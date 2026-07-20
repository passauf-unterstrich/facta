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
// Sicherheitsnetz, in zwei Zügen:
// 1. Checkpoint: das WAL-Notizbuch vollständig ins Hauptbuch
//    einspielen — facta.db ist danach garantiert der Live-Stand.
db.pragma('wal_checkpoint(TRUNCATE)');

// 2. Tages-Schnappschuss der (jetzt aktuellen) DB nach data/backups/.
import { copyFileSync, existsSync } from 'node:fs';
const backupDir = join(dataDir, 'backups');
mkdirSync(backupDir, { recursive: true });
const dbPfad = join(dataDir, 'facta.db');
const heutigesBackup = join(backupDir, `facta-${new Date().toISOString().slice(0, 10)}.db`);
if (existsSync(dbPfad) && !existsSync(heutigesBackup)) {
	copyFileSync(dbPfad, heutigesBackup);
}

const schema = readFileSync(join(here, 'schema.sql'), 'utf-8');
db.exec(schema);
