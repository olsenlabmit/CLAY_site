"""Build non-debug validation SVGs from the current layout output set."""

from __future__ import annotations

import json
import os
import re
import shutil
import sys
import tempfile
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
LAYOUT_DIR = REPO_ROOT / "layout"
LAYOUT_OUTPUT_DIR = LAYOUT_DIR / "output"
VALIDATION_SVG_DIR = Path(__file__).resolve().parent / "validation_svgs_v1"
FINAL_DIR_PATTERN = re.compile(r"^entry_(\d+)_")
INVALID_FILENAME_CHARS = re.compile(r'[<>:"/\\|?*\x00-\x1f]')
TARGET_LAYER_KEYS = frozenset({"F0", "F1"})


def _load_layout_module():
    os.environ.pop("LAYOUT_DEBUG", None)
    sys.path.insert(0, str(LAYOUT_DIR))

    import fragment_layout_substitution as layout  # noqa: PLC0415

    layout.LAYOUT_DEBUG = False
    return layout


def _current_final_svg_specs() -> list[tuple[int, str, Path]]:
    specs: list[tuple[int, str, Path]] = []
    for svg_path in LAYOUT_OUTPUT_DIR.glob("entry_*/*_final.svg"):
        match = FINAL_DIR_PATTERN.match(svg_path.parent.name)
        if match is None:
            continue
        specs.append((int(match.group(1)), svg_path.name, svg_path.with_suffix(".json")))
    return sorted(specs)


def _prepare_output_dir() -> None:
    VALIDATION_SVG_DIR.mkdir(parents=True, exist_ok=True)
    for svg_path in VALIDATION_SVG_DIR.glob("*.svg"):
        svg_path.unlink()


def _safe_filename_component(value: object) -> str:
    name = INVALID_FILENAME_CHARS.sub("_", str(value)).strip(" .")
    return name or "unnamed"


def _validation_svg_name(entry: dict[str, object]) -> str:
    if "index" not in entry:
        raise ValueError("entry is missing dataset index")
    dataset_index = _safe_filename_component(entry["index"])
    name = _safe_filename_component(entry.get("name", "unnamed"))
    return f"{dataset_index} - {name}.svg"


def _has_target_layer_shape(layout: object, entry: dict[str, object]) -> bool:
    work_items = layout.enumerate_entry_fragment_work_items(entry)
    return {item["layer_key"] for item in work_items} == TARGET_LAYER_KEYS


def _payload_has_atom(payload: object, atom_symbol: str) -> bool:
    if isinstance(payload, dict):
        if payload.get("atom") == atom_symbol:
            return True
        return any(_payload_has_atom(value, atom_symbol) for value in payload.values())
    if isinstance(payload, list):
        return any(_payload_has_atom(value, atom_symbol) for value in payload)
    return False


def _final_json_has_atom(final_json_path: Path, atom_symbol: str) -> bool:
    payload = json.loads(final_json_path.read_text(encoding="utf-8"))
    return _payload_has_atom(payload, atom_symbol)


def main() -> None:
    layout = _load_layout_module()
    entries = layout._validate_clean_layout_entries(
        json.loads(layout.DATA_PATH.read_text(encoding="utf-8"))
    )
    specs = _current_final_svg_specs()
    if not specs:
        raise SystemExit(f"No final SVGs found under {LAYOUT_OUTPUT_DIR}")

    _prepare_output_dir()
    failures: list[str] = []
    target_specs: list[tuple[int, str]] = []
    skipped_r_atom_count = 0

    for entry_index, source_svg_name, source_json_path in specs:
        if entry_index >= len(entries):
            failures.append(
                f"{source_svg_name}: entry index {entry_index} is out of range"
            )
            continue
        if not source_json_path.exists():
            failures.append(f"{source_svg_name}: missing {source_json_path.name}")
            continue
        if _has_target_layer_shape(layout, entries[entry_index]):
            if _final_json_has_atom(source_json_path, "R"):
                skipped_r_atom_count += 1
                continue
            target_specs.append((entry_index, source_svg_name))

    with tempfile.TemporaryDirectory(prefix="validation_svg_layout_") as tmp_dir:
        layout.OUTPUT_ROOT = Path(tmp_dir)

        for entry_index, source_svg_name in target_specs:
            entry = entries[entry_index]
            try:
                output_svg_name = _validation_svg_name(entry)
                final_scene, _ = layout.assemble_entry(entry, entry_index)
            except Exception as exc:  # pragma: no cover - command-line reporting
                failures.append(f"{source_svg_name}: {exc}")
                continue

            if final_scene is None:
                failures.append(f"{source_svg_name}: no final scene was produced")
                continue

            layout.save_final_scene_svg(
                final_scene,
                VALIDATION_SVG_DIR / output_svg_name,
                debug=False,
            )

    if failures:
        shutil.rmtree(VALIDATION_SVG_DIR, ignore_errors=True)
        raise SystemExit("Failed to build validation SVGs:\n" + "\n".join(failures))

    print(
        f"Wrote {len(target_specs)} SVGs to {VALIDATION_SVG_DIR} "
        f"(skipped {skipped_r_atom_count} entries with R atoms)"
    )


if __name__ == "__main__":
    main()
