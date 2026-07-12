## Suboptimal BIGSMILES error mode

- Added `suboptimal_bigsmiles` / `Suboptimal BIGSMILES` to the frontend `ERROR_MODES` list, so the review panel renders it with the existing error-mode controls.
- Added `suboptimal_bigsmiles` to the validation API allowlist so `PATCH /entries/:entryIndex/error-modes` accepts and persists it while unknown ids remain rejected by the existing parser.
- Replaced the left-panel always-expanded error filter list with a compact `<details>` dropdown that keeps checkbox multi-select behavior and OR filtering semantics.
- Added a dropdown summary that displays selected error mode labels and falls back to `Any error mode`.
- Confirmed the existing Acceptable mutual exclusion paths still apply: setting Acceptable clears `error_modes`, and setting any error mode clears `checked`.
- Verified inline JavaScript syntax with `node --check` on the extracted script.
- Verified the Supabase function with `deno.cmd check supabase/functions/validation-api/index.ts`.
- Checked literal `getElementById(...)` references; new dropdown ids resolve, and the pre-existing `svg-hit-rect` reference is created dynamically before use.

## Last modified filter and MOL downloads

- Added `mol` and `mol_file_name` columns to `public.entries`, including compatibility `alter table ... add column if not exists` statements.
- Updated `scripts/sync_validation_data.py` so `--mol-dir` is required, `MOL-file-name` is read from `validation_manifest.csv`, missing MOL references fail before upload, and each entry upsert includes MOL text plus the stored filename.
- Extended the validation API so entry list/detail and review update responses include database-backed `updatedAt`; entry detail also returns `mol` and `molFileName`.
- Added frontend timestamp tracking that computes entries tied for the newest parsed `updatedAt`, marks them with `data-last-modified`, and highlights only their `.ei-idx` text in orange.
- Added a left-panel `Last modified` checkbox that filters conjunctively with search, comment, acceptable, and error-mode filters.
- Updated Acceptable and error-mode save handlers so returned `updatedAt` values refresh the local timestamp cache, row datasets, highlights, and active filters.
- Added a right-side BigSMILES bar download icon that appears only for selected entries with MOL content and downloads a `chemical/x-mdl-molfile` Blob using the Supabase-provided `.mol` filename.
- Verified sync loading with `python scripts/sync_validation_data.py --svg-dir site_svgs_260712 --mol-dir site_mols_260712 --dry-run`; it prepared 643 entries and 0 comments.
- Verified the Supabase function with `deno.cmd check supabase/functions/validation-api/index.ts`.
- Verified inline JavaScript syntax by extracting the inline script from `pages/index.html` and running `node --check` on the extracted file.
