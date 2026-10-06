### Changed

- CI now starts on every pull request, and skips the test job only when the PR changes docs alone. This lets `main` require the "Test & build" check without blocking docs-only PRs (tasks#2883).
- The version-bump job pushes its release commit with a deploy key when `VERSION_BUMP_DEPLOY_KEY` is set, so the push gets past the `main` ruleset (tasks#2883).
