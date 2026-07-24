# JiraWM — Workflowi

Korisnički vodič za workflow sistem. Namenjen svakom ko koristi ekstenziju, ne samo developerima.

---

## Šta je workflow i zašto postoji

**Workflow** je sačuvan šablon za kreiranje Jira taskova. Umesto da svaki put biraš projekat, tip issue-a, parent i popunjavaš obavezna polja, to podesiš **jednom** i sačuvaš kao workflow. Posle toga, kreiranje taska iz screenshota je samo: izaberi workflow → upiši summary → klikni Create.

Workflow pamti:
- **Projekat** (npr. `AT — Awesome Team`)
- **Tip issue-a** (npr. Bug, Task, Sub-task)
- Da li se taskovi kreiraju **pod parent issue-om** (i koji je parent)
- **Podrazumevane vrednosti obaveznih polja** (npr. Component uvek = "Frontend")
- Izabrana **opciona polja** i njihove default vrednosti
- Podešavanja kvaliteta screenshota

Workflowi se čuvaju u `chrome.storage.local`, lokalno u tvom browseru.

---

## Kako se kreira workflow (5 koraka)

Otvori Side Panel, klikni **+ New** u traci selektora (mora prvo da bude povezan Jira nalog — vidi SETUP.md).

**Korak 1 — Projekat.**
Padajući meni "Project *" se puni tvojim Jira projektima (učitava se preko `/project` API-ja). Izaberi projekat. Na ekranu vidiš `AT — Awesome Team` (ključ + ime).

**Korak 2 — Parent (opciono).**
Pojavljuje se checkbox *"Create all tasks as subtasks of a parent"*. Ako ga štikliraš, dobijaš polje za pretragu — kucaj bar 2 karaktera i ekstenzija pretražuje issue-e u tom projektu. Klikni rezultat da ga izabereš; prikazaće se kao `AT-45 — Login redesign` sa **×** za brisanje.

**Korak 3 — Tip issue-a.**
Padajući meni "Issue type *" se puni tipovima za izabrani projekat (Bug, Task, Story, Sub-task…). Izbor tipa otključava polja ispod.

**Korak 4 — Obavezna polja.**
Sekcija **REQUIRED FIELDS** prikazuje sva polja koja Jira zahteva za taj tip (osim onih koje aplikacija sама popunjava: project, issuetype, summary, description, parent, attachment, reporter). Upiši default vrednost za svako — ona će se automatski slati pri svakom kreiranju.

**Korak 5 — Opciona polja + ime.**
Sekcija **OPTIONAL FIELDS** ima checkbox za svako opciono polje; kad štrikliraš, dobijaš polje za default vrednost. Na kraju upiši **Workflow name *** (npr. "QA Bug Report") i klikni **Save Workflow**. Dugme je aktivno tek kad su popunjeni projekat, tip i ime.

> Novi workflow se odmah selektuje u traci. Kad je izabran, pored selektora stoji **Edit** dugme za izmenu ili brisanje.

---

## Šta znači "parent task" opcija

Kad je *"Create all tasks as subtasks of a parent"* uključen, **svaki** task koji napraviš kroz taj workflow se kreira kao **subtask ispod izabranog parent issue-a** (šalje se `parent: { key }` u Jira). Korisno kad grupišeš više bug-ova/screenshotova pod jedan epik ili story.

Ako je isključen, taskovi se kreiraju kao samostalni issue-i u projektu (bez parenta). Prazan parent se nikad ne šalje — Jira bi to odbila.

---

## Kako se koristi u Single Task modu

1. Izaberi workflow u traci (tab **Single Task**).
2. Klikni **Capture Screenshot** — snima vidljivi tab, kompresuje po podešavanju. Klik na preview otvara lightbox.
3. Upiši **Summary** (obavezno). **Description** je opcioni (ako workflow ima default za description, unapred je popunjen).
4. Klikni **Create Task**. Ekstenzija kreira issue + zakači screenshot.
5. Na uspeh: link ka issue-u (`AT-234`) + dugme **Create Another**. Ako screenshot upload padne (a issue je napravljen), dobijaš **Retry screenshot**.

Sva Jira polja (projekat, tip, parent, defaults) dolaze iz workflowa — u formi ručno unosiš samo summary i opciono description.

---

## Kako se koristi u Bulk modu

1. Izaberi workflow, pređi na tab **Bulk Upload**.
2. **Prevuci** screenshotove u drop zonu ili klikni **Choose files** (može više odjednom, samo slike).
3. Za svaki red u tabeli upiši **Summary** (ako ostaviš prazno, koristi se ime fajla).
4. Klikni **Start Upload**. Taskovi se obrađuju **jedan po jedan** u pozadini; status kolona prikazuje ⏸️ Waiting → ⏳ Creating → 📤 Uploading → link na issue (ili ❌ greška).
5. Kad se završi, dobijaš Chrome notifikaciju "X/Y tasks created". Ako neki padnu, pojavljuje se **Retry Failed** koji ponovo šalje samo neuspele.

Obrada radi i ako zatvoriš/otvoriš panel — progres se čuva u storage-u, a pozadinski worker se drži živ preko `keepAlive` alarma.

---

## Export / Import

U **Settings → Workflows**:
- **Export Workflows** — preuzima `workflows-jirawm.json` sa svim workflowima. Beleži se i "Last export" snapshot (vreme, broj, imena).
- **Import Workflows** — izaberi `.json` fajl. Merge je **po `id`**: postojeći workflowi sa istim id se ažuriraju, novi se dodaju. Prikazuje se `Imported N workflows (X new, Y updated)`.

Format je običan JSON niz `Workflow` objekata — pogodno za deljenje workflowa sa kolegama.

---

## FAQ

**Zašto ne vidim moj projekat?**
Lista dolazi iz Jira `/project` API-ja i pokazuje samo projekte kojima tvoj nalog ima pristup. Ako projekat fali: proveri da si povezan (Settings → Test Connection ✓), da tvoj Jira nalog ima dozvolu za taj projekat, i probaj ponovo da otvoriš **+ New** (projekti se učitavaju pri otvaranju wizarda). Tipovi issue-a se keširaju po projektu (`jirawm_createmeta_{projectKey}`).

**Šta su "required" polja?**
To su polja koja Jira konfiguracija označava kao obavezna za taj tip issue-a. Ako ih ne popuniš (ovde kao default), Jira vraća grešku pri kreiranju. Wizard ih automatski izvlači iz Jira "createmeta" i prikazuje u sekciji REQUIRED FIELDS (bez sistemskih polja koja aplikacija sama rešava).

**Mogu li da imam više workflowa?**
Da, koliko god. Svaki ima svoje ime i pojavljuje se u padajućem selektoru. Tipičan obrazac: poseban workflow po projektu/tipu (npr. "Web Bug", "Mobile Task", "QA pod Epic-om"). Prebacuješ se između njih preko selektora, bez ponovnog podešavanja.
