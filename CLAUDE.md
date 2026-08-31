# board-kit — rules for any Claude session

A Vue 3 package: Trello-style pipeline and list views, installed from git by the
client-starter family of apps (TQK Platform, ThreeStep OS, Glampot OS, NewBond
OS, KrakenOS, client-starter). Read `README.md` first — it is the contract, and
a change that breaks it breaks six apps at once.

## The rules that are not obvious from the code

1. **This package ships source, never a build.** No `dist/`, no `prepare`
   script. Consumers compile it with their own Vite. `npm run build` exists only
   as a compile check in CI.

2. **No colours, ever.** Every colour is `var(--some-token, fallback)` naming a
   variable client-starter's `semantic.css` already defines. A hex in a component
   is a bug: it will be wrong in dark mode and wrong in five brands.

3. **No new runtime dependencies without a reason in the PR.** Today it is
   `sortablejs` and nothing else. Vue is a peer dependency. Icons are inline SVG
   precisely so the package does not pull an icon library into six apps that
   already have one.

4. **The kit never mutates the `cards` prop.** A drop emits `move`. If you find
   yourself writing to a prop, the design has gone wrong.

5. **Every card keeps its move menu.** It is the keyboard and screen-reader path
   and the one-thumb path. A change that makes drag the only way to move a card
   is not shippable.

6. **Touch settings are measured, not taste.** `delay: 350`,
   `delayOnTouchOnly`, `touchStartThreshold: 8` in
   `src/composables/useSortableList.js` are what stop a scroll swipe becoming a
   drag. Changing them needs testing on a real phone, not a resized desktop.

7. **The DOM restore in `onEnd` is load-bearing.** Sortable moves nodes and Vue
   owns them; the restore is what stops cards duplicating. Do not "simplify" it.

## Testing

`npm test` — vitest + happy-dom. Two kinds:

- `tests/model.test.js`, `tests/move.test.js` — the pure functions. **This is
  where the real logic lives**, deliberately, so it can be tested without a
  browser. `resolveDrop` in particular: the filtered-index translation is the
  subtlest thing in the package.
- `tests/BoardView.test.js` — rendering, counts, filters, the optimistic layer.
  Sortable is mocked; happy-dom has no pointer and no layout, so a real drag
  cannot be tested here.

**A real drag can only be checked in the playground.** `npm run dev`, then drag a
card. The switch marked "make every save fail" is how you check a revert.

## Conventions shared with the rest of the estate

- PR-only, branch `task/<issue>-<slug>`, one PR per task (ops-board CLAUDE.md §9).
- Every PR adds one `.changes/<issue>-<slug>.md` fragment; `version-bump.yml`
  folds it on merge. **Never edit the version or `CHANGELOG.md` on a branch.**
- Durable findings go in `.agents/learnings/<issue>-<slug>.md`, never straight
  into `.agents/LEARNINGS.md`.
- 4-space indent, single quotes, semicolons. Comments explain *why*, not what.
