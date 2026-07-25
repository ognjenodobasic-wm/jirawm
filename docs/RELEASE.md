# JiraWM — Procedura za izdavanje verzije

Ovaj dokument opisuje korake za pripremu i objavljivanje nove JiraWM verzije. Sve se radi lokalno, osim samog kreiranja GitHub Release-a koje radi GitHub Action.

## Koraci

1. **Sinhrinizujte verziju**
   - Ažurirajte `version` u `manifest.json`.
   - Ažurirajte `version` u `package.json` na istu vrednost.

2. **Ažurirajte CHANGELOG.md**
   - Dodajte novu sekciju na vrhu sa datumom i promenama.

3. **Proverite TypeScript**
   ```bash
   npx tsc --noEmit
   ```

4. **Napravite ZIP arhivu**
   ```bash
   npm run package
   ```
   Ovo pokreće `npm run build`, pa zatim pravi `release/jirawm-v{version}.zip`. Proverite da li je arhiva ispravna pre nego što nastavite.

5. **Commit-ujte promene**
   ```bash
   git add -A
   git commit -m "release: v{version}"
   ```

6. **Napravite i push-ujte tag**
   ```bash
   git tag v{version}
   git push
   git push --tags
   ```

   **VAŽNO:** Git tag mora biti u formatu `v{version}` i mora se poklapati sa verzijom u `manifest.json`. Ako se ne poklapaju, GitHub Action će odbiti objavljivanje. Na primer, ako je verzija u manifestu `vX.Y.Z`, tag mora biti `vX.Y.Z`.

7. **GitHub Action objavljuje Release**
   Nakon push-a taga, `.github/workflows/release.yml` će automatski:
   - pokrenuti build,
   - proveriti da se tag i manifest poklapaju,
   - objaviti GitHub Release i zakačiti `jirawm-v{version}.zip` kao asset.

8. **Podelite link sa testerima**
   ```
   https://github.com/ognjenodobasic-wm/jirawm/releases/latest
   ```

## Šta raditi ako Action padne

- Pročitajte logove u GitHub Actions tabu.
- Najčešći razlog: tag i manifest se ne poklapaju. U tom slučaju ne pravite novi tag ručno — popravite verziju, commit-ujte, obrišite pogrešan tag (`git tag -d vX.Y.Z && git push --delete origin vX.Y.Z`), pa napravite novi.

## Napomene

- `key.pem` se nikad ne commit-uje — nalazi se u `.gitignore`. Ako je izgubljen, ekstenzija će dobiti novi privremeni ID svaki put kad se učita unpacked, pa ga čuvajte.
- `dist/` i `release/` se takođe ne commit-uju.
