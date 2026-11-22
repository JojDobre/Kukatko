-- Kukátko: databázová schéma (verzia 2: filmy + seriály, viac jazykov a regiónov).
-- Dá sa spustiť opakovane, všetko je IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS titles (
  id              serial PRIMARY KEY,
  kind            text    NOT NULL CHECK (kind IN ('tv', 'movie')),
  tmdb_id         integer NOT NULL,
  original_name   text    NOT NULL,
  original_language text,
  -- Preklady podľa jazyka: {"sk": {"name", "overview", "tagline", "slug"}, "cs": {...}}
  i18n            jsonb   NOT NULL DEFAULT '{}',
  poster_path     text,
  backdrop_path   text,
  release_date    date,                           -- prvé vysielanie / premiéra filmu
  year            integer,
  status          text,
  genre_ids       integer[] NOT NULL DEFAULT '{}',
  seasons         integer,
  episodes        integer,
  runtime         integer,                        -- minúty (film) / priemerná dĺžka epizódy
  creators        text[]  NOT NULL DEFAULT '{}',  -- tvorcovia seriálu / režiséri filmu
  "cast"          jsonb   NOT NULL DEFAULT '[]',  -- [{id, name, character, profile_path}]
  -- Platformy podľa regiónu: {"SK": [{id, name, logo_path, type}], "CZ": [...]}
  providers       jsonb   NOT NULL DEFAULT '{}',
  provider_keys   text[]  NOT NULL DEFAULT '{}',  -- ["SK:8", "CZ:8"] na rýchle filtrovanie
  regions         text[]  NOT NULL DEFAULT '{}',  -- regióny, kde je titul na nejakej platforme
  watch_links     jsonb   NOT NULL DEFAULT '{}',  -- {"SK": "https://..."}
  trailers        jsonb   NOT NULL DEFAULT '{}',  -- {"sk": "youtubeKey", "en": "..."}
  next_ep         jsonb,                          -- {season, episode, name, air_date}
  next_air_date   date,
  last_ep         jsonb,
  popularity      real    NOT NULL DEFAULT 0,
  tmdb_rating     real,
  tmdb_votes      integer NOT NULL DEFAULT 0,
  imdb_id         text,
  imdb_rating     real,
  imdb_votes      integer,
  rt_rating       integer,
  omdb_checked_at timestamptz,
  user_avg        real,
  user_count      integer NOT NULL DEFAULT 0,
  synced_at       timestamptz NOT NULL DEFAULT now(),
  seasons_synced_at timestamptz,                  -- kedy sme naposledy stiahli všetky epizódy
  score integer GENERATED ALWAYS AS (
    round(
      ( coalesce(CASE WHEN tmdb_votes >= 20 THEN tmdb_rating * 10 END, 0)
      + coalesce(imdb_rating * 10, 0)
      + coalesce(rt_rating, 0)
      + coalesce(CASE WHEN user_count >= 5 THEN user_avg * 10 END, 0)
      ) / nullif(
        (CASE WHEN tmdb_votes >= 20 AND tmdb_rating IS NOT NULL THEN 1 ELSE 0 END)
      + (CASE WHEN imdb_rating IS NOT NULL THEN 1 ELSE 0 END)
      + (CASE WHEN rt_rating IS NOT NULL THEN 1 ELSE 0 END)
      + (CASE WHEN user_count >= 5 AND user_avg IS NOT NULL THEN 1 ELSE 0 END), 0)
    )::integer
  ) STORED,
  UNIQUE (kind, tmdb_id)
);

CREATE INDEX IF NOT EXISTS titles_score_idx      ON titles (kind, score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS titles_popularity_idx ON titles (kind, popularity DESC);
CREATE INDEX IF NOT EXISTS titles_next_air_idx   ON titles (next_air_date);
CREATE INDEX IF NOT EXISTS titles_pkeys_idx      ON titles USING gin (provider_keys);
CREATE INDEX IF NOT EXISTS titles_regions_idx    ON titles USING gin (regions);
CREATE INDEX IF NOT EXISTS titles_genres_idx     ON titles USING gin (genre_ids);

-- História dostupnosti: kedy sa titul objavil na platforme a kedy z nej zmizol.
CREATE TABLE IF NOT EXISTS availability (
  title_id    integer NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
  region      text    NOT NULL,
  provider_id integer NOT NULL,
  first_seen  timestamptz NOT NULL DEFAULT now(),
  last_seen   timestamptz NOT NULL DEFAULT now(),
  removed_at  timestamptz,
  initial     boolean NOT NULL DEFAULT false,      -- videné pri prvom stiahnutí titulu (nie je to novinka)
  PRIMARY KEY (title_id, region, provider_id)
);
CREATE INDEX IF NOT EXISTS availability_new_idx     ON availability (region, first_seen DESC) WHERE NOT initial;
CREATE INDEX IF NOT EXISTS availability_removed_idx ON availability (region, removed_at DESC) WHERE removed_at IS NOT NULL;

-- Názvy platforiem a ich logá.
CREATE TABLE IF NOT EXISTS providers (
  id        integer PRIMARY KEY,
  name      text NOT NULL,
  logo_path text,
  slug      text NOT NULL
);

-- Názvy žánrov v jednotlivých jazykoch.
CREATE TABLE IF NOT EXISTS genres (
  kind text    NOT NULL,
  id   integer NOT NULL,
  lang text    NOT NULL,
  name text    NOT NULL,
  PRIMARY KEY (kind, id, lang)
);

-- Epizódy seriálov (aktuálna sezóna všetkých pokračujúcich, všetky sezóny sledovaných).
CREATE TABLE IF NOT EXISTS episodes (
  title_id integer NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
  season   integer NOT NULL,
  episode  integer NOT NULL,
  air_date date,
  runtime  integer,
  names    jsonb NOT NULL DEFAULT '{}',            -- {"sk": "…", "en": "…"}
  PRIMARY KEY (title_id, season, episode)
);

-- Herci a tvorcovia (načítajú sa z TMDB pri prvej návšteve stránky a cachujú sa).
CREATE TABLE IF NOT EXISTS people (
  id           integer PRIMARY KEY,               -- TMDB id
  name         text NOT NULL,
  slug         text NOT NULL,
  profile_path text,
  birthday     date,
  deathday     date,
  birthplace   text,
  known_for    text,
  bio          jsonb NOT NULL DEFAULT '{}',        -- {"sk": "…", "en": "…"}
  credits      jsonb NOT NULL DEFAULT '[]',        -- [{kind, tmdb_id, name, character, year, poster_path, popularity}]
  popularity   real NOT NULL DEFAULT 0,
  synced_at    timestamptz NOT NULL DEFAULT now()
);

-- Anonymné zariadenia (bez registrácie). Identifikuje ich cookie.
CREATE TABLE IF NOT EXISTS devices (
  id            uuid PRIMARY KEY,
  lang          text NOT NULL DEFAULT 'sk',
  region        text NOT NULL DEFAULT 'SK',
  prefs         jsonb NOT NULL DEFAULT '{"episodes": true, "seasons": true, "availability": true, "reminder": true}',
  premium_until timestamptz,
  stripe_customer text,
  stripe_subscription text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS follows (
  device_id  uuid    NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  title_id   integer NOT NULL REFERENCES titles(id)  ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (device_id, title_id)
);
CREATE INDEX IF NOT EXISTS follows_title_idx ON follows (title_id);

CREATE TABLE IF NOT EXISTS ratings (
  device_id  uuid     NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  title_id   integer  NOT NULL REFERENCES titles(id)  ON DELETE CASCADE,
  value      smallint NOT NULL CHECK (value BETWEEN 1 AND 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (device_id, title_id)
);

-- Pozreté epizódy.
CREATE TABLE IF NOT EXISTS watched (
  device_id  uuid    NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  title_id   integer NOT NULL REFERENCES titles(id)  ON DELETE CASCADE,
  season     integer NOT NULL,
  episode    integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (device_id, title_id, season, episode)
);

-- Recenzie od užívateľov.
CREATE TABLE IF NOT EXISTS reviews (
  id         serial PRIMARY KEY,
  device_id  uuid    NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  title_id   integer NOT NULL REFERENCES titles(id)  ON DELETE CASCADE,
  lang       text    NOT NULL,
  nickname   text,
  body       text    NOT NULL,
  status     text    NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'pending', 'hidden')),
  reports    integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (device_id, title_id)
);
CREATE INDEX IF NOT EXISTS reviews_title_idx ON reviews (title_id, created_at DESC) WHERE status = 'visible';

CREATE TABLE IF NOT EXISTS review_reports (
  review_id integer NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  device_id uuid    NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (review_id, device_id)
);

-- Krátke kódy na prenos sledovaných titulov na iné zariadenie.
CREATE TABLE IF NOT EXISTS transfer_codes (
  code       text PRIMARY KEY,
  device_id  uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint   text PRIMARY KEY,
  device_id  uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_device_idx ON push_subscriptions (device_id);

-- Aby nikto nedostal to isté upozornenie dvakrát.
CREATE TABLE IF NOT EXISTS notifications_sent (
  device_id uuid    NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  title_id  integer NOT NULL REFERENCES titles(id)  ON DELETE CASCADE,
  key       text    NOT NULL,
  sent_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (device_id, title_id, key)
);

-- Kliky na „Kde pozerať“ (štatistika pre affiliate).
CREATE TABLE IF NOT EXISTS clicks (
  day         date    NOT NULL,
  title_id    integer NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
  provider_id integer NOT NULL,
  region      text    NOT NULL,
  count       integer NOT NULL DEFAULT 0,
  PRIMARY KEY (day, title_id, provider_id, region)
);

-- Malé úložisko stavu robota (denný limit OMDb, čas poslednej synchronizácie…).
CREATE TABLE IF NOT EXISTS kv (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
