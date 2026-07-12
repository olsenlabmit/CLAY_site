# 2026-07-07

- Updated `pages/index.html` so the left entry panel defaults to `25vw`.
- Updated the right review sidebar default width to `25vw` via `--cmts-width`.
- Updated the bottom comment composer default height to `50vh` via `--composer-height`.
- Added a draggable horizontal divider between Error Modes and Comment History, backed by `--error-modes-height`.
- Increased the composer resize clamp to avoid snapping below the new half-screen default on short viewports.
- Verified the inline JavaScript in `pages/index.html` with `node --check`.

## Panel Interaction Cleanup

- Replaced the SVG annotation toolbar in `pages/index.html` with a bottom-docked viewer toolbar containing Pan, Zoom In, Zoom Out, and Restore View controls.
- Removed frontend SVG drawing and annotation UI/state while keeping SVG parsing, responsive sizing, hit rect behavior, panning, mouse-wheel zoom, center-based zoom actions, and restore view.
- Added document-level arrow-key navigation across currently visible entry rows, with input, textarea, select, button, and editable-content targets ignored.
- Restyled Error Modes with bolder labels, wider checkbox spacing, and selected-entry gradient styling for checked Acceptable state.
- Updated Post Comment styling to match the reviewer badge shape, colors, border, and compact padding, including disabled styling.
- Verified the extracted inline JavaScript in `pages/index.html` with `node --check`.
- Verified whitespace with `git diff --check`.
- Did not run browser checks.

## Panel Interaction Minor Modifications

- Updated the right sidebar split so the default Comment History area is `40vh` (`0.4` viewport height), with the existing row resizer behavior preserved.
- Restyled the file input Browse button with the reviewer badge colors and font size while leaving its native shape intact.
- Restored the Post Comment button to its prior full-width rectangular sizing and radius while keeping reviewer badge colors.
- Removed bold weight from Error Mode options, added entry-row-like padding, hover treatment, and divider lines between options.
- Removed the Pan toolbar button while keeping SVG panning behavior active through the viewer hit rect.
- Verified the extracted inline JavaScript in `pages/index.html` with `node --check`.
- Verified whitespace with `git diff --check`.
- Did not run browser checks.

## Error Modes Schema Cache Follow-up

- Diagnosed the updated error mode save failure as a production database schema/cache issue after the Edge Function route was redeployed successfully.
- Updated `supabase/schema.sql` to notify PostgREST to reload its schema cache after applying schema changes.
- Updated `in.md` backend deployment instructions to state that function deployment does not apply database changes and to include the minimum SQL for restoring `entries.error_modes`.
- Added a troubleshooting note for the `entries.error_modes` schema cache error.
- Verified whitespace with `git diff --check -- in.md supabase/schema.sql`.
