# 2026-07-01

## Directory Migration Path Updates

- Updated `in.md` backend instructions to use flattened project-root paths: `supabase/schema.sql`, `scripts/sync_validation_data.py`, `validation_manifest.csv`, `validation_svgs_v1/*.svg`, `index.html`, and `pages/**`.
- Updated `legacy_apps_script/BatchUpload.js` local manifest-generation recipe to derive `validation_svgs_v1` and `validation_manifest.csv` from the current `CLAY_site` working directory instead of the old `validation_site` subdirectory.
- Updated `build_validation_svgs.py` so validation SVG output resolves inside `CLAY_site/validation_svgs_v1`, while layout inputs resolve from sibling `BIGSMILES_clay/layout` by default. Added `CLAY_LAYOUT_REPO_ROOT` support for overriding the layout repository location.
- Verified `scripts/sync_validation_data.py --dry-run` reads `validation_manifest.csv` and prepares 460 entries from the flattened root paths.
- Verified `build_validation_svgs.py` resolves `C:\Users\ChemEGrad2025\Documents\MIT\Research\BIGSMILES_clay\layout` and that the directory exists.
- Verified Python syntax with `python -m py_compile build_validation_svgs.py scripts\sync_validation_data.py`.
- Verified whitespace with `git diff --check`.

## Local Supabase Environment Loading

- Added optional `.env.local` loading to `scripts/sync_validation_data.py`; values in the file fill missing local environment variables, while shell variables and CLI flags still take precedence.
- Added `.env.local` to `.gitignore` so local Supabase credentials are not committed.
- Updated `in.md` to separate hosted Edge Function secrets from local uploader credentials and remove the invalid `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...` instruction.
- Verified `.env.local` parsing with a temporary PowerShell-created UTF-8 file, including quoted values and `SUPABASE_SERVICE_ROLE_KEY`.
- Verified `python scripts\sync_validation_data.py --dry-run` still prepares 460 entries.

## GitHub Pages Frontend Deployment Guide

- Added a `Deploy Frontend to GitHub Pages` section to `in.md`.
- Documented that the deployable frontend is the static `pages/` directory and that GitHub Actions should be used because the site is not in the repository root or `docs/`.
- Added the repository variable setup for `VALIDATION_API_BASE_URL` and optional `SUPABASE_ANON_KEY`.
- Added a complete `.github/workflows/deploy-validation-site.yml` example that generates `pages/config.js`, uploads `pages/` as the Pages artifact, includes hidden files so `pages/.nojekyll` is preserved, and deploys with `actions/deploy-pages`.
- Verified the Markdown edit with `git diff --check -- in.md`.

## GitHub Pages Workflow YAML Fix

- Fixed `.github/workflows/deploy-validation-site.yml` after its nested `on`, `permissions`, `concurrency`, and `jobs` sections lost indentation.
- Verified the corrected workflow file parses as YAML with PyYAML.
- Verified whitespace with `git diff --check -- .github/workflows/deploy-validation-site.yml`.

## Explicit SVG Directory Flag for Sync

- Removed the fixed `DEFAULT_SVG_DIR` path from `scripts/sync_validation_data.py`.
- Made `--svg-dir` a required terminal flag so each sync run explicitly selects the SVG directory referenced by the manifest.
- Updated `in.md` backend sync examples to pass `--svg-dir site_svgs_260701` for normal uploads, exported entry state migration, and exported comment migration.
- Verified `python -m py_compile scripts\sync_validation_data.py`.
- Verified `python scripts\sync_validation_data.py --dry-run` fails with argparse's required `--svg-dir` error.
- Verified `python scripts\sync_validation_data.py --svg-dir site_svgs_260701 --dry-run` prepares 643 entries and 0 comments.
- Verified whitespace with `git diff --check -- scripts/sync_validation_data.py in.md`.

## SVG Default Scale and Touchpad Navigation

- Updated `index.html` SVG viewport initialization and Restore View behavior to use a centered `DEFAULT_SVG_SCALE = 0.5`, so SVG layouts display at 50% size by default.
- Added trackpad wheel handling in `index.html`: pinch/`ctrlKey` wheel events zoom around the cursor, while likely two-finger scroll wheel events pan the SVG canvas.
- Appended `in.md` frontend re-implementation notes documenting the 50% default view state and trackpad pan/zoom behavior.
- Verified inline JavaScript parsing with Node `vm.Script`.
- Verified whitespace with `git diff --check -- index.html in.md`.

## Startup Validation Key Gate

- Updated `supabase/functions/validation-api/index.ts` so `GET /me` validates `x-validation-key` with the same `VALIDATION_REVIEW_KEY` guard used by write routes.
- Updated `pages/index.html` and `index.html` so initialization verifies the reviewer key through `/me` before loading entries, and saving reviewer settings keeps the settings panel open on an invalid key.
- Added an inline settings-panel error message for invalid reviewer keys instead of allowing entries to load before write actions fail.
- Updated `in.md` with redeployment instructions for Edge Function changes and GitHub Pages frontend changes.
- Verified inline JavaScript parsing for `pages/index.html` and `index.html` with `node --check`.
- Verified Edge Function TypeScript with `deno check supabase/functions/validation-api/index.ts`.
- Verified whitespace with `git diff --check -- pages/index.html index.html supabase/functions/validation-api/index.ts in.md`.
