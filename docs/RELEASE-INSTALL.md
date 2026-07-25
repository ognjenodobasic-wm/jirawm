# JiraWM — Uputstvo za testere

Ovaj fajl se nalazi unutar ZIP-a koji ste preuzeli. Pročitajte ga pre instalacije.

## Zahtevi

- Google Chrome 114 ili noviji.
- Jira Cloud nalog i API token.

## Preuzimanje

Na GitHub Releases stranici preuzmite fajl koji se zove **`jirawm-vX.Y.Z.zip`** (gde su X.Y.Z brojevi verzije). **Nemojte** preuzimati `Source code (zip)` — to je kod projekta, a ne spremna ekstenzija.

## Instalacija

1. Raspakujte ZIP u neki folder koji nećete brisati ni pomerati (Chrome učitava ekstenziju direktno iz tog foldera).
2. Otvorite Chrome i idite na `chrome://extensions`.
3. Uključite **Developer mode** (gore desno).
4. Kliknite **Load unpacked**.
5. Izaberite raspakovani folder `jirawm-vX.Y.Z`.
6. Kliknite na ikonu slagalice u Chrome toolbar-u, pronađite JiraWM i kliknite pin da ostane vidljiva.

## Podešavanje Jira pristupa

1. Napravite API token na: https://id.atlassian.com/manage-profile/security/api-tokens
2. Otvorite ekstenziju (klik na ikonu).
3. Idite na **Settings**.
4. Unesite:
   - **Domain**: samo poddomen (npr. `mojatim`, bez `.atlassian.net`)
   - **Email**: vaša email adresa
   - **API token**: token koji ste kreirali
5. Kliknite **Test Connection**. Kad vidite potvrdu, kliknite **Save & Test Connection**.

## Osnovna upotreba

Izaberite workflow, kliknite **Capture** da snimite ekran, unesite naslov i kliknite **Create Task**. Detaljnije uputstvo nalazi se u `docs/SETUP.md` unutar ZIP-a.

## Ažuriranje

Kada izađe nova verzija, preuzmite novi ZIP, raspakujte ga u novi folder, a zatim u `chrome://extensions` kliknite **Reload** na kartici JiraWM. Podešavanja i workflow-i ostaju sačuvani. Ne morate ponovo da kreirate API token.
