# JiraWM — Agent Reference

Concise source of truth for coding agents working on the JiraWM Chrome extension. When this file conflicts with any other document, inspect the current source code; code is authoritative.

---

## Project

- Internal Chrome Manifest V3 extension.
- Stack: React 19 + TypeScript strict + Vite, `@crxjs/vite-plugin`, Tailwind CSS v4.
- APIs: Chrome Side Panel API, `chrome.windows.create` popup editor, Jira Cloud REST API v3.
- No server, database, OAuth flow, or external backend.

---

## Architecture

Three isolated JavaScript contexts. They do **not** share memory.

1. **Side Panel UI** — `src/sidepanel/`
2. **Background Service Worker** — `src/background/worker.ts`
3. **Annotation Editor popup** — `src/editor/`

- Communication: `chrome.runtime.sendMessage` and `chrome.storage`.
- Large base64 screenshot payloads must **never** travel through runtime messages. Store them in `chrome.storage.local`; messages carry only lightweight signals and identifiers.

---

## Storage

- **Jira credentials** (`domain`, `email`, `apiToken`) always go in `chrome.storage.local`. Never put them in `sync`, source code, comments, or logs.
- **Workflows** (`jirawm_workflows`) are stored in `chrome.storage.local`. `chrome.storage.sync` is a legacy location and is cleaned via `removeLegacySyncWorkflows`.
- **Local-only data**: `jirawm_bulk_progress`, `pendingEditor`, `annotationResult`, `editorWindowBounds`, `jirawm_export_snapshot`, `jirawm_compression`, `jirawm_createmeta_{projectKey}`.
- Never use browser `localStorage`.

---

## Jira integration

- Auth: Basic auth `base64(email:apiToken)`.
- Base URL: `https://{domain}.atlassian.net/rest/api/3`.
- Description fields must be converted to ADF **only** in `src/lib/jira.ts`; callers pass plain strings.
- Creating an issue and attaching screenshots are separate operations.
- Reuse `issue.key` returned by issue creation; do not perform an extra lookup.
- Jira create metadata is cached in local storage (`jirawm_createmeta_{projectKey}`).
- Field serialization must stay type-aware. Do not regress `option`, `priority`, `user`, arrays, or numbers into raw strings.

---

## Bulk processing

- Processing is **strictly sequential**. Never create or attach multiple Jira tasks in parallel.
- Save progress to storage after every meaningful state transition.
- State flow: `waiting` → `creating` → `uploading` → `done` or `failed`.
- On worker restart:
  - `waiting` may resume normally.
  - `uploading` with an `issueKey` may resume attachment only.
  - `creating` without an `issueKey` must become `failed` and require manual retry, because automatic retry could create a duplicate Jira issue.
  - `done` and `failed` are skipped.
- **If a task has an existing `issueKey` when processed** (regardless of its `status` label, e.g. `waiting` after a "Retry Failed" click), `processBulkTasks` must skip `createIssue` and go straight to `uploading` → `attachScreenshot`. This prevents duplicate Jira issues when attachment failed on a previous run.
- Maintain the in-memory `activeBulkRun` guard (or an equivalent single-run mechanism) so recovery and a new `START_BULK` signal cannot process the same batch concurrently.
- Do not weaken these idempotency and recovery protections.

---

## UI and editor

- Use CSS variables from `src/styles/globals.css`; do not introduce Tailwind default color palettes.
- Use the system font stack only; do not add external font libraries.
- Preserve the approximately 400px Side Panel layout and underline-style tabs.
- The annotation editor must remain a Chrome popup window (`type: 'popup'`), not a regular tab.
- Maintain the one-editor-window guard and the storage handoff protocol between Side Panel and editor.

---

## Validation

- Do not start a development server.
- Run `npx tsc --noEmit` and `npm run build` after code changes.
- For changes involving Chrome contexts, screenshots, bulk upload, or the editor, explicitly state which manual Chrome extension checks are still required.
- Do not claim an end-to-end flow was tested unless it was actually tested in Chrome with Jira.

---

## Working style

- Read relevant files before changing them.
- Keep changes small and scoped to the request.
- Do not revert unrelated user changes.
- Update active architecture documentation when behavior changes.
- Do not update historical versioned specifications unless explicitly asked.
