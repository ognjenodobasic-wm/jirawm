# JiraWM — Claude Code Instructions

## What this project is
Chrome Extension (Manifest V3) — Side Panel UI for creating Jira subtasks from screenshots.
Internal use only. No server, no database, no OAuth.

## Trenutno stanje
- Faza 1 (Task): ✅ Kompletna
- Faza 2 (Bulk mod): ✅ Kompletna
- Faza 3 (Workflow polish): ✅ Kompletna
- Faza 4 (Više screenshotova): ✅ Kompletna
- Faza 5 (Anotacije — editor popup): ✅ Kompletna
- Faza 6 (Comment tab): ✅ Kompletna

## Faze razvoja
- [x] Faza 1 — Task: capture → create issue → attach screenshot
- [x] Faza 2 — Bulk mod: drag/drop, sekvencijalni background upload, retry failed
- [x] Faza 3 — Workflow polish: Jira-driven wizard, edit/delete, export/import, parent search, field serialization
- [x] Faza 4 — Više screenshotova po tasku: thumbnail strip (max 10), drag reorder, lightbox navigacija, sekvencijalni multi-attach + partial success/retry
- [x] Faza 5 — Anotacije (editor popup, src/editor/) — chrome.windows.create type:'popup'
- [x] Faza 6 — Comment tab (src/sidepanel/CommentMode.tsx): post a comment to an existing Jira issue — project/issue picker (fuzzy search by key or summary), screenshot capture reusing the Task tab's capture/annotate/thumbnail flow, screenshots placed via shortcode tokens (e.g. `[1-filename.jpg]`) inserted into the comment body

## Stack
- React 19 + TypeScript strict + Tailwind CSS v4
- Vite + @crxjs/vite-plugin
- Chrome Side Panel API (MV3)
- Jira Cloud REST API v3
- Fabric.js v7 za anotacioni editor (v7 API se značajno razlikuje od v5 — vidi docs/jirawm-spec.md sekcija 5.8)

## Build & check
- Build: `npm run build` → /dist
- TypeScript: `npx tsc -b` — run before every commit, fix all errors. (Root tsconfig.json is solution-style — only "references", no "files" — so bare `tsc --noEmit` silently checks nothing. `tsc -b`, or `npm run build` which runs `tsc -b && vite build`, is the only command that actually typechecks this repo.)
- No dev server — Chrome extensions require built output. Build → reload in chrome://extensions → test.
- When reporting typecheck or build results in any task Report, always paste the full raw terminal output — never summarize as "clean" or state an error count without the output itself.

## Three JS contexts — never mix them
1. Side Panel (UI) — src/sidepanel/
2. Background Service Worker — src/background/worker.ts
3. Annotation Editor Popup — src/editor/ (Faza 5; chrome.windows.create type:'popup', NE novi tab)

Communication between contexts: chrome.runtime.sendMessage only.
Large data (screenshots, base64): use chrome.storage.local as buffer, NOT sendMessage.

## Chrome storage rules
- API token, email, domain → chrome.storage.local (sensitive, never synced)
- Workflows → chrome.storage.local (legacy sync data is cleared on startup via `removeLegacySyncWorkflows`)
- Bulk progress, pending screenshots → chrome.storage.local (temporary)
- Export snapshot metadata → chrome.storage.local
- `updateInfo` → chrome.storage.local, written by `checkForUpdate()`, read by UpdateBanner and the Help panel notice
- `dismissedUpdateVersion` → chrome.storage.local, written by UpdateBanner on dismiss, read by UpdateBanner only

## Jira API rules
- Auth: Basic base64(email:api_token) in Authorization header
- Base URL: https://{domain}.atlassian.net/rest/api/3/
- Description fields MUST use ADF format — plain string returns 400
- Create issue and attach screenshot are TWO separate API calls
- issue.key (e.g. AT-234) comes back in the create response — no extra fetch needed
- Cache createmeta response in chrome.storage.local (key `jirawm_createmeta_{projectKey}`) — never fetch on every form open

## ADF helper — always use this
function toADF(text) {
  return {
    type: 'doc', version: 1,
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }]
  };
}

## UI rules
- Font: system font stack only — no external font libraries
- Colors: use CSS variables from globals.css (--chrome-*), never Tailwind default colors
- Side Panel width: ~400px fixed
- Tab bar style: underline indicator, not pill/capsule

## Keyboard shortcut
- Ctrl+Shift+S (Windows) / Cmd+Shift+S (Mac) — otvara Side Panel.
- Manifest komanda je `_execute_action` (rezervisana), ne custom `open-jirawm`. Shortcut je **Ctrl+Shift+S, ne J**.

## Poznate zamke
- select/option field defaults zahtevaju type-aware serializaciju — implementirano u jira.ts `serializeField` helper (pokriva option, priority, user, array, number; ostalo prolazi kao string).

## Service Worker keepalive (bulk sessions)
chrome.alarms.create('keepAlive', { periodInMinutes: 0.33 });
Required for bulk uploads longer than 30 seconds. MV3 workers get killed otherwise.

## Bulk processing — always sequential
Process tasks one by one. Use Promise.allSettled, never Promise.all.
Update chrome.storage.local status after each step: creating → uploading → done/failed.

## Faza 5 — Checklist (editor popup)

- [x] `editor.html` + Vite entry za editor kontekst (`src/editor/main.tsx`)
- [x] `useWindowBounds.ts` — čitanje/čuvanje dimenzija prozora (debounce 500ms)
- [x] `useEditorTransfer.ts` — storage protokol (pendingEditor, annotationResult, cleanup)
- [x] `chrome.windows.create` integracija u SingleMode — jedan popup istovremeno guard
- [x] Preview mode — readonly, fit-to-window, [Annotate] i [Close] dugmad, Escape shortcut
- [x] Annotate mode — Fabric.js canvas inicijalizacija sa screenshot-om (`AnnotateMode.tsx`)
- [x] Toolbar — Select, Arrow, Rect (outline+fill toggle), Numbered marker, Text
- [x] Boje — 5 preset-a (#ff4444, #ffcc00, #00cc88, #4499ff, #ffffff)
- [x] Stroke width — 2/3/4px dropdown
- [x] Numbered marker auto-increment counter u toolbar-u
- [x] Undo/Redo — Fabric.js history (Cmd+Z / Cmd+Y)
- [x] Delete selected — Delete/Backspace + toolbar dugme
- [x] "Done" — canvas export JPEG 0.9 → storage → sendMessage ANNOTATION_DONE → zatvori
- [x] "Cancel" — zatvori popup, original nepromenjen
- [x] Side Panel listener — ANNOTATION_DONE handler, replace thumbnail, cleanup storage
- [x] Anotovani screenshot zamenjuje original u strip-u
- [x] ✎ badge na thumbnail koji je anotiran
- [x] `npx tsc -b` — 0 grešaka
- [x] `npm run build` — build prolazi

## Update notification system
- `src/lib/updateCheck.ts` exports `fetchLatestRelease()`, `isNewerVersion()`, and `checkForUpdate()`. `checkForUpdate()` compares the installed manifest version against the latest GitHub release and writes the result to chrome.storage.local under the key `updateInfo` (`{ latestVersion, downloadUrl, checkedAt }`), or clears that key if no update is available.
- `src/background/worker.ts` registers an alarm named `updateCheck` (every 360 minutes) that calls `checkForUpdate()`, plus an immediate call on worker start.
- `src/sidepanel/UpdateBanner.tsx` renders a dismissible banner at the bottom of the Side Panel root layout. Dismissal is tracked via the `dismissedUpdateVersion` key in chrome.storage.local — the banner reappears automatically whenever `updateInfo.latestVersion` changes to something not yet dismissed.
- The Help panel additionally shows a non-dismissible version of the same notice, independent of `dismissedUpdateVersion` — it always shows when an update exists.
- Shared color values for update/notice UI: background `#fff3cd`, border `#e6c200` (also used by the crop overlay in the editor) — reuse these exact values, do not introduce a different yellow elsewhere in the app.
- IMPORTANT constraint to preserve: UpdateBanner must always remain the LAST child of the Side Panel root layout, so that any future sticky footer element added inside `<main>` renders visually above it, not below it.

## Version bumping — automated, do not do manually for patch
- A pre-commit hook (simple-git-hooks, configured in package.json, script at `scripts/bump-patch-version.mjs`) auto-increments the patch version in manifest.json on every commit and mirrors it into package.json. manifest.json is the source of truth; package.json only mirrors it.
- Do NOT manually edit the patch number — it will be overwritten by the hook anyway.
- MINOR and MAJOR bumps are still manual and intentional — set them explicitly when a release note calls for it; the hook only ever increments patch by 1 relative to whatever is currently in manifest.json at commit time.
- The hook is local to each machine (not versioned via .git) — after this file lands, each clone needs one `npm install` to activate it.

## Two changelog sources — keep in sync
- docs/CHANGELOG.md and src/sidepanel/help/changelogData.ts must always describe the same releases with matching substance (same bullets, same meaning) — the first is the doc-facing source, the second is what the Help panel actually renders. A past discrepancy (stale wording about shortcode/inline-embed behavior) went uncorrected in one file after being fixed in the other — check both whenever one is edited.

## What NOT to do
- Never run npm run dev or start a dev server
- Never use select('*') or equivalent — always explicit fields
- Never put sensitive data in code or comments
- Never use localStorage — chrome.storage only
- Never assume a variable from one context exists in another
- Never send large base64 strings via sendMessage — use chrome.storage.local
