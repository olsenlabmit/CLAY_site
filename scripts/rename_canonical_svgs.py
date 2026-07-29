"""Rename downloaded canonical Index.svg files using validation_manifest.csv."""

from __future__ import annotations

import argparse
import csv
import os
from pathlib import Path
import re
import sys


class RenameError(ValueError):
    """Raised when rename preflight validation fails."""


_WINDOWS_RESERVED_NAMES = {
    "CON",
    "PRN",
    "AUX",
    "NUL",
    *(f"COM{number}" for number in range(1, 10)),
    *(f"LPT{number}" for number in range(1, 10)),
}


def _column(fieldnames: list[str] | None, expected: str) -> str:
    matches = [
        name for name in (fieldnames or [])
        if name.strip().casefold() == expected.casefold()
    ]
    if len(matches) != 1:
        raise RenameError(f"Manifest must contain exactly one {expected!r} column.")
    return matches[0]


def _safe_svg_filename(value: str) -> str:
    filename = value.strip()
    if not filename:
        raise RenameError("Manifest contains an empty SVG-file-name.")
    if filename in {".", ".."} or Path(filename).name != filename:
        raise RenameError(f"Unsafe SVG filename: {filename!r}")
    if re.search(r'[<>:"/\\|?*\x00-\x1f]', filename):
        raise RenameError(f"Unsafe SVG filename: {filename!r}")
    if filename.endswith((" ", ".")):
        raise RenameError(f"Unsafe SVG filename: {filename!r}")
    if Path(filename).stem.upper() in _WINDOWS_RESERVED_NAMES:
        raise RenameError(f"Unsafe SVG filename: {filename!r}")
    if Path(filename).suffix.casefold() != ".svg":
        raise RenameError(f"Target is not an SVG filename: {filename!r}")
    return filename


def _read_manifest(manifest: Path) -> dict[str, str]:
    try:
        handle = manifest.open("r", encoding="utf-8-sig", newline="")
    except OSError as exc:
        raise RenameError(f"Could not read manifest {manifest}: {exc}") from exc

    with handle:
        reader = csv.DictReader(handle)
        index_column = _column(reader.fieldnames, "index")
        svg_column = _column(reader.fieldnames, "SVG-file-name")
        mappings: dict[str, str] = {}
        for row_number, row in enumerate(reader, start=2):
            index = str(row.get(index_column) or "").strip()
            if not index:
                raise RenameError(f"Manifest row {row_number} has a missing index.")
            if index in mappings:
                raise RenameError(f"Manifest contains duplicate index {index!r}.")
            mappings[index] = str(row.get(svg_column) or "")
    return mappings


def plan_renames(canonical_folder: Path, manifest: Path) -> list[tuple[Path, Path]]:
    """Validate the complete operation and return source/target path pairs."""
    folder = canonical_folder.resolve()
    if not folder.is_dir():
        raise RenameError(f"Canonical folder does not exist: {canonical_folder}")

    mappings = _read_manifest(manifest.resolve())
    svg_files = [path for path in folder.iterdir() if path.is_file() and path.suffix.casefold() == ".svg"]
    source_by_index: dict[str, Path] = {}
    for path in svg_files:
        if path.stem not in mappings:
            continue
        if path.stem in source_by_index:
            raise RenameError(f"Downloaded folder contains duplicate index {path.stem!r}.")
        source_by_index[path.stem] = path
    unknown_sources = sorted(path.name for path in svg_files if path.stem not in mappings)
    if unknown_sources:
        raise RenameError(
            "Downloaded SVG index is missing from the manifest: "
            + ", ".join(unknown_sources)
        )

    planned: list[tuple[Path, Path]] = []
    targets: dict[str, Path] = {}
    existing_by_name = {path.name.casefold(): path for path in folder.iterdir()}
    for index, source in source_by_index.items():
        filename = _safe_svg_filename(mappings[index])
        target = folder / filename
        target_key = os.path.normcase(filename).casefold()
        if target_key in targets and targets[target_key] != source:
            raise RenameError(f"Duplicate target filename: {filename!r}")
        targets[target_key] = source
        planned.append((source, target))

    source_paths = {source.resolve() for source, _ in planned}
    for source, target in planned:
        if target.resolve() == source.resolve():
            continue
        collision = existing_by_name.get(target.name.casefold())
        if (
            (collision is not None and collision.resolve() != source.resolve())
            or target.resolve() in source_paths
        ):
            raise RenameError(f"Target filename collides with an existing file: {target.name!r}")

    return sorted(planned, key=lambda pair: pair[0].name.casefold())


def rename_canonical_svgs(canonical_folder: Path, manifest: Path) -> int:
    """Preflight and then perform all requested renames."""
    planned = plan_renames(canonical_folder, manifest)
    changed = 0
    for source, target in planned:
        if source.resolve() == target.resolve():
            continue
        source.rename(target)
        changed += 1
    return changed


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Rename extracted canonical <Index>.svg files to SVG-file-name values "
            "from the validation manifest."
        )
    )
    parser.add_argument("canonical_folder", type=Path)
    parser.add_argument(
        "--manifest",
        type=Path,
        default=Path("validation_manifest.csv"),
        help="Manifest CSV path (default: validation_manifest.csv).",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    try:
        changed = rename_canonical_svgs(args.canonical_folder, args.manifest)
    except RenameError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    print(f"Renamed {changed} SVG file(s) in {args.canonical_folder}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
