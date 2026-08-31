# Changelog fragments

One file per task branch, named `<issue>-<slug>.md` (the board issue number
keeps names unique, so parallel PRs never conflict). Content: Keep a Changelog
style bullets, optionally under `### Added` / `### Changed` / `### Fixed`.

Do NOT bump the version in `package.json` and do NOT edit `CHANGELOG.md` on a
branch. The `version-bump` workflow does both, once, when the PR merges to
main -- it folds every pending fragment into `CHANGELOG.md` under the new
version heading and deletes the fragments.

`package.json`'s `version` is the single source of truth for the number this
package publishes, and the tag consuming apps pin in their `package.json`.
