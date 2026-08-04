---
name: End of Day
description: Reconciles version history, syncs both changelog sources, audits Help panel content against actual current behavior, reminds about structure.md, and pushes.
triggers:
  - end of day
  - kraj dana
  - session end
  - zavrsi sesiju
---

# End of Day

Note: docs/jirawm-spec-v1.2.md sync is intentionally excluded from this skill and
deferred — its versioned filename convention is still undecided. This skill never
touches that file.

## Step 1 — Determine what changed

```bash
git log -1 --format="%H %ad %s" --date=short -- docs/CHANGELOG.md
```

Then, using that hash:

```bash
git log <that-hash>..HEAD --oneline --reverse
```

This is the working set for the rest of the skill. If the list is empty, skip straight
to Step 9 (push) and report nothing else to do.

## Step 2 — Verify actual behavior, not commit messages

For each commit in the working set, do NOT write changelog content from the commit
title alone. Use `git show <hash> --stat` and `git show <hash>` to confirm what
actually changed and whether it's still true in the current code — a later commit in
the same set may have reverted or replaced it. This happened before: see the
"da6ad38 / 45fc51c" case in git history, where a later commit (6890d03) removed
functionality two earlier commits had added.

Group commits into:
- Still accurate as shipped — document these.
- Superseded/reverted by a later commit — do not document.
- Internal-only with no user-facing effect — do not document, unless it fixed a
  visible bug.

## Step 3 — Decide version bump type

Read the current version from manifest.json. The pre-commit hook already
auto-increments PATCH on every commit — do not manually touch the patch number. Decide
only whether MINOR or MAJOR applies:

- MAJOR: a full development phase completed (check CLAUDE.md's "## Trenutno stanje"
  for phase language).
- MINOR: one or more significant, user-facing features shipped in the working set.
- NEITHER: only fixes, polish, or internal changes — in this case, state explicitly
  "no minor/major bump needed this session, patch auto-handles it" and do not bump
  manually.

If MINOR or MAJOR applies, set that number in manifest.json (package.json will mirror
it automatically via the pre-commit hook's own run during this session's commit, but
set both manually here to be safe, since the hook only bumps patch, not minor/major)
and reset patch to 0.

## Step 4 — Update docs/CHANGELOG.md

If the most recent existing section at the top is for a version that was never tagged
(check: `git tag --list` and compare against the section's version number), treat this
session's still-accurate changes as amendments to THAT SAME section rather than
creating a new one — unless Step 3 decided on a MINOR/MAJOR bump, in which case add a
new section at the top for the new version number, using only the "still accurate as
shipped" findings from Step 2.

## Step 5 — Sync src/sidepanel/help/changelogData.ts

Mirror Step 4's result into this file exactly, matching its existing structure and the
Serbian "Juli 2026"-style date convention already used there. Both files must describe
the same releases with matching substance afterward.

## Step 6 — Help panel content audit

For each user-facing item from Step 2, check whether the relevant file under
src/sidepanel/help/sections/ already documents it accurately. Read the actual current
component (e.g. CommentMode.tsx, SingleMode.tsx, BulkMode.tsx) rather than assuming,
the same way the earlier full Help-panel audit task did. Fix only what's actually
stale or missing — do not add speculative documentation for anything you're not sure
is accurate.

## Step 7 — structure.md reminder (do not regenerate it here)

Print a reminder that structure.md may be stale and should be refreshed via its own
separate existing prompt — do not attempt to regenerate it inside this skill.

## Step 8 — Spec document reminder (do not touch it here)

Print a reminder that docs/jirawm-spec-v1.2.md sync is intentionally deferred — its
versioned filename convention is under review and this skill does not touch it until
that's resolved.

## Step 9 — Final git safety check and push

```bash
npx tsc -b
npm run build
```

Paste full raw output. STOP if either fails.

If both succeed:

```bash
git add -A
git commit -m "chore: end of day — <short summary>"
```

Then run:

```bash
git status --short --branch
```

one more time to confirm a clean tree ahead of origin, then:

```bash
git push
```

Report the push result explicitly — do not claim success without pasting the actual
command output.

## Step 10 — Push a release tag if the version changed

After the push in Step 9 has succeeded, read the current version from manifest.json.

Check whether a tag matching that version already exists on origin:

```bash
git ls-remote --tags origin | grep "v<version>"
```

If it already exists, skip this step and note: "tag v<version> already exists on
origin, nothing to do — release workflow already ran for this version."

If it does not exist (meaning this session bumped the version and it hasn't been
released yet), run:

```bash
git tag -a v<version> -m "v<version>"
git push origin v<version>
```

Pushing this tag triggers `.github/workflows/release.yml`, which builds, packages
(via `npm run package`, which requires `docs/RELEASE-INSTALL.md` to exist — if that
file is ever missing, the Action will fail loudly, which is expected and correct, not
something this skill should work around), and publishes the GitHub release
automatically. This skill does not need to check the Action's result — that happens on
GitHub's side, not locally.

Print a one-line reminder:
"Tag v<version> pushed — GitHub Actions will publish the release in ~1-2 min, check
the Releases page or `gh run list --workflow=release.yml` if you want to confirm."

## Closing note

This skill assumes it is being run at the actual end of a work session — it commits
and pushes as its last action. It should not be run mid-session unless the user
explicitly wants an interim push.
