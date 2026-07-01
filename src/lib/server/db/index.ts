import Database from 'better-sqlite3';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// "Wo bin ich?" — der Ordner dieser Datei (src/lib/server/db)
const here = dirname(fileURLToPath(import.meta.url));

// Von dort vier Ebenen hoch zum Projekt-Root, dann rein in data/
const root = join(here, '..', '..', '..', '..');
const dataDir = join(root, 'data');
mkdirSync(dataDir, { recursive: true });

export const db = new Database(join(dataDir, 'facta.db'));

// WAL: die DB schreibt erst ins Notizbuch, dann ins Hauptbuch.
// Schneller, und Lesen blockiert Schreiben nicht. Best Practice.
db.pragma('journal_mode = WAL');

// Ohne diese Zeile ignoriert SQLite Fremdschlüssel komplett —
// CASCADE und UNIQUE aus dem Schema wären nur Dekoration.
db.pragma('foreign_keys = ON');

// Bauplan einlesen und Schränke aufstellen (passiert beim ersten
// Serverstart; dank IF NOT EXISTS danach ein No-Op)
const schema = readFileSync(join(here, 'schema.sql'), 'utf-8');
db.exec(schema);