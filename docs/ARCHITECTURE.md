# JiraWM — Arhitektura

Tehnički pregled za developere. Ekstenzija je Chrome MV3 Side Panel aplikacija bez servera, baze i OAuth-a. Sva komunikacija ide direktno ka Jira Cloud REST API v3, autentikacija je Basic auth (`base64(email:api_token)`).

---

## Tri JS konteksta

MV3 ekstenzija se izvršava u tri odvojena JS okruženja. **Nijedno ne deli memoriju sa drugim** — svaka `let`/`const` promenljiva postoji samo u svom kontekstu. Jedini most između njih je poruka (`chrome.runtime.sendMessage`) ili deljeni `chrome.storage`.

| Kontekst | Fajlovi | Uloga | Životni vek |
|----------|---------|-------|-------------|
| **Side Panel (UI)** | `src/sidepanel/*` | React UI — forme, tabele, workflow wizard | Živi dok je panel otvoren |
| **Background Service Worker** | `src/background/worker.ts` | Bulk obrada, notifikacije, otvaranje panela | MV3 ga gasi posle ~30s neaktivnosti |
| **Annotation Editor Tab** | `src/editor/*` (Faza 5, još nema) | Buduće: crtanje po screenshotu | Zaseban tab |

### Zašto ne dele memoriju
Svaki kontekst je zaseban V8 izolat. `setAuth()` pozvan u Side Panelu **ne** postavlja `_auth` u workeru — zato i Side Panel i worker svaki za sebe učitavaju `auth` iz `chrome.storage.local` i pozivaju `setAuth()` pre bilo kog Jira poziva (vidi `SingleMode.handleSubmit` i `worker.processBulkTasks`).

### Kako komuniciraju
- **Male poruke / signali** → `chrome.runtime.sendMessage`. Primer: Side Panel šalje `{ type: 'START_BULK', tasks, workflowId }` workeru (`BulkMode.startUpload`).
- **Veliki podaci (base64 screenshotovi)** → NE idu kroz `sendMessage`. Umesto toga pišu se u `chrome.storage.local` kao bafer, a čitalac ih odatle preuzima.
  - Napomena: trenutno `BulkMode` šalje i `tasks` (sa base64) i kroz `sendMessage` i upisuje ih u `jirawm_bulk_progress`. Worker svejedno merge-uje sa storage verzijom, pa je storage izvor istine za progres.
- **Deljeno stanje / progres** → `chrome.storage`. UI poll-uje `jirawm_bulk_progress` svake 1s da bi ažurirao tabelu.

---

## Chrome Storage mapa

Dva storage area: `local` (osetljivo + privremeno, nikad se ne sinhronizuje) i `sync` (workflowi, prati korisnikov Chrome nalog).

| Ključ | Area | Sadržaj | Piše | Čita |
|-------|------|---------|------|------|
| `auth` | local | `{ domain, email, apiToken, accountId }` | `Settings.handleSave` | `SingleMode`, `SidePanel`, `WorkflowManager`, `worker` |
| `accountId` | local | `string` — Jira accountId | `Settings.handleSave` (posle testConnection) | `SidePanel` (auth gate) |
| `jirawm_workflows` | **sync** | `Workflow[]` | `workflows.saveWorkflow/deleteWorkflow`, `Settings` import | `SidePanel`, `SingleMode`, `worker`, `WorkflowManager` |
| `jirawm_bulk_progress` | local | `BulkTask[]` — status svakog taska | `BulkMode`, `worker.saveProgress` | `BulkMode` (poll), `worker` |
| `jirawm_export_snapshot` | local | `ExportSnapshot` — meta poslednjeg exporta | `Settings.handleExport` | `Settings` | 
| `jirawm_compression` | local | `{ quality, maxWidth }` | `Settings.handleSaveCompression` | `SingleMode`, `Settings` |
| `jirawm_createmeta_{projectKey}` | local | `IssueTypeMeta[]` — keširan createmeta | `jira.getIssueTypes` | `jira.getIssueTypes` |

**Pravila (iz CLAUDE.md):** token/email/domain uvek `local`, nikad sync. Workflowi uvek `sync`. Nikad `localStorage`.

---

## Jira API flow

Base URL: `https://{domain}.atlassian.net/rest/api/3`. Svi pozivi idu kroz `apiFetch()` u `src/lib/jira.ts`, koji dodaje Basic auth header i baca grešku sa telom odgovora ako `!res.ok`.

### Single Task mod
```
[UI] Capture Screenshot
   └─ chrome.tabs.captureVisibleTab(null, {format:'jpeg', quality})
   └─ resizeImage() na canvas → JPEG dataURL (workflow.compression ili global)
[UI] Create Task (submit)
   └─ getLocal('auth') → setAuth()
   └─ createIssue({summary, projectKey, issueType, parentKey?, fields, fieldMeta})
        ├─ serializeField() na svako polje
        ├─ description → toADF()
        └─ POST /issue           →  { id, key }   (npr. AT-234)
   └─ attachScreenshot(key, dataURL, filename)
        └─ POST /issue/{key}/attachments  (multipart, X-Atlassian-Token: no-check)
   └─ Ako attach padne: issue postoji, UI nudi "Retry screenshot"
```

Create issue i attach su **dva odvojena poziva**. `issue.key` stiže iz create odgovora — nema dodatnog fetch-a.

### Bulk mod
```
[UI BulkMode] Start Upload
   └─ buildTasks(): svaki fajl → base64 (BulkTask[])
   └─ setLocal('jirawm_bulk_progress', tasks)
   └─ sendMessage({type:'START_BULK', tasks, workflowId})
   └─ startPolling(): svake 1s čita jirawm_bulk_progress → ažurira tabelu

[Worker processBulkTasks]  ── SEKVENCIJALNO, jedan po jedan ──
   └─ getLocal('auth') + getSync('jirawm_workflows')  → setAuth()
   └─ chrome.alarms.create('keepAlive', {periodInMinutes: 0.33})
   └─ za svaki task (preskače status==='done'):
        status='creating'  → saveProgress()
        createIssue(...)    → status='uploading', issueKey → saveProgress()
        attachScreenshot()  → status='done'
        (greška → status='failed', task.error)
        saveProgress() posle svakog koraka
   └─ chrome.alarms.clear('keepAlive')
   └─ chrome.notifications.create(...)  "X/Y tasks created"
```

Bulk je uvek sekvencijalan (nikad `Promise.all`). Status se piše u `storage.local` posle svakog koraka da bi UI poll to video.

---

## Field serialization (`serializeField`)

Jira odbija (400) ako se strukturisano polje pošalje kao goli string. `serializeField(fieldId, value, fieldMeta)` u `src/lib/jira.ts` mapira string vrednost u oblik koji Jira očekuje, na osnovu `schema.type` iz keširanog `fieldMeta`:

| `schema.type` | Izlaz | Primer |
|---------------|-------|--------|
| `option` | `{ value }` | select / radio polja |
| `priority` | `{ name }` | Priority |
| `user` | `{ accountId }` | Assignee i sl. |
| `array` + `items:'option'` | `[{ value }]` | multi-select |
| `array` + `items:'string'` | `[value]` | labels-tip |
| `number` | `Number(value)` | numerička polja |
| ostalo / nepoznato | `value` (string) | text, textarea |

**Gde se poziva:** unutar `createIssue()`, u petlji kroz `params.fields` (preskače `description`, koji ide kroz `toADF`). Poziva se i iz Single moda i iz bulk workera, jer oba prolaze kroz `createIssue` i prosleđuju `workflow.fieldMeta`.

`fieldMeta` se snima u sam workflow u trenutku kreiranja (iz `getIssueTypes`), tako da serializacija radi i offline / iz keša.

---

## Poznate zamke

1. ~~**`accountId` ključ se čita ali se nikad ne upisuje.**~~ — **Popravljeno.** `Settings.handleSave` sada snima `accountId` i u `auth` objekat i kao top-level `accountId` ključ (`setLocal('accountId', accountId)`). `SidePanel` auth gate čita top-level ključ i radi ispravno.
2. **Nekonzistentan storage za export snapshot.** `Settings` čita/piše `jirawm_export_snapshot` u `local` (usklađeno sa CLAUDE.md), ali `workflows.ts` (`getExportSnapshot`/`exportWorkflows`) koristi `sync`. Aktivni UI put je `Settings` (local); `workflows.ts` helperi za export/snapshot se trenutno ne koriste iz UI-a.
3. **select/option defaults kao goli string** — rešeno preko `serializeField`, ali samo za tipove iz tabele gore. Egzotičniji custom tipovi (cascading select, version, component) padaju u `default` granu i idu kao string → mogu vratiti 400.
4. **Worker restart recovery ne postoji.** Ako MV3 worker bude ugašen usred bulk obrade uprkos `keepAlive` alarmu (npr. browser pod pritiskom memorije), petlja se ne nastavlja automatski. `jirawm_bulk_progress` ostaje "zamrznut" na poslednjem status-u, a UI poll bez timeout-a nastavlja beskonačno. Nema logike koja na restart workera pokupi nedovršene taskove i nastavi.
5. **Dead code za komandu.** Manifest koristi rezervisanu `_execute_action`; svaki stari `chrome.commands.onCommand` listener za `open-jirawm` se nikad ne okida (trenutno je uklonjen iz workera, ali paziti pri dodavanju novih komandi).
6. **Bulk `sendMessage` nosi base64.** Suprotno pravilu "ne slati velike base64 kroz sendMessage". Radi jer je interno, ali za velike serije razmisliti o čistom storage-buffer pristupu (worker već merge-uje iz storage-a).

---

## Build i dev loop

Nema dev servera — Chrome ekstenzija zahteva build output.

```bash
npm run build        # tsc -b && vite build → /dist
npx tsc --noEmit     # type check, pre svakog commita
```

### Reload petlja
1. `npm run build` → generiše `/dist`.
2. `chrome://extensions` → uključi **Developer mode**.
3. Prvi put: **Load unpacked** → izaberi `/dist`.
4. Posle svake izmene: **Reload** (↻) dugme na kartici ekstenzije, pa reopen Side Panel.

### Gde su konzole za svaki kontekst
| Kontekst | Kako otvoriti DevTools |
|----------|------------------------|
| Side Panel (UI) | Desni klik unutar panela → **Inspect** |
| Service Worker | `chrome://extensions` → kartica ekstenzije → **service worker** (link) → otvara DevTools workera |
| Editor Tab (buduće) | Standardni DevTools u tom tabu (F12) |

Svaki kontekst ima **svoju** konzolu — `console.log` iz workera se NE vidi u Side Panel DevTools i obrnuto.
