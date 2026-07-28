# JiraWM — Specifikacija

**Version: 1.3 | Date: Juli 2026**

> This document is not versioned by filename — it is updated in place to reflect current state. See docs/CHANGELOG.md for what shipped when.

Chrome Extension (Manifest V3) — Side Panel UI za kreiranje Jira subtaskova iz screenshotova. Interna upotreba. Bez servera, baze i OAuth-a.

> Napomena: Ovaj dokument je prvi zapisani spec u repo-u. Ranije verzije (v1.0/v1.1) nisu postojale kao fajl — istorija ispod je rekonstruisana iz stanja projekta (CLAUDE.md faze). v1.2 je bio autoritativan; v1.3 dodaje Fazu 5.

---

## Changelog

- **v1.0** — Faza 1: Single Task mod (capture → create issue → attach jednog screenshota).
- **v1.1** — Faze 2–3: Bulk mod (drag/drop, sekvencijalni background upload, retry) i Workflow polish (Jira-driven wizard, edit/delete, export/import, parent search, `serializeField`).
- **v1.2** — Faza 4 kompletna — thumbnail strip, drag & drop reorder, lightbox navigacija, sekvencijalni upload više attachmenta po tasku.
- **v1.3** — Faza 5 redizajnirana — annotation editor i screenshot preview objedinjeni u jedan `chrome.windows.create` popup prozor (`type:'popup'`); izbačen novi tab pristup; pamćenje dimenzija prozora u `chrome.storage.local`; numbered markers alat umesto free draw; blur alat izbačen (fill kvadrat pokriva PII use case); anotovani screenshot zamenjuje original u thumbnail strip-u.

---

## 1. Cilj

Omogućiti korisniku da iz Chrome Side Panela za par sekundi napravi Jira subtask iz jednog ili više screenshotova, koristeći unapred podešen **workflow** (projekat, tip issue-a, parent, default vrednosti polja). Bez ručnog otvaranja Jire za svaki task.

## 2. Stack i ograničenja

- React 19 + TypeScript strict + Tailwind CSS v4
- Vite + `@crxjs/vite-plugin`
- Chrome Side Panel API (MV3)
- Jira Cloud REST API v3, Basic auth (`base64(email:api_token)`)
- Bez dev servera — ekstenzija zahteva build (`npm run build` → `/dist`, load unpacked).

## 3. Arhitektura (kratko)

Tri odvojena JS konteksta (Side Panel UI, Background Service Worker, Editor Tab — Faza 5). Ne dele memoriju; komunikacija ide kroz `chrome.runtime.sendMessage` i deljeni `chrome.storage`. Detalji: [`ARCHITECTURE.md`](ARCHITECTURE.md).

---

## 4. Funkcionalnosti

### 4.1 Task Mod

Kreiranje jednog issue-a sa jednim ili više screenshotova. Sva Jira polja dolaze iz izabranog workflowa; korisnik ručno unosi samo summary i (opciono) description.

| Funkcija | Status | Detalji |
|----------|--------|---------|
| Capture screenshot | Done | `chrome.tabs.captureVisibleTab` + resize/compress po workflow/global podešavanju |
| Summary (obavezno) | Done | Validacija pre submita |
| Description (opciono) | Done | ADF format; pre-popunjeno iz `requiredFieldDefaults.description` ako postoji |
| Create task | Done | `createIssue()` → `POST /issue`, vraća `issue.key` |
| Attach screenshot(a) | Done | `POST /issue/{key}/attachments`, odvojen poziv od create-a |
| **Više screenshotova po tasku** | **Done** | Thumbnail strip, **max 10**, `×` remove po thumbnailu, **drag reorder** |
| **Screenshot preview** | **Done** | **Lightbox sa navigacijom** između screenshotova (← →), **keyboard nav** (Esc/ArrowLeft/ArrowRight), brojač `n / N` |
| Partial success handling | Done | Sekvencijalni upload; ako deo padne → `attachFailed`, poruka `X/N uploaded`, dugme **Retry screenshots** |
| Create Another | Done | Reset forme uz zadržavanje workflowa |

Model podataka za screenshotove: vidi §9.

### 4.2 Bulk Mod

Kreiranje više issue-a odjednom iz skupa fajlova. Obrada je **sekvencijalna** u background workeru, sa progresom preko `chrome.storage.local` (`jirawm_bulk_progress`) i `keepAlive` alarmom. Retry samo neuspelih. Detalji flow-a: [`ARCHITECTURE.md`](ARCHITECTURE.md) → Bulk mod.

### 4.3 Comment Tab (Faza 6)

Dodaje komentar na postojeći Jira issue, bez kreiranja novog. Komponenta: `src/sidepanel/CommentMode.tsx`.

| Funkcija | Status | Detalji |
|----------|--------|---------|
| Project + issue picker | Done | Izbor projekta iz dropdowna, zatim fuzzy search issue-a po key-u ili summary-ju (`IssuePicker`) |
| Screenshot capture | Done | Isti `ScreenshotCapture` shared component kao Task tab — capture/annotate/thumbnail flow se ponovo koristi, ne duplira |
| Shortcode tokeni | Done | Svaki screenshot dobija token oblika `[N-filename]`, gde je filename stvarno ime attachmenta na Jiri. Klik na chip ubacuje token na poziciju kursora u komentaru |
| Token kao link | Done | Ako token ostane u tekstu komentara, on je i klikabilan link ka 1400×1400 thumbnail preview-u tog screenshota (ne ka originalu pune rezolucije) |
| Attach bez tokena | Done | Screenshotovi na koje se ne referencira token i dalje se attach-uju na issue, samo bez linka u telu komentara — nema automatskog append-a na kraj |
| Submit | Done | `POST /issue/{key}/comment`, ADF telo (`buildCommentADF`) |
| Partial attach failure | Done | `attach-partial` state — prikazuje X/N uploaded, dugme "Retry failed screenshots" |
| Comment post failure | Done | `comment-error` state — prikazuje poruku, dugme "Retry comment" |
| Success view | Done | Link na komentar (`buildCommentUrl`), dugme "New comment on {issue}" (zadržava issue, resetuje formu) i "New comment" (pun reset) |

---

## 5. Workflow sistem

Sačuvani šablon za kreiranje taskova: projekat, tip issue-a, opcioni parent, default vrednosti obaveznih i izabranih opcionih polja, keširani `fieldMeta`. Čuva se u `chrome.storage.sync` (`jirawm_workflows`). Kreiranje/edit/brisanje kroz `WorkflowManager`; export/import JSON kroz Settings. Korisnički vodič: [`WORKFLOWS.md`](WORKFLOWS.md).

## 6. Settings / Auth

Domain (poddomen), email, API token → `chrome.storage.local` (`auth`), plus `accountId` kao top-level ključ posle `testConnection()`. Podešavanje kvaliteta screenshota (`jirawm_compression`). Instalacija i prva konfiguracija: [`SETUP.md`](SETUP.md).

## 7. Jira integracija

Svi pozivi kroz `apiFetch()` u `src/lib/jira.ts` (nula fetch-eva van tog fajla). Description uvek ADF (`toADF`). Strukturisana polja se serializuju kroz `serializeField` (§10). Create issue i attach su dva odvojena poziva.

## 8. Storage model

Puna mapa ključeva (area, sadržaj, pisci/čitači) je u [`ARCHITECTURE.md`](ARCHITECTURE.md) → Chrome Storage mapa. Pravila: token/email/domain uvek `local`; workflowi uvek `sync`; nikad `localStorage`.

**Update notification ključevi** (`chrome.storage.local`):
- `updateInfo` — `{ latestVersion, downloadUrl, checkedAt }`, piše `checkForUpdate()` (`src/lib/updateCheck.ts`) kad je dostupna novija verzija na GitHub Releases, briše se ako trenutna verzija više nije zastarela. Čitaju `UpdateBanner.tsx` i Help panel notice.
- `dismissedUpdateVersion` — verzija koju je korisnik odbacio u `UpdateBanner`; piše i čita samo `UpdateBanner.tsx`.

`src/background/worker.ts` registruje alarm `updateCheck` (svakih 360 minuta) koji poziva `checkForUpdate()`, plus jedan poziv odmah pri startu workera.

**Verzionisanje (patch auto-bump):** pre-commit hook (`simple-git-hooks`, skripta `scripts/bump-patch-version.mjs`) automatski inkrementira patch broj u `manifest.json` na svaki commit i ogleda ga u `package.json`. `manifest.json` je izvor istine; `package.json` samo prati. Minor/major bump ostaje ručan.

## 9. Screenshot model (Faza 4)

`ScreenshotItem` (`src/types/index.ts`):

```ts
interface ScreenshotItem {
  id: string;        // crypto.randomUUID()
  dataUrl: string;   // resized/compressed JPEG data URL
  label?: string;    // rezervisano (buduće labeliranje/anotacije)
  annotated?: boolean; // true ako je screenshot prošao kroz annotation editor (Faza 5)
}
```

- Single mod drži `screenshots: ScreenshotItem[]` (max 10). Svaki capture dodaje novi item; dugme prelazi iz "Capture Screenshot" u "Add Screenshot" i disable-uje se na 10.
- Thumbnail strip: horizontalni scroll, klik na thumbnail otvara lightbox, `×` uklanja item, drag & drop menja redosled.
- Attachment je sekvencijalan: posle `createIssue`, petlja jedan-po-jedan zove `attachScreenshot(issueKey, item.dataUrl, "{key}-{item.id}.jpg")`. Broji uspešne, skuplja neuspele; ako ijedan padne → partial success (`X/N uploaded`) + Retry.
- Filename konvencija: `{issueKey}-{screenshotId}.jpg`.

## 10. Field serialization

`serializeField(fieldId, value, fieldMeta)` mapira string default u oblik koji Jira očekuje (`option → {value}`, `priority → {name}`, `user → {accountId}`, `array` varijante, `number`; ostalo kao string). Tabela i pozivi: [`ARCHITECTURE.md`](ARCHITECTURE.md) → Field serialization.

## 11. Bezbednost / privatnost

- Token/email/domain samo u `chrome.storage.local`, nikad sync, nikad `localStorage`.
- Nema servera ni telemetrije; svi pozivi idu direktno ka `{domain}.atlassian.net`.
- Screenshotovi se ne perzistiraju van tekuće sesije forme (osim bulk progresa dok traje upload).

## 12. Poznata ograničenja

Detaljno u [`ARCHITECTURE.md`](ARCHITECTURE.md) → Poznate zamke. Sažetak: egzotični custom field tipovi mogu vratiti 400 (padaju u string granu); worker restart recovery ne postoji za bulk; bulk `sendMessage` nosi base64.

---

## 13. Faze razvoja

- [x] **Faza 1 — Task**: capture → create issue → attach screenshot
- [x] **Faza 2 — Bulk mod**: drag/drop, sekvencijalni background upload, retry failed
- [x] **Faza 3 — Workflow polish**: Jira-driven wizard, edit/delete, export/import, parent search, field serialization
- [x] **Faza 4 — Više screenshotova po tasku**
  - [x] Thumbnail strip (max 10 po tasku)
  - [x] Drag & drop reorder
  - [x] Lightbox sa navigacijom (← → i keyboard: Esc/ArrowLeft/ArrowRight)
  - [x] Sekvencijalni upload više attachmenta + partial success + Retry

  > Kompletno kao of Juli 2026.

- [x] **Faza 5 — Screenshot Preview i Annotation Editor** (popup, Fabric.js v7, Juli 2026)
- [x] **Faza 6 — Comment Tab**: komentar na postojeći Jira issue — project/issue picker, screenshot capture reuse iz Task taba, shortcode tokeni sa linkom ka thumbnail preview-u (vidi §4.3, Juli 2026)

---

## Faza 5 — Screenshot Preview i Annotation Editor

> Verzija: 1.3 | Dodata: Juli 2026
> Changelog: Preview i Annotation Editor objedinjeni u jedan popup prozor (`chrome.windows.create type:'popup'`); izbačen novi tab pristup; pamćenje dimenzija prozora; numbered markers umesto free draw; blur alat izbačen (fill kvadrat pokriva PII use case).

---

### 5.1 Arhitektura — Popup prozor

Oba flow-a (preview i anotacija) koriste **isti popup prozor** (`editor.html`), razlikuju se po `mode` query parametru.

```
editor.html?mode=preview&index=0   → readonly lightbox
editor.html?mode=annotate&index=0  → Fabric.js editor
```

**Zašto popup, ne tab:**
- Korisnici imaju mnogo otvorenih tabova — novi tab je kontekstualni šum
- `type:'popup'` prozor nema Chrome toolbar (čist aplikacijski prozor)
- Resize i pozicija se pamte u chrome.storage.local
- Jedan kontekst manje za upravljanje vs. tab

**Dimenzije:**
- Default: 1000×700px
- Minimum: 700×500px
- Pamti se poslednja pozicija i veličina (width, height, left, top)

---

### 5.2 Cross-context transfer protokol

```
Side Panel (SingleMode.tsx)
  → klik "Preview" ili "Annotate" na thumbnail[i]
  → chrome.storage.local.set({
       pendingEditor: {
         dataUrl: screenshots[i].dataUrl,
         thumbnailIndex: i,
         mode: 'preview' | 'annotate'
       }
     })
  → chrome.windows.create({ type: 'popup', url: 'editor.html?mode=...&index=i', ...bounds })

Editor Popup (AnnotationEditor.tsx)
  → on mount: storage.local.get('pendingEditor')
  → čita mode iz URL params
  → mode='preview': renderuje readonly, nema toolbar
  → mode='annotate': inicijalizuje Fabric.js canvas sa screenshot-om
  → "Done" (samo u annotate modu):
       canvas.toDataURL('image/jpeg', 0.9)
       storage.local.set({ annotationResult: { dataUrl, thumbnailIndex } })
       runtime.sendMessage({ type: 'ANNOTATION_DONE' })
       chrome.windows.getCurrent() → windows.remove(windowId)

Side Panel listener
  → onMessage 'ANNOTATION_DONE'
  → storage.local.get('annotationResult')
  → screenshots[result.thumbnailIndex].dataUrl = result.dataUrl
  → setScreenshots([...updated])
  → cleanup: storage.local.remove(['pendingEditor', 'annotationResult'])
```

**Pamćenje dimenzija (debounce 500ms):**
```javascript
chrome.windows.onBoundsChanged.addListener((win) => {
  if (win.id === editorWindowId) {
    chrome.storage.local.set({
      editorWindowBounds: {
        width: win.width, height: win.height,
        left: win.left, top: win.top
      }
    });
  }
});
```

---

### 5.3 Preview mode (mode=preview)

Readonly prikaz screenshota u popup prozoru.

**UI:**
- Screenshot centriran, fit-to-window (object-fit: contain)
- Tamna pozadina (#1a1a2e ili slično)
- Toolbar: samo [✎ Annotate] dugme u gornjem desnom uglu + [✕ Close]
- Klik "Annotate" → zatvara preview → otvara isti popup u annotate modu
- Klik "Close" ili Escape → zatvara popup, side panel ostaje nepromenjen
- Keyboard: Escape = zatvori

**Nema:**
- Zoom/pan (MVP — može u kasnijem patchu)
- Download dugmeta

---

### 5.4 Annotation editor (mode=annotate)

Fabric.js canvas editor u popup prozoru.

> **Izmena (Juli 2026):** Rect F-toggle zamenjen zasebnim Fill alatom u toolbaru — toggle je bio nevidljiv u UI-ju i korisnik nije imao način da vidi koji je mod aktivan.

#### Toolbar layout (levo → desno)

```
[ Select(V) ] | [ Arrow(A) ] [ Rectangle(R) ] [ Fill(F) ] [ Marker(M) ] [ Text(T) ] | [ ● boje ] | [ px▼ ] | [ ↩ ↪ ] [ 🗑 ] || [ Cancel ] [ ✓ Done ]
```

#### Alati

| Alat | Shortcut | Ponašanje |
|---|---|---|
| Select / move | V ili Esc | Selektuje, pomera, resajzuje objekte. Klik na prazan prostor = deselect |
| Strelica | A | Klik+drag crta strelicu sa vrhom. Jednosmerna |
| Rectangle | R | Klik+drag crta pravougaonik sa outline-om. Crta se od ugla na kome je drag počeo, ne od centra. |
| Fill | F | Isto ponašanje kao Rectangle, ali je pravougaonik ispunjen aktivnom bojom. Pokriva PII redaction use case. |
| Numbered marker | M | Svaki klik dodaje circle sa auto-increment brojem (1, 2, 3...). Counter vidljiv u toolbar-u pored ikonice |
| Tekst | T | Klik = text box. Dvostruki klik na postojeći = inline edit |

#### Boje (5 preset-a)

`#ff4444` (crvena) · `#ffcc00` (žuta) · `#00cc88` (zelena) · `#4499ff` (plava) · `#ffffff` (bela)

Aktivna boja se pamti tokom sesije. Primenjuje se na sledeći nacrtani objekat.

#### Stroke width

2px · 3px · 4px (select dropdown). Primenjuje se na sledeći objekat.

#### Akcije

| Akcija | Shortcut | Napomena |
|---|---|---|
| Undo | Cmd+Z / Ctrl+Z | Fabric.js history stack |
| Redo | Cmd+Y / Ctrl+Y | |
| Delete selected | Delete ili Backspace | + toolbar dugme |
| Cancel | dugme | Zatvara popup, original u strip-u ostaje nepromenjen |
| Done | dugme | Export canvas → JPEG 0.9 quality → storage.local → sendMessage → zatvori popup |

#### Numbered marker detalji

- Counter počinje od 1, inkrementiše se pri svakom kliku dok je M alat aktivan
- Counter se resetuje ako se svi markeri obrišu (undo do praznog stanja)
- Vizual: beli broj u kružnici boje aktivne boje, font-size proporcionalan kružnici
- Kružnica je selektabilna i pomična u select modu

---

### 5.5 Integracija u SingleMode.tsx

> **Izmena (Juli 2026):** 👁 Preview dugme uklonjeno — klik na sam thumbnail otvara preview. ✎ ikonica zamenjena tekstualnim "Edit" dugmetom radi jasnoće.

**Per-thumbnail akcije** (ispod thumbnail):

```
[thumbnail slika]   ← klik otvara popup u preview modu
   [ Edit ]         ← centrirano ispod thumbnaila, otvara popup u annotate modu
   [ ✕ ]            ← uklanja thumbnail iz stripa
```

- Klik na thumbnail → otvara popup u preview modu
- "Edit" → otvara popup u annotate modu
- "✕" → uklanja thumbnail iz stripa
- Ako je screenshot već anotiran: thumbnail ima mali indikator (✎ badge na uglu)

**Anotovani screenshot zamenjuje original** u thumbnail strip-u — original se ne čuva zasebno.

---

### 5.6 Manifest permissions

Dodati ako već nije prisutno:

```json
"permissions": ["tabs", "storage", "activeTab", "sidePanel"]
```

`chrome.windows.create` ne zahteva posebnu permission — dostupno svim extensionima.

---

### 5.7 File struktura

```
src/
  editor/
    AnnotationEditor.tsx    ← glavni component, čita mode iz URL params
    PreviewMode.tsx         ← readonly prikaz
    AnnotateMode.tsx        ← Fabric.js canvas + toolbar
    useWindowBounds.ts      ← hook za pamćenje/restorovanje dimenzija (debounce 500ms)
    useEditorTransfer.ts    ← hook za storage read/write (pendingEditor, annotationResult)
    main.tsx                ← React root za editor kontekst
editor.html                 ← entry point za popup prozor (root, isti pattern kao sidepanel.html)
```

---

### 5.8 Poznate zamke za Fazu 5

**`chrome.windows.onBoundsChanged` se poziva često** — debounce na 500ms pre nego što pišeš u storage da ne bi floodovao I/O.

**Fabric.js i React** — Fabric.js upravlja sopstvenim DOM-om unutar `<canvas>`. Ne pokušavaj da renderuješ Fabric objekte kroz React state — koristi `useRef` za canvas instancu i Fabric.js API direktno.

**`canvas.toDataURL` blokira UI** na velikim screenshotovima — obaviti u `requestAnimationFrame` ili `setTimeout(0)` da ne zamrzne UI pre zatvaranja popupa.

**Storage cleanup je obavezan** — `pendingEditor` i `annotationResult` moraju biti obrisani nakon transfera. Ako popup crashuje pre cleanup-a, side panel pri sledećem otvaranju može pokupit stari result.

**Jedan popup istovremeno** — ako korisnik klikne "Annotate" dok je popup već otvoren, ne otvaraj drugi. Čuvaj `editorWindowId` u state-u side panela i proveri pre otvaranja novog. Ako prozor postoji, focusiraj ga (`chrome.windows.update(id, { focused: true })`).

**JPEG quality 0.9 za export** — screenshot prolazi kroz kompresiju drugi put (originalni capture + re-export iz editora), pa koristimo 0.9 umesto globalnog 0.85 da kompenzujemo quality loss.

#### Fabric.js v7 — API razlike u odnosu na v5

Projekat koristi **Fabric.js 7.4.0**. Fabric v6 i v7 uveli su brojna breaking changes u odnosu na v5. Tabela poznatih zamki:

| v5 API | Status | v7 ekvivalent |
|--------|--------|---------------|
| `fabric.Image.fromURL(url, callback)` | **BROKEN** | `fabric.FabricImage.fromURL(url)` vraća Promise |
| `canvas.setBackgroundImage(img, cb)` | **BROKEN** | `canvas.backgroundImage = img` (direktna dodela) |
| `canvas.getPointer(e)` | **BROKEN** | `canvas.getScenePoint(e)` ili `canvas.getViewportPoint(e)` |
| `canvas.loadFromJSON(json, callback)` | **BROKEN** | `canvas.loadFromJSON(json)` vraća Promise — koristiti `.then()` |
| `canvas.setZoom(n)` | **RISKY** | Primenjuje viewport transform samo na objekte; backgroundImage ignoriše zoom |
| `canvas.toDataURL({format, quality})` | **RISKY** | TypeScript tip zahteva `multiplier` polje — dodati `multiplier: 1` |
| `new fabric.Rect({})` bez `originX/originY` | **RISKY** | v7 default je `center`; v5 default bio `left`/`top` — uvek eksplicitno navesti |
| `new fabric.IText({})` bez `originX/originY` | **RISKY** | Isto kao Rect — tekst se pozicionira od centra bez eksplicitnog origina |

**Najskuplja zamka je `setZoom`.** U v7 `setZoom` primenjuje viewport transform samo na objekte — `backgroundImage` se uvek renderuje u sopstvenoj skali i ignoriše zoom. Zbog toga editor prikazuje samo gornji-levi ugao screenshota bez obzira na zoom vrednost. Ispravan pristup: kreirati canvas na display dimenzijama (zoom ostaje 1) i skalirati `backgroundImage` eksplicitno kroz `scaleX`/`scaleY` na `FabricImage` objektu. Za export u punoj rezoluciji koristiti privremeni offscreen canvas na prirodnim dimenzijama i klonirati objekte skalirane sa `1/scale`.

---

### 5.9 Checklist Faze 5

- [x] `editor.html` + Vite entry za editor kontekst
- [x] `useWindowBounds.ts` — čitanje/čuvanje dimenzija prozora (debounce 500ms)
- [x] `useEditorTransfer.ts` — storage protokol (write pendingEditor, read annotationResult, cleanup)
- [x] `chrome.windows.create` integracija u SingleMode — jedan popup istovremeno guard
- [x] Preview mode — readonly, fit-to-window, [Annotate] i [Close] dugmad, Escape shortcut
- [x] Annotate mode — Fabric.js canvas inicijalizacija sa screenshot-om
- [x] Toolbar — Select, Arrow, Rectangle, Fill, Numbered marker, Text
- [x] Boje — 5 preset-a, aktivan state vidljiv
- [x] Stroke width — 2/3/4px dropdown
- [x] Numbered marker auto-increment counter u toolbar-u
- [x] Undo/Redo — Fabric.js history
- [x] Delete selected — Delete/Backspace + dugme
- [x] "Done" — canvas export JPEG 0.9 → storage → sendMessage → zatvori
- [x] "Cancel" — zatvori popup, original nepromenjen
- [x] Side Panel listener — ANNOTATION_DONE handler, replace thumbnail, cleanup
- [x] Anotovani screenshot zamenjuje original u strip-u
- [x] "Edit" taster centriran ispod thumbnaila (umesto badge-a — taster je vidljiviji i jasniji)
- [x] Manifest permissions update
- [x] `npx tsc --noEmit` — 0 grešaka
- [x] `npm run build` — build prolazi
