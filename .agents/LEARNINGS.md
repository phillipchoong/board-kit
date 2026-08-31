# Learnings — board-kit

The curated digest. Read it after `CLAUDE.md`, before writing code here.

Edited only by consolidation, never on a task branch: a branch drops one
fragment at `.agents/learnings/<issue>-<slug>.md` and `version-bump.yml` folds
it in on merge.

## Toolchain

- **happy-dom cannot test a drag.** No pointer, no layout. `sortablejs` is
  mocked in `tests/BoardView.test.js`, and the logic that matters was pulled
  out into `src/lib/move.js` so it can be tested as plain functions. A real
  drag is checked in the playground, by hand.
- **SortableJS listens on `pointerdown`, not `mousedown`**, whenever the browser
  has `PointerEvent`. Driving a drag from a script — or from a browser
  automation tool that only sends mouse events — does nothing at all until you
  dispatch `pointerdown` / `pointermove` / `pointerup`. It looks exactly like a
  broken Sortable instance and is not one.

## Vue

- **A deep `ref` hands back a proxy of what you put in**, so `entry !== original`
  and any code that filters an array by object identity silently matches
  nothing. The pending-move list uses `shallowRef` plus an explicit token for
  this reason; with a plain `ref` a failed save left the card in its new column
  forever, and the unit test for `revert()` is what caught it.
