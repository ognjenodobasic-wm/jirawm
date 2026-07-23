# JiraWM — Instalacija i podešavanje

Vodič za novog korisnika: od dobijanja build-a do prvog kreiranog taska. Ekstenzija je za internu upotrebu i ne distribuira se preko Chrome Web Store-a — instalira se ručno ("load unpacked").

---

## Preduslovi

- **Google Chrome 114+** (Side Panel API zahteva 114 ili noviji). Radi i na Chrome-based browserima sa MV3 + Side Panel podrškom (novi Edge). Proveri verziju na `chrome://version`.
- **Jira Cloud nalog** sa pristupom projektima u koje ćeš kreirati taskove.
- Nije potreban Node/build alat ako dobiješ gotov `/dist` od developera. (Build iz izvora: `npm install && npm run build`.)

---

## Kako da dobiješ build od developera

Developer ti šalje **sadržaj `dist/` foldera** (ne izvorni kod). Najčešće kao:
- **ZIP** — raspakuj u stalan folder (npr. `~/JiraWM/dist`). Ne briši ga posle — Chrome učitava ekstenziju sa te putanje.
- **AirDrop / deljeni folder** — isto, samo sačuvaj na stalno mesto.

> Bitno: folder mora ostati na disku. Ako ga premestiš ili obrišeš, ekstenzija prestaje da radi dok je ponovo ne učitaš sa nove putanje.

---

## Load unpacked (instalacija)

1. Otvori `chrome://extensions` (ili ⋮ Menu → Extensions → Manage Extensions).
2. Gore desno uključi **Developer mode** (toggle).
3. Klikni **Load unpacked** (gore levo).
4. U dijalogu izaberi **`dist` folder** (onaj koji sadrži `manifest.json`, `sidepanel.html`, `icons/`…). Potvrdi.
5. Kartica **JiraWM** se pojavljuje u listi. Prikačimo je na traku: klikni ikonicu puzzle (🧩) u toolbaru → pin pored **JiraWM**.

### Otvaranje Side Panela
- Klikni **JiraWM** ikonicu u toolbaru, **ili**
- Pritisni **Ctrl+Shift+S** (Windows) / **Cmd+Shift+S** (Mac).

---

## Kako da generišeš Jira API token

Ekstenzija koristi API token (ne lozinku) za Basic auth.

1. Otvori: **https://id.atlassian.com/manage-profile/security/api-tokens**
2. Klikni **Create API token**.
3. Daj mu ime (npr. "JiraWM") i klikni **Create**.
4. **Kopiraj token odmah** — prikazuje se samo jednom. Ako ga izgubiš, napravi novi.

> Token je isto što i lozinka — ne deli ga i ne commituj nigde. Čuva se lokalno u `chrome.storage.local` i nikad se ne sinhronizuje.

---

## Prva konfiguracija (Settings)

1. Otvori Side Panel → klikni **⚙ Settings** (gore desno).
2. Popuni sekciju **Jira Connection**:
   - **Jira domain** — samo poddomen, npr. `mycompany` (ekstenzija sama dodaje `.atlassian.net`).
   - **Email** — email tvog Jira naloga.
   - **API token** — nalepi token (dugme **Show** za proveru).
3. Klikni **Save & Test Connection**.
   - ✓ **Connected** + tvoje ime + Account ID → uspeh.
   - ✗ crvena poruka → proveri domain (samo poddomen), email i token.
4. (Opciono) **Screenshot Quality** — podesi JPEG kvalitet i max širinu, pa **Save Compression**.

Kad je konekcija ✓, vrati se (**← Back**) i napravi prvi workflow preko **+ New** (vidi WORKFLOWS.md).

> Napomena: ako posle uspešnog testa selektor workflowa i dalje traži konekciju, to je poznata zamka (accountId ključ) — vidi `docs/ARCHITECTURE.md`, sekcija Poznate zamke.

---

## Keyboard shortcut podešavanje

Podrazumevano: **Ctrl+Shift+S / Cmd+Shift+S**.

Da promeniš:
1. U Settings → sekcija **Keyboard Shortcut** → klikni **Change shortcut** (otvara `chrome://extensions/shortcuts`).
2. Nađi **JiraWM**, klikni polje pored komande i pritisni novu kombinaciju.

> Chrome dozvoljava do 4 globalna shortcut-a po ekstenziji i ne dozvoljava kombinacije koje se sudaraju sa sistemskim/Chrome prečicama.

---

## Kako da dobiješ update

Pošto nije preko Web Store-a, update je ručan:
1. Developer ti pošalje novi `dist` (ZIP/folder). Prepiši stari sadržaj **na istoj putanji** (da ne moraš ponovo load unpacked).
2. Otvori `chrome://extensions` → na kartici **JiraWM** klikni **Reload** (↻).
3. Zatvori i ponovo otvori Side Panel.

Ako si sačuvao novi build na **novu** putanju, uradi **Load unpacked** ponovo i ukloni staru instancu. Workflowi i auth ostaju sačuvani u `chrome.storage` (vezani za ekstenziju), pa ih ne moraš ponovo podešavati posle reload-a iste ekstenzije.
