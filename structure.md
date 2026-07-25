# JiraWM — Project Structure
> Auto-generated. Run "Generate/Update structure.md" prompt to refresh.
> Last updated: 2026-07-25

---

## Root

### `.clinerules`
Cline behavior rules for this project — role definition, build loop, commit format, TypeScript strict mode, chrome.storage wrapper rules.

### `.gitignore`
Git ignore rules — node_modules, dist, etc.

### `.oxlintrc.json`
OxLint linter configuration.


### `CLAUDE.md`
Claude Code instructions — project overview, architecture, build commands, rules, known pitfalls. Read before every task.

### `editor.html`
HTML entry point for the annotation editor popup window. Vite processes this as a separate entry point.

### `manifest.json`
Chrome Extension Manifest V3 — permissions (activeTab, storage, tabs, notifications, sidePanel, alarms), optional_host_permissions (`<all_urls>` for capture), side panel config, background service worker, keyboard shortcut command, icons.

### `package.json`
Project dependencies and scripts — React 19, Vite, @crxjs/vite-plugin, Fabric.js, Tailwind CSS v4.

### `README.md`
Project README.

### `sidepanel.html`
HTML entry point for the Chrome Side Panel.

### `tsconfig.app.json`
TypeScript config for the app source (strict mode).

### `tsconfig.json`
Root TypeScript config — references to app and node configs.

### `tsconfig.node.json`
TypeScript config for Node/Vite tooling.

### `vite.config.ts`
Vite build configuration with @crxjs/vite-plugin for Chrome extension bundling, Tailwind CSS plugin.

---

## `docs/` — Documentation

### `docs/ARCHITECTURE.md`
Detailed architecture docs — three JS contexts, storage map, field serialization, image ingest pipeline, capture metadata, permission model, editor state machine, known pitfalls.

### `docs/CHANGELOG.md`
Version history for all releases (1.0.0 → 3.0.1). Source of truth for changelog data displayed in the Help panel.

### `docs/jirawm-spec-v1.2.md`
Authoritative feature specification — functional requirements, data models, storage schema, phase checklist.

### `docs/SETUP.md`
Installation and first-time setup guide.

### `docs/WORKFLOWS.md`
User-facing workflow guide — how to create, edit, export/import workflows.

---

## `public/` — Static assets

### `public/favicon.svg`
Extension favicon.

### `public/icons.svg`
SVG sprite sheet for extension icons.

---

## `src/background/` — Background Service Worker

### `src/background/worker.ts`
Chrome background service worker — handles bulk task processing (START_BULK message), creates issues sequentially via Jira API, sends desktop notifications on completion, manages keepAlive alarm for long-running bulk uploads.

---

## `src/editor/` — Annotation Editor (popup window)

### `src/editor/main.tsx`
Entry point for the annotation editor popup. Renders AnnotationEditor component into the DOM.

### `src/editor/AnnotationEditor.tsx`
Root editor component — reads pending editor data from chrome.storage.local (via `useEditorTransfer`), passes screenshotId and dataUrl to AnnotateMode, handles ANNOTATION_DONE message, window close, and one-editor-window guard.

### `src/editor/AnnotateMode.tsx`
Full Fabric.js annotation canvas editor — unified viewer and editor mode. Supports crop (image-space accurate with scale factor), Select, Arrow, Rect (outline/fill), Numbered Marker, Text tools. 5 color presets, stroke width dropdown, Undo/Redo history stack, Delete selected. Keyboard shortcuts (V/A/R/M/T/F, Ctrl+Z/Y, Delete). Close when empty, Cancel+Save when dirty. Export at hardcoded 0.95 JPEG quality.

### `src/editor/useEditorTransfer.ts`
Storage helper for editor ↔ side panel communication — reads pending editor data, writes annotation results (screenshotId-based, not index-based), cleans up storage keys.

### `src/editor/useWindowBounds.ts`
Tracks and persists editor popup window dimensions/position via chrome.storage.local with 500ms debounce.

---

## `src/lib/` — Shared utilities

### `src/lib/jira.ts`
All Jira Cloud REST API v3 interactions — auth (Basic), testConnection, getProjects, getIssueTypes (with createmeta caching), getAssignableUsers, searchIssues, createIssue (with field serialization), attachScreenshot. Single source of fetch calls.

### `src/lib/storage.ts`
Chrome storage wrapper — getLocal/setLocal (local area), getSync/setSync (sync area), getAppSettings/saveAppSettings (app settings). All storage access goes through this module.

### `src/lib/workflows.ts`
Workflow CRUD — getWorkflows, saveWorkflow, deleteWorkflow, buildWorkflowFields (merges required + optional defaults into Jira fields object). Also removeLegacySyncWorkflows for storage migration.

### `src/lib/image.ts`
Unified image ingest pipeline — `normalizeImage()` converts any image input (File or dataUrl) to JPEG with transparency fill, quality control, and maxWidth scaling. Also provides `readImageSize()` for reading raw image dimensions before normalization, and `toJpegFilename()` for generating attachment filenames.

### `src/lib/capture-metadata.ts`
Permission-free capture metadata collector — `collectCaptureMetadata()` reads URL, title, viewport, DPR, zoom, browser, and OS from raw captured image dimensions and chrome.tabs API. Viewport is derived arithmetically from image dimensions, not measured via scripting permission.

### `src/lib/capture-adf.ts`
ADF description builder — `buildDescriptionADF()` merges user description text with capture details ADF block (URL, page title, timestamp, viewport, browser). `buildCaptureDetailLines()` is the single source of truth for detail lines, shared between ADF builder and the SingleMode preview.

### `src/lib/permissions.ts`
Permission helpers — `hasCapturePermission()` checks if `<all_urls>` is granted; `requestCapturePermission()` requests it (must be called synchronously from click handler).

---

## `src/sidepanel/` — Side Panel UI (React)

### `src/sidepanel/SidePanel.tsx`
Root component. Renders tab bar (Single Task | Bulk Upload | Workflows | Help | ⚙️), sticky workflow selector (visible on Single/Bulk only), auth state management. Routes between SingleMode, BulkMode, WorkflowsTab, Help, Settings, WorkflowManager.

### `src/sidepanel/SingleMode.tsx`
Single task creation — screenshot card with Capture (primary) and Add (secondary) buttons, horizontal thumbnail scrolling with fade affordance, click-to-open annotation editor, capture details preview (shared ADF lines), summary/description/assignee fields, create Jira issue + attach screenshots, recent task history, error handling with retry. Monotonic numbering with no renumbering on delete.

### `src/sidepanel/BulkMode.tsx`
Bulk task creation — file drop zone, per-row summary/description/assignee inputs with live numbering, background processing via service worker, progress tracking, retry failed rows, completion notification. Position-based numbering renumbers on row removal.

### `src/sidepanel/WorkflowsTab.tsx`
Workflow management tab — displays workflows as cards (name, project, parent summary, issue type, assignee), kebab menu with Edit/Delete, import/export JSON, empty state. Fetches parent issue summaries from Jira API on mount.

### `src/sidepanel/WorkflowManager.tsx`
5-step workflow creation/edit wizard — project selection, parent task search, default assignee, issue type selection, required field defaults, optional field defaults, workflow naming and save. Excludes assignee from optional fields.

### `src/sidepanel/Settings.tsx`
Settings panel — Jira domain/email/API token input, test connection, accordion-based settings sections for image handling (quality, maxWidth, transparency fill), screenshot naming (single/bulk numbering), capture details (position, field toggles), and page access permission status with Grant button.

### `src/sidepanel/Help.tsx`
Help panel with sidebar navigation — 7 sections: Intro, Quick setup, Single task, Bulk upload, Screenshot, Feedback, Changelog. Hardcoded changelog data synced with docs/CHANGELOG.md. Covers annotation editor, capture details, and crop tool documentation.

### `src/sidepanel/ConnectJiraPrompt.tsx`
Empty state prompt shown when Jira is not configured — directs user to open Settings.

---

## `src/sidepanel/components/` — Reusable sub-components

### `src/sidepanel/components/AssigneeSelect.tsx`
Assignee dropdown — reads cached assignable users from chrome.storage.local by project key. Shows sorted user list with Unassigned option.

### `src/sidepanel/components/Accordion.tsx`
Collapsible accordion section with tooltip — used in Settings for image, naming, and capture details sections.

### `src/sidepanel/components/Tooltip.tsx`
Hover/focus tooltip — positioned relative to trigger, flips above if near bottom edge, stays inside panel horizontally. Accessible via keyboard focus.

---

## `src/styles/` — Global CSS

### `src/styles/globals.css`
Chrome-native CSS variables (--chrome-bg, --chrome-surface, --chrome-border, --chrome-text-primary, --chrome-text-secondary, --chrome-blue, --chrome-red, --chrome-green), Tailwind import, base resets.

---

## `src/types/` — TypeScript types

### `src/types/index.ts`
All shared type definitions — AuthConfig, Workflow, JiraField, JiraUser, IssueTypeMeta, BulkTask, ScreenshotItem (with origin, number, filename, metadata), CaptureMetadata, CaptureDetailsSettings, AppSettings, ImageSettings, NamingSettings, CompressionSettings, PendingEditor (screenshotId-based), AnnotationResult (screenshotId-based), WindowBounds, PanelMode, etc.

### `src/types/chrome.d.ts`
Chrome API type declarations for Manifest V3 APIs not covered by @types/chrome.

---

## Open TODOs (from code scan)

No TODO/FIXME/HACK comments found in source files.