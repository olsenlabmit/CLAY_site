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
