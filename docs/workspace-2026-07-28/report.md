# Work report — 2026-07-28

## Accepted SVG export and filtered sorting

- Added a reviewer-key-protected accepted-SVG ZIP route backed by a pinned, store-only ZIP helper.
- Added latest-comment timestamps to the entry collection and comment-create response without changing the database schema.
- Replaced the last-modified checkbox with newest-first Update time and Latest comment sorting.
- Consolidated entry search, state filters, error-mode filters, sorting, and rendering into one collection-first refresh pipeline.
- Added the header ZIP download action with binary-safe error handling and duplicate-click prevention.
- Added an all-or-nothing manifest rename utility plus accepted-subset success and validation-failure tests.
- Updated the site manual with export, extraction, renaming, and backend deployment guidance.

## Validation results

- `deno check supabase/functions/validation-api/index.ts` — passed.
- `deno test supabase/functions/validation-api/canonical_export_test.ts` — passed (1 test).
- `python -m unittest scripts.test_rename_canonical_svgs` — passed (2 tests).
- `git diff --check` — passed.
- Full `deno test supabase/functions/validation-api` regression run — passed (10 tests).
- Frontend inline JavaScript syntax parse with Node.js — passed.
- Python bytecode compilation for the rename utility and tests — passed.
