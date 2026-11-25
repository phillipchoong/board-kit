## Context
Nightly security scan (tasks#4012) flagged 4 npm advisories in package-lock.json: @vitest/mocker 4.1.11 and brace-expansion 5.0.9. Branch: task/4012-security-scan-4-new-finding.

## What to do
Upgrade the lock file so none of the four advisories remain. `npm audit fix` crashes on npm 10 (arborist peer-set bug), so use npm 11 (`npx npm@11 audit fix`). Run `npm test` and `npm run build`.

## Out of scope
Other audit findings not named in the task (glob, happy-dom, minimatch). Any package.json or version change.

## Report back
PR link, and the audit output showing the four findings gone.
