# 2026-07-21

## Error Rate Live Update

- Added an Error Modes/statistics toggle to `pages/index.html`. Statistics mode retains its state while entries change, returns to the selected entry checklist, renders a keyboard-accessible seven-category CSS bar chart, formats tooltips to at most two decimals, and provides refresh, JSON, and CSV controls.
- Added frontend loading, retry/error, zero-classified, and narrow-panel horizontal-overflow states. Statistics are fetched only when opened, manually refreshed, or after a successful acceptable/error-mode save; no polling was added.
- Added fresh `checked,error_modes` aggregation routes at `GET /statistics` and `GET /statistics.csv` in `validation-api`, including `Cache-Control: no-store`, CSV attachment headers, recognized-mode deduplication, independent multi-error counts, and Acceptable counts.
- Added pure aggregation and CSV helpers in `statistics.ts` plus nine Deno tests covering empty/zero-classified data, acceptable/unclassified entries, multi-error and duplicate modes, percentages, category order/abbreviations, and CSV escaping/shape.

### Validation results

- `deno.cmd check supabase/functions/validation-api/index.ts`: passed.
- `deno.cmd test supabase/functions/validation-api/statistics_test.ts`: 9 passed, 0 failed.
- `git diff --check`: passed.
- Browser QA against local mock responses: verified chart persistence through entry selection, return to the selected checklist, all seven accessible bar labels/tooltips, focus-visible tooltip behavior, 263px-to-540px horizontal overflow, and no console errors.

### Deployment results

- Deployed only `validation-api` to Supabase project `gczdijnfrsgzctqxodov` with `--no-verify-jwt`; deployment uploaded `index.ts` and `statistics.ts` successfully.
- Deployed JSON and CSV routes returned HTTP 200 with `Cache-Control: no-store`; JSON used `application/json`, and CSV used `text/csv; charset=utf-8` plus an attachment disposition.
- Deployed totals matched `/entries`: 643 total, 0 classified, seven CSV/category rows, and every category count matched an independent recomputation.
- Recomputed live after a reversible classification write: entry `0` changed the aggregate to 1 classified/1 acceptable, then its original classification was restored and the aggregate returned to 0 classified/0 acceptable with a new generation timestamp.
- The GitHub Pages frontend was not committed, pushed, published, or deployed.

## Responsive Error-Rate Chart

- Replaced the chart's fixed 540px minimum width and horizontal scroll wrapper with fluid grid tracks in `pages/index.html`; all seven bars and abbreviated labels now contract and expand with the error-modes panel.
- Added responsive plot gaps and padding plus first/last tooltip edge alignment, while retaining the 38px bar-fill cap, percentage heights, keyboard-accessible tooltips, and distinct Acceptable styling.
- Browser QA with local mock statistics passed at approximately 262px, 399px, and 539px panel widths: chart and section scroll widths matched their client widths, all seven bars and labels stayed aligned, and no horizontal scrollbar appeared.
- Narrow-panel focus checks confirmed both edge tooltips remained inside the plotting region. At a 300px viewport height, the section retained vertical scrolling while the chart still had no horizontal overflow.
- A clean local browser run rendered the statistics panel with no console errors, and `git diff --check` passed.

## Review-State-Preserving Asset Sync

- Updated `scripts/sync_validation_data.py` so ordinary uploads first read existing entry indices and stored BIGSMILES values, then upsert only each entry identity and its SVG, MOL, and MOL filename. Existing annotations, acceptable state, error modes, BIGSMILES, and related comments are preserved; new rows use manifest BIGSMILES and database review-state defaults.
- Kept `--entries-csv` as an explicit full-state migration override that imports annotations, acceptable state, and error modes.
- Added paginated existing-entry reads and unit coverage for preserved state, new rows, explicit migration overrides, pagination, and upload batching.
- Updated `in.md` to document normal preservation behavior, the migration override, and the required MOL directory for comment imports.

### Validation results

- `python -m unittest scripts.test_sync_validation_data`: 4 passed, 0 failed.
- `python -m py_compile scripts/sync_validation_data.py scripts/test_sync_validation_data.py`: passed.
- The requested `site_svgs_260712` / `site_mols_260712` dry run could not run because those directories are absent from this checkout.
- `python scripts/sync_validation_data.py --svg-dir site_svgs_260721 --mol-dir site_mols_260721 --dry-run`: prepared 643 entries and 0 comments.
- `git diff --check`: passed.

### Follow-up

- Removed `scripts/test_sync_validation_data.py` to keep the workspace lightweight. Future tests will only be added when explicitly requested.
