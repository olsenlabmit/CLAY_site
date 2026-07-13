## MOL download button deployment fix

- Confirmed the deployed `GET /entries/2` response was stale before redeploy: it returned `index,bigsmiles,svg,annotations,checked,errorModes` with no `mol` or `molFileName`.
- Deployed the updated Supabase Edge Function with `supabase.cmd functions deploy validation-api --project-ref gczdijnfrsgzctqxodov --no-verify-jwt`.
- Verified the deployed `GET /entries/2` response now includes `mol` and `molFileName`; `mol` length was 2341 and filename was `2 - polytetrafluoroethylene [PTFE, Teflon].mol`.
- Added a clearer sync-script diagnostic for Supabase `PGRST204` schema-cache errors so missing `mol`, `mol_file_name`, or `error_modes` columns point to rerunning `supabase/schema.sql` and reloading PostgREST.
- Updated `in.md` with the required `--mol-dir` sync examples, minimum MOL schema SQL, and a troubleshooting note that a hidden MOL download button after sync usually means the deployed Edge Function is stale.
- Verified `scripts/sync_validation_data.py` compiles with `python -m py_compile`.
- Verified dry-run sync with `python scripts/sync_validation_data.py --svg-dir site_svgs_260712 --mol-dir site_mols_260712 --dry-run`.
- Verified the Supabase function with `deno.cmd check supabase/functions/validation-api/index.ts`.

## MOL download button color

- Updated the MOL download button in `pages/index.html` to use the same active and hover color values as the bottom Post Comment button: `rgba(88,166,255,.14)`, `#dbeafe`, `rgba(88,166,255,.28)`, and `rgba(88,166,255,.22)` on hover.
- Verified CSS whitespace with `git diff --check -- pages/index.html`.
