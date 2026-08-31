# Learnings fragments

One file per task branch, named `<issue>-<slug>.md`. Write what the NEXT agent
working in this repo would otherwise rediscover — toolchain traps, real timings,
CI quirks, non-obvious conventions. A few bullets: the fact, and what it cost
not to know it.

Not here: the task narrative (that is the board Result log), anything already in
`CLAUDE.md` or `LEARNINGS.md`, secrets, or speculation. A session that learned
nothing non-obvious writes nothing.

`version-bump.yml` appends each fragment to `.agents/LEARNINGS.md` verbatim on
merge and deletes it. Never edit `LEARNINGS.md` on a branch.
