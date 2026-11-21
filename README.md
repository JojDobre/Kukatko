# Kukátko

Katalóg seriálov: kde ich pozerať na Slovensku, hodnotenia z IMDb, TMDB a Rotten Tomatoes a upozornenia na nové epizódy. Všetko sa plní automaticky.

```
docker-compose.yml   ← celé nasadenie na VPS
Caddyfile            ← HTTPS (Let's Encrypt, automaticky)
.env.example         ← nastavenia, skopíruj ako .env
app/
  src/app/           ← stránky (Next.js)
  src/lib/           ← databáza, TMDB, OMDb
  worker/            ← robot: sťahovanie dát a upozornenia
  db/schema.sql      ← tabuľky databázy
  public/sw.js       ← service worker (push, offline)
```

## Čo beží na VPS

| Služba | Čo robí |
|---|---|
| `db` | PostgreSQL 16. Dáta sú v Docker volume `pgdata`. Dostupná len z VPS (127.0.0.1:5432). |
| `web` | Web a API (Next.js) na porte 3000, za Caddy. |
| `worker` | Každú noc o 03:15 stiahne seriály z TMDB a hodnotenia z OMDb. Každú hodinu obnoví seriály, ktorým vychádza epizóda, a pošle push upozornenia. |
| `caddy` | HTTPS certifikát a presmerovanie na web. |

Stačí VPS s 1 GB RAM (2 GB pohodlnejšie) a Docker.

## Nasadenie krok za krokom

### 1. Bezplatné kľúče

- **TMDB:** zaregistruj sa na themoviedb.org, potom v *Settings → API* požiadaj o kľúč (typ „Developer“). Skopíruj **API Read Access Token**.
- **OMDb:** na omdbapi.com/apikey.aspx vyber **FREE (1 000 dopytov denne)** a potvrď e-mail.

### 2. Doména

V DNS nastav záznam `A` pre `tvojadomena.sk` (a `www`) na IP adresu VPS.

### 3. Na VPS

Nainštaluj Docker (ak ho ešte nemáš):

```bash
curl -fsSL https://get.docker.com | sh
```

Nahraj priečinok projektu na VPS (napr. cez `git clone` alebo `scp`) a vytvor nastavenia:

```bash
cd kukatko
cp .env.example .env
nano .env
```

Vyplň aspoň `DOMAIN`, `SITE_URL`, `POSTGRES_PASSWORD`, `TMDB_TOKEN`, `OMDB_API_KEY`. Heslo do databázy vygeneruješ:

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

Robot pri prvom štarte zistí, že databáza je prázdna, a hneď stiahne seriály. Trvá to zhruba 5 – 10 minút. Priebeh uvidíš:

```bash
docker compose logs -f worker
```

Hotovo, web beží na `https://tvojadomena.sk`.

## Bežná údržba

Aktualizácia po zmene kódu:

```bash
docker compose up -d --build
```

Ručná synchronizácia (napr. hneď po zmene nastavení):

```bash
docker compose exec worker node node_modules/tsx/dist/cli.mjs worker/cli.ts sync
```

Záloha databázy (odporúčam pridať do cronu na VPS):

```bash
docker compose exec -T db pg_dump -U kukatko kukatko | gzip > zaloha-$(date +%F).sql.gz
```

Obnova zo zálohy:

```bash
gunzip -c zaloha-2026-11-21.sql.gz | docker compose exec -T db psql -U kukatko kukatko
```

## Android appka na Google Play

Web je PWA, takže appka je len „obal“ okolo webu (Trusted Web Activity). Všetky zmeny na webe sa v appke prejavia hneď, bez nového vydania.

1. Na svojom PC nainštaluj Node.js a Bubblewrap:
   ```bash
   npm i -g @bubblewrap/cli
   ```
2. Vytvor projekt appky z manifestu webu:
   ```bash
   bubblewrap init --manifest https://tvojadomena.sk/manifest.webmanifest
   ```
   Ako *package name* zadaj napr. `sk.kukatko.app`. Bubblewrap si sám stiahne Android SDK a vytvorí podpisový kľúč. **Kľúč a heslo si zálohuj.** Bez nich appku už nikdy neaktualizuješ.
3. Zostav appku:
   ```bash
   bubblewrap build
   ```
   Vznikne `app-release-bundle.aab` (pre Google Play) a SHA-256 odtlačok kľúča.
4. Do `.env` na VPS doplň `TWA_PACKAGE=sk.kukatko.app` a `TWA_SHA256=<odtlačok>` a reštartuj web (`docker compose up -d`). Over, že `https://tvojadomena.sk/.well-known/assetlinks.json` vracia tvoje údaje. Bez toho by appka hore ukazovala lištu s adresou.
5. V Google Play Console (jednorazovo 25 $) vytvor appku a nahraj `.aab`. Ak používaš *Play App Signing*, pridaj do `TWA_SHA256` aj odtlačok z *Setup → App signing*, oddelený čiarkou.
6. Nové osobné vývojárske účty musia pred zverejnením spraviť uzavretý test s aspoň 12 testermi počas 14 dní.

Push upozornenia v appke fungujú cez Chrome v telefóne, netreba Firebase.

## Zárobok

- **Affiliate:** v `app/src/lib/platforms.ts` doplň do `AFFILIATE` odkazy z partnerských programov (Awin, CJ…). Tlačidlá „Kde pozerať“ ich použijú namiesto bežného odkazu.
- **AdSense:** keď ti Google schváli web, doplň `ADSENSE_CLIENT` a `ADSENSE_SLOT` do `.env`. Reklamné bloky sa zobrazia na domovskej stránke a v detaile seriálu.

## Vývoj na vlastnom PC

```bash
cd app
npm install
export DATABASE_URL=postgres://user:heslo@localhost:5432/kukatko
npm run seed:demo
npm run dev
```

`seed:demo` vloží 14 ukážkových seriálov, takže web vyskúšaš aj bez TMDB kľúča. Na ostrom serveri ho nespúšťaj, prípadne ukážky zmaž:

```sql
DELETE FROM shows WHERE id > 900000;
```

Testy: `npm test`. Kontrola typov: `npm run typecheck`.

## Podmienky dát

- TMDB: na webe musí byť uvedené, že dáta sú z TMDB (je to v pätičke). Komerčné použitie s reklamou je pri bezplatnom kľúči povolené, pri veľkej návštevnosti ti môžu ponúknuť komerčnú licenciu.
- Dostupnosť na platformách pochádza od JustWatch cez TMDB a treba ich uviesť (je to v pätičke aj pri tlačidlách).
- OMDb: bezplatný kľúč, limit 1 000 dopytov denne. Robot ho dodržiava a hodnotenia obnovuje postupne, každý seriál raz za 7 dní.
