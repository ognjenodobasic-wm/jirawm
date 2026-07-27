# JiraWM

🇷🇸 Srpski | [🇬🇧 English](README.en.md)

Chrome ekstenzija koja pretvara screenshotove iz browsera u Jira taskove — bez napuštanja stranice koju gledaš.

Otvori side panel, snimi ili prevuci screenshot, upiši naslov, klikni Create. Issue sleti u Jiru sa zakačenim screenshot-om za par sekundi. Imaš ceo batch spreman? Prebaci se na Bulk Upload i pusti da radi u pozadini dok ti nastavljaš dalje.

---

## Problem koji rešava

Prijavljivanje buga ili UX napomene u Jiri traje duže nego što bi trebalo. Snimiš screenshot, prebaciš se na drugi tab, tražiš pravi projekat, tražiš pravi epic, biraš tip issue-a, podešavaš sprint i prioritet, kačiš fajl, pišeš naslov. Dok završiš, izgubio si fokus i napola zaboravio šta si hteo da kažeš.

<img width="800" height="484" alt="jirawm-singletask" src="https://github.com/user-attachments/assets/f584f88e-81ab-49fe-bd9a-d73fb0fed78b" />

JiraWM sve to svodi na: **snimi → naslovi → pošalji**. Sve ostalo — projekat, tip issue-a, parent epic, sprint, prioritet, assignee — živi u workflow preset-u koji se primenjuje automatski.

---

## Kako radi: Workflow-ovi

Prava ušteda vremena u JiraWM nije snimanje screenshot-a — nego workflow-ovi.

**Workflow** je sačuvan preset koji jednom odgovori na sva Jira pitanja, tako da to nikad više ne moraš da radiš. Zamisli ga kao prečicu tačno na pravo mesto u Jiri: pravi projekat, pravi epic, pravi sprint — već podešeno.

Kad praviš workflow, podešavaš:

- **Projekat** — biraš iz svojih stvarnih Jira projekata, bez ručnog kucanja ključa
- **Tip issue-a** — Bug, Task, Story, ili šta god tvoj projekat koristi
- **Parent task** (opciono) — zakači sve taskove za konkretan epic ili story; svaki task napravljen ovim workflow-om postaje njegov sub-task
- **Default vrednosti obaveznih polja** — Sprint, Priority, Component, Labels, ili koje god polje tvoj projekat označi kao obavezno
- **Opciona polja** — uključi samo ona polja koja stvarno koristiš
- **Default assignee** — unapred dodeli sebi ili kolegi

Ovo podesiš jednom. Od tog trenutka, biranje workflow-a je jedina odluka koju praviš pre snimanja.

**Par primera workflow-ova koje bi mogao da napraviš:**

| Naziv workflow-a | Projekat | Tip issue-a | Parent | Sprint |
|---|---|---|---|---|
| QA — Login sprint | MOBILE | Bug | MOBILE-412 (Login epic) | Sprint 24 |
| UX feedback | DESIGN | Task | — | — |
| PM backlog | CORE | Story | — | Backlog |
| Regression — v4.2 | QA | Bug | QA-88 (v4.2 regression epic) | Sprint 23 |

Prebacuješ se između workflow-ova jednim klikom. Dobro pravilo: jedan workflow po kontekstu. "QA bugovi" i "PM backlog" treba da budu odvojeni workflow-ovi, ne jedan koji pokušava da radi oboje.

---

## Single task

Svakodnevni mod. Na stranici si, primetiš nešto vredno prijave — bug, UX problem, nešto za follow-up.

<img width="50%" height="auto" alt="singletask" src="https://github.com/user-attachments/assets/0275f1f1-f57a-44f6-b2b6-cd384d7cee4e" />

1. Otvori side panel (klik na ikonicu ekstenzije ili `Ctrl+Shift+S`)
2. Izaberi workflow iz dropdown-a
3. Klikni **Capture** da snimiš trenutni tab — ili **Add** da dodaš postojeći fajl
4. Opciono klikni na thumbnail da otvoriš editor: iseci region koji želiš, pa anotiraj strelicama, pravougaonicima, numerisanim markerima ili tekstom
5. Upiši summary
6. Klikni **Create task**

Ekstenzija kreira issue u Jiri, kači screenshot, i vraća ti ključ taska kao klikabilan link (`AT-234`). Kad je workflow jednom podešen, ceo proces traje ispod deset sekundi.

Treba da zakačiš više screenshot-ova za jedan task — npr. par stanja istog buga? Samo nastavi da dodaješ thumbnail-ove pre nego što pošalješ. Svi se kače redom.

**Capture details** se automatski dodaju u opis taska kad koristiš Capture: URL stranice, naslov, veličina viewport-a, nivo zuma, browser i OS. Korisno za bug reportove gde su uslovi reprodukcije bitni. Možeš da izabereš tačno koja polja se uključuju — ili da isključiš celu funkciju — u Settings.

---

## Bulk upload

Izašao si iz review sesije, usability testa, ili QA prolaska sa folderom punim screenshot-ova. Bulk Upload sve to pretvara u Jira taskove bez da sediš i klikćeš kroz svaki pojedinačno.

<img width="50%" height="auto" alt="bulkupload" src="https://github.com/user-attachments/assets/67065d40-263e-40fe-a111-e147829241f3" />

1. Prebaci se na tab **Bulk Upload**
2. Izaberi workflow — primenjuje se na svaki red
3. Prevuci screenshot-ove na drop zonu, ili klikni **Select files**
4. Svaki fajl dobija svoj red. Upiši summary po redu — to je jedini unos koji popunjavaš
5. Klikni **Start upload** i nastavi sa nečim drugim

Taskovi se kreiraju jedan po jedan u pozadini. Možeš zatvoriti side panel, prebaciti tabove, normalno pregledati — worker nastavlja da radi. Kad završi, desktop notifikacija javlja rezultat (`18/20 tasks created`). Klik na nju te vraća u panel gde vidiš sve linkove ka taskovima.

Ako par taskova ne uspe — Jira timeout, network hiccup — pojavljuje se dugme **Retry failed**. Pokušava ponovo samo redove koji nisu uspeli, ostavljajući uspešne netaknute.

Progres se čuva u storage-u, tako da zatvaranje i ponovno otvaranje panela pokazuje tačno gde je stalo.

---

## Editor za anotacije

Klik na bilo koji thumbnail otvara ga u plutajućem prozoru editora koji pamti svoju veličinu i poziciju između sesija. Možeš samo da pogledaš, anotiraš, ili zatvoriš bez izmena — original ostaje netaknut dok ne klikneš Done.

**Alati:**

| Alat | Šta radi |
|---|---|
| Crop | Selektuj region i primeni. Iseci pre anotiranja — onemogućen čim nešto nacrtaš |
| Select | Pomeraj ili briši postojeće anotacije |
| Arrow | Nacrtaj strelicu ka nečemu |
| Rectangle | Pravougaonik za isticanje regiona |
| Fill | Popunjen pravougaonik — zgodno za prekrivanje osetljivih podataka |
| Marker | Numerisan krug, auto-inkrement: ①, ②, ③ |
| Text | Klikni da postaviš editabilan tekst |

Pet preset boja, debljina linije 2/3/4px. Undo/redo (`Ctrl+Z` / `Ctrl+Y`) radi kroz zajednički history stack — crop-ovi i anotacije na jednoj kontinuiranoj vremenskoj liniji.

---

## Settings

Settings je podeljen u tri sekcije koje se sklapaju/rasklapaju, sve se čuva automatski čim promeniš vrednost.

- **Image handling** — JPEG kvalitet (default 0.85), maksimalna širina (default 1920px), i boja za popunjavanje transparentnosti kod PNG-ova. Svaka slika se konvertuje u JPEG čim uđe u ekstenziju. Anotacije se uvek čuvaju u punom kvalitetu bez obzira na quality podešavanje, tako da editovanje nikad ne degradira sliku dvaput.
- **Screenshot naming** — numeriše priloge redom (1.jpg, 2.jpg) tako da možeš da referenciraš konkretne slike iz opisa. Podesivo odvojeno za single task i bulk upload.
- **Capture details** — kontroliše koja polja se pojavljuju u automatskom metadata bloku, da li ide na početak ili kraj opisa, i da li se brišu query parametri iz URL-ova (uključeno po default-u — URL-ovi često nose session tokene koje ne želiš u tiketu).

---

## Podešavanje

**Zahtevi:** Chrome 114+, Jira Cloud nalog, Jira API token.

**Instalacija:**

1. Preuzmi najnoviji release ZIP sa [Releases stranice](https://github.com/ognjenodobasic-wm/jirawm/releases)
2. Otpakuj ga
3. Otvori `chrome://extensions/` u Chrome-u
4. Uključi **Developer mode** (prekidač gore desno)
5. Klikni **Load unpacked** i izaberi otpakovan folder

**Prvo podešavanje:**

1. Klikni na ikonicu ekstenzije da otvoriš side panel
2. Otvori **Settings** (⚙️ gore desno)
3. Unesi svoj Jira subdomen (samo `yourcompany` iz `yourcompany.atlassian.net`), email adresu, i API token
4. Klikni **Test connection** — ako je sve tačno, videćeš potvrđeno svoje ime
5. Idi na tab **Workflows** i napravi svoj prvi workflow

**Kako doći do API tokena:**
Idi na [id.atlassian.com → Security → API tokens](https://id.atlassian.com/manage-profile/security/api-tokens) i napravi novi token. Tretiraj ga kao lozinku — ide u lokalni browser storage i šalje se isključivo Jira-inom sopstvenom API-ju.

**Prečica na tastaturi:** `Ctrl+Shift+S` (Windows) / `Cmd+Shift+S` (Mac) otvara side panel odakle god da si.

---

## Tehnološki stack

- React 19 + TypeScript (strict) + Tailwind CSS v4
- Vite + `@crxjs/vite-plugin`
- Fabric.js (editor za anotacije)
- Chrome Side Panel API, Manifest V3
- Jira Cloud REST API v3

Tri JavaScript konteksta: Side Panel UI, Background Service Worker, Annotation Editor popup. Komuniciraju preko `chrome.runtime.sendMessage` i `chrome.storage.local`.

---

## Build iz izvornog koda

```
npm install
npm run build
```

Output ide u `/dist`. Učitaj taj folder kao unpacked ekstenziju.

```
npx tsc --noEmit   # type check
npm run build      # production build
```

---

## Za kontributore koji koriste AI alate

`CLAUDE.md` i `.clinerules` sadrže projekt-instrukcije za AI coding asistente
(Claude Code i Cline). Ako koristiš bilo koji od ta dva alata, oni će ih automatski pokupiti
— build loop, format commit-a, TypeScript pravila, storage konvencije i poznate zamke
su sve tamo dokumentovane.

`AGENTS.md` pokriva pravila koordinacije više agenata za sesije koje uključuju
više AI alata istovremeno.

---

## Distribucija

JiraWM se distribuira interno kao load-unpacked build — ne kroz Chrome Web Store. Release-ovi se objavljuju na [GitHub-u](https://github.com/ognjenodobasic-wm/jirawm/releases). Kad je nova verzija dostupna, ekstenzija prikazuje indikator ažuriranja u side panelu da znaš da je preuzmeš.

---

## Doprinos projektu

JiraWM je napravljen za internu upotrebu, ali je kodbaza otvorena. Ako radiš sa Chrome ekstenzijama, React-om, ili Jira integracijama i želiš da doprineseš — slobodno otvori issue ili PR na [GitHub-u](https://github.com/ognjenodobasic-wm/jirawm).

Napomene o arhitekturi, storage šema, i poznate zamke su u [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
