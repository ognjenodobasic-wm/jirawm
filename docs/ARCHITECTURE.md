# JiraWM — Arhitektura

Tehnički pregled za developere. Ekstenzija je Chrome MV3 Side Panel aplikacija bez servera, baze i OAuth-a. Sva komunikacija ide direktno ka Jira Cloud REST API v3, autentikacija je Basic auth (`base64(email:api_token)`).

---

## Tri JS konteksta

MV3 ekstenzija se izvršava u tri odvojena JS okruženja. **Nijedno ne deli memoriju sa drugim** — svaka `let`/`const` promenljiva postoji samo u svom kontekstu. Jedini most između njih je poruka (`chrome.runtime.sendMessage`) ili deljeni `chrome.storage`.

| Kontekst | Fajlovi | Uloga | Životni vek |
|----------|---------|-------|-------------|
| **Side Panel (UI)** | `src/sidepanel/*` | React UI — forme, tabele, workflow wizard | Živi dok je panel otvoren |
| **Background Service Worker** | `src/background/worker.ts` | Bulk obrada, notifikacije, otvaranje panela | MV3 ga gasi posle ~30s neaktivnosti |
| **Annotation Editor Popup** | `src/editor/*` | Crop i anotacija screenshota | Popup prozor (`type:'popup'`), živi dok je prozor otvoren |

### Zašto ne dele memoriju
Svaki kontekst je zaseban V8 izolat. `setAuth()` pozvan u Side Panelu **ne** postavlja `_auth` u workeru — zato i Side Panel i worker svaki za sebe učitavaju `auth` iz `chrome.storage.local` i pozivaju `setAuth()` pre bilo kog Jira poziva (vidi `SingleMode.handleSubmit` i `worker.processBulkTasks`).

### Kako komuniciraju (i editor popup)
- **Male poruke / signali** → `chrome.runtime.sendMessage`. Primer: Side Panel šalje `{ type: 'START_BULK', workflowId }` workeru (`BulkMode.startUpload`).
- **Veliki podaci (base64 screenshotovi)** → NE idu kroz `sendMessage`. Umesto toga pišu se u `chrome.storage.local` kao bafer, a čitalac ih odatle preuzima.
  - `BulkMode` upisuje kompletan `BulkTask[]` (uključujući base64 screenshotove) u `jirawm_bulk_progress`, a zatim šalje samo signal `{ type: 'START_BULK', workflowId }`. Worker učitava taskove isključivo iz storage-a.
- **Deljeno stanje / progres** → `chrome.storage`. UI poll-uje `jirawm_bulk_progress` svake 1s da bi ažurirao tabelu.

---

## Chrome Storage mapa

Workflowi se čuvaju u `local` storage-u. `sync` je legacy lokacija iz koje se podaci uklanjaju prilikom učitavanja ekstenzije (`removeLegacySyncWorkflows`).

| Ključ | Area | Sadržaj | Piše | Čita |
|-------|------|---------|------|------|
| `auth` | local | `{ domain, email, apiToken, accountId }` | `Settings.handleSave` | `SingleMode`, `SidePanel`, `WorkflowManager`, `worker` |
| `accountId` | local | `string` — Jira accountId | `Settings.handleSave` (posle testConnection) | `SidePanel` (auth gate) |
| `jirawm_workflows` | **local** | `Workflow[]` | `workflows.saveWorkflow/deleteWorkflow`, `Settings` import | `SidePanel`, `SingleMode`, `worker`, `WorkflowManager` |
| `jirawm_bulk_progress` | local | `BulkTask[]` — status svakog taska | `BulkMode`, `worker.saveProgress` | `BulkMode` (poll), `worker` |
| `jirawm_export_snapshot` | local | `ExportSnapshot` — meta poslednjeg exporta | `Settings.handleExport` | `Settings` |
| `jirawm_createmeta_{projectKey}` | local | `IssueTypeMeta[]` — keširan createmeta | `jira.getIssueTypes` | `jira.getIssueTypes` |
| `pendingEditor` | local | `PendingEditor` — screenshotId + dataUrl za editor popup | `SingleMode.openEditor` | `AnnotationEditor` on mount |
| `annotationResult` | local | `AnnotationResult` — anotovani dataUrl + screenshotId | `AnnotateMode` (Save) | `SingleMode` ANNOTATION_DONE listener |
| `editorWindowBounds` | local | `WindowBounds` — poslednje dimenzije editor popupa | `useWindowBounds` hook | `SingleMode.openEditor` |

**Pravila (iz CLAUDE.md):** token/email/domain uvek `local`, nikad sync. Workflowi uvek `local`. Nikad `localStorage`. `removeLegacySyncWorkflows()` čisti preostale sync zapise.

---

## Jira API flow

Base URL: `https://{domain}.atlassian.net/rest/api/3`. Svi pozivi idu kroz `apiFetch()` u `src/lib/jira.ts`, koji dodaje Basic auth header i baca grešku sa telom odgovora ako `!res.ok`.

### Single Task mod
```
[UI] Capture screenshot (or Add files)
   └─ captureVisibleTab(null, {format:'png'}) → lossless PNG
   └─ collectCaptureMetadata() → viewport, URL, browser from raw image dimensions
   └─ normalizeImage(rawDataUrl, imageSettings) → single JPEG compression via canvas
   └─ adds ScreenshotItem to screenshots[]
[UI] Create Task (submit)
   └─ getLocal('auth') → setAuth()
   └─ createIssue({summary, projectKey, issueType, parentKey?, fields, fieldMeta, descriptionOptions})
        ├─ buildDescriptionADF() u Jira sloju (spaja plain description + capture details)
        ├─ serializeField() na svako polje
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
   └─ sendMessage({type:'START_BULK', workflowId})
       └─ čeka async odgovor worker-a `{ ok: true }`
          ├─ ok: startPolling(): svake 1s čita jirawm_bulk_progress → ažurira tabelu
          └─ greška (`ok:false` ili runtime error): prekida polling, `isProcessing=false`, prikazuje error banner u UI

[Worker processBulkTasks]  ── SEKVENCIJALNO, jedan po jedan ──
   └─ getLocal('auth') + getLocal('jirawm_workflows')  → setAuth()
   └─ resumeBulkIfNeeded()  (automatski oporavak prekinutih bulk sesija posle restarta workera)
   └─ chrome.alarms.create('keepAlive', {periodInMinutes: 0.33})
   └─ za svaki task (preskače status==='done' i status==='failed'):
        Ako task.issueKey postoji (npr. retry nakon pada attachmenta):
          status='uploading' → saveProgress()
          attachScreenshot()  → status='done'
          (greška → status='failed', task.error)
        Inače:
          status='creating'  → saveProgress()
          createIssue(...)    → status='uploading', issueKey → saveProgress()
          attachScreenshot()  → status='done'
          (greška → status='failed', task.error)
        saveProgress() posle svakog koraka
   └─ chrome.alarms.clear('keepAlive')
   └─ chrome.notifications.create(...)  "N issues created · M attachments retried · K failed" (samo nivoi koji su >0, sa ✅ na kraju ako nema failed)
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

**Gde se poziva:** unutar `createIssue()`, u petlji kroz `params.fields` (preskače `description`, koji `createIssue` centralno pretvara u ADF preko `buildDescriptionField`). Poziva se i iz Single moda i iz bulk workera, jer oba prolaze kroz `createIssue` i prosleđuju `workflow.fieldMeta`.

`fieldMeta` je **runtime-only** — nije persisted u storage. `saveWorkflow` u `src/lib/workflows.ts` ga eksplicitno briše pre nego što se workflow pohrani. On se rekonstruiše svaki put kada se workflow koristi, prikupljanjem createmeta iz Jira API-ja (ili iz kešinga). Ovo omogućava da se serializacija radi sa uvek-svežim informacijama o poljima.

---

## Screenshot model

Single Task mod podržava **više screenshotova po tasku** (max 10). Model je `ScreenshotItem` iz `src/types/index.ts`:

```ts
interface ScreenshotItem {
  id: string;        // crypto.randomUUID()
  dataUrl: string;   // JPEG data URL after normalizeImage
  origin: 'capture' | 'upload';
  number: number | null;  // sequence number (1, 2, 3...), null when numbering is off
  filename: string;       // final attachment filename, e.g. "1.jpg"
  metadata: CaptureMetadata | null;  // only when origin === 'capture'
  label?: string;
  annotated?: boolean;
}
```

### Screenshot card u SingleMode
- Stanje: `screenshots: ScreenshotItem[]` + `selectedId`.
- Header: **Capture** (primary, blue) i **Add** (secondary, outline). Capture traži page access permisiju (optional `<all_urls>`) i pravi `captureVisibleTab`. Add otvara file picker za upload.
- Thumbnails su horizontalni scroll (64×64). Klik na thumbnail otvara **annotation editor** direktno; `×` u uglu uklanja stavku (`handleRemove`).
- **Numbering (single mode):** monoton counter (counterRef) počinje od 1. Kada se screenshot obriše, broj se NE menja — sledeći nastavlja niz (1, 3, 4...). Counter se resetuje samo posle uspešnog `createIssue`. Ovo osigurava da referenciranje "screenshot 3" u deskripciji ostaje validno.
- **Fade affordance:** kad sadržaj prelazi širinu panela, desna ivica ima gradijentni fade koji nestaje kad se skroluje do kraja.

### Sekvencijalni attachment flow
Posle uspešnog `createIssue`, screenshotovi se kače **jedan po jedan** (nikad paralelno):

```
createIssue(...) → issue.key
za svaki item u screenshots:
   attachScreenshot(issue.key, item.dataUrl, item.filename)
   uspeh → uploadedCount++
   greška → failedItems.push(item)   (petlja se NE prekida)
```

**Partial success handling:** ako je `failedItems.length > 0`, issue je već kreiran (ne poništava se) — UI prikazuje `X/N screenshots uploaded`, postavlja `attachFailed=true` i nudi **Retry screenshots** (`retryFailedAttachments`), koji ponovo prolazi kroz sve i re-attach-uje.

**Max 10 screenshotova po tasku** — tvrdo ograničenje u `handleCapture` i `handleFiles` (guard `screenshots.length >= MAX_SCREENSHOTS`). Ako se doda više fajlova nego što je preostalo mesta, višak se preskače i korisnik dobija poruku koliko fajlova je preskočeno.

---

## Image ingest pipeline

Svaka slika koja ulazi u ekstenziju prolazi kroz `normalizeImage()` u `src/lib/image.ts`. Funkcija `resizeImage` više ne postoji.

### Tok obrade
```
Input (File | PNG/JPEG dataUrl)
  → drawImage na canvas sa transparencyFill pozadinom (pre drawImage — bela ili crna)
  → scale na maxWidth ako je širina veća
  → canvas.toDataURL('image/jpeg', quality)
  → { dataUrl: string, width: number, height: number }
```

### Capture — lossless PNG
`chrome.tabs.captureVisibleTab` se poziva sa `format: 'png'`. PNG je lossless i služi samo kao transfer format — `normalizeImage` zatim vrši **jedini JPEG prolaz** korisničkim quality podešavanjem. Ponovno korišćenje `format: 'jpeg'` na capture pozivu bi prouzrokovalo **dvostruku kompresiju** i primetno omekšavanje teksta na screenshotovima.

### Editor export — 0.95 quality
Annotation editor izvozi završni rezultat sa hardkodiranom `quality: 0.95`, nezavisno od korisničkog ingest quality podešavanja. Ovo sprečava gubitak kvaliteta pri svakom čuvanju (npr. crop pa annotate).

### Transparency fill
JPEG nema transparentnost. PNG-ovi sa providnim oblastima dobijaju belu (ili crnu, po Settings podešavanju) pozadinu pre nego što se nacrtaju na canvas. Bez ovoga, transparentne oblasti bi bile crne.

### Bulk mode
Bulk mod koristi isti `normalizeImage()` pipeline sa istim podešavanjima kvaliteta.

---

## Capture metadata

Kada korisnik napravi screenshot (Capture), ekstenzija prikuplja metapodatke o uslovima snimanja. Ovi podaci se **ne pišu u description textarea** — oni se generišu pri submitu i dodaju u description ADF blok.

### Viewport derivacija
Viewport se **izračunava aritmetički**, ne meri se pomoću `scripting` permisije:

```
cssViewport = capturedImagePx / (devicePixelRatio * zoomFactor)
```

- `devicePixelRatio` dolazi iz side panela (isto Chrome okruženje, isti display).
- `zoomFactor` se čita iz `chrome.tabs.get(tabId)`.
- `capturedImagePx` su sirove dimenzije capture slike — **moraju se pročitati pre** `normalizeImage` jer ona downscale-uje na maxWidth.

Ovo izbegava potrebu za `scripting` permisijom.

### Podaci koji se prikupljaju
`collectCaptureMetadata()` u `src/lib/capture-metadata.ts` prikuplja:
- URL i naslov stranice (iz `chrome.tabs.get`)
- Vreme snimanja (ISO 8601)
- Viewport dimenzije (izračunate)
- Device pixel ratio (iz side panela)
- Zoom factor (iz taba)
- Browser i OS (iz `navigator.userAgent`)

### Prikaz u description ADF-u
`buildDescriptionADF()` u `src/lib/capture-adf.ts` gradi ADF doc koji spaja korisnički tekst i capture details blok, ali se finalno poziva iz Jira sloja (`src/lib/jira.ts`), ne iz UI submit koda. UI prosleđuje plain `description` plus `descriptionOptions` (screenshots + settings), a `createIssue()` radi finalnu ADF konverziju. Ako caller pošalje već validan ADF doc, Jira sloj ga koristi direktno (bez duple konverzije). `buildCaptureDetailLines()` je jedinstven izvor istine za linije koje se prikazuju — koristi se i za ADF list items i za preview u SingleMode panelu.

---

## Permission model

### Required permissions (u manifest.json)
```
activeTab, storage, tabs, notifications, sidePanel, alarms
```

### Host permissions
- `https://*.atlassian.net/*` — u `host_permissions` (required) — za Jira API pozive.
- `<all_urls>` — u `optional_host_permissions` — za `captureVisibleTab`.

### On-demand capture permission
Prilikom prvog klika na **Capture**, ekstenzija poziva `chrome.permissions.request({ origins: ['<all_urls>'] })`. Ovaj poziv mora biti **prvi await** unutar click handlera — bilo koji `await` pre njega uzrokuje da Chrome odbaci zahtev tiho, bez greške u konzoli.

Ako je permisija već odobrena, `request` odmah vraća `true` bez prikazivanja dijaloga. Ako korisnik odbije, korisnik dobija poruku da koristi **Add** za upload umesto Capture.

Settings panel prikazuje status page access permisije (Granted/Grant dugme).

---

## Editor popup kontekst

Annotation editor se otvara kao `chrome.windows.create({ type: 'popup' })` — bez Chrome toolbara, kao čist aplikacijski prozor.

### `chrome.windows.create type:'popup'` pattern

```ts
// SingleMode.tsx — openEditor()
chrome.windows.create({
  type: 'popup',
  url: chrome.runtime.getURL('editor.html'),
  width: bounds?.width ?? 1000,
  height: bounds?.height ?? 700,
  left: bounds?.left,
  top: bounds?.top,
}, (win) => {
  setEditorWindowId(win?.id ?? null);
});
```

URL ne sadrži query parametre. Svi podaci putuju kroz `chrome.storage.local`.

### pendingEditor / annotationResult storage protokol

Dva privremena ključa u `chrome.storage.local` služe kao most između Side Panel-a i editor popupa:

| Ključ | Piše | Čita | Briše |
|-------|------|------|-------|
| `pendingEditor` | `SingleMode.openEditor` | `AnnotationEditor` on mount | `AnnotationEditor` close (always) ili `SingleMode` posle uspešne potrošnje resulta |
| `annotationResult` | `AnnotateMode` (Save) | `SingleMode` ANNOTATION_DONE listener | Isključivo `SingleMode` nakon uspešnog read/apply (ili safe discard ako screenshot više ne postoji) |

**pendingEditor** sadrži `{ dataUrl, screenshotId }`. Screenshot ID se koristi umesto array indexa zato što korisnik može da obriše screenshot dok je editor popup otvoren — index-based matching bi napisao anotaciju na pogrešnu sliku.

**annotationResult** sadrži `{ dataUrl, screenshotId }`. Ako screenshot sa datim ID-om više ne postoji (obrisan je), rezultat se tiho odbacuje.

Flow: Side Panel upisuje `pendingEditor` → otvara popup → popup čita i prikazuje screenshot → "Save" upisuje `annotationResult` + šalje `ANNOTATION_DONE` message → Side Panel asinhrono čita result, proverava da li screenshot postoji, zamenjuje thumbnail ako postoji (ili safe-discard ako je obrisan), pa tek onda briše `annotationResult` (i `pendingEditor`). Popup pri zatvaranju čisti samo `pendingEditor`; ne sme da briše `annotationResult`.

### Editor state machine

Editor ima dva stanja dugmadi:
- **Close** — kad je canvas prazan (bez objekata). Klik zatvara prozor bez potvrde.
- **Cancel + Save** — kad je canvas prljav (ima objekata). Cancel traži potvrdu ("Discard annotations?"). Save izvozi annotated sliku i šalje nazad u Side Panel.

Escape taster: ako je canvas prljav, otvara confirm dialog; ako je prazan, zatvara.

### Crop tool

Crop radi u editoru: korisnik bira region, Apply konvertuje u image-space koordinate, iseče sliku, i postavlja novi background. Crop je blokiran kad canvas ima objekte (annotated) — zaštita od gubitka anotacija. Undo posle cropa vraća punu sliku i originalne dimenzije.

### editorWindowId guard (jedan popup istovremeno)

`SingleMode` čuva `editorWindowId: number | null` u React state-u:
- Ako je `editorWindowId !== null`, pokušava `chrome.windows.update(id, { focused: true })` umesto otvaranja novog prozora.
- Ako update bacit grešku (prozor je zatvoren), resetuje `editorWindowId = null` i otvara novi.
- Na `ANNOTATION_DONE` message: resetuje `editorWindowId = null`.
- `chrome.windows.onRemoved` listener: resetuje `editorWindowId` ako je prozor zatvoren spolja.

### onBoundsChanged debounce pattern

`chrome.windows.onBoundsChanged` se okida pri svakom pixelu pomeranja/resajzovanja prozora — može biti stotine puta u sekundi. Debounce od 500ms sprečava flood I/O operacija:

```ts
// useWindowBounds.ts
const listener = (win: chrome.windows.Window) => {
  if (win.id !== currentWindowId) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    chrome.storage.local.set({ editorWindowBounds: { width, height, left, top } });
  }, 500);
};
chrome.windows.onBoundsChanged.addListener(listener);
```

---

## Poznate zamke

1. **`accountId` ključ se čita ali se nikad ne upisuje.** — **Popravljeno.** `Settings.handleSave` sada snima `accountId` i u `auth` objekat i kao top-level `accountId` ključ (`setLocal('accountId', accountId)`). `SidePanel` auth gate čita top-level ključ i radi ispravno.
2. **select/option defaults kao goli string** — rešeno preko `serializeField`, ali samo za tipove iz tabele gore. Egzotičniji custom tipovi (cascading select, version, component) padaju u `default` granu i idu kao string → mogu vratiti 400.
3. **Worker restart recovery za bulk.** Implementiran `resumeBulkIfNeeded()`: posle restarta workera, ako `jirawm_bulk_progress` sadrži taskove koji nisu `done`/`failed`, worker automatski nastavlja obradu. Task sa statusom `uploading` i postojećim `issueKey` nastavlja samo kačenjem screenshota (bez ponovnog kreiranja). Task sa statusom `creating` i bez `issueKey` se NE automatski ponovo kreira — označava se kao `failed` sa porukom `Bulk processing was interrupted while creating the Jira issue. Retry manually to avoid a possible duplicate.`, a korisnik ga može retry-ovati iz UI-a. In-memory guard (`activeBulkRun`) sprečava paralelno pokretanje više bulk obrada ako `START_BULK` poruka stigne dok recovery još traje.
   **Retry s postojećim issueKey.** Ako task ima `issueKey` ali nije `done` (npr. `attachScreenshot` je pao), `processBulkTasks` preskače `createIssue` i odmah prelazi u stanje `uploading` → re-attach. Ovo važi i za eksplicitni "Retry Failed" iz UI-a (BulkMode.retryFailed resetuje status na `waiting`, ali čuva `issueKey` u storage-u) i za automatski restart workera.
4. **Capture must stay PNG (double compression trap).** `captureVisibleTab` poziv koristi `format: 'png'`. Ako se promeni na `format: 'jpeg'`, normalizeImage ce kompresovati JPEG u JPEG — dvostruka kompresija koja primecuje omeksavanje teksta. PNG je transient i nikad se ne cuva.
5. **`chrome.permissions.request` i user gesture requirement.** Chrome zahteva da se `chrome.permissions.request` pozove sinhrono unutar click handlera — bilo koji `await` pre njega uzrokuje da Chrome odbaci zahtev tiho, bez konzolne greške. Ovo je lako promašiti jer se handleCapture normalno await-uje.
6. **Crop konvertuje screen space u image space.** Crop rectangle se crta u screen koordinatama, ali se konvertuje u image-space koristeći `1 / scale` faktor. Pogrešan scale factor (npr. korišćenje CSS umesto display scale) crops plausible ali pogrešnu region.
7. **Crop je blokiran kad canvas ima objekte.** Crop dugme je disabled kad je `isDirty === true` (canvas ima objekte). Ovo je namerno — crop bez anotacija je siguran, crop sa anotacijama može iseći deo anotacija.

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
| Editor Popup | Desni klik unutar popupa → **Inspect** |

Svaki kontekst ima **svoju** konzolu — `console.log` iz workera se NE vidi u Side Panel DevTools i obrnuto.