## Suboptimal BIGSMILES error mode

- Added `suboptimal_bigsmiles` / `Suboptimal BIGSMILES` to the frontend `ERROR_MODES` list, so the review panel renders it with the existing error-mode controls.
- Added `suboptimal_bigsmiles` to the validation API allowlist so `PATCH /entries/:entryIndex/error-modes` accepts and persists it while unknown ids remain rejected by the existing parser.
- Replaced the left-panel always-expanded error filter list with a compact `<details>` dropdown that keeps checkbox multi-select behavior and OR filtering semantics.
- Added a dropdown summary that displays selected error mode labels and falls back to `Any error mode`.
- Confirmed the existing Acceptable mutual exclusion paths still apply: setting Acceptable clears `error_modes`, and setting any error mode clears `checked`.
- Verified inline JavaScript syntax with `node --check` on the extracted script.
- Verified the Supabase function with `deno.cmd check supabase/functions/validation-api/index.ts`.
- Checked literal `getElementById(...)` references; new dropdown ids resolve, and the pre-existing `svg-hit-rect` reference is created dynamically before use.
