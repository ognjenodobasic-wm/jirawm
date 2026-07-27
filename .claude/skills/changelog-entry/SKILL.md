---
name: changelog-entry
description: Use to add a dated docs/CHANGELOG.md entry summarizing work done so far, without bumping the version or packaging a release.
---

# Add a CHANGELOG entry (no version bump, no packaging)

This is the lightweight counterpart to the `release-manager` agent. `release-manager` walks the *whole* release (version sync in `manifest.json`/`package.json`, changelog, tsc, `npm run package`) and is for actually cutting a release. This skill is for the common in-between case: the user wants what's landed so far written down in `docs/CHANGELOG.md`, without touching the version number or building a zip.

## Steps

1. Read the top of `docs/CHANGELOG.md` to see the current entry format. Match it exactly:
   ```
   ## {version} — {short summary of the release}

   ### Added
   - ...

   ### Fixed
   - ...

   ### Changed
   - ...
   ```
   Only include the subsections (`Added`/`Fixed`/`Changed`) that actually have entries — don't add empty headers.

2. Figure out what's actually changed. Compare against the most recent reference point:
   - If there's a git tag matching the last CHANGELOG version, use `git log <last-tag>..HEAD --oneline` and `git diff <last-tag>..HEAD --stat`.
   - Otherwise, use `git log` since the date/commit the current top CHANGELOG entry was written, or `git status`/`git diff` for uncommitted work.
   Don't invent changes — only summarize what the log/diff actually shows.

3. Insert the new section at the **top** of `docs/CHANGELOG.md`, above the current top entry. Use the version number currently in `manifest.json`/`package.json` if this entry describes work on top of the last released version and no new version has been decided yet — do not invent or bump a version number yourself. If the user hasn't decided on a version bump, leave the version out of the heading or ask, rather than guessing patch/minor/major.

4. Write entries as user-facing, past-tense bullets (matching the existing tone — see examples already in the file), not commit-message shorthand.

## Explicitly out of scope for this skill

Do not do any of the following — if the user wants these too, point them at the `release-manager` agent instead:
- Bumping `version` in `manifest.json` or `package.json`
- Running `npm run package` / creating a release zip
- `git tag` / `git push` / `git push --tags`
