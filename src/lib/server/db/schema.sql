-- Karten. Das CHECK ist ein Türsteher: nur diese fünf Typen kommen rein,
-- ein Tippfehler wie 'defintion' wird an der Tür abgewiesen.
CREATE TABLE IF NOT EXISTS nodes (
  id         TEXT PRIMARY KEY,
  type       TEXT NOT NULL CHECK (type IN ('fall','schema','definition','subsumtion','simpel','thema')),
  area       TEXT,
  front      TEXT NOT NULL,
  back       TEXT NOT NULL DEFAULT '',
  title      TEXT,
  ref        TEXT,
  mode       TEXT NOT NULL DEFAULT 'open' CHECK (mode IN ('open','agls','schema','chips')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Verknüpfungen. ON DELETE CASCADE: stirbt eine Karte, sterben ihre
-- Kanten automatisch mit — wie Stromleitungen beim Hausabriss.
-- UNIQUE: dieselbe Verbindung kann physisch nicht doppelt existieren.
CREATE TABLE IF NOT EXISTS edges (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  from_id  TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  to_id    TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  label    TEXT,
  position INTEGER,
  UNIQUE (from_id, to_id)
);

-- Indizes = Stichwortverzeichnis im Buch: "alle Kanten von Karte X"
-- wird ein Nachschlagen statt Seite-für-Seite-Durchblättern.
CREATE INDEX IF NOT EXISTS idx_edges_from ON edges(from_id);
CREATE INDEX IF NOT EXISTS idx_edges_to   ON edges(to_id);

-- Die leere Steckdose für FSRS: liegt bereit, führt noch keinen Strom.
-- Exakt die Felder, die der Algorithmus später braucht.
CREATE TABLE IF NOT EXISTS review_state (
  node_id     TEXT PRIMARY KEY REFERENCES nodes(id) ON DELETE CASCADE,
  due         TEXT,
  stability   REAL,
  difficulty  REAL,
  reps        INTEGER NOT NULL DEFAULT 0,
  lapses      INTEGER NOT NULL DEFAULT 0,
  state       TEXT NOT NULL DEFAULT 'new',
  last_review TEXT
);