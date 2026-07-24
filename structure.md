# JiraWM — Project Structure
> Auto-generated. Run "Generate/Update structure.md" prompt to refresh.
> Last updated: 2026-07-24

---

## Root

### `.clinerules`
Cline behavior rules for this project — role definition, build loop, commit format, TypeScript strict mode, chrome.storage wrapper rules.

### `.gitignore`
Git ignore rules — node_modules, dist, etc.

### `.oxlintrc.json`
OxLint linter configuration.

### `CHANGELOG.md`
Version history for all releases (1.0.0 → 2.0.0). Source of truth for changelog data displayed in the Help panel.

### `CLAUDE.md`
Claude Code instructions — project overview, architecture, build commands, rules, known pitfalls. Read before every task.

### `editor.html`
HTML entry point for the annotation editor popup window. Vite processes this as a separate entry point.

### `manifest.json`
Chrome Extension Manifest V3 — permissions, side panel config, background service worker, keyboard shortcut command, icons.

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
Detailed architecture docs — three JS contexts, storage map, field serialization, known pitfalls.

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
Root editor component — reads pending editor data from storage, routes between Preview and Annotate modes, handles ANNOTATION_DONE message and window close.

### `src/editor/PreviewMode.tsx`
Read-only screenshot preview in a popup window. Shows full-size image with Annotate and Close buttons, Escape keyboard shortcut.

### `src/editor/AnnotateMode.tsx`
Full Fabric.js annotation canvas editor — Select, Arrow, Rect (outline/fill), Numbered Marker, Text tools. 5 color presets, stroke width dropdown, Undo/Redo history stack, Delete selected. Keyboard shortcuts (V/A/R/M/T/F, Ctrl+Z/Y, Delete). Export as JPEG.

### `src/editor/useEditorTransfer.ts`
Storage helper for editor ↔ side panel communication — reads pending editor data, writes annotation results, cleans up storage keys.

### `src/editor/useWindowBounds.ts`
Tracks and persists editor popup window dimensions/position via chrome.storage.local with 500ms debounce.

---

## `src/lib/` — Shared utilities

### `src/lib/jira.ts`
All Jira Cloud REST API v3 interactions — auth (Basic), testConnection, getProjects, getIssueTypes (with createmeta caching), getAssignableUsers, searchIssues, createIssue (with field serialization), attachScreenshot. Single source of fetch calls.

### `src/lib/storage.ts`
Chrome storage wrapper — getLocal/setLocal (local area), getSync/setSync (sync area). All storage access goes through this module.

### `src/lib/workflows.ts`
Workflow CRUD — getWorkflows, saveWorkflow, deleteWorkflow, buildWorkflowFields (merges required + optional defaults into Jira fields object). Also removeLegacySyncWorkflows for storage migration.

---

## `src/sidepanel/` — Side Panel UI (React)

### `src/sidepanel/SidePanel.tsx`
Root component. Renders tab bar (Single Task | Bulk Upload | Workflows | Help | ⚙️), sticky workflow selector (visible on Single/Bulk only), auth state management. Routes between SingleMode, BulkMode, WorkflowsTab, Help, Settings, WorkflowManager.

### `src/sidepanel/SingleMode.tsx`
Single task creation — capture screenshot, thumbnail strip with lightbox, drag reorder, summary/description/assignee fields, create Jira issue + attach screenshots, recent task history, error handling with retry.

### `src/sidepanel/BulkMode.tsx`
Bulk task creation — file drop zone, per-row summary input, background processing via service worker, progress tracking, retry failed rows, completion notification.

### `src/sidepanel/WorkflowsTab.tsx`
Workflow management tab — displays workflows as cards (name, project, parent summary, issue type, assignee), kebab menu with Edit/Delete, import/export JSON, empty state. Fetches parent issue summaries from Jira API on mount.

### `src/sidepanel/WorkflowManager.tsx`
5-step workflow creation/edit wizard — project selection, parent task search, default assignee, issue type selection, required field defaults, optional field defaults, workflow naming and save. Excludes assignee from optional fields.

### `src/sidepanel/Settings.tsx`
Settings panel — Jira domain/email/API token input, test connection, JPEG compression settings (quality slider, max width), save compression.

### `src/sidepanel/Help.tsx`
Help panel with sidebar navigation — 7 sections: Intro, Quick setup, Single task, Bulk upload, Screenshot, Feedback, Changelog. Hardcoded changelog data synced with CHANGELOG.md.

### `src/sidepanel/ConnectJiraPrompt.tsx`
Empty state prompt shown when Jira is not configured — directs user to open Settings.

---

## `src/sidepanel/components/` — Reusable sub-components

### `src/sidepanel/components/AssigneeSelect.tsx`
Assignee dropdown — reads cached assignable users from chrome.storage.local by project key. Shows sorted user list with Unassigned option.

---

## `src/styles/` — Global CSS

### `src/styles/globals.css`
Chrome-native CSS variables (--chrome-bg, --chrome-surface, --chrome-border, --chrome-text-primary, --chrome-text-secondary, --chrome-blue, --chrome-red, --chrome-green), Tailwind import, base resets.

---

## `src/types/` — TypeScript types

### `src/types/index.ts`
All shared type definitions — AuthConfig, Workflow, JiraField, JiraUser, IssueTypeMeta, BulkTask, ScreenshotItem, CompressionSettings, EditorMode, PendingEditor, AnnotationResult, PanelMode, etc.

### `src/types/chrome.d.ts`
Chrome API type declarations for Manifest V3 APIs not covered by @types/chrome.

---

## Open TODOs (from code scan)

No TODO/FIXME/HACK comments found in source files.