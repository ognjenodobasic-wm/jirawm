# JiraWM

[🇷🇸 Srpski](README.md) | 🇬🇧 English

A Chrome extension that turns browser screenshots into Jira tasks — without leaving the page you're looking at.

Open the side panel, capture or drop a screenshot, type a title, hit Create. The issue lands in Jira with the screenshot attached in a few seconds. Have a whole batch ready? Switch to Bulk Upload and let it run in the background while you keep working.

---

## The problem it solves

Filing a bug or a UX note in Jira takes longer than it should. You take a screenshot, switch tabs, find the right project, find the right epic, pick the issue type, set the sprint and priority, attach the file, write the title. By the time you're done you've broken your focus and half-forgotten what you wanted to say.

<img width="800" height="484" alt="jirawm-singletask" src="https://github.com/user-attachments/assets/f584f88e-81ab-49fe-bd9a-d73fb0fed78b" />

JiraWM collapses all of that to: **capture → title → submit**. Everything else — project, issue type, parent epic, sprint, priority, assignee — lives in a workflow preset that gets applied automatically.

---

## How it works: Workflows

The real time-saver in JiraWM isn't the screenshot capture — it's workflows.

A **workflow** is a saved preset that answers all the Jira questions once, so you never have to answer them again. Think of it as a shortcut to exactly the right place in Jira: the right project, the right epic, the right sprint — already set.

When you create a workflow you configure:

- **Project** — picked from your actual Jira projects, no manual key typing
- **Issue type** — Bug, Task, Story, or whatever your project uses
- **Parent task** (optional) — pin all tasks to a specific epic or story; every task created with this workflow becomes a subtask of it
- **Required field defaults** — Sprint, Priority, Component, Labels, or any field your project marks as required
- **Optional fields** — include only the fields you actually use
- **Default assignee** — pre-assign to yourself or a teammate

You set this up once. From that point on, picking the workflow is the only decision you make before capturing.

**Some examples of workflows you might create:**

| Workflow name | Project | Issue type | Parent | Sprint |
|---|---|---|---|---|
| QA — Login sprint | MOBILE | Bug | MOBILE-412 (Login epic) | Sprint 24 |
| UX feedback | DESIGN | Task | — | — |
| PM backlog | CORE | Story | — | Backlog |
| Regression — v4.2 | QA | Bug | QA-88 (v4.2 regression epic) | Sprint 23 |

Switch between workflows in one click. A good rule of thumb: one workflow per context. "QA bugs" and "PM backlog" should be separate workflows, not one workflow trying to do both.

---

## Single task

The everyday mode. You're on a page, you spot something worth filing — a bug, a UX issue, something to follow up on.

<img width="50%" height="auto" alt="singletask" src="https://github.com/user-attachments/assets/0275f1f1-f57a-44f6-b2b6-cd384d7cee4e" />

1. Open the side panel (click the extension icon or `Ctrl+Shift+S`)
2. Select a workflow from the dropdown
3. Click **Capture** to screenshot the current tab — or **Add** to upload an existing file
4. Optionally click the thumbnail to open the editor: crop the region you want, then annotate with arrows, rectangles, numbered markers, or text
5. Type a summary
6. Click **Create task**

The extension creates the issue in Jira, attaches the screenshot, and gives you back the task key as a clickable link (`AT-234`). Once a workflow is set up, the whole thing takes under ten seconds.

Need to attach multiple screenshots to one task — a few states of the same bug, for example? Just keep adding thumbnails before you submit. All of them get attached in sequence.

**Capture details** are automatically added to the task description when you use Capture: page URL, title, viewport size, zoom level, browser and OS. Handy for bug reports where reproduction conditions matter. You can pick exactly which fields are included — or turn the whole thing off — in Settings.

---

## Bulk upload

You've come out of a review session, a usability test, or a QA pass with a folder full of screenshots. Bulk Upload turns all of them into Jira tasks without you sitting there clicking through each one.

<img width="50%" height="auto" alt="bulkupload" src="https://github.com/user-attachments/assets/67065d40-263e-40fe-a111-e147829241f3" />

1. Switch to the **Bulk Upload** tab
2. Select a workflow — it applies to every row
3. Drag your screenshots onto the drop zone, or click **Select files**
4. Each file gets its own row. Type a summary per row — that's the only input you fill in
5. Click **Start upload** and get on with something else

Tasks are created one at a time in the background. You can close the side panel, switch tabs, browse normally — the worker keeps going. When it finishes, a desktop notification reports the result (`18/20 tasks created`). Click it to jump back to the panel and see all the task links.

If a few tasks fail — a Jira timeout, a network blip — a **Retry failed** button appears. It retries only the rows that didn't make it, leaving the successful ones alone.

Progress is saved to storage, so closing and reopening the panel shows exactly where things stand.

---

## Annotation editor

Click any thumbnail to open it in a floating editor window that remembers its size and position between sessions. You can look at it, annotate it, or close it without changes — the original is untouched until you click Done.

**Tools:**

| Tool | What it does |
|---|---|
| Crop | Select a region and apply. Crop before annotating — disabled once you've drawn anything |
| Select | Move or delete existing annotations |
| Arrow | Draw an arrow pointing at something |
| Rectangle | Outline rectangle to highlight a region |
| Fill | Solid filled rectangle — handy for covering sensitive info |
| Marker | Numbered circle, auto-incrementing: ①, ②, ③ |
| Text | Click to place editable text |

Five color presets, stroke width 2/3/4px. Undo/redo (`Ctrl+Z` / `Ctrl+Y`) works across a shared history stack — crops and annotations in one continuous timeline.

---

## Settings

Settings is split into three collapsible sections, all of which save automatically as you change them.

- **Image handling** — JPEG quality (default 0.85), max width (default 1920px), and a transparency fill color for PNGs. Every image is converted to JPEG the moment it enters the extension. Annotations are always saved at full quality regardless of the quality setting, so editing never degrades an image twice.
- **Screenshot naming** — numbers attachments sequentially (1.jpg, 2.jpg) so you can reference specific images from the description. Configurable separately for single task and bulk upload.
- **Capture details** — controls which fields appear in the automatic metadata block, whether it goes at the start or end of the description, and whether to strip query parameters from URLs (on by default — URLs often carry session tokens you don't want in a ticket).

---

## Setup

**Requirements:** Chrome 114+, a Jira Cloud account, a Jira API token.

**Installation:**

1. Download the latest release ZIP from the [Releases page](https://github.com/ognjenodobasic-wm/jirawm/releases)
2. Unzip it
3. Open `chrome://extensions/` in Chrome
4. Enable **Developer mode** (toggle in the top right)
5. Click **Load unpacked** and select the unzipped folder

**First-time configuration:**

1. Click the extension icon to open the side panel
2. Open **Settings** (⚙️ top right)
3. Enter your Jira subdomain (just `yourcompany` from `yourcompany.atlassian.net`), your email address, and your API token
4. Click **Test connection** — if everything is right, you'll see your display name confirmed
5. Head to the **Workflows** tab and create your first workflow

**Getting an API token:**
Go to [id.atlassian.com → Security → API tokens](https://id.atlassian.com/manage-profile/security/api-tokens) and create a new token. Treat it like a password — it goes into local browser storage and is only ever sent to Jira's own API.

**Keyboard shortcut:** `Ctrl+Shift+S` (Windows) / `Cmd+Shift+S` (Mac) opens the side panel from anywhere.

---

## Tech stack

- React 19 + TypeScript (strict) + Tailwind CSS v4
- Vite + `@crxjs/vite-plugin`
- Fabric.js (annotation editor)
- Chrome Side Panel API, Manifest V3
- Jira Cloud REST API v3

Three JavaScript contexts: Side Panel UI, Background Service Worker, Annotation Editor popup. They communicate via `chrome.runtime.sendMessage` and `chrome.storage.local`.

---

## Building from source

```
npm install
npm run build
```

Output goes to `/dist`. Load that folder as an unpacked extension.

```
npx tsc --noEmit   # type check
npm run build      # production build
```

---

## For contributors using AI tools

`CLAUDE.md` and `.clinerules` contain project instructions for AI coding assistants
(Claude Code and Cline). If you use either tool, they will pick these up automatically
— build loop, commit format, TypeScript rules, storage conventions and known pitfalls
are all documented there.

`AGENTS.md` covers multi-agent coordination rules for sessions that involve more than
one AI tool at the same time.

---

## Distribution

JiraWM is distributed internally as a load-unpacked build — not through the Chrome Web Store. Releases are published on [GitHub](https://github.com/ognjenodobasic-wm/jirawm/releases). When a new version is available, the extension shows an update indicator in the side panel so you know to grab it.

---

## Contributing

JiraWM is built for internal use but the codebase is open. If you work with Chrome extensions, React, or Jira integrations and want to contribute — you're welcome to open an issue or a PR on [GitHub](https://github.com/ognjenodobasic-wm/jirawm).

Architecture notes, storage schema, and known pitfalls are in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
