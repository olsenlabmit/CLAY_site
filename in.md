# Validation Site Manual

## Frontend

1. Open the GitHub Pages URL for the validation site.
2. If the settings panel opens, enter:
   - Reviewer name: the display name saved with new comments.
   - Shared review key: the write key used for checked state, annotations, and comments.
   - Validation API base URL: only needed for local/manual use when `config.js` is not present.
3. To update those values later, click the reviewer badge in the header.
4. Browse entries in the left panel. Use Search index to filter by entry index.
5. Use Comment and Checked filters to show all entries, only commented/checked entries, or entries without those states.
6. Select an entry to load its BIGSMILES string, SVG layout, saved annotations, and comment history.
7. Pan the SVG by dragging the canvas. Zoom with the mouse wheel. Use Restore View to reset the view.
8. Use Line or Text to add annotations. Choose color, line width, and text size from the toolbar.
9. Click Save to persist annotations. Saved annotations reload with the entry.
10. Click the check button beside an entry to mark it checked or unchecked.
11. Add text comments in the composer. Attach an image with the file picker when needed.
12. Posted comments appear in Comment History. Click a comment card to expand it. Click a comment image to view it full size.

## Deploy Frontend to GitHub Pages

This repository's deployable frontend is the static site in `pages/`. Use GitHub Actions as the Pages source because GitHub Pages branch publishing only serves the repository root or `docs/`, while this project keeps the public site in `pages/`.

1. Confirm the frontend files are ready:
   - `pages/index.html`: the deployed application.
   - `pages/.nojekyll`: keeps GitHub Pages from processing the site with Jekyll.
   - `pages/config.example.js`: example runtime configuration.
2. Deploy the backend first and note the Edge Function URL:

   ```text
   https://<project-ref>.functions.supabase.co/validation-api
   ```

3. In the GitHub repository, open Settings > Secrets and variables > Actions > Variables and add:
   - `VALIDATION_API_BASE_URL`: `https://<project-ref>.functions.supabase.co/validation-api`
   - `SUPABASE_ANON_KEY`: the public anon key, only needed if JWT verification is enabled.
4. In the GitHub repository, open Settings > Pages. Under Build and deployment, set Source to GitHub Actions.
5. Add `.github/workflows/deploy-validation-site.yml` with this workflow:

   ```yaml
   name: Deploy validation site

   on:
     push:
       branches: [main]
       paths:
         - "pages/**"
         - ".github/workflows/deploy-validation-site.yml"
     workflow_dispatch:

   permissions:
     contents: read
     pages: write
     id-token: write

   concurrency:
     group: pages
     cancel-in-progress: false

   jobs:
     deploy:
       runs-on: ubuntu-latest
       environment:
         name: github-pages
         url: ${{ steps.deployment.outputs.page_url }}
       steps:
         - name: Checkout
           uses: actions/checkout@v6

         - name: Generate runtime config
           shell: bash
           env:
             VALIDATION_API_BASE_URL: ${{ vars.VALIDATION_API_BASE_URL }}
             SUPABASE_ANON_KEY: ${{ vars.SUPABASE_ANON_KEY }}
           run: |
             cat > pages/config.js <<EOF
             window.VALIDATION_SITE_CONFIG = {
               apiBaseUrl: "${VALIDATION_API_BASE_URL}",
               anonKey: "${SUPABASE_ANON_KEY}",
             };
             EOF

         - name: Configure GitHub Pages
           uses: actions/configure-pages@v5

         - name: Upload site artifact
           uses: actions/upload-pages-artifact@v4
           with:
             path: pages
             include-hidden-files: true

         - name: Deploy to GitHub Pages
           id: deployment
           uses: actions/deploy-pages@v4
   ```

6. Commit and push the frontend and workflow files:

   ```powershell
   git add pages .github/workflows/deploy-validation-site.yml in.md
   git commit -m "Add validation site GitHub Pages deployment"
   git push origin main
   ```

7. Open the Actions tab and run Deploy validation site manually, or let the push trigger it. The deployed Pages URL appears in the workflow summary and in Settings > Pages.
8. Visit the Pages URL. If the settings panel appears, confirm the reviewer name and shared review key. The API URL should already come from the generated `config.js`.
9. For future frontend changes, update `pages/index.html`, `pages/config.example.js`, or `.github/workflows/deploy-validation-site.yml`, then push to `main` or rerun the workflow manually.

## Backend

1. Open the Supabase project dashboard.
2. Run `supabase/schema.sql` in the SQL editor. It creates or updates `entries`, `comments`, the update trigger, and the public `validation-comment-images` Storage bucket, then reloads the PostgREST schema cache.

   Rerun this step whenever `supabase/schema.sql` changes. Deploying the Edge Function does not apply database schema changes.

   If error mode writes fail with `Could not find the 'error_modes' column of 'entries' in the schema cache`, run at minimum:

   ```sql
   alter table if exists public.entries
     add column if not exists error_modes text[] not null default '{}'::text[];

   notify pgrst, 'reload schema';
   ```

   If MOL sync fails with `Could not find the 'mol' column of 'entries' in the schema cache`, run at minimum:

   ```sql
   alter table if exists public.entries
     add column if not exists mol text not null default '',
     add column if not exists mol_file_name text not null default '';

   notify pgrst, 'reload schema';
   ```

3. Deploy the Edge Function from this repository:

   ```powershell
   supabase functions deploy validation-api --project-ref <project-ref> --no-verify-jwt
   ```

4. Set Edge Function secrets. Do not set `SUPABASE_SERVICE_ROLE_KEY`; Supabase provides it automatically to hosted Edge Functions.

   ```powershell
   supabase secrets set VALIDATION_REVIEW_KEY=<shared-review-key> --project-ref <project-ref>
   supabase secrets set VALIDATION_COMMENT_IMAGE_BUCKET=validation-comment-images --project-ref <project-ref>
   ```

5. In GitHub repository variables, set:
   - `VALIDATION_API_BASE_URL`: `https://<project-ref>.functions.supabase.co/validation-api`
   - `SUPABASE_ANON_KEY`: the public anon key, if JWT verification is enabled.
6. To upload or update validation SVG data from a local terminal, create `.env.local` in the repository root. This file is ignored by Git.

   ```text
   SUPABASE_URL=https://<project-ref>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
   ```

   Then run:

   ```powershell
   conda activate rdkit-env
   python scripts/sync_validation_data.py --svg-dir site_svgs_260712 --mol-dir site_mols_260712
   ```

   The script reads `validation_manifest.csv` by default and requires `--svg-dir` plus `--mol-dir` to identify the SVG and MOL directories, then upserts `entries`.

7. To migrate exported Google Sheet entry state:

   ```powershell
   conda activate rdkit-env
   python scripts/sync_validation_data.py --svg-dir site_svgs_260712 --mol-dir site_mols_260712 --entries-csv path\to\Entries.csv
   ```

8. To migrate exported Google Sheet comments:

   ```powershell
   conda activate rdkit-env
   python scripts/sync_validation_data.py --svg-dir site_svgs_260701 --comments-csv path\to\Comments.csv
   ```

   Add `--replace-comments` only when the existing Supabase comments should be deleted first.

9. Inspect data in Supabase Table Editor:
   - `entries`: BIGSMILES, SVG XML, annotations JSON, checked state, and update time.
   - `comments`: reviewer name/email, timestamp, comment text, and image URL.
10. Inspect uploads in Storage under `validation-comment-images`.
11. Rotate the shared review key by updating `VALIDATION_REVIEW_KEY` in Supabase secrets, then give reviewers the new key. No Pages redeploy is required for key rotation.
12. After changing `supabase/functions/validation-api/index.ts`, redeploy the Edge Function:

    ```powershell
    supabase functions deploy validation-api --project-ref <project-ref> --no-verify-jwt
    ```

13. After changing `pages/**`, redeploy GitHub Pages by running the Deploy validation site workflow or pushing a change to `pages/**` or the workflow file. Confirm the latest artifact includes `index.html` and `config.js`.

## Troubleshooting

- Failed login/key: click the reviewer badge and re-enter the shared review key. The site verifies the key before loading entries by calling `/me` with `x-validation-key`; if login still fails, verify `VALIDATION_REVIEW_KEY` in Supabase secrets and redeploy the Edge Function.
- Entries not loading: confirm `VALIDATION_API_BASE_URL` points to the deployed `validation-api` function and that the function has `SUPABASE_SERVICE_ROLE_KEY`.
- Local sync asks for Supabase credentials: create `.env.local` with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, or pass `--supabase-url` and `--service-role-key` for a one-off run.
- SVG missing: rerun the sync script and confirm the manifest row references an existing SVG file.
- MOL missing: rerun the sync script and confirm the manifest row references an existing MOL file in the `--mol-dir` directory.
- Save errors: check the browser console and Supabase function logs. Annotation and checked writes require `x-validation-key`.
- Error mode save cannot find `entries.error_modes`: rerun `supabase/schema.sql` in the Supabase SQL editor. The Edge Function route is deployed, but the production database schema or PostgREST schema cache has not been updated.
- MOL download button missing after data sync: inspect `GET /entries/<index>` in browser DevTools. If the JSON does not include non-empty `mol` and `molFileName`, redeploy `validation-api`; the deployed Edge Function is stale even if the database columns are filled.
- Image upload failures: confirm the `validation-comment-images` bucket exists and is public, and that `VALIDATION_COMMENT_IMAGE_BUCKET` matches it.
- Stale Pages deployment: rerun the Deploy validation site workflow and confirm the latest artifact includes `index.html` and `config.js`.
- Mismatched manifest/SVG counts: run the sync script. It stops when the manifest row count does not match the number of SVG files.

## Frontend Re-implementation Notes

- SVG view state should initialize and restore to `DEFAULT_SVG_SCALE = 0.5`, centered on the SVG's original viewBox.
- Trackpad wheel handling should treat pinch gestures (`ctrlKey` wheel events) as cursor-centered zoom and likely touchpad two-finger scroll events as canvas panning.
