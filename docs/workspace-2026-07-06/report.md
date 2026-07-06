# 2026-07-06

- Added the deployed `pages/index.html` review sidebar with a top Error Modes panel and bottom Comment History panel sharing the existing resizable right column.
- Renamed the UI-facing checked filter/control language to Acceptable while preserving the backend `checked` field.
- Added persistent frontend error-mode state, multi-select error-mode filtering with OR semantics, and mutual exclusion between Acceptable and selected error modes.
- Added `entries.error_modes text[] not null default '{}'::text[]` to `supabase/schema.sql`, including an `alter table` for existing databases.
- Updated `supabase/functions/validation-api/index.ts` so entry list/detail responses include `checked` and `errorModes`, checked writes clear error modes when set true, and `PATCH /entries/:entryIndex/error-modes` validates/saves allowed ids while clearing `checked`.
- Updated `scripts/sync_validation_data.py` to import `error_modes` from migration CSVs when present, default to an empty list, and keep imported acceptable state mutually exclusive with error modes.
- Verified `pages/index.html` inline JavaScript parses, all `getElementById` references resolve when dynamic SVG/editor ids are included, `scripts/sync_validation_data.py` compiles, and `deno check supabase/functions/validation-api/index.ts` passes.
