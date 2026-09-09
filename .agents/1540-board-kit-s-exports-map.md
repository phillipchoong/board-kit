## Context

board-kit's `package.json` `exports` map has no `./composables/*` entry, so a
consuming app cannot `import` anything from `src/composables/` via the
package's public subpath resolution — that path currently throws. `./components/*`
and `./lib/*` already have entries; `./composables/*` was simply missed.

This is additive to a resolution map: it makes a path that currently throws
resolve, and cannot change how any existing import behaves. No source, test or
build path reads `exports` today — only Vite/Node's resolver would, for a
subpath nobody can use yet.

Branch: `task/1540-board-kit-s-exports-map`
Board: phillipchoong/tasks#1540

## What to do

- In `package.json`, add one entry to `exports`:
  `"./composables/*": "./src/composables/*"`, alongside the existing
  `./components/*` and `./lib/*` entries.
- Change nothing else in `package.json` — no version bump, no other key.

## Out of scope

- No source code changes.
- No `CHANGELOG.md` or `version` edits (`version-bump.yml` handles that on
  merge).

## Report back

Acceptance criteria (verbatim from the issue):
- `exports` carries `"./composables/*"`.
- No other key in `package.json` changed, `version` included — prove it via
  `git diff`.
- CI is green.
