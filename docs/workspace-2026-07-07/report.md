# 2026-07-07

- Updated `pages/index.html` so the left entry panel defaults to `25vw`.
- Updated the right review sidebar default width to `25vw` via `--cmts-width`.
- Updated the bottom comment composer default height to `50vh` via `--composer-height`.
- Added a draggable horizontal divider between Error Modes and Comment History, backed by `--error-modes-height`.
- Increased the composer resize clamp to avoid snapping below the new half-screen default on short viewports.
- Verified the inline JavaScript in `pages/index.html` with `node --check`.
