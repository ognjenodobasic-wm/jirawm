# JiraWM — Project Structure
> Auto-generated. Run "Generate/Update structure.md" prompt to refresh.
> Last updated: 2026-07-28

---

## Root

### `.clinerules`
Cline behavior rules for this project — role definition, build loop (`npx tsc -b`, with a note that bare `tsc --noEmit` checks nothing under this repo's solution-style tsconfig), commit format, TypeScript strict mode, chrome.storage wrapper rules.

### `.gitignore`
Git ignore rules — node_modules, dist, release, key.pem, etc.

### `.oxlintrc.json`
OxLint linter configuration.

### `.vibeyardignore`
Exclude patterns for AI-readiness large-file scanning tooling (currently just `package-lock.json`).

### `AGENTS.md`
Generic agent instructions (Codex/other non-Claude agents) — project overview, architecture, build/typecheck commands (`npx tsc -b`), testing notes (no automated test suite), known pitfalls.

### `CLAUDE.md`
Claude Code instructions — project overview, phase status (Faza 1–6 complete), architecture, build commands, chrome.storage key inventory, update-notification system architecture, version-bump hook rules, two-changelog-sources sync rule, known pitfalls. Read before every task.

### `README.md`
Project README (Serbian) — problem statement, features, screenshots, setup pointer.

### `README.en.md`
English translation of the README, linked from the top of `README.md`.

### `editor.html`
HTML entry point for the annotation editor popup window. Vite processes this as a separate entry point.

### `key.pem`
Locally generated RSA private key used to derive the extension's stable ID (not committed — present only on machines that ran `scripts/generate-key.mjs`; listed here because it currently exists in this working tree).

### `key.pub.txt`
Base64 DER-encoded public key derived from `key.pem`, pasted into `manifest.json`'s `key` field so the extension keeps the same ID across rebuilds.

### `manifest.json`
Chrome Extension Manifest V3 — permissions (activeTab, storage, tabs, notifications, sidePanel, alarms), optional_host_permissions (`<all_urls>` for capture), side panel config, background service worker, keyboard shortcut command, icons, stable `key`. `version` field is the source of truth for the app version — auto-incremented on patch by the pre-commit hook.

### `package.json`
Project dependencies and scripts — React 19, Vite, @crxjs/vite-plugin, Fabric.js, Tailwind CSS v4, `simple-git-hooks` dev dependency, `prepare` script that installs git hooks, and the `simple-git-hooks` config block wiring the pre-commit patch-bump script.

### `sidepanel.html`
HTML entry point for the Chrome Side Panel.

### `tsconfig.app.json`
TypeScript config for the app source (strict mode).

### `tsconfig.json`
Root TypeScript config — solution-style, only `references` to app and node configs (no `files`), which is why `tsc -b` (not bare `tsc --noEmit`) is required to actually typecheck.

### `tsconfig.node.json`
TypeScript config for Node/Vite tooling.

### `vite.config.ts`
Vite build configuration with @crxjs/vite-plugin for Chrome extension bundling, Tailwind CSS plugin.

---

## `.claude/` — Claude Code configuration

### `.claude/agents/code-reviewer.md`
Read-only review subagent — checks diffs against this repo's documented invariants (three-context isolation, storage placement, ADF-only descriptions, sequential bulk processing, bulk idempotency), reports findings without editing.

### `.claude/agents/extension-tester.md`
Verification subagent — runs `npx tsc --noEmit`, `npm run build`, and lint, and flags known-fragile patterns (localStorage, parallel bulk processing, oversized sendMessage payloads). Note: its own instructions still use the stale `tsc --noEmit` form.

### `.claude/agents/release-manager.md`
Release-preparation subagent — walks `docs/RELEASE.md` end-to-end (version sync, changelog, `tsc` check, packaging), stops before tag/push. Its own instructions also still reference `npx tsc --noEmit`.

### `.claude/skills/changelog-entry/SKILL.md`
Lightweight skill to add a dated `docs/CHANGELOG.md` entry summarizing work so far, without bumping the version or packaging a release.

### `.claude/skills/end-of-day/SKILL.md`
Session-closeout skill — determines what changed since the last changelog touch, verifies each commit's actual current effect (not just its message), decides on a minor/major version bump if warranted, syncs `docs/CHANGELOG.md` and `changelogData.ts`, audits Help panel content, reminds about `structure.md` and the spec doc, then runs the final build check, commits, and pushes.

### `.claude/skills/fabric-v7-check/SKILL.md`
Checklist skill for Fabric.js v5→v7 API pitfalls before writing/reviewing canvas code in `src/editor/`. Still points at the old `docs/jirawm-spec-v1.3.md` filename (stale after the spec rename to `docs/jirawm-spec.md`).

### `.claude/skills/jira-field-serializer/SKILL.md`
Reference skill for adding a new Jira custom field type to `serializeField` in `src/lib/jira.ts`, documenting the existing branch pattern.

### `.claude/skills/start-of-day/SKILL.md`
Session-start skill — git sync check (stop on uncommitted changes, fast-forward pull only), unconditional `npm install` (re-registers local git hooks), build verification, then prints a session briefing (current version, latest changelog section, "Trenutno stanje" project status, last 5 commits).

---

## `.github/workflows/` — CI

### `.github/workflows/release.yml`
GitHub Actions workflow triggered on `v*` tag push — installs deps, runs `npm run package`, verifies the built manifest version matches the pushed tag, then publishes a GitHub Release with the zip attached and auto-generated notes.

---

## `.opencode/` — OpenCode tooling (non-Claude agent runtime)

### `.opencode/.gitignore`
Ignore rules scoped to this directory (node_modules, package files, bun.lock).

### `.opencode/package.json`
Declares the `@opencode-ai/plugin` dependency used by the notifications plugin below.

### `.opencode/plugins/emdash-notifications.js`
OpenCode event-hook plugin — forwards session and event notifications to a local Emdash HTTP endpoint using port/token/pty-id read from environment variables; no-ops if those aren't set.

---

## `docs/` — Documentation

### `docs/ARCHITECTURE.md`
Detailed architecture docs — three JS contexts, storage map, field serialization, image ingest pipeline, capture metadata, permission model, editor state machine, known pitfalls.

### `docs/CHANGELOG.md`
Version history for all releases, doc-facing source. Must stay in sync in substance with `src/sidepanel/help/changelogData.ts`, which is what the Help panel actually renders.

### `docs/CROP-AUDIT.md`
Point-in-time diagnosis report on crop-tool bugs in the (then-938-line, now-refactored) `AnnotateMode.tsx` — root causes only, no code changes made as part of the audit itself.

### `docs/RELEASE-INSTALL.md`
Tester-facing install guide (Serbian) bundled as `INSTALL.md` inside each release zip by `scripts/package.mjs` — download/unpack/load-unpacked instructions.

### `docs/RELEASE.md`
Step-by-step release procedure (Serbian) — version sync, changelog update, `npx tsc --noEmit` check (stale command reference), zip packaging, tag/push.

### `docs/SETUP.md`
Installation and first-time setup guide.

### `docs/WORKFLOWS.md`
User-facing workflow guide — how to create, edit, export/import workflows.

### `docs/jirawm-faza5-spec-section.md`
Standalone copy of the Faza 5 (annotation editor) spec section — same content as `docs/jirawm-spec.md` §5, kept as a separate excerpt file.

### `docs/jirawm-spec.md`
Authoritative feature specification — functional requirements (including the Comment tab, §4.3), data models, storage schema (including the update-notification keys and patch-bump hook), phase checklist through Faza 6. Renamed from `jirawm-spec-v1.3.md`; the document states inline that it is no longer versioned by filename and is updated in place instead.

---

## `public/` — Static assets

### `public/favicon.svg`
Extension favicon.

### `public/icons.svg`
SVG sprite sheet for extension icons.

### `public/icons/icon16.png`, `public/icons/icon48.png`, `public/icons/icon128.png`
Extension icon PNGs at the three sizes Chrome requires, referenced from `manifest.json`.

---

## `scripts/` — Build/dev tooling

### `scripts/bump-patch-version.mjs`
Plain Node ESM script (no dependencies) run by the pre-commit git hook — reads `manifest.json`'s version, increments the patch segment, writes the new version back to both `manifest.json` and `package.json`, logs the old/new version, and exits 1 on any read/parse failure.

### `scripts/generate-key.mjs`
One-time key-generation script — creates an RSA keypair, writes the private key to `key.pem` (refuses to overwrite an existing one), converts the public key to base64 DER and writes it to `key.pub.txt` for pasting into `manifest.json`'s `key` field.

### `scripts/package.mjs`
Packaging script run by `npm run package` — verifies `dist/` and its manifest exist, warns if `dist/manifest.json` and `package.json` versions disagree, zips `dist/` plus `docs/RELEASE-INSTALL.md` (renamed to `INSTALL.md`) into `release/jirawm-v{version}.zip`.

---

## `src/background/` — Background Service Worker

### `src/background/worker.ts`
Chrome background service worker — handles bulk task processing (START_BULK message), creates issues sequentially via Jira API, sends desktop notifications on completion, manages the `keepAlive` alarm for long-running bulk uploads, registers the `updateCheck` alarm (every 360 minutes) and calls `checkForUpdate()` both on that alarm and once immediately on worker start.

---

## `src/editor/` — Annotation Editor (popup window)

### `src/editor/main.tsx`
Entry point for the annotation editor popup. Renders `AnnotationEditor` into the DOM.

### `src/editor/AnnotationEditor.tsx`
Root editor component — reads pending editor data from `chrome.storage.local` (via `useEditorTransfer`), shows a loading/empty state, and renders `AnnotateMode` with a close handler that cleans up storage and closes the popup window.

### `src/editor/AnnotateMode.tsx`
Main Fabric.js canvas editor component (413 lines — down from an earlier 938-line monolith after being split into the modules below). Wires together canvas setup, the drawing-tools hook, crop-tool hook, annotation-history hook, the capture-details side panel, and the toolbar/dialog components; owns dirty-state tracking (image vs. capture-detail overrides) and the Save/Close/discard flow.

### `src/editor/AnnotateToolbar.tsx`
Toolbar UI component — crop/select/arrow/rect/fill/marker/text tool buttons with inline SVG icons, 5 color swatches, stroke-width dropdown, undo/redo buttons, and the Save/Close action button (label and enabled-state driven by `hasUnsavedWork`/`isSaving`).

### `src/editor/CaptureDetailsPanel.tsx`
Collapsible right-side panel (300px, collapse state persisted in `chrome.storage.local`) showing per-field capture-detail rows (URL, page title, timestamp, viewport, browser) with checkboxes to enable/disable and text inputs to override each value, plus a "Reset all details" action when any override is active.

### `src/editor/ConfirmDiscardDialog.tsx`
Modal confirmation dialog — "Discard changes?" with Keep editing / Discard buttons, shown before closing the editor with unsaved work.

### `src/editor/CropOverlay.tsx`
Crop-mode UI pieces — `CropBanner` (yellow `#fff3cd`/`#e6c200` bar with Apply/Cancel, disabled until a large-enough selection is drawn) and `CropSelectionBox` (the draggable selection rectangle overlay).

### `src/editor/annotationOverrides.ts`
Pure helpers for capture-detail override state — `normalizeOverrides()` collapses an empty overrides object to `null`; `overridesEqual()` deep-compares two override sets to detect the "dirty" state.

### `src/editor/imageExport.ts`
`exportAnnotatedImage()` — renders the final annotated image at full natural resolution by cloning canvas objects onto an offscreen temp canvas scaled by `1/scale`, exporting as JPEG at quality 0.95.

### `src/editor/useAnnotationHistory.ts`
Undo/redo history hook — maintains a stack of full canvas JSON snapshots, exposes `saveHistory`/`commitHistoryPair` (for crop, which needs a paired before/after snapshot), `undo`/`redo`, and `deleteSelected`.

### `src/editor/useCropTool.ts`
Crop-tool hook — tracks crop mode/selection/drag state in screen coordinates, converts the selection to natural image coordinates on Apply, re-renders the background image from a cropped offscreen canvas, and commits the change as a history pair.

### `src/editor/useDrawingTools.ts`
Fabric.js mouse-event wiring for the draw tools — arrow (line + triangle head), rectangle (outline or filled), text (`IText`, auto-enters editing), and numbered marker (circle + auto-incrementing label group); attaches/detaches canvas listeners based on the active tool.

### `src/editor/useEditorTransfer.ts`
Storage helper for editor ↔ side panel communication — reads pending editor data, writes annotation results, and cleans up only the `pendingEditor` key on close (the Side Panel owns `annotationResult`'s lifecycle since it may still need to consume it after the popup closes).

### `src/editor/useWindowBounds.ts`
Tracks and persists editor popup window dimensions/position via `chrome.storage.local` with 500ms debounce; also exposes `readBounds`/`saveBounds` for direct use.

---

## `src/lib/` — Shared utilities

### `src/lib/capture-adf.ts`
Capture-detail field resolution and ADF building — `buildCaptureDetailFields()` resolves each field (URL, page title, timestamp, viewport, browser) against global settings and per-screenshot overrides; `buildCaptureDetailLines()`/`buildCaptureDetailsADF()` render the resolved fields as preview lines or an ADF bullet-list block; `hasMetadataOverrides()` detects whether any override actually changes something; `buildDescriptionADF()` merges user text with the capture-details block at the configured position.

### `src/lib/capture-metadata.ts`
Permission-free capture metadata collector — `collectCaptureMetadata()` reads URL, title, viewport, DPR, zoom, browser, and OS from raw captured image dimensions and the chrome.tabs API. Viewport is derived arithmetically from image dimensions, not measured via scripting permission.

### `src/lib/image.ts`
Unified image ingest pipeline — `normalizeImage()` converts any image input (File or dataUrl) to JPEG with transparency fill, quality control, and maxWidth scaling. Also provides `readImageSize()` for reading raw image dimensions before normalization, and `toJpegFilename()` for generating attachment filenames.

### `src/lib/jira.ts`
All Jira Cloud REST API v3 interactions — auth (Basic), `testConnection`, `getProjects`, `searchIssues` (fuzzy issue search excluding sub-tasks from parent-eligible results), `getAssignableUsers`, `getIssueTypes` (with createmeta caching), `createIssue` (with field serialization and description ADF), `attachScreenshot` (returns attachment id, content URL, and a 1400×1400 thumbnail URL), and the Comment-tab trio `buildCommentADF`/`addComment`/`buildCommentUrl`/`updateComment` (the last is currently unused dead code — the inline-media retry flow that once called it was removed). Single source of fetch calls.

### `src/lib/permissions.ts`
Permission helpers — `hasCapturePermission()` checks if `<all_urls>` is granted; `requestCapturePermission()` requests it (must be called synchronously from click handler).

### `src/lib/storage.ts`
Chrome storage wrapper — `getLocal`/`setLocal` (local area), `getSync`/`setSync` (sync area), `getAppSettings`/`saveAppSettings` (app settings, with legacy-compression migration). All storage access is meant to go through this module.

### `src/lib/updateCheck.ts`
GitHub-release update check — `isNewerVersion()` compares two `major.minor.patch` strings numerically; `fetchLatestRelease()` fetches the repo's latest GitHub release, extracts the version and the first `.zip` asset's download URL, returning `null` on any failure; `checkForUpdate()` compares the fetched version against `chrome.runtime.getManifest().version` and writes/clears the `updateInfo` key in `chrome.storage.local` accordingly.

### `src/lib/workflows.ts`
Workflow CRUD — `getWorkflows`, `saveWorkflow`, `deleteWorkflow`, `buildWorkflowFields` (merges required + optional defaults into Jira fields object). Also `removeLegacySyncWorkflows` for storage migration.

---

## `src/sidepanel/` — Side Panel UI (React)

### `src/sidepanel/SidePanel.tsx`
Root component. Renders the tab bar (Task | Bulk | Comment | Workflows | Help | ⚙️), a sticky workflow selector (visible on Task/Bulk only), auth state management, and routes between `SingleMode`, `BulkMode`, `CommentMode`, `WorkflowsTab`, `Help`, `Settings`, `WorkflowManager`. `UpdateBanner` is rendered as the last child of the root layout so any future sticky footer inside `<main>` would render above it.

### `src/sidepanel/SingleMode.tsx`
Task creation — delegates screenshot capture/thumbnail/annotate UI to the shared `ScreenshotCapture` component, keeps summary/assignee/description form state (lifted into parent-managed `SingleTabState` so it survives tab switches), builds the description ADF with capture-details, creates the Jira issue, attaches screenshots sequentially with per-item retry on partial failure, and keeps a session-local "Recent" task history list.

### `src/sidepanel/BulkMode.tsx`
Bulk task creation — file drop zone, per-row summary/description/assignee inputs with live numbering, background processing via the service worker (polled via `chrome.storage.local`), sticky footer (Clear All / Start Upload) with a scanning progress indicator and spinner while active, confirmation before clearing unfinished rows, retry of only failed rows, and a completion desktop notification.

### `src/sidepanel/CommentMode.tsx`
Comment-tab component — project dropdown + `IssuePicker` fuzzy search, reuses the shared `ScreenshotCapture` component, assigns each screenshot a `[N-filename]` shortcode chip that inserts the token at the textarea cursor, attaches screenshots and posts the comment via `buildCommentADF`/`addComment`, handles partial-attach-failure and comment-post-failure states with dedicated retry buttons, and shows a success view (link to the comment, "New comment on {issue}", "New comment").

### `src/sidepanel/WorkflowsTab.tsx`
Workflow management tab — displays workflows as cards (name, project, parent summary, issue type, assignee), kebab menu with Edit/Delete, import/export JSON, empty state. Fetches parent issue summaries from Jira API on mount.

### `src/sidepanel/WorkflowManager.tsx`
5-step workflow creation/edit wizard — project selection, parent task search (sub-tasks filtered out since Jira disallows nested sub-tasks), default assignee, issue type selection, required/optional field defaults (dropdown for fields with predefined Jira values, free text otherwise), workflow naming and save (with a saving spinner/disabled-state guard against duplicate submits).

### `src/sidepanel/Settings.tsx`
Settings panel — Jira domain/email/API token input with a visibly-styled "Generate token" link, test connection, accordion-based settings sections for image handling (quality, maxWidth, transparency fill), screenshot naming (single/bulk numbering), capture details (position, field toggles), and page-access permission status with a Grant button.

### `src/sidepanel/Help.tsx`
Help panel shell — left nav (Intro, Quick setup, Task, Bulk upload, Comment, Screenshot, Editor, Workflows, Feedback, Changelog) driving a `HelpContent` switch over the components in `src/sidepanel/help/sections/`, plus a persistent (non-dismissible) update-available notice pinned to the bottom of the panel, independent of the global banner's dismissal state.

### `src/sidepanel/UpdateBanner.tsx`
Dismissible update banner — reads `updateInfo`/`dismissedUpdateVersion` from `chrome.storage.local` (and live-updates via `chrome.storage.onChanged`), renders a yellow (`#fff3cd`/`#e6c200`) bar with a "Download" link when an undismissed update exists, and writes `dismissedUpdateVersion` on dismiss. Documented as required to always be the last child of the Side Panel root layout.

### `src/sidepanel/ConnectJiraPrompt.tsx`
Empty state prompt shown when Jira is not configured — directs user to open Settings.

---

## `src/sidepanel/components/` — Reusable sub-components

### `src/sidepanel/components/Accordion.tsx`
Collapsible accordion section with tooltip — used in Settings for image, naming, and capture details sections.

### `src/sidepanel/components/AssigneeSelect.tsx`
Assignee dropdown — reads cached assignable users from `chrome.storage.local` by project key. Shows sorted user list with Unassigned option.

### `src/sidepanel/components/IssuePicker.tsx`
Fuzzy issue-search combobox — debounced (400ms) search-as-you-type by key or summary via `searchIssues`, disables sub-task results (Jira forbids parenting a sub-task under another), shows a cleared/selected chip once an issue is picked. Used by `CommentMode` and (for parent search) `WorkflowManager`.

### `src/sidepanel/components/ScreenshotCapture.tsx`
Shared screenshot capture/thumbnail/annotate component used by both `SingleMode` and `CommentMode` — wraps `useScreenshotCapture` and `useAnnotationEditor` from `src/sidepanel/single/`, renders `ScreenshotStrip`, and shows a confirmation dialog before removing a screenshot.

### `src/sidepanel/components/Tooltip.tsx`
Hover/focus tooltip — positioned relative to trigger, flips above if near bottom edge, stays inside panel horizontally. Accessible via keyboard focus.

---

## `src/sidepanel/help/` — Help panel content

### `src/sidepanel/help/primitives.tsx`
Shared presentational building blocks for Help sections — `Card`, `SectionTitle`, `Subtitle`, `Text`, `SmallText`, `Divider`, `ActionList`, `CodeBlock`, `Step`, `ToolRow`, and the `cardHeadingStyle` constant. Every section under `sections/` composes these instead of one-off markup.

### `src/sidepanel/help/changelogData.ts`
Structured changelog data (`CHANGELOG_DATA`) rendered by `ChangelogSection` — must describe the same releases with matching substance as `docs/CHANGELOG.md`.

### `src/sidepanel/help/sections/IntroSection.tsx`
"What is JiraWM?" overview — describes the 5-tab bar (Task, Bulk, Comment, Workflows, Help), the sticky workflow selector, a one-line description of each tab, and a mention of the update-notification banner/indicator.

### `src/sidepanel/help/sections/QuickSetupSection.tsx`
First-run setup guide — API token creation, connecting to Jira, creating the first workflow, plus reference cards on page access, settings overview, image handling, screenshot naming, and capture details.

### `src/sidepanel/help/sections/SingleTaskSection.tsx`
"Task" tab guide — select workflow, capture/add screenshots, add a summary, create task; plus a card on the capture-details description block.

### `src/sidepanel/help/sections/BulkUploadSection.tsx`
"Bulk" tab guide — drop screenshots, add summaries, start upload; task status icons, retry-failed, while-uploading behavior, clearing the list, completion notification.

### `src/sidepanel/help/sections/CommentSection.tsx`
"Comment" tab guide — pick project/issue, capture/add screenshots (reusing the Task tab's flow), write the comment and optionally insert shortcode chips, submit; a card explaining the shortcode-token/thumbnail-link tradeoff, and a card on the post-submit success view.

### `src/sidepanel/help/sections/ScreenshotSection.tsx`
Screenshot capture/format/strip/crop/annotation reference — capturing, image format normalization, thumbnail strip overlays, crop, and annotation tools.

### `src/sidepanel/help/sections/EditorSection.tsx`
Annotation editor reference — tool list with shortcuts, colors/stroke, undo/redo/delete, and a keyboard-shortcut table.

### `src/sidepanel/help/sections/WorkflowsSection.tsx`
Workflow system guide — what a workflow captures, the 5-step creation wizard, import/export, and a tip on splitting workflows by context.

### `src/sidepanel/help/sections/FeedbackSection.tsx`
Bug-report/feature-request guidance — GitHub issue link, what makes a good report, and a "want to contribute" call-out.

### `src/sidepanel/help/sections/ChangelogSection.tsx`
Renders `CHANGELOG_DATA` from `changelogData.ts` as a list of versioned release cards.

---

## `src/sidepanel/single/` — Task-tab internals (shared with Comment tab via `ScreenshotCapture`)

### `src/sidepanel/single/types.ts`
Shared types/constants for the Task-tab screenshot flow — `HistoryEntry`, `SingleTabState`, `SingleModeProps`, `MAX_SCREENSHOTS` (10), `readEditorBounds()`, and `buildImageSettings()` (resolves quality/maxWidth from workflow or app defaults).

### `src/sidepanel/single/useScreenshotCapture.ts`
Capture/upload hook — requests capture permission on demand, captures the active tab as lossless PNG then normalizes to JPEG, collects capture metadata, applies sequence numbering per naming settings, and handles multi-file upload with a per-batch cap warning.

### `src/sidepanel/single/useAnnotationEditor.ts`
Editor-popup orchestration hook — opens/focuses the single-instance editor popup window, writes `pendingEditor` to storage, listens for `ANNOTATION_DONE`/`CAPTURE_DETAILS_UPDATED` runtime messages to apply results back into the screenshot list, and cleans up stale storage keys.

### `src/sidepanel/single/ScreenshotStrip.tsx`
Horizontal scrollable thumbnail strip — capture/add buttons, edge fade affordance, per-thumbnail click-to-open-editor and remove button, permission-gated capture button state.

### `src/sidepanel/single/CaptureDetailsPreview.tsx`
Collapsible summary of capture-detail lines per screenshot, shown below the form fields in `SingleMode`; only renders when at least one screenshot has capture metadata.

---

## `src/styles/` — Global CSS

### `src/styles/globals.css`
Chrome-native CSS variables (--chrome-bg, --chrome-surface, --chrome-border, --chrome-text-primary, --chrome-text-secondary, --chrome-blue, --chrome-red, --chrome-green), Tailwind import, base resets.

---

## `src/types/` — TypeScript types

### `src/types/index.ts`
All shared type definitions — `AuthConfig`, `Workflow`, `JiraField`, `JiraUser`, `IssueTypeMeta`, `BulkTask`, `ScreenshotItem` (with origin, number, filename, metadata, metadataOverrides), `CaptureMetadata`, `CaptureDetailKey`/`CaptureDetailOverride`/`MetadataOverrides`, `CaptureDetailsSettings`, `AppSettings`, `ImageSettings`, `NamingSettings`, `CompressionSettings`, `PendingEditor`, `AnnotationResult` (both screenshotId-based), `WindowBounds`, and `PanelMode` (`'single' | 'bulk' | 'comment' | 'workflows' | 'help'`).

### `src/types/chrome.d.ts`
Chrome API type declarations for Manifest V3 APIs not covered by @types/chrome.

---

## Open TODOs (from code scan)

No TODO/FIXME/HACK comments found in source files (grepped across `src/`, `scripts/`, `docs/`, `.claude/`, `.github/`, `.opencode/`, and root config files).

Stale references noticed during this scan, outside the scope of this regeneration (structure.md only documents them, it does not fix them):
- `.claude/skills/fabric-v7-check/SKILL.md` still points at `docs/jirawm-spec-v1.3.md`, which was renamed to `docs/jirawm-spec.md`.
- `.claude/agents/extension-tester.md`, `.claude/agents/release-manager.md`, and `docs/RELEASE.md` still instruct `npx tsc --noEmit`, which silently checks nothing under this repo's solution-style root tsconfig — the correct command is `npx tsc -b`.
