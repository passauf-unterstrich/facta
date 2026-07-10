# Facta — Projektbriefing

Jura-Lernkarten-App für die Examensvorbereitung. Kernidee: Fälle als
verschachtelter Wissens-Graph (Fall → Anspruchsgrundlage → Definition →
Subsumtion), Lern-Erlebnis wie Mochi (Karte aufdecken, über Inline-Links
in gestapelte Layer immer tiefer). Ein-Personen-Betrieb, später
Server-Hosting und FSRS-Spaced-Repetition.

## Nutzer & Arbeitsweise
- Der Nutzer ist selbstlernender Programmier-Laie mit guten Grundkenntnissen.
  Er will bei jeder Änderung VERSTEHEN, was passiert: kurze Erklärungen,
  gern eine Metapher, keine Romane.
- Kleine, abgeschlossene Schritte. Nach jedem funktionierenden Stand ein
  Commit mit deutscher, aussagekräftiger Message.
- Der Nutzer testet selbst im Browser; auf Erfolgskontrollen hinweisen.
- Design-Anspruch: Apple-Philosophie. Ruhig, reduziert, dezent, "gebacken"
  und haptisch (sanfte Hover/Active-Transitions, Blur-Tiefe, eine
  Akzentfarbe). Vor UI-Arbeit tokens.css lesen.

## Tech-Stack
SvelteKit (Svelte 5, Runes-Modus erzwungen) · TypeScript strict ·
better-sqlite3 · marked · Tailwind v4 ist installiert, aber Komponenten
nutzen Scoped CSS mit den Tokens aus src/lib/tokens.css. Keine neuen
Dependencies ohne triftigen Grund — bewusst KEINE Graph-Library
(Finder-Spalten sind pures CSS).

## Architektur
Browser (Svelte) ⇄ API-Routen (+server.ts) ⇄ $lib/server/db ⇄ SQLite
- Datenbank: data/facta.db (gitignored, NIE committen — enthält die
  Lerninhalte des Nutzers, Backup läuft über /api/export als JSON)
- Schema: src/lib/server/db/schema.sql — nodes, edges, review_state
  (review_state ist die vorbereitete FSRS-Steckdose, noch ungenutzt)
- Seiten laden Daten über +page.server.ts-load (direkter DB-Zugriff),
  Mutationen laufen über fetch auf die API-Routen + invalidateAll()

## Eherne Regeln (nie brechen)
1. **Der Text ist die einzige Quelle für Kanten.** [[Text|ziel_id]]-Links
   im Kartentext erzeugen beim Speichern (POST /api/nodes) die edges —
   Sync: alle ausgehenden Kanten löschen, aus dem Text neu aufbauen.
   NIEMALS einen zweiten Weg einführen, der Kanten am Text vorbei anlegt.
2. **Alles Schreibende in Transaktionen** (db.transaction), Import atomar.
3. **IDs sind Maschinensache**: im Lern-UI unsichtbar, im Bauen-Modus und
   in Verwalten sichtbar. Auto-Generierung: praefix_slug (fall_, agl_,
   def_, sub_, k), Umlaute→ae/oe/ue, §→p, Kollision→_2.
4. **Ein Austauschformat** (FactaExport in types.ts): Import = Export =
   KI-Pipeline. Beim Import werden edges mit fehlenden Endpunkten
   übersprungen, nodes sind Upserts.
5. **Sichtbarer UI-Text mit echten Umlauten (ä/ö/ü/ß)**; Code-Bezeichner
   und IDs bleiben umlautfrei. UI-Sprache ist durchgehend Deutsch,
   Code-Bezeichner ebenfalls deutsch (oeffne, speichere, KinderListe).
6. Fünf Kartentypen: fall, schema, definition, subsumtion, simpel —
   doppelt abgesichert (TS-Check in der API + CHECK constraint in SQLite).

## Was existiert (Stand: Fundament + Kern fertig)
- / Bibliothek: Load-Funktion, Suche, Fall-Kacheln (ohne IDs)
- /karte/[id]: EINE Seite, Modi Lernen|Bauen via schwebendem HUD
  (z-index 100, über den Overlays mit z-index 50); ?modus=bauen als
  Start-Parameter. Layer-Stack: gestapelte Overlays mit Blur + Versatz,
  Esc schließt. LernKarte/BauKarte/KinderListe/LinkMenu als Komponenten.
  Verlinken: Text markieren → LinkMenu (Suche vorbefüllt, Enter = erster
  Treffer, oder neue Karte mit Auto-ID) → speichern → Ziel öffnet als Layer.
- /graph/[id]: Finder-Spalten (Miller Columns). Pfad = State (ID-Kette),
  Akkordeon folgt aus der Datenstruktur. Wurzel-Spalte, Vorschau rechts.
- /verwalten: Karte erstellen (springt in Bauen-Modus), JSON-Import,
  Export-Download, KI-Prompt-Feld (dynamisch aus DB via /api/prompt,
  Textarea mit select-on-click — NICHT navigator.clipboard, Safari!),
  Karten löschen.
- API: GET/POST /api/nodes (POST = Upsert + Kanten-Sync), GET/DELETE
  /api/nodes/[id] (DELETE cascaded via Schema), POST /api/import,
  GET /api/export, GET /api/prompt

## Bekannte Stolpersteine
- Svelte: :global() darf nur EINEN Selektor enthalten
- Safari blockiert navigator.clipboard nach await — deshalb Prompt-Textarea
- ESLint bewusst deaktiviert (dokumentiert in eslint.config.js):
  svelte/no-navigation-without-resolve (App läuft an Domain-Wurzel),
  svelte/no-at-html-tags (Inhalte aus eigener DB; bei Multi-User:
  Sanitizer in src/lib/markdown.ts nachrüsten)
- BauKarte koppelt front/back bewusst vom node-Prop ab
  (svelte-ignore state_referenced_locally) — Entwurfsschutz; frischer
  Zustand bei Kartenwechsel via {#key node.id}
- Tailwind-CSS-Datei heißt src/routes/layout.css (nicht app.css)

## Befehle
npm run dev · npm run check (svelte-check) · npm run lint · npm run format
API-Tests per curl gegen localhost:5173 (Beispiele: Git-History)

## Roadmap
Siehe ROADMAP.md — als Nächstes: erster echter Fall von Hand (liefert
Muster-JSON für den KI-Prompt), dann Bibliothek in Fälle/Wissen
strukturieren, KI-Pipeline Stufe 2+3, FSRS-Lernmodi, Subsumtions-Chips,
Server-Hosting (adapter-node, PWA).