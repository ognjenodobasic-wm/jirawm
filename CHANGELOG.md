# JiraWM — Changelog

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