## Faza 5 — Screenshot Preview i Annotation Editor

> Verzija: 1.3 | Dodata: Juli 2026
> Changelog: Preview i Annotation Editor objedinjeni u jedan popup prozor (chrome.windows.create type:'popup'); izbačen novi tab pristup; pamćenje dimenzija prozora; numbered markers umesto free draw; blur alat izbačen (fill kvadrat pokriva PII use case).

---

### 5.1 Arhitektura — Popup prozor

Oba flow-a (preview i anotacija) koriste **isti popup prozor** (`editor.html`), razlikuju se po `mode` query parametru.

```
editor.html?mode=preview&index=0   → readonly lightbox
editor.html?mode=annotate&index=0  → Fabric.js editor
```

**Zašto popup, ne tab:**
- Korisnici imaju mnogo otvorenih tabova — novi tab je kontekstualni šum
- `type: 'popup'` prozor nema Chrome toolbar (čist aplikacijski prozor)
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

**Pamćenje dimenzija:**
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

#### Toolbar layout (levo → desno)

```
[ Select(V) ] | [ Arrow(A) ] [ Rect(R) ] [ Marker(M) ] [ Text(T) ] | [ ● boje ] | [ px▼ ] | [ ↩ ↪ ] [ 🗑 ] || [ Cancel ] [ ✓ Done ]
```

#### Alati

| Alat | Shortcut | Ponašanje |
|---|---|---|
| Select / move | V ili Esc | Selektuje, pomera, resajzuje objekte. Klik na prazan prostor = deselect |
| Strelica | A | Klik+drag crta strelicu sa vrhom. Jednosmerna |
| Kvadrat | R | Klik+drag crta kvadrat/pravougaonik. Toggle outline↔fill sa F dok je alat aktivan |
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

**Per-thumbnail akcije** (ispod ili overlay na thumbnail):

```
[thumbnail slika]
  [ 👁 Preview ] [ ✎ Annotate ] [ ✕ ]
```

- "Preview" → otvara popup u preview modu
- "Annotate" → otvara popup u annotate modu
- "✕" → uklanja thumbnail iz stripa (postojeće ponašanje)
- Ako je screenshot već anotiran: thumbnail ima mali indikator (npr. ✎ badge na uglu)

**Anotovani screenshot zamenjuje original** u thumbnail strip-u — original se ne čuva zasebno.

---

### 5.6 Manifest permissions

Dodati ako već nije prisutno:

```json
"permissions": ["tabs", "storage", "activeTab", "sidePanel"],
"host_permissions": ["https://*.atlassian.net/*"]
```

`chrome.windows.create` ne zahteva posebnu permission — dostupno svim extensionima.

---

### 5.7 File struktura

```
src/
  editor/
    AnnotationEditor.tsx    ← glavni component, čita mode iz URL params
    PreviewMode.tsx         ← readonly prikaz (ili inline u AnnotationEditor)
    AnnotateMode.tsx        ← Fabric.js canvas + toolbar
    useWindowBounds.ts      ← hook za pamćenje/restorovanje dimenzija
    useEditorTransfer.ts    ← hook za storage read/write (pendingEditor, annotationResult)
public/
  editor.html               ← entry point za popup prozor
```

---

### 5.8 Poznate zamke za Fazu 5

**`chrome.windows.onBoundsChanged` se poziva često** — debounce na 500ms pre nego što pišeš u storage da ne bi floodovao I/O.

**Fabric.js i React** — Fabric.js upravlja sopstvenim DOM-om unutar `<canvas>`. Ne pokušavaj da renderuješ Fabric objekte kroz React state — koristi `useRef` za canvas instancu i Fabric.js API direktno.

**`canvas.toDataURL` blokira UI** na velikim screenshotovima — obaviti u `requestAnimationFrame` ili `setTimeout(0)` da ne zamrzne UI pre zatvaranja popupa.

**Storage cleanup je obavezan** — `pendingEditor` i `annotationResult` moraju biti obrisani nakon transfera. Ako popup crashuje pre cleanup-a, side panel pri sledećem otvaranju može pokupit stari result. Dodati cleanup i u `componentDidMount` stranu panela (provjeri i obrisi stale data).

**Jedan popup istovremeno** — ako korisnik klikne "Annotate" dok je popup već otvoren, ne otvaraj drugi. Čuvaj `editorWindowId` u state-u side panela i proveri `chrome.windows.get(editorWindowId)` pre otvaranja novog. Ako prozor postoji, focusiraj ga (`chrome.windows.update(id, { focused: true })`).

**JPEG quality 0.9 za export** — screenshot prolazi kroz kompresiju drugi put (originalni capture + re-export iz editora), pa koristimo 0.9 umesto globalnog 0.85 da kompenzujemo quality loss.

---

### 5.9 Checklist Faze 5

- [ ] `public/editor.html` + Vite entry za editor kontekst
- [ ] `useWindowBounds.ts` — čitanje/čuvanje dimenzija prozora (debounce 500ms)
- [ ] `useEditorTransfer.ts` — storage protokol (write pendingEditor, read annotationResult, cleanup)
- [ ] `chrome.windows.create` integracija u SingleMode — jedan popup istovremeno guard
- [ ] Preview mode — readonly, fit-to-window, [Annotate] i [Close] dugmad, Escape shortcut
- [ ] Annotate mode — Fabric.js canvas inicijalizacija sa screenshot-om
- [ ] Toolbar — Select, Arrow, Rect (outline+fill toggle), Numbered marker, Text
- [ ] Boje — 5 preset-a, aktivan state vidljiv
- [ ] Stroke width — 2/3/4px dropdown
- [ ] Numbered marker auto-increment counter u toolbar-u
- [ ] Undo/Redo — Fabric.js history
- [ ] Delete selected — Delete/Backspace + dugme
- [ ] "Done" — canvas export JPEG 0.9 → storage → sendMessage → zatvori
- [ ] "Cancel" — zatvori popup, original nepromenjen
- [ ] Side Panel listener — ANNOTATION_DONE handler, replace thumbnail, cleanup
- [ ] Anotovani screenshot zamenjuje original u strip-u
- [ ] ✎ badge na thumbnail koji je anotiran
- [ ] Manifest permissions update
- [ ] `npx tsc --noEmit` — 0 grešaka
- [ ] `npm run build` — build prolazi

