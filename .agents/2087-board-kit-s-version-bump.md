## Context

`phillipchoong/board-kit` is a public Vue 3 package installed by the
client-starter family as a git dependency (`npm install
github:phillipchoong/board-kit#v0.1.1`). For a git dependency **the tag is the
release**. `.github/workflows/version-bump.yml` bumps `package.json` and folds
the changelog on every merge to `main`, but it never ran `git tag` — so
`v0.1.2` (commit `936359d`) and `v0.1.3` (commit `cc6ec8d`) were merged and
released in `package.json` but never became installable tags.

Branch: `task/2087-board-kit-s-version-bump`. No registry numbers needed (no
migrations, no ports).

## What to do

1. In `.github/workflows/version-bump.yml`, after the release commit push
   succeeds, create and push an annotated tag `v$NEW` on that commit — but
   only when a release was actually cut (`$NEW` non-empty; a learnings-only
   merge cuts no tag). Pattern copied from
   `phillipchoong/laravel-ops-integrations`'s `.github/workflows/release.yml`:
   push first (with the existing retry loop — now checked for real success),
   `git fetch --tags --force`, fail loudly if the tag already exists (never
   move or overwrite it), then `git tag -a "v$NEW" -m "v$NEW"` and
   `git push origin "refs/tags/v$NEW"`.
2. `permissions: contents: write` already covers a tag push — no change
   needed there.
3. Add the two missing tags directly on the existing release commits:
   `v0.1.2` on `936359d`, `v0.1.3` on `cc6ec8d` — verified each commit's
   `package.json` holds that version first.
4. `README.md`: install line now reads
   `npm install github:phillipchoong/board-kit#semver:^0.1`, with a note that
   the tag is the release and the workflow cuts it with no human step.
5. `CLAUDE.md` does not describe the release/install steps in any detail
   (only names the repo as "installed from git" in the intro line), so it
   needed no edit for this task.

### Acceptance (copied from the issue)

- [ ] A merge to `main` that cuts a release also pushes an annotated tag
      `vX.Y.Z` on the release commit, with no human step.
- [ ] A merge that cuts no release (learnings only) pushes no tag.
- [ ] If the tag already exists the job fails loudly and does not move or
      overwrite it.
- [ ] Tags `v0.1.2` and `v0.1.3` exist and each points at the commit whose
      `package.json` holds that version.
- [ ] After this PR's own release, `gh api
      repos/phillipchoong/board-kit/compare/<newest tag>...main -q .ahead_by`
      prints `0`.
- [ ] In a scratch directory, `npm install
      "github:phillipchoong/board-kit#semver:^0.1"` installs the newest tag.
      The PR body shows the installed version.
- [ ] `README.md` shows the `#semver:^0.1` install form and says the workflow
      cuts the tag.

## Out of scope

- The Vue components do not change.
- Moving the four consumers (`glampot-ops-stack`, `kraken-os`,
  `tqk-platform`, `threestep-ops-stack`) to the `#semver:` pin is separate
  work — this task changes board-kit only.

## Report back

Result log on board issue #2087: branch, PR link, tags pushed, verification
that `npm install github:phillipchoong/board-kit#semver:^0.1` resolves to the
newest tag in a scratch dir, and anything surprising.
