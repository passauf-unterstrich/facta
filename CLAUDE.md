# Facta — Projektbriefing

Jura-Lernkarten-App für die Examensvorbereitung. Kernidee: Fälle als
verschachtelter Wissens-Graph (Fall → Anspruchsgrundlage → Definition →
Subsumtion), Lern-Erlebnis wie Mochi (Karte aufdecken, über Inline-Links
in gestapelte Layer immer tiefer). Ein-Personen-Betrieb, später
Server-Hosting und FSRS-Spaced-Repetition.

## Nutzer & Arbeitsweise

- Selbstlernender Programmier-Laie mit guten Grundkenntnissen. Er will
  bei jeder Änderung VERSTEHEN, was passiert: kurze Erklärungen, gern
  eine Metapher, keine Romane.
- Kleine, abgeschlossene Schritte. Nach jedem funktionierenden Stand ein
  Commit mit deutscher, aussagekräftiger Message.
- Der Nutzer testet selbst im Browser; auf Erfolgskontrollen hinweisen.
- Design-Anspruch: Apple-Philosophie. Ruhig, reduziert, "gebacken" und
  haptisch (sanfte Hover/Active-Transitions, Blur-Tiefe, EINE
  Akzentfarbe). Vor UI-Arbeit tokens.css lesen.

## Tech-Stack

SvelteKit (Svelte 5, Runes erzwungen) · TypeScript strict ·
Supabase/Postgres · marked. Tailwind v4 ist installiert und liefert den
CSS-Reset (Preflight) — Komponenten stylen aber mit Scoped CSS + Tokens
aus src/lib/tokens.css. Keine neuen Dependencies ohne triftigen Grund —
bewusst KEINE Graph-Library (Finder-Spalten sind pures CSS).

## Architektur

Browser (Svelte) ⇄ SvelteKit/Vercel ⇄ Supabase/Postgres

- Zugangsdaten liegen ausschließlich in `.env` bzw. den Vercel-Variablen
  `SUPABASE_URL` und `SUPABASE_SECRET_KEY`; niemals committen oder an den
  Browser geben. Backup über `/api/export`.
- Schema- und RPC-Änderungen werden im Supabase SQL Editor ausgeführt und
  als nachvollziehbarer SQL-Befehl dokumentiert.
- Seiten laden über `+page.server.ts`; Mutationen laufen über API-Routen.
  Große Tabellen immer seitenweise über
  `$lib/server/db/supabase-pages.ts` lesen, weil Supabase Antworten begrenzt.
- Geteilte Helfer: $lib/id.ts (baueId), $lib/schalen.ts (parseZeilen/
  serialisiere), $lib/markdown.ts (rendere/rendereInline/klartext),
  $lib/server/db/supabase-queries.ts (holeKarte/holeKinder). Duplikate dieser
  Logik NIE wieder inline anlegen.

## Datenmodell

Sechs Kartentypen (TS-Union + Constraint in Postgres): fall, schema,
definition, subsumtion, simpel, thema.

- title = Anzeigename für Menüs (Regel überall: title ?? front),
  ref = Aktenzeichen (nur fall), mode = Darstellung der Rückseite.
- mode: open (Freitext) · struktur (eine Link-Zeile pro Schale). Das
  separate Feld chips enthält Link-Zeilen für Bubbles. Im Strukturmodus
  ist back stets die Serialisierung der Schalen.
- thema = Erkennungs-Signal (Arglist, Sachmangel …). Signalwörter im
  Sachverhalt sind Links auf Themen-Karten und werden GELB gerendert
  (Renderer bekommt eine typMap id→typ). Themen-Rückseite = Merkliste
  der Konsequenzen, KEIN Fall-Register.

## Eherne Regeln (nie brechen)

1. **Der Text ist die einzige Quelle für Kanten.** [[Text|ziel_id]]-Links
   erzeugen beim Speichern (POST /api/nodes) die edges — Sync: alle
   ausgehenden Kanten löschen, aus dem Text neu aufbauen. Auch DELETE
   respektiert das: Links auf die gelöschte Karte werden serverseitig
   zu blankem Text entschärft. NIEMALS einen zweiten Weg einführen.
2. **Zusammengehörige Schreibvorgänge atomar halten.** Der Komplettimport
   läuft über die Supabase-RPC `import_facta`; neue mehrstufige Schreibwege
   ebenfalls als RPC/Transaktion bauen.
3. **IDs sind Maschinensache**: im Lern-UI unsichtbar. Auto-Generierung
   zentral in $lib/id.ts (fall_/agl_/def_/sub_/k_/thema_, Umlaute→ae/oe,
   §→p, Kollision→_2).
4. **Ein Austauschformat** (FactaExport): Import = Export = KI-Pipeline.
5. **Sichtbarer UI-Text mit echten Umlauten**; Code-Bezeichner deutsch
   und umlautfrei (oeffne, speichere, KinderListe).

## Was existiert

- / Bibliothek: Suche, Fall-Kacheln (title ?? front, keine IDs)
- /karte/[id]: Modi Lernen|Bauen via schwebendem HUD (+ Graph-Link,
  z-index 100 über Overlays 50); ?modus=bauen als Startparameter.
  Layer-Stack mit Blur + Versatz; Overlay schließt nur bei
  mousedown-Start auf dem Vorhang (Markier-Schwünge sicher), Esc.
  BauKarte: Typ + Mode wechselbar, Titel/Aktenzeichen, Schalen-Editor
  (Zeilen-UI, ＋, verlinken pro Schale), Vorschau-Toggles unter den
  Feldern, Cmd+S speichern, Cmd+B/I/U formatieren (auch in Schalen).
  LinkMenu: Suche vorbefüllt, Enter = erster Treffer, kontextsensitiver
  Typ-Default (fall→schema→definition→subsumtion), neue Karten
  bekommen passenden mode/title.
- /graph/[id]: Finder-Spalten, Pfad = State, Wurzel-Spalte, Vorschau.
- /verwalten: Karte per Titel erstellen (springt in Bauen-Modus),
  JSON-Import, Export, KI-Prompt (dynamisch aus $lib/server/prompt.ts;
  Safari: Prompt wird vorab geladen, Clipboard-Schreiben direkt nach
  Klick ohne await), Löschen mit confirm.
- API: GET/POST /api/nodes (POST = Upsert + Kanten-Sync, leere front
  erlaubt), GET/DELETE /api/nodes/[id] (DELETE entschärft Links),
  POST /api/import (Supabase-RPC/Transaktion), GET /api/export, GET /api/prompt

## Bekannte Stolpersteine

- Svelte: :global() darf nur EINEN Selektor enthalten
- Safari-Clipboard: kein await zwischen Klick und writeText
- Zwei ESLint-Regeln bewusst aus (dokumentiert): no-navigation-without-resolve,
  no-at-html-tags (eigene DB; bei Multi-User Sanitizer in markdown.ts)
- BauKarte koppelt Entwurf bewusst vom node-Prop ab (svelte-ignore
  state_referenced_locally); frisch via {#key id:updated_at}
- Globale select-Styles setzen Chevron mit !important — Ausnahmen
  (mode-wahl) überstimmen gezielt
- Tailwind-CSS-Datei heißt src/routes/layout.css

## Befehle

npm run dev · npm run check · npm run lint · npm run format

## Roadmap

Siehe ROADMAP.md
