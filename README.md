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
- **Jazykové verzie:** slovenčina (predvolená, bez predpony v adrese), čeština (`/cs`), angličtina (`/en`), poľština (`/pl`), maďarčina (`/hu`), nemčina (`/de`). Názvy titulov sú lokálne (napr. *Odloučení* v češtine). Platformy sa ukazujú podľa krajiny, ktorú si užívateľ zvolí v profile (predvolene podľa jazyka: SK, CZ, GB, PL, HU, DE, ďalšie cez `EXTRA_REGIONS`). Prepínač ukazuje jazyky ich vlastným názvom. Pri prvej návšteve sa jazyk zvolí podľa prehliadača. Zapnuté jazyky určuje `LOCALES` v `.env`.
- **Katalóg** so zoradením (priemer, IMDb, TMDB, RT, užívatelia, najbližšia epizóda, najnovšie) a filtrami (seriály/filmy, platformy, žáner).
- **Rebríčky** (`/charts`): vychádza tento týždeň, nové na platformách, najlepšie seriály a filmy, zmizlo z platforiem, plus rebríčky pre každú väčšiu platformu. Obnovujú sa každý deň.
- **Stránky hercov a tvorcov** so životopisom a tým, čo sa od nich dá pozrieť.
- **Zvonček a upozornenia:** nová epizóda, ohlásená sezóna, titul pribudol na platformu alebo z nej zmizol (v krajine užívateľa). Prémiové zariadenia dostanú aj pripomienku večer pred vydaním epizódy.
- **Pozreté epizódy:** odškrtávanie po epizódach aj celých sezónach (netreba seriál sledovať) a sekcia „Pozerám“ s tým, čo je na rade.
- **Stránky epizód** (`/tv/…/season/3/episode/9`): obrázok zo scény, popis vo všetkých jazykoch, réžia, scenár, hosťujúce hviezdy, hodnotenie z TMDB aj od užívateľov, vlastné hodnotenie 1–10, recenzie epizódy, tlačidlo „Pozreté“, predchádzajúca a ďalšia epizóda a obrázok na zdieľanie. Zoznam epizód v detaile seriálu ukazuje obrázky a skóre každej epizódy.
- **Prenos na iné zariadenie** QR kódom alebo 6-miestnym kódom. Bez registrácie.
- **Recenzie** s moderovaním: texty s odkazmi alebo hrubými slovami čakajú na schválenie, po 3 nahláseniach sa recenzia skryje. Na deň max. 5 recenzií z jedného zariadenia.
- **Administrácia** (`/admin`): schvaľovanie recenzií, štatistika klikov na platformy, stav robota.
- **Prémium bez reklám** cez Stripe. Predvolene **vypnuté** (`PREMIUM_ENABLED=false`).
- **Stránky platforiem** (`/platforms`, `/platform/netflix`): novinky, čo zmizlo, nové epizódy tento týždeň a najlepšie tituly.
- **„Podobné ako…“** (`/tv/…/similar`, `/movie/…/similar`): samostatné stránky pre vyhľadávanie typu „seriály podobné ako Dark“.
- **Kalendár vydaní** (`/calendar`) na celý mesiac, s filtrom platforiem a prepínačom „Len sledované“.
- **Obrázky na zdieľanie:** pri zdieľaní odkazu na titul sa ukáže karta s plagátom, hodnotením a platformami.
- **Čo dnes pozrieť?** (`/pick`): tri otázky (nálada, film alebo seriál, čas) a tri tipy z tvojich platforiem.
- **Chcem vidieť:** samostatný zoznam. Upozornenie príde, keď titul pribudne na tvoju platformu.
- **Nezaujíma ma:** titul sa prestane ukazovať v odporúčaniach a vo výbere na dnes (dá sa vrátiť v Sledujem).
- **Moje štatistiky** (`/stats`): hodiny pozerania, žánre, najlepšie hodnotené, prehľad po mesiacoch a obrázok „Môj rok“ na zdieľanie.
- **Pozerajte spolu** (`/together`): odkaz pre kamaráta, ktorý nájde tituly, čo ste nevideli ani jeden, na vašich platformách.
- **Import z IMDb, Letterboxd a Trakt** (v profile): hodnotenia, Chcem vidieť a pozreté filmy.
- **Kalendár v telefóne:** súkromný odkaz pre Google alebo Apple kalendár s vydaniami sledovaných seriálov.
- **Filtre v katalógu:** rok, dĺžka (film alebo epizóda), minimálne hodnotenie a pôvodný jazyk.
- **Krajina a moje platformy** v profile (pozri nižšie).
- **TV program** (`/tv-program`): filmy a seriály v televízii s hodnotením, „Najlepšie filmy v TV dnes“ na domovskej a „V televízii“ pri titule (pozri nižšie).
- **Odporúčané boxy:** reklamné miesto na domovskej stránke, ktoré predáš priamo a spravuješ v `/admin`.

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

### 3b. VPS, na ktorom už bežia iné projekty

Kukátko beží v samostatných kontajneroch (názvy začínajú `kukatko-`) a s vlastnou databázou, takže sa s inými projektmi nebije. Treba len vyriešiť, kto bude obsluhovať porty 80 a 443:

- **Na VPS ešte nebeží web server:** nechaj v `.env` `COMPOSE_PROFILES=caddy`. Kukátko si spustí Caddy a samo vybaví HTTPS.
- **Už máš nginx, Caddy alebo Traefik:** nastav `COMPOSE_PROFILES=` (prázdne). Web bude počúvať len na `127.0.0.1:3010` (zmeníš cez `WEB_PORT`) a v tvojom web serveri pridáš doménu, ktorá naň presmeruje. Ukážka pre nginx:

  ```nginx
  server {
      server_name kukatko.sk www.kukatko.sk;
      location / {
          proxy_pass http://127.0.0.1:3010;
          proxy_http_version 1.1;
          proxy_set_header Host $host;
          proxy_set_header X-Forwarded-For $remote_addr;
          proxy_set_header X-Forwarded-Proto $scheme;
      }
  }
  ```

  HTTPS potom vybavíš cez `certbot --nginx -d kukatko.sk -d www.kukatko.sk`. Hlavička `X-Forwarded-For` musí obsahovať skutočnú IP návštevníka, inak nebude správne fungovať obmedzenie počtu požiadaviek.

Databáza počúva len na VPS na porte `5433` (zmeníš cez `DB_PORT`), aby nekolidovala s inou databázou.

### 4. Spustenie

```bash
docker compose up -d --build
```

Robot pri prvom štarte zistí, že databáza je prázdna, a hneď stiahne tituly pre všetky krajiny. Pri šiestich jazykoch to trvá zhruba 20 až 40 minút. Priebeh uvidíš:

```bash
docker compose logs -f worker
```

Rebríčky „Nové na platformách“ a „Zmizlo z platforiem“ sa začnú plniť až od druhého dňa, lebo robot potrebuje porovnať dve synchronizácie.

## Automatické testy a nasadenie (GitHub Actions)

Pri každom pushnutí sa spustí `CI`: kontrola typov, testy, build a skúšobný beh webu s databázou a ukážkovými dátami. Keď CI prejde vo vetve `main`, spustí sa `Deploy`: pripojí sa na VPS cez SSH, stiahne kód a reštartuje kontajnery.

Nastavenie nasadenia (raz):
1. Na VPS vytvor kľúč len pre GitHub a povoľ ho:
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/github_deploy -N ""
   ```
   ```bash
   cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
   ```
2. V GitHub repozitári otvor *Settings → Secrets and variables → Actions* a pridaj:
   - `VPS_HOST`: IP adresa alebo doména VPS,
   - `VPS_USER`: používateľ na VPS,
   - `VPS_SSH_KEY`: obsah súboru `~/.ssh/github_deploy` (súkromný kľúč),
   - voliteľne `VPS_PORT` (predvolene 22) a `VPS_PATH` (predvolene `~/kukatko`).
3. Na VPS musí byť projekt naklonovaný v `VPS_PATH` a mať vyplnený `.env`.

Kým `VPS_HOST` nie je nastavený, nasadenie sa preskočí a beží len CI. Ručne ho spustíš v záložke *Actions → Deploy → Run workflow*. Nasadenie prepíše zmeny v kóde na VPS podľa `main` (súbor `.env` a zálohy zostanú).

## Rýchlosť a ochrana

- Dopyty, ktoré sú rovnaké pre všetkých (rebríčky, zoznamy platforiem, najlepšie hodnotené, katalóg), si web pamätá 5 minút (`CACHE_TTL`).
- API má obmedzenie počtu požiadaviek z jednej IP adresy (napríklad 120 za minútu, import 6 za 10 minút). Pri prekročení vráti chybu 429.

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

### Odporúčané boxy (priamy predaj reklamy)
V `/admin` v časti *Odporúčané boxy* pridáš box s nadpisom, textom, cieľovou adresou, obdobím a jazykmi. Voliteľne ho prepojíš s titulom (zobrazí sa jeho plagát). Box sa ukáže na domovskej stránke s označením „Reklama“, prémioví užívatelia ho nevidia. Administrácia ukazuje počet zobrazení a klikov, ktoré môžeš poslať inzerentovi.

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

## Krajina a platformy

V **Profile** si každý vyberie krajinu a platformy, ktoré má predplatené. Krajina je nezávislá od jazyka (napr. slovenčina, ale ponuka pre Česko). Podľa krajiny sa ukazuje, čo je na ktorej platforme, a aj TV program. Výber platforiem platí pre katalóg, domovskú stránku aj upozornenia.

Na výber je **Celý svet**, krajiny jazykov (SK, CZ, GB, PL, HU, DE), **USA** a **všetky krajiny EÚ**. „Celý svet“ ukazuje celý katalóg bez ohľadu na krajinu a pri titule platformy zo všetkých krajín spolu. Pre krajiny jazykov sa každú noc sťahuje `SYNC_PAGES` strán populárnych titulov, pre ostatné `SYNC_PAGES_EXTRA` (predvolene 3), lebo populárne tituly sa prekrývajú. Zoznam zmeníš cez `EXTRA_REGIONS` (napr. `AT,CH,US`, alebo `none`). Platformy pre nové krajiny sa objavia po najbližšej nočnej synchronizácii.

## TV program

Sekcia **TV program** (`/tv-program`), dlaždica „Najlepšie filmy v TV dnes“ na domovskej stránke a riadok „V televízii“ pri titule. Je len pre **Slovensko a Česko**. V iných krajinách sa sekcia ani odkaz neukazujú.

- **Zdroj:** verejný TV program z tvprogram.cz (mobilná verzia m.tv.sms.cz). Rovnaký zdroj používa open-source projekt iptv-org/epg. Netreba nič nastavovať ani inštalovať.
- **Stanice:** asi 45 staníc, napríklad Jednotka, Dvojka, Markíza, Doma, Dajto, JOJ, JOJ Plus, WAU, JOJ Cinema, ČT1, ČT2, Nova, Nova Cinema, Prima, Prima Max, CS Film, Film+, HBO, Cinemax, AXN či Filmbox. Zoznam je v `app/worker/tvsms.ts`.
- **Kedy sa sťahuje:** robot každých 6 hodín obnoví dnešok a zajtrajšok. Raz denne ráno stiahne 5 dní dopredu. Medzi stránkami robí pauzu (`TV_SMS_PAUSE_MS`, predvolene 1,2 s), aby zdroj nezaťažoval.
- **Párovanie:** relácie spáruje s titulmi podľa názvu a roku. Čo nenájde v katalógu, vyhľadá v TMDB (`TV_TMDB_LOOKUPS` na jeden beh) a titul pridá aj s hodnotením. Správy, šport a relácie sa vynechajú.
- **Vlastný zdroj:** namiesto vstavaného môžeš zadať súbor XMLTV cez `TV_XMLTV_SK` a `TV_XMLTV_CZ`. Vstavaný zdroj vypneš cez `TV_BUILTIN=off`.

Ručné spustenie:

```bash
docker compose exec worker node node_modules/tsx/dist/cli.mjs worker/cli.ts tv
```

Výsledok posledného behu je v tabuľke `kv` pod kľúčom `last_tv_import`. Monitoring: adresu kontroly z healthchecks.io vlož do `HC_TV_URL`.

## Podmienky dát

- **TMDB:** na webe musí byť uvedené, že dáta sú z TMDB (je to v pätičke). Bezplatný kľúč povoľuje aj web s reklamou. Pri veľkej návštevnosti ti môžu ponúknuť komerčnú licenciu.
- **JustWatch:** dostupnosť na platformách pochádza od JustWatch cez TMDB a treba ich uviesť (je to v pätičke aj pri tlačidlách).
- **OMDb:** bezplatný kľúč, limit 1 000 dopytov denne. Robot ho dodržiava a hodnotenia obnovuje postupne, každý titul raz za 7 dní.
- **TV program:** pochádza z verejného tvprogram.cz. Pri komerčnom využití (reklama, prémium) si over ich podmienky alebo prejdi na licencovaný zdroj XMLTV.
- **Odchody z platforiem:** TMDB ani JustWatch zadarmo neposkytujú dátum, kedy titul z platformy odíde. Kukátko preto hlási odchod až vtedy, keď titul na platforme už nie je (po dvoch synchronizáciách, aby nechodili falošné upozornenia).
