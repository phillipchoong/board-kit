### Fixed

- `version-bump.yml` now pushes an annotated `vX.Y.Z` tag on the release
  commit after the push lands, and skips tagging on a learnings-only merge.
  A tag that already exists fails the job loudly rather than being moved.
- Added the missing `v0.1.2` and `v0.1.3` tags on their existing release
  commits, so those two releases are installable again.

### Changed

- `README.md`'s install line now uses the `#semver:^0.1` range form instead
  of pinning an exact tag, and notes that the tag is the release and the
  workflow cuts it.
