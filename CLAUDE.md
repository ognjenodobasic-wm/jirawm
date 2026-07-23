# JiraWM — Claude Code Instructions

## What this project is
Chrome Extension (Manifest V3) — Side Panel UI for creating Jira subtasks from screenshots.
Internal use only. No server, no database, no OAuth.

## Trenutno stanje
- Faza 1 (Single Task): ✅ Kompletna
- Faza 2 (Bulk mod): ✅ Kompletna
- Faza 3 (Workflow polish): ✅ Kompletna
- Faza 4 (Više screenshotova): ⏳ Nije početa
- Faza 5 (Anotacije): ⏳ Nije početa

## Faze razvoja
- [x] Faza 1 — Single Task: capture → create issue → attach screenshot
- [x] Faza 2 — Bulk mod: drag/drop, sekvencijalni background upload, retry failed
- [x] Faza 3 — Workflow polish: Jira-driven wizard, edit/delete, export/import, parent search, field serialization
- [ ] Faza 4 — Više screenshotova po tasku
- [ ] Faza 5 — Anotacije (editor tab, src/editor/)

## Stack
- React 19 + TypeScript strict + Tailwind CSS v4
- Vite + @crxjs/vite-plugin
- Chrome Side Panel API (MV3)
- Jira Cloud REST API v3

## Build & check
- Build: `npm run build` → /dist
- TypeScript: `npx tsc --noEmit` — run before every commit, fix all errors
- No dev server — Chrome extensions require built output. Build → reload in chrome://extensions → test.

## Three JS contexts — never mix them
1. Side Panel (UI) — src/sidepanel/
2. Background Service Worker — src/background/worker.ts
3. Annotation Editor Tab — src/editor/ (future phase)

Communication between contexts: chrome.runtime.sendMessage only.
Large data (screenshots, base64): use chrome.storage.local as buffer, NOT sendMessage.

## Chrome storage rules
- API token, email, domain → chrome.storage.local (sensitive, never synced)
- Workflows → chrome.storage.sync (synced across user's Chrome instances)
- Bulk progress, pending screenshots → chrome.storage.local (temporary)
- Export snapshot metadata → chrome.storage.local

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

## What NOT to do
- Never run npm run dev or start a dev server
- Never use select('*') or equivalent — always explicit fields
- Never put sensitive data in code or comments
- Never use localStorage — chrome.storage only
- Never assume a variable from one context exists in another
- Never send large base64 strings via sendMessage — use chrome.storage.local
