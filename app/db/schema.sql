-- Kukátko: databázová schéma. Dá sa spustiť opakovane (všetko je IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS shows (
  id              integer PRIMARY KEY,          -- TMDB id
  slug            text NOT NULL,
  name            text NOT NULL,
  original_name   text,
  overview        text,
  tagline         text,
  poster_path     text,
  backdrop_path   text,
  first_air_date  date,
  year            integer,
  status          text,                          -- Returning Series / Ended / Canceled ...
  genres          text[] NOT NULL DEFAULT '{}',
  seasons         integer,
  episodes        integer,
  creators        text[] NOT NULL DEFAULT '{}',
  "cast"          jsonb NOT NULL DEFAULT '[]',    -- [{name, character, profile_path}]
  providers       jsonb NOT NULL DEFAULT '[]',    -- [{id, name, logo_path, type}]
  provider_ids    integer[] NOT NULL DEFAULT '{}',
  watch_link      text,                           -- stránka TMDB/JustWatch s odkazmi na platformy
  next_ep         jsonb,                          -- {season, episode, name, air_date}
  next_air_date   date,
  last_ep         jsonb,
  current_season  jsonb,                          -- [{episode, name, air_date}] aktuálnej sezóny
  trailer_key     text,                           -- YouTube kľúč
  popularity      real NOT NULL DEFAULT 0,
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
  ) STORED
);

CREATE INDEX IF NOT EXISTS shows_score_idx      ON shows (score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS shows_popularity_idx ON shows (popularity DESC);
CREATE INDEX IF NOT EXISTS shows_next_air_idx   ON shows (next_air_date);
CREATE INDEX IF NOT EXISTS shows_providers_idx  ON shows USING gin (provider_ids);
CREATE INDEX IF NOT EXISTS shows_genres_idx     ON shows USING gin (genres);

-- Anonymné zariadenia (bez registrácie). Identifikuje ich cookie.
CREATE TABLE IF NOT EXISTS devices (
  id         uuid PRIMARY KEY,
  prefs      jsonb NOT NULL DEFAULT '{"episodes": true, "seasons": true}',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS follows (
  device_id  uuid    NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  show_id    integer NOT NULL REFERENCES shows(id)   ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (device_id, show_id)
);
CREATE INDEX IF NOT EXISTS follows_show_idx ON follows (show_id);

CREATE TABLE IF NOT EXISTS ratings (
  device_id  uuid     NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  show_id    integer  NOT NULL REFERENCES shows(id)   ON DELETE CASCADE,
  value      smallint NOT NULL CHECK (value BETWEEN 1 AND 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (device_id, show_id)
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
  show_id   integer NOT NULL REFERENCES shows(id)   ON DELETE CASCADE,
  key       text    NOT NULL,   -- napr. "ep:S02E05" alebo "season:3"
  sent_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (device_id, show_id, key)
);

-- Malé úložisko stavu robota (napr. denný limit OMDb).
CREATE TABLE IF NOT EXISTS kv (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
