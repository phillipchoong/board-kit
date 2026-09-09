### Fixed
- Added `./composables/*` to the `exports` map in `package.json` so consumers
  can import from `board-kit/composables/*` — previously only `./components/*`
  and `./lib/*` were exported, leaving the composables subpath unresolvable.
