---
name: Start of Day
description: Runs repo sync, dependency install, build verification, and prints a session briefing at the start of a work session.
triggers:
  - start of day
  - pocetak dana
  - session start
---

# Start of Day

This skill fulfills the "/session-start" reference in the universal project
instructions (§9) — the git-sync and build-verification portion specifically. The
ROADMAP.md file referenced there does not exist in this project; CLAUDE.md's
"Trenutno stanje" section serves the same purpose here, which is why Step 4c reads
from there instead.

## Step 1 — Git sync check

Run:

```bash
git status --short --branch
```

- If there is any uncommitted change (non-empty short status beyond the branch line):
  STOP immediately, print the full status output, and tell the user to resolve it
  manually before continuing. Do not stash, commit, or discard anything.
- If clean and the branch line shows "behind" origin: run
  ```bash
  git pull --ff-only
  ```
  If that pull fails (non-fast-forward): STOP, print the error, tell the user this
  needs manual attention — do not attempt a merge or rebase.
- If clean and not behind: continue.

## Step 2 — Dependency sync

Run:

```bash
npm install
```

Always run this unconditionally, even if nothing appears to have changed — this is
what re-registers local git hooks (simple-git-hooks) on this machine and picks up any
new dependency added on another machine.

## Step 3 — Build verification

Run:

```bash
npm run build
```

Paste the full raw output. If the build fails, STOP and report the full error output —
do not proceed to the briefing step with a broken build.

## Step 4 — Session briefing

Print, in this order, clearly labeled:

a) Current version: read the "version" field from manifest.json

```bash
grep -m1 '"version"' manifest.json
```

b) Most recent changelog entry: the first "## " section from docs/CHANGELOG.md (the
   whole section, not just the heading)

```bash
awk '/^## /{if (n==1) exit; n++} n' docs/CHANGELOG.md
```

c) Current project status: the "## Trenutno stanje" section from CLAUDE.md (or the
   nearest equivalent section if that exact heading has changed — check the live file,
   do not assume the heading text)

```bash
awk '/^## Trenutno stanje/{f=1; print; next} f && /^## /{exit} f' CLAUDE.md
```

(If the "## Trenutno stanje" heading is no longer present, read CLAUDE.md directly and
locate the nearest equivalent status section instead of assuming this command's output.)

d) Last 5 commits:

```bash
git log -5 --oneline
```

## Closing note

If the session type (bug fix / new feature / refactor / audit / docs) isn't already
obvious from what the user asked for, this skill's output should make it easy to ask —
but asking is a judgment call for whoever runs this skill, not something to automate
away.
