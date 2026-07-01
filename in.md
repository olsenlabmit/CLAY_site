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

## Backend

1. Open the Supabase project dashboard.
2. Run `supabase/schema.sql` in the SQL editor. It creates `entries`, `comments`, the update trigger, and the public `validation-comment-images` Storage bucket.
3. Deploy the Edge Function from this repository:

   ```powershell
   supabase functions deploy validation-api --project-ref <project-ref> --no-verify-jwt
   ```

4. Set Edge Function secrets:

   ```powershell
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service-role-key> VALIDATION_REVIEW_KEY=<shared-review-key> --project-ref <project-ref>
   supabase secrets set VALIDATION_COMMENT_IMAGE_BUCKET=validation-comment-images --project-ref <project-ref>
   ```

5. In GitHub repository variables, set:
   - `VALIDATION_API_BASE_URL`: `https://<project-ref>.functions.supabase.co/validation-api`
   - `SUPABASE_ANON_KEY`: the public anon key, if JWT verification is enabled.
6. To upload or update validation SVG data:

   ```powershell
   conda activate rdkit-env
   python scripts/sync_validation_data.py
   ```

   The script reads `validation_manifest.csv` and `validation_svgs_v1/*.svg`, then upserts `entries`.

7. To migrate exported Google Sheet entry state:

   ```powershell
   conda activate rdkit-env
   python scripts/sync_validation_data.py --entries-csv path\to\Entries.csv
   ```

8. To migrate exported Google Sheet comments:

   ```powershell
   conda activate rdkit-env
   python scripts/sync_validation_data.py --comments-csv path\to\Comments.csv
   ```

   Add `--replace-comments` only when the existing Supabase comments should be deleted first.

9. Inspect data in Supabase Table Editor:
   - `entries`: BIGSMILES, SVG XML, annotations JSON, checked state, and update time.
   - `comments`: reviewer name/email, timestamp, comment text, and image URL.
10. Inspect uploads in Storage under `validation-comment-images`.
11. Rotate the shared review key by updating `VALIDATION_REVIEW_KEY` in Supabase secrets, then give reviewers the new key. No Pages redeploy is required for key rotation.
12. Redeploy GitHub Pages by running the Deploy validation site workflow or pushing a change to `index.html`, `pages/**`, or the workflow file.

## Troubleshooting

- Failed login/key: click the reviewer badge and re-enter the shared review key. If writes still fail, verify `VALIDATION_REVIEW_KEY` in Supabase secrets.
- Entries not loading: confirm `VALIDATION_API_BASE_URL` points to the deployed `validation-api` function and that the function has `SUPABASE_SERVICE_ROLE_KEY`.
- SVG missing: rerun the sync script and confirm the manifest row references an existing SVG file.
- Save errors: check the browser console and Supabase function logs. Annotation and checked writes require `x-validation-key`.
- Image upload failures: confirm the `validation-comment-images` bucket exists and is public, and that `VALIDATION_COMMENT_IMAGE_BUCKET` matches it.
- Stale Pages deployment: rerun the Deploy validation site workflow and confirm the latest artifact includes `index.html` and `config.js`.
- Mismatched manifest/SVG counts: run the sync script. It stops when the manifest row count does not match the number of SVG files.
