# JiraWM — Changelog

## 3.2.0 — Bulk upload UX overhaul, workflow safeguards, and visual polish

### Added
- Workflow setup now prevents selecting a sub-task issue as a parent (Jira does not allow subtasks of subtasks).
- Required/optional workflow fields with predefined Jira values now show a dropdown instead of a free-text input.
- Bulk upload: Success (green) / Error (red) status labels with clearer wording.
- Bulk upload: animated scanning progress indicator in the header while an upload is running, visible regardless of scroll position.
- Bulk upload: spinner and "Uploading…" label on Start Upload while processing.
- Bulk upload: sticky footer (Clear All / Start Upload) pinned to the bottom of the panel.
- Bulk upload: "Clear All" now asks for confirmation if there are unfinished (non-success) rows.
- Bulk upload: completed rows are automatically removed from the list once new screenshots are added.
- Save Workflow now shows a spinner and is disabled while saving, preventing duplicate submissions.
- Create Task button shows a spinner while submitting.
- Hover background styling added to native select dropdown options.
- Serbian translation of the README is now the primary README; the original English version is preserved as README.en.md.

### Fixed
- Jira API error responses are now parsed into readable messages instead of showing raw JSON.
- Arrow tool (and any default tool) no longer fails to respond on initial annotation editor load — fixed a canvas-readiness race condition.
- Bulk upload no longer allows submitting rows with an empty required Summary field.
- Bulk upload no longer re-uploads already-successful rows when Start Upload is clicked again on the same batch.
- Fixed a double-click race on Start Upload where the processing state wasn't set immediately.

### Changed
- Create Task and Save Workflow buttons are now green (previously blue) to visually distinguish the primary continue action.
- Workflow breadcrumb in Single Task now uses → separators instead of middle dots.
- Removed the stale keyboard-shortcuts column from the annotation editor tools table in both README files (those shortcuts no longer exist).

## 3.1.2 — Bulk retry attachment-only fix + bulk filename numbering fix + editor handoff race fix

### Fixed
- Retry Failed no longer creates a duplicate Jira issue when a task already has an `issueKey`.
  If `createIssue` succeeded but `attachScreenshot` failed, the task is now retried from the
  `uploading` state — attachment only, no second `POST /issue` call.
- State transition `waiting → uploading` (with saved issueKey) is persisted to
  `chrome.storage.local` before the attachment attempt so that a worker restart mid-retry
  can resume correctly.
- Bulk upload filename numbering no longer accumulates prefixes on add/remove row.
  Each row now keeps a stable `originalFilename` used for renumbering, preventing
  `1 - 1 - slika.jpg` artefacts.
- Annotation editor / side panel storage handoff race fixed: editor no longer deletes
  `annotationResult` on close, so Side Panel can reliably read and apply saved annotations
  before cleanup.
- Bulk Upload start/retry now handles async worker response. If worker rejects `START_BULK`,
  UI stops processing state, cancels polling, and shows an explicit error instead of hanging.

## 3.1.1 — Crop tool and annotation editor fixes

### Fixed
- Crop toolbar button now correctly enters crop mode.
- Crop dim overlay now darkens the area outside the selection instead of the selection itself.
- Crop Apply no longer produces a blank canvas.
- Save no longer shows a false "unsaved changes" confirmation prompt when saving intentionally.
- Marker labels now use the correct system sans-serif font instead of a serif fallback.
- Crop confirmation bar now has a light yellow background to signal crop mode is active.

### Changed
- Crop mode now opens empty — the user draws their own selection zone instead of starting from a pre-filled default.
- Selection can be moved by dragging its body.
- Selection can be resized by dragging any of the eight handles.
- Dragging outside the selection starts a new selection.
- Tool-activation single-letter keyboard shortcuts removed to avoid conflicts with text editing.

## 3.1.0 — Release packaging

### Added
- Stable extension ID via manifest `key` field.
- `npm run generate-key` script to create and export the extension RSA key.
- `npm run package` script that builds and produces `release/jirawm-v{version}.zip`.
- ZIP layout with a single top-level folder `jirawm-v{version}/` containing the full `dist/` contents plus `INSTALL.md`.
- GitHub Actions workflow (`.github/workflows/release.yml`) that builds, verifies the tag matches `manifest.json`, and publishes the Release with the ZIP attached.
- `docs/RELEASE-INSTALL.md` — tester install guide in Serbian.
- `docs/RELEASE.md` — release checklist in Serbian.

## 3.0.1 — Fixes


### Fixed
- Screenshots taken with the extension were compressed twice, softening text.
  Capture is now lossless and compressed only once.
- The Timestamp option in Settings had no effect on the description block
- Selecting more than 10 files at once bypassed the per-task limit
- Annotations could be written to the wrong screenshot if one was deleted while
  the editor was open
- The capture details preview did not match what was sent to Jira
- The permission prompt could be skipped on the very first screenshot

## [3.0.0] — Juli 2026
### Novo
- Crop tool u editoru — izreži screenshot pre ili posle anotacije
- Capture details block u opisu taska — URL, viewport, zoom, browser, OS
- Screenshot kartica sa horizontalnim skrolom, Capture i Add dugmadima
- Permission-free viewport derivation — širina ekrana izračunata iz dimenzija slike, bez potrebe za page access do prvog screenshot-a
- Page access premješten iz required u optional host_permissions, traži se na klik Capture
- Single screenshot numeracija (1.jpg, 2.jpg...) i bulk upload numeracija prefiksa ("1 - filename.jpg")
- Editor export uvek kvalitet 0.95, nezavisno od ingest quality postavke

### Removed
- Thumbnail drag-to-reorder — Jira does not preserve attachment order
- Separate Preview mode — editor now opens directly from the thumbnail

## [2.1.0] — Juli 2026
### Popravljeno
- Lista projekata prikazuje samo aktivne projekte, sortirana abecedno
- Pretraga parent taska prepisana — direktan lookup po key-u, wildcard JQL, svi izvori uvek upitani sa izolacijom grešaka
- Uklonjen client-side filter koji je odbacivao validne server rezultate
- Migracija sa deprecated GET /search na POST /search/jql
- Assignee dropdown sada učitava korisnike odmah po izboru projekta
- Save dugme vraćeno i uvek vidljivo u formi za workflow
- Polje za ime workflowa premješteno na vrh forme
- Issue type pozicioniran iznad default assignee

### Novo
- Pretraživi assignee combobox zamjenjuje dugu native listu
- Inline "Connect to Jira" link u empty state-u, vodi direktno na Settings

## [2.0.0] — Juli 2026
### Novo
- Annotation editor — popup prozor sa Fabric.js canvas editorom
- Screenshot preview — readonly popup pre anotacije
- Alati: strelica, kvadrat (outline/fill), numbered markers (1,2,3...), tekst
- 5 preset boja, stroke width izbor (2/3/4px)
- Undo/Redo, delete selected, keyboard shortcuts
- Anotovani screenshot zamenjuje original u thumbnail strip-u
- Popup prozor pamti dimenzije i poziciju između sesija

## [1.4.0] — Juli 2026
### Novo
- Assignee dropdown u Single modu (Summary → Assignee → Description redosled)
- Assignee dropdown per-row u Bulk modu
- Workflow default može da pre-popuni assignee
- Help panel sa 6 sekcija: Intro, Quick setup, Single task, Bulk upload, Screenshot, Feedback
- Help dostupan kao link u top baru

## [1.3.0] — Juli 2026
### Novo
- Thumbnail strip — više screenshotova po tasku (max 10)
- Drag & drop reorder thumbnailova
- Screenshot lightbox sa navigacijom između screenshotova
- Sekvencijalni upload više attachmenta po tasku
- Partial success handling (task kreiran, neki attachmenti failed)

## [1.2.0] — Juli 2026
### Novo
- Export workflowa kao JSON fajl (workflows-jirawm.json)
- Import workflowa iz JSON fajla (merge sa postojećim)
- Snapshot metadata u Settings-u

## [1.1.0] — Juli 2026
### Novo
- Bulk mod — batch kreiranje taskova iz više screenshotova
- Background Service Worker processing (1 po 1, sekvencijalno)
- Per-row status: Waiting → Creating → Uploading → Done/Failed
- Progress persistencija (preživljava zatvaranje panela)
- Desktop notifikacija po završetku bulk uploada
- Retry samo failed redova
- Service Worker keepalive alarm

## [1.0.0] — Juli 2026
### Novo
- Inicijalno izdanje
- Chrome Side Panel sa Single Task i Bulk Upload tabovima
- Settings — Jira domain, email, API token, test konekcije
- Workflow CRUD — kreiranje, editovanje, brisanje workflow preseta
- Screenshot capture (chrome.tabs.captureVisibleTab)
- JPEG kompresija (0.85 quality, 1920px maxWidth)
- Kreiranje Jira taska (POST /issue) + attachment (POST /attachments)
- Prikaz kreiranog taska kao klikabilni link (AT-234)