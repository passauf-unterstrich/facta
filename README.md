# Facta

Jura-Lernkarten-App für die Examensvorbereitung. Fälle werden als
verschachtelter Wissens-Graph erfasst (Fall → Anspruchsgrundlage →
Definition → Subsumtion) und wie eine echte Gutachten-Prüfung
durchwandert: Karte aufdecken, über Inline-Links in gestapelte Layer
immer tiefer.

## Kernideen

- **Text = Wahrheit**: `[[Begriff|ziel_id]]`-Links im Kartentext erzeugen
  beim Speichern automatisch die Kanten des Graphen. Es gibt keinen
  zweiten Weg, Verknüpfungen anzulegen.
- **Bahnhof-Effekt**: Geteilte Definitionen und Themen, auf die viele
  Fälle verweisen — ein Knoten, viele Linien.
- **Ein Austauschformat**: Import = Export = KI-Pipeline (JSON aus
  nodes + edges).

## Stack

SvelteKit (Svelte 5, Runes) · TypeScript strict · better-sqlite3 · marked.
Design: eigene Tokens (`src/lib/tokens.css`) + Scoped CSS, dunkel,
reduziert. Bewusst ohne Graph-Library.

## Entwickeln

```sh
npm install
npm run dev        # http://localhost:5173
npm run check      # svelte-check
npm run lint       # prettier + eslint
npm run format
```

Die Datenbank liegt in `data/facta.db` (gitignored). Backup: Verwalten →
„Backup exportieren" (JSON). Schema-Änderungen: Server stoppen,
`data/facta.db*` löschen, Server starten — die DB wird frisch nach
`src/lib/server/db/schema.sql` gebaut.

Projektwissen für KI-Assistenten: `CLAUDE.md` · Planung: `ROADMAP.md`
