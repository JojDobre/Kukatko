# Kukátko

Katalóg seriálov a filmov: kde ich pozerať, hodnotenia z IMDb, TMDB a Rotten Tomatoes, upozornenia na nové epizódy a na príchody a odchody z platforiem. Šesť jazykových verzií. Všetko sa plní automaticky.

```
docker-compose.yml   ← celé nasadenie na VPS (web, robot, databáza, zálohy, HTTPS)
Caddyfile            ← HTTPS (Let's Encrypt, automaticky)
.env.example         ← nastavenia, skopíruj ako .env
backup/backup.sh     ← nočné zálohy databázy
app/
  src/app/[lang]/    ← stránky vo všetkých jazykoch
  src/app/api/       ← API (sledovanie, hodnotenie, recenzie, prenos, prémium…)
  src/app/admin/     ← administrácia: moderovanie recenzií, štatistiky
  src/lib/           ← databáza, TMDB, OMDb, preklady (src/lib/i18n)
  worker/            ← robot: sťahovanie dát a upozornenia
  db/schema.sql      ← tabuľky databázy
```

## Čo stránka vie

- **Seriály aj filmy** s popisom, plagátmi, hercami, trailerom a hodnoteniami z viacerých zdrojov.
- **Jazykové verzie:** slovenčina (predvolená, bez predpony v adrese), čeština (`/cs`), angličtina (`/en`), poľština (`/pl`), maďarčina (`/hu`), nemčina (`/de`). Názvy titulov sú lokálne (napr. *Odloučení* v češtine). Platformy sa ukazujú podľa krajiny jazyka: SK, CZ, GB, PL, HU, DE. Prepínač ukazuje jazyky ich vlastným názvom. Pri prvej návšteve sa jazyk zvolí podľa prehliadača. Zapnuté jazyky určuje `LOCALES` v `.env`.
- **Katalóg** so zoradením (priemer, IMDb, TMDB, RT, užívatelia, najbližšia epizóda, najnovšie) a filtrami (seriály/filmy, platformy, žáner).
- **Rebríčky** (`/charts`): vychádza tento týždeň, nové na platformách, najlepšie seriály a filmy, zmizlo z platforiem, plus rebríčky pre každú väčšiu platformu. Obnovujú sa každý deň.
- **Stránky hercov a tvorcov** so životopisom a tým, čo sa od nich dá pozrieť.
- **Zvonček a upozornenia:** nová epizóda, ohlásená sezóna, titul pribudol na platformu alebo z nej zmizol (v krajine užívateľa). Prémiové zariadenia dostanú aj pripomienku večer pred vydaním epizódy.
- **Pozreté epizódy:** odškrtávanie po epizódach aj celých sezónach a sekcia „Pozerám“ s tým, čo je na rade.
- **Prenos na iné zariadenie** QR kódom alebo 6-miestnym kódom. Bez registrácie.
- **Recenzie** s moderovaním: texty s odkazmi alebo hrubými slovami čakajú na schválenie, po 3 nahláseniach sa recenzia skryje. Na deň max. 5 recenzií z jedného zariadenia.
- **Administrácia** (`/admin`): schvaľovanie recenzií, štatistika klikov na platformy, stav robota.
- **Prémium bez reklám** cez Stripe. Predvolene **vypnuté** (`PREMIUM_ENABLED=false`).

## Čo beží na VPS

| Služba | Čo robí |
|---|---|
| `db` | PostgreSQL 16. Dáta sú v Docker volume `pgdata`. Dostupná len z VPS (127.0.0.1:5432). |
| `web` | Web a API (Next.js) na porte 3000, za Caddy. |
| `worker` | Každú noc o 03:15 stiahne seriály a filmy pre všetky krajiny, zistí zmeny na platformách a doplní hodnotenia z OMDb. Každú hodinu obnoví tituly, ktorým vychádza epizóda, a pošle upozornenia. |
| `backup` | Každú noc o 02:00 záloha databázy do `./backups`, uchová posledných 14 dní. |
| `caddy` | HTTPS certifikát a presmerovanie na web. |
| `umami` | Voliteľné štatistiky návštevnosti (profil `analytics`). |

Stačí VPS s 2 GB RAM a Docker.

## Nasadenie krok za krokom

### 1. Bezplatné kľúče

- **TMDB:** na themoviedb.org v *Settings → API* požiadaj o kľúč (typ „Developer“). Skopíruj **API Read Access Token**.
- **OMDb:** na omdbapi.com/apikey.aspx vyber **FREE (1 000 dopytov denne)** a potvrď e-mail.

### 2. Doména

V DNS nastav záznam `A` pre `tvojadomena.sk` (a `www`) na IP adresu VPS.

### 3. Na VPS

Nainštaluj Docker (ak ho ešte nemáš):

```bash
curl -fsSL https://get.docker.com | sh
```

Stiahni projekt a vytvor nastavenia:

```bash
git clone https://github.com/JojDobre/kukatko.git
```

```bash
cd kukatko && cp .env.example .env && nano .env
```

Vyplň aspoň `DOMAIN`, `SITE_URL`, `POSTGRES_PASSWORD`, `TMDB_TOKEN`, `OMDB_API_KEY` a `ADMIN_TOKEN`. Heslá vygeneruješ:

```bash
openssl rand -hex 24
```

Kľúče pre push upozornenia vygeneruješ a vložíš do `.env`:

```bash
docker compose run --rm --no-deps worker node node_modules/tsx/dist/cli.mjs worker/cli.ts vapid
```

### 4. Spustenie

```bash
docker compose up -d --build
```

Robot pri prvom štarte zistí, že databáza je prázdna, a hneď stiahne tituly pre všetky krajiny. Pri šiestich jazykoch to trvá zhruba 20 až 40 minút. Priebeh uvidíš:

```bash
docker compose logs -f worker
```

Rebríčky „Nové na platformách“ a „Zmizlo z platforiem“ sa začnú plniť až od druhého dňa, lebo robot potrebuje porovnať dve synchronizácie.

## Monitoring (zadarmo)

- **Web:** v [UptimeRobot](https://uptimerobot.com) pridaj sledovanie adresy `https://tvojadomena.sk/api/health`. Vráti chybu 503, ak nefunguje databáza alebo robot nestiahol dáta viac ako 36 hodín.
- **Robot a zálohy:** na [healthchecks.io](https://healthchecks.io) vytvor tri kontroly (nočná synchronizácia raz za deň, hodinová obnova raz za hodinu, záloha raz za deň) a ich adresy vlož do `HC_NIGHTLY_URL`, `HC_HOURLY_URL` a `HC_BACKUP_URL`. Keď sa úloha nespustí alebo zlyhá, príde ti e-mail.

## Zálohy

Zálohy sú v priečinku `backups/` vedľa projektu. Odporúčam ich občas skopírovať aj mimo VPS.

Obnova zo zálohy:

```bash
gunzip -c backups/kukatko-2026-11-21.sql.gz | docker compose exec -T db psql -U kukatko kukatko
```

## Bežná údržba

Aktualizácia po zmene kódu:

```bash
git pull && docker compose up -d --build
```

Ručná synchronizácia:

```bash
docker compose exec worker node node_modules/tsx/dist/cli.mjs worker/cli.ts sync
```

## Zárobok

### Affiliate odkazy
V `app/src/lib/platforms.ts` doplň do `AFFILIATE` odkazy z partnerských programov (Awin, CJ…). Každý klik na „Kde pozerať“ prechádza cez `/out/…`, započíta sa do štatistiky v administrácii a presmeruje na platformu.

### AdSense a súhlas s cookies (GDPR)
1. Keď ti Google schváli web, doplň `ADSENSE_CLIENT` a `ADSENSE_SLOT` do `.env`.
2. V AdSense zapni **Privacy & messaging → European regulations** a vytvor správu o súhlase. Je to certifikovaná platforma na správu súhlasu (CMP) od Google, zadarmo, a v EÚ je pre reklamy povinná. Okno so súhlasom potom zobrazuje Google sám.
3. V pätičke sa objaví odkaz „Nastavenia súkromia“, cez ktorý môže návštevník súhlas zmeniť.

Vlastné cookies webu sú len funkčné (id zariadenia, jazyk, vybrané platformy), na tie súhlas netreba. Umami cookies nepoužíva.

### Prémium (predvolene vypnuté)
1. V [Stripe](https://stripe.com) vytvor produkt s mesačnou cenou a skopíruj jeho `price_…` id.
2. V *Developers → Webhooks* pridaj adresu `https://tvojadomena.sk/api/premium/webhook` s udalosťami `checkout.session.completed`, `customer.subscription.updated` a `customer.subscription.deleted`.
3. V *Settings → Billing → Customer portal* zapni zákaznícky portál (zrušenie predplatného).
4. Do `.env` doplň `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`, `PREMIUM_PRICE_LABEL` a nastav `PREMIUM_ENABLED=true`.

Prémium skryje reklamy a zapne pripomienku deň vopred. Na ďalšie zariadenia sa prenesie kódom z profilu. Stripe nemá mesačný poplatok, platíš len percento z platby.

**Pravidlá Google Play:** digitálne predplatné predávané v Android appke musí ísť cez platby Google Play. Preto sa v appke nákup prémia **neponúka** (rozpozná sa podľa `?zdroj=app` v úvodnej adrese). Prémium kúpené na webe však v appke platí.

### Štatistiky návštevnosti (voliteľné)
Umami je štatistika bez cookies, ktorú si spustíš na vlastnom VPS:

```bash
docker compose exec db createdb -U kukatko umami
```

```bash
docker compose --profile analytics up -d
```

Potom v `Caddyfile` odkomentuj blok `stats.{$DOMAIN}`, nasmeruj subdoménu na VPS, prihlás sa na `https://stats.tvojadomena.sk` (predvolene admin / umami, hneď zmeň heslo), pridaj web a do `.env` doplň `UMAMI_SCRIPT_URL=https://stats.tvojadomena.sk/script.js` a `UMAMI_WEBSITE_ID`.

## Android appka na Google Play

Web je PWA, takže appka je len obal okolo webu (Trusted Web Activity). Zmeny na webe sa v appke prejavia hneď, bez nového vydania.

1. Na svojom PC nainštaluj Node.js a Bubblewrap:
   ```bash
   npm i -g @bubblewrap/cli
   ```
2. Vytvor projekt appky z manifestu webu:
   ```bash
   bubblewrap init --manifest https://tvojadomena.sk/manifest.webmanifest
   ```
   Ako *package name* zadaj napr. `sk.kukatko.app`. Bubblewrap vytvorí aj podpisový kľúč. **Kľúč a heslo si zálohuj.** Bez nich appku už neaktualizuješ.
3. Zostav appku:
   ```bash
   bubblewrap build
   ```
4. Do `.env` doplň `TWA_PACKAGE` a `TWA_SHA256` (odtlačok kľúča) a reštartuj web. Over, že `https://tvojadomena.sk/.well-known/assetlinks.json` vracia tvoje údaje.
5. V Google Play Console (jednorazovo 25 $) nahraj `app-release-bundle.aab`. Ak používaš *Play App Signing*, pridaj do `TWA_SHA256` aj odtlačok z *Setup → App signing*, oddelený čiarkou.
6. Nové osobné vývojárske účty musia pred zverejnením spraviť uzavretý test s aspoň 12 testermi počas 14 dní.

## Vývoj na vlastnom PC

```bash
cd app && npm install
```

```bash
export DATABASE_URL=postgres://user:heslo@localhost:5432/kukatko
```

```bash
npm run seed:demo && npm run dev
```

`seed:demo` vloží 10 ukážkových seriálov a 6 filmov s vymyslenými hodnoteniami, takže web vyskúšaš aj bez TMDB kľúča. Na ostrom serveri ho nespúšťaj, prípadne ukážky zmaž:

```sql
DELETE FROM titles WHERE tmdb_id > 900000;
```

Testy: `npm test`. Kontrola typov: `npm run typecheck`.

### Nový jazyk
1. Pridaj ho do `ALL_LOCALES` v `app/src/lib/locales.ts` (názov, krajina, kód TMDB).
2. Skopíruj `app/src/lib/i18n/en.ts`, prelož texty a zaregistruj ho v `app/src/lib/i18n/index.ts`. Test skontroluje, že žiadny text nechýba.
3. Pridaj kód do `LOCALES` v `.env`.

## Podmienky dát

- **TMDB:** na webe musí byť uvedené, že dáta sú z TMDB (je to v pätičke). Bezplatný kľúč povoľuje aj web s reklamou. Pri veľkej návštevnosti ti môžu ponúknuť komerčnú licenciu.
- **JustWatch:** dostupnosť na platformách pochádza od JustWatch cez TMDB a treba ich uviesť (je to v pätičke aj pri tlačidlách).
- **OMDb:** bezplatný kľúč, limit 1 000 dopytov denne. Robot ho dodržiava a hodnotenia obnovuje postupne, každý titul raz za 7 dní.
- **Odchody z platforiem:** TMDB ani JustWatch zadarmo neposkytujú dátum, kedy titul z platformy odíde. Kukátko preto hlási odchod až vtedy, keď titul na platforme už nie je (po dvoch synchronizáciách, aby nechodili falošné upozornenia).
