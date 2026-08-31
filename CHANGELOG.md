# Changelog

All notable changes to board-kit are recorded here. The version and this file
are only ever changed by `version-bump.yml` on merge to `main`; a task branch
adds a fragment under `.changes/` instead.

## 0.1.0

First release.

- `BoardView` — pipeline (swim-lane) and list views in one component, with the
  choice remembered per board.
- Drag between columns and reorder within one, via SortableJS, tuned for touch:
  hold 350ms to lift, 8px cancels, the board auto-scrolls while a card is held.
- Swimlanes: one shared grid, collapsible lanes and columns, optional cross-lane
  drags.
- Search, multi-select filters with live option counts, and per-column WIP limits
  in `warn` or `block` mode.
- A move menu on every card, so the board never needs a drag.
- Optimistic moves that settle themselves when the props catch up, and `revert()`
  for the failure path.
- No colours of its own; reads the host app's design tokens, dark mode included.
