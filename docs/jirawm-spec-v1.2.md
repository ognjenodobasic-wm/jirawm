# JiraWM — Specifikacija

**Version: 1.2 | Date: July 2026**

Chrome Extension (Manifest V3) — Side Panel UI za kreiranje Jira subtaskova iz screenshotova. Interna upotreba. Bez servera, baze i OAuth-a.

> Napomena: Ovaj dokument je prvi zapisani spec u repo-u. Ranije verzije (v1.0/v1.1) nisu postojale kao fajl — istorija ispod je rekonstruisana iz stanja projekta (CLAUDE.md faze). v1.2 je autoritativan.

---

## Changelog

- **v1.0** — Faza 1: Single Task mod (capture → create issue → attach jednog screenshota).
- **v1.1** — Faze 2–3: Bulk mod (drag/drop, sekvencijalni background upload, retry) i Workflow polish (Jira-driven wizard, edit/delete, export/import, parent search, `serializeField`).
- **v1.2** — Faza 4 kompletna — thumbnail strip, drag & drop reorder, lightbox navigacija, sekvencijalni upload više attachmenta po tasku.

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

### 4.1 Single Task Mod

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

### 4.3 Help tab

Statičan informativni panel unutar Side Panel-a sa sidebar navigacijom unutar taba. Pomaže korisnicima da razumeju ceo workflow bez napuštanja aplikacije.

#### Sekcije (redosled)

| Sekcija | Sadržaj |
|---|---|
| Intro | Šta je JiraWM, one-liner objašnjenje, šta se može raditi, šta je workflow |
| Quick setup | 3 koraka: API token → Settings → Test konekcije |
| Single task | Kako kreirati task: Screenshot → Workflow → Summary → Create |
| Bulk upload | Drag & drop, per-row summary, Start Upload, retry failed |
| Screenshot | Capture, thumbnail strip, preview, annotate (coming soon badge) |
| Feedback | Link ka GitHub Issues + poziv za saradnju |
| Changelog | Poslednji nav item — verzije kao kartice sa Major badge oznakom |

#### Changelog u Help panelu

- Hardkodovan u komponentu (ne fetchuje se iz fajla)
- Prikazuje verzije u opadajućem redosledu (najnovija prva)
- Svaka verzija = kartica sa: verzijom, datumom, Major/Minor/Patch badge, listom promena
- Izvor istine: CHANGELOG.md u root-u projekta
- Changelog kartica u Help-u se ažurira ručno uz svaki version bump

#### Sub-komponente

`ActionList`, `CodeBlock`, `Card`, `Step`, `Badge` — reusable UI elementi unutar Help komponente.

#### Routing i pozicija

`'help'` je vrednost u `PanelMode` union tipu (`src/types/index.ts`).

Tab bar redosled: [ Single Task ] [ Bulk Upload ] [ Workflows ] [ Help ] [ ⚙️ ]

PanelMode union: `'single' | 'bulk' | 'workflows' | 'help'`

Help je četvrti tab. Gear ikonica (⚙️) ostaje bez labele desno od tabova.

---

## 5. Workflow sistem

Sačuvani šablon za kreiranje taskova: projekat, tip issue-a, opcioni parent, default vrednosti obaveznih i izabranih opcionih polja, keširani `fieldMeta`. Čuva se u `chrome.storage.sync` (`jirawm_workflows`). Kreiranje/edit/brisanje kroz `WorkflowManager`; export/import JSON kroz Settings. Korisnički vodič: [`WORKFLOWS.md`](WORKFLOWS.md).

## 6. Settings / Auth

Domain (poddomen), email, API token → `chrome.storage.local` (`auth`), plus `accountId` kao top-level ključ posle `testConnection()`. Podešavanje kvaliteta screenshota (`jirawm_compression`). Instalacija i prva konfiguracija: [`SETUP.md`](SETUP.md).

## 7. Jira integracija

Svi pozivi kroz `apiFetch()` u `src/lib/jira.ts` (nula fetch-eva van tog fajla). Description uvek ADF (`toADF`). Strukturisana polja se serializuju kroz `serializeField` (§10). Create issue i attach su dva odvojena poziva.

## 8. Storage model

Puna mapa ključeva (area, sadržaj, pisci/čitači) je u [`ARCHITECTURE.md`](ARCHITECTURE.md) → Chrome Storage mapa. Pravila: token/email/domain uvek `local`; workflowi uvek `sync`; nikad `localStorage`.

## 9. Screenshot model (Faza 4)

`ScreenshotItem` (`src/types/index.ts`):

```ts
interface ScreenshotItem {
  id: string;      // crypto.randomUUID()
  dataUrl: string; // resized/compressed JPEG data URL
  label?: string;  // rezervisano (buduće labeliranje/anotacije)
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

- [x] **Faza 1 — Single Task**: capture → create issue → attach screenshot
  - [x] Help tab — 6 sekcija + Changelog nav item
- [x] **Faza 2 — Bulk mod**: drag/drop, sekvencijalni background upload, retry failed
- [x] **Faza 3 — Workflow polish**: Jira-driven wizard, edit/delete, export/import, parent search, field serialization
- [x] **Faza 4 — Više screenshotova po tasku**
  - [x] Thumbnail strip (max 10 po tasku)
  - [x] Drag & drop reorder
  - [x] Lightbox sa navigacijom (← → i keyboard: Esc/ArrowLeft/ArrowRight)
  - [x] Sekvencijalni upload više attachmenta + partial success + Retry

  > Kompletno kao of Juli 2026.

- [ ] **Faza 5 — Anotacije** (editor tab, `src/editor/`) — nije početa
