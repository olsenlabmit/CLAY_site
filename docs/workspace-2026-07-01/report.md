# 2026-07-01

## Directory Migration Path Updates

- Updated `in.md` backend instructions to use flattened project-root paths: `supabase/schema.sql`, `scripts/sync_validation_data.py`, `validation_manifest.csv`, `validation_svgs_v1/*.svg`, `index.html`, and `pages/**`.
- Updated `legacy_apps_script/BatchUpload.js` local manifest-generation recipe to derive `validation_svgs_v1` and `validation_manifest.csv` from the current `CLAY_site` working directory instead of the old `validation_site` subdirectory.
- Updated `build_validation_svgs.py` so validation SVG output resolves inside `CLAY_site/validation_svgs_v1`, while layout inputs resolve from sibling `BIGSMILES_clay/layout` by default. Added `CLAY_LAYOUT_REPO_ROOT` support for overriding the layout repository location.
- Verified `scripts/sync_validation_data.py --dry-run` reads `validation_manifest.csv` and prepares 460 entries from the flattened root paths.
- Verified `build_validation_svgs.py` resolves `C:\Users\ChemEGrad2025\Documents\MIT\Research\BIGSMILES_clay\layout` and that the directory exists.
- Verified Python syntax with `python -m py_compile build_validation_svgs.py scripts\sync_validation_data.py`.
- Verified whitespace with `git diff --check`.
