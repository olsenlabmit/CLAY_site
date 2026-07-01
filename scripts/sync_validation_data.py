from __future__ import annotations

import argparse
import csv
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib import error, parse, request


REPO_VALIDATION_DIR = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = REPO_VALIDATION_DIR / "validation_manifest.csv"
DEFAULT_SVG_DIR = REPO_VALIDATION_DIR / "validation_svgs_v1"


def _cell(row: dict[str, str], *names: str) -> str:
    lowered = {key.strip().lower(): value for key, value in row.items() if key}
    for name in names:
        value = lowered.get(name.strip().lower())
        if value is not None:
            return str(value).strip()
    return ""


def _read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))


def _parse_bool(value: str) -> bool:
    text = str(value or "").strip().lower()
    if not text:
        return False
    if text in {"true", "yes", "y", "1", "checked"}:
        return True
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        return False
    return parsed is True or (isinstance(parsed, list) and len(parsed) > 0)


def _parse_annotations(value: str) -> list[Any]:
    if not value:
        return []
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return []
    return parsed if isinstance(parsed, list) else []


def _parse_timestamp(value: str) -> str | None:
    text = str(value or "").strip()
    if not text:
        return None
    for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%d %H:%M:%S", "%m/%d/%Y %H:%M:%S"):
        try:
            return datetime.strptime(text, fmt).isoformat()
        except ValueError:
            pass
    try:
        return datetime.fromisoformat(text).isoformat()
    except ValueError:
        return None


def _load_entry_migration(path: Path | None) -> dict[str, dict[str, Any]]:
    if path is None:
        return {}
    rows: dict[str, dict[str, Any]] = {}
    for row in _read_csv(path):
        entry_index = _cell(row, "index", "entryindex", "entry_index")
        if not entry_index:
            continue
        rows[entry_index] = {
            "annotations": _parse_annotations(_cell(row, "annotations")),
            "checked": _parse_bool(_cell(row, "checked", "bookmarks", "bookmark")),
        }
    return rows


def _load_manifest_entries(
    manifest_path: Path,
    svg_dir: Path,
    migration_rows: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    missing_svgs: list[str] = []
    for row in _read_csv(manifest_path):
        entry_index = _cell(row, "index", "entry_index")
        bigsmiles = _cell(row, "bigsmiles")
        svg_name = _cell(row, "svg-file-name", "svg file name", "svg_file_name", "svg")
        if not entry_index or not svg_name:
            continue
        svg_path = svg_dir / svg_name
        if not svg_path.exists():
            missing_svgs.append(svg_name)
            continue
        migration = migration_rows.get(entry_index, {})
        entries.append(
            {
                "entry_index": entry_index,
                "bigsmiles": bigsmiles,
                "svg": svg_path.read_text(encoding="utf-8"),
                "annotations": migration.get("annotations", []),
                "checked": bool(migration.get("checked", False)),
            }
        )
    if missing_svgs:
        preview = ", ".join(missing_svgs[:20])
        raise SystemExit(f"Manifest rows reference missing SVG files: {preview}")
    return entries


def _load_comments(path: Path | None) -> list[dict[str, Any]]:
    if path is None:
        return []
    comments: list[dict[str, Any]] = []
    for row in _read_csv(path):
        entry_index = _cell(row, "entryindex", "entry_index", "index")
        if not entry_index:
            continue
        created_at = _parse_timestamp(_cell(row, "timestamp", "created_at", "created at"))
        comment = {
            "entry_index": entry_index,
            "reviewer_email": _cell(row, "email", "reviewer_email") or None,
            "reviewer_name": _cell(row, "name", "reviewer_name") or "Unknown",
            "text": _cell(row, "text", "comment"),
            "image_url": _cell(row, "imageurl", "image_url", "image url") or None,
        }
        if created_at:
            comment["created_at"] = created_at
        comments.append(comment)
    return comments


class SupabaseRest:
    def __init__(self, url: str, key: str) -> None:
        self.base_url = url.rstrip("/")
        self.key = key

    def request(
        self,
        method: str,
        path: str,
        payload: Any | None = None,
        prefer: str | None = None,
    ) -> Any:
        body = None if payload is None else json.dumps(payload).encode("utf-8")
        headers = {
            "apikey": self.key,
            "authorization": f"Bearer {self.key}",
            "accept": "application/json",
        }
        if body is not None:
            headers["content-type"] = "application/json"
        if prefer:
            headers["prefer"] = prefer
        req = request.Request(
            f"{self.base_url}/rest/v1/{path}",
            data=body,
            headers=headers,
            method=method,
        )
        try:
            with request.urlopen(req) as response:
                raw = response.read().decode("utf-8")
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise SystemExit(f"Supabase request failed: {exc.code} {detail}") from exc
        return json.loads(raw) if raw else None

    def upsert_entries(self, entries: list[dict[str, Any]], batch_size: int) -> int:
        total = 0
        for start in range(0, len(entries), batch_size):
            batch = entries[start : start + batch_size]
            self.request(
                "POST",
                "entries?on_conflict=entry_index",
                batch,
                "resolution=merge-duplicates,return=minimal",
            )
            total += len(batch)
        return total

    def delete_comments(self) -> None:
        self.request("DELETE", "comments?id=not.is.null", prefer="return=minimal")

    def insert_comments(self, comments: list[dict[str, Any]], batch_size: int) -> int:
        total = 0
        for start in range(0, len(comments), batch_size):
            batch = comments[start : start + batch_size]
            self.request("POST", "comments", batch, "return=minimal")
            total += len(batch)
        return total


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Sync validation entries to Supabase.")
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--svg-dir", type=Path, default=DEFAULT_SVG_DIR)
    parser.add_argument("--entries-csv", type=Path, help="Optional exported Entries sheet CSV.")
    parser.add_argument("--comments-csv", type=Path, help="Optional exported Comments sheet CSV.")
    parser.add_argument(
        "--replace-comments",
        action="store_true",
        help="Delete existing comments before importing --comments-csv.",
    )
    parser.add_argument("--batch-size", type=int, default=50)
    parser.add_argument("--supabase-url", default=os.environ.get("SUPABASE_URL", ""))
    parser.add_argument(
        "--service-role-key",
        default=os.environ.get("SUPABASE_SERVICE_ROLE_KEY", ""),
    )
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    manifest = args.manifest.resolve()
    svg_dir = args.svg_dir.resolve()
    if not manifest.exists():
        raise SystemExit(f"Manifest not found: {manifest}")
    if not svg_dir.is_dir():
        raise SystemExit(f"SVG directory not found: {svg_dir}")

    migration_rows = _load_entry_migration(args.entries_csv)
    entries = _load_manifest_entries(manifest, svg_dir, migration_rows)
    svg_count = len(list(svg_dir.glob("*.svg")))
    if len(entries) != svg_count:
        raise SystemExit(
            f"Manifest/SVG count mismatch: {len(entries)} manifest rows for {svg_count} SVG files"
        )

    comments = _load_comments(args.comments_csv)
    print(f"Prepared {len(entries)} entries from {manifest}")
    print(f"Prepared {len(comments)} comments for import")
    if args.dry_run:
        return
    if not args.supabase_url or not args.service_role_key:
        raise SystemExit("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or pass CLI flags.")

    client = SupabaseRest(args.supabase_url, args.service_role_key)
    imported_entries = client.upsert_entries(entries, args.batch_size)
    print(f"Upserted {imported_entries} entries")
    if comments:
        if args.replace_comments:
            client.delete_comments()
            print("Deleted existing comments")
        imported_comments = client.insert_comments(comments, args.batch_size)
        print(f"Inserted {imported_comments} comments")


if __name__ == "__main__":
    main()
