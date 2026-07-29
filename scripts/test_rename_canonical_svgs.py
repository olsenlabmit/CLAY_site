from __future__ import annotations

import csv
from pathlib import Path
import tempfile
import unittest

from scripts.rename_canonical_svgs import RenameError, rename_canonical_svgs


class RenameCanonicalSvgsTests(unittest.TestCase):
    def write_manifest(self, path: Path, rows: list[tuple[str, str]]) -> None:
        with path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=["index", "SVG-file-name"])
            writer.writeheader()
            for index, filename in rows:
                writer.writerow({"index": index, "SVG-file-name": filename})

    def test_renames_only_files_in_accepted_subset(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            canonical = root / "canonical-20260728T150405Z"
            canonical.mkdir()
            (canonical / "2.svg").write_text("<svg>two</svg>", encoding="utf-8")
            (canonical / "10.svg").write_text("<svg>ten</svg>", encoding="utf-8")
            manifest = root / "validation_manifest.csv"
            self.write_manifest(
                manifest,
                [
                    ("1", "one.svg"),
                    ("2", "2 - two.svg"),
                    ("10", "10 - ten.svg"),
                ],
            )

            changed = rename_canonical_svgs(canonical, manifest)

            self.assertEqual(changed, 2)
            self.assertEqual(
                sorted(path.name for path in canonical.iterdir()),
                ["10 - ten.svg", "2 - two.svg"],
            )
            self.assertEqual(
                (canonical / "2 - two.svg").read_text(encoding="utf-8"),
                "<svg>two</svg>",
            )

    def test_validation_failure_leaves_all_files_unchanged(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            canonical = root / "canonical-20260728T150405Z"
            canonical.mkdir()
            original = {
                "2.svg": "<svg>two</svg>",
                "10.svg": "<svg>ten</svg>",
            }
            for filename, content in original.items():
                (canonical / filename).write_text(content, encoding="utf-8")
            manifest = root / "validation_manifest.csv"
            self.write_manifest(
                manifest,
                [
                    ("2", "same.svg"),
                    ("10", "same.svg"),
                ],
            )

            with self.assertRaises(RenameError):
                rename_canonical_svgs(canonical, manifest)

            self.assertEqual(
                {
                    path.name: path.read_text(encoding="utf-8")
                    for path in canonical.iterdir()
                },
                original,
            )


if __name__ == "__main__":
    unittest.main()
