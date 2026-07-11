# Facta — Roadmap

## Erledigt

- Fundament: Schema (nodes/edges/review_state), Typen, Tokens, Layout
- Kern-API mit Link-Sync, Import/Export in Transaktionen, KI-Prompt
- Bibliothek, Karten-Seite (Lernen|Bauen|Graph-HUD), Layer-Stack
- Tiefen-Editor: LinkMenu mit kontextsensitivem Typ-Default, Auto-IDs
- title/ref im Modell, Karten-Modes + Schalen-Editor (agls/schema/chips)
- Typ 'thema': Signal-Wörter im Sachverhalt gelb, Zwei-Bahnhöfe-Konzept
- Generalputz: geteilte Helfer (id/schalen/queries), DELETE entschärft
  Links, Prompt v2 mit Netz-Regeln und Beispiel

## Als Nächstes

1. **Erster echter Fall komplett von Hand** (liefert Muster-JSON und
   Reibungsliste; danach Prompt ggf. mit echtem Beispiel ersetzen)
2. **Bibliothek strukturieren**: Fälle / Wissen / Themen als Sektionen
3. **KI-Pipeline testen**: PDF + Prompt im Chat → JSON → Import → Review

## Danach

- **KI-Pipeline Stufe 3 — PDF-Upload mit API** (kleines Budget):
  PDF → Anthropic-API → JSON-Vorschau → Review → Import
- **FSRS (ts-fsrs)** mit Lernmodi: Fall eintauchen · Zufall durch
  fallbezogene Karten · Zufall durch alles · nur Wissenskarten ·
  Typ-Filter (z.B. heute nur Definitionen)
- **Löschen aus der Verknüpft-Liste** (zweistufig, Warnung bei
  Mehrfach-Verlinkung — Server-Seite ist bereits sauber)
- **Server-Hosting** (adapter-node, kleiner Server, PWA fürs iPhone);
  dabei Sanitizer in markdown.ts nachrüsten (Multi-User)
- Erwägen, falls Live-Vorschau nicht reicht: Rich-Text-Editor
  (TipTap + eigene Link-Extension) — bewusst zurückgestellt

## Konzept: Zwei Bahnhöfe (Erkennen + Durchprüfen)

Die App trainiert zwei Kernkompetenzen über geteilte Knoten:

1. DEFINITION — sitzt TIEF im Baum, beim Subsumieren. Trainiert:
   Fälle DURCHPRÜFEN. Sammelt ihre Subsumtionen als Links.
2. THEMA — sitzt OBEN am Sachverhalt, beim Erkennen. Trainiert:
   Fälle ERKENNEN. Signalwort im Sachverhalt = gelber Link auf die
   Themen-Karte; deren Rückseite ist eine MERKLISTE der Konsequenzen
   (welche Normen/Ketten das Signal auslösen kann — die Variabilität
   ist der Lerninhalt), bewusst KEIN Register der Fälle.
   Entschieden: eigener Typ 'thema' (gelb). Verworfen: automatischer
   Rückwärts-Bahnhof für Themen. Offen: Subsumtions-Chips unter
   Definitionen automatisch aus eingehenden Kanten befüllen.

## Prinzipien (unverändert)

Text = einzige Quelle für Kanten · Mensch als Reviewer · IDs sind
Maschinensache · ein Austauschformat für alles · Design: ruhig,
dezent, haptisch

## Konzept: Chips (entschieden)
Chips sind KEIN Mode, sondern ein drittes Textfeld jeder Karte
(Spalte `chips`, eine Link-Zeile pro Chip, Teil des Kanten-Syncs).
Lern-Modus: kleine gelbe Bubbles unter der Karte nach dem Aufdecken.
Anatomie: Kern oben in front/back, Tiefe über Links, Besonderheiten
und Anwendungsfälle unten als Chips.

## KI-Dedup, Zwei-Stufen-Plan
Jetzt (manuell): Bestand steht im frisch kopierten Prompt — die
Chat-KI sieht existierende IDs und verlinkt/erweitert statt zu
duplizieren. Trägt bis einige hundert Karten.
Stufe 3 (API): Chat-KI generiert frei → beim Upload läuft ein
Merge-Endpoint mit KI: gleicht neues JSON gegen den Bestand ab
(Normen/Titel matchen), löst Duplikate auf, ERWEITERT statt zu
kürzen, Ergebnis als Vorschau — Mensch bleibt Reviewer.
