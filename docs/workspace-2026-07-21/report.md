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
