# Facta — Roadmap

## Als Nächstes
1. **Erster echter Fall von Hand** (Tiefen-Editor-Härtetest, liefert Muster-JSON)
2. **KI-Pipeline Stufe 1 — Prompt kopieren** (in Verwalten): dynamisch
   erzeugter System-Prompt mit Kartenbestand als Dedup-Kontext. Workflow
   ohne API-Kosten: PDF ins Chatfenster + Prompt → JSON → Import-Knopf.
3. **KI-Pipeline Stufe 2**: Muster-JSON vom ersten Handfall in den Prompt
4. **Bibliothek strukturieren**: Fälle-Sektion und Wissens-Sektion getrennt

## Danach
- **KI-Pipeline Stufe 3 — PDF-Upload mit API** (kleines Budget): PDF →
  Anthropic-API → JSON-Vorschau → Review → Import. Gleicher Prompt wie
  Stufe 1. Zwei Varianten: Fall+Lösung → Fallbaum · Skript → Wissenskarten
- **FSRS (ts-fsrs)** mit Lernmodi:
  - Fall eintauchen (Fall vorgeschlagen vom Algorithmus, in die Tiefe)
  - Zufall durch fallbezogene Karten (erreichbar von einem Fall)
  - Zufall durch alles
  - Nur Wissenskarten (simpel)
  - Filter: nur ein Typ (z.B. heute nur Definitionen)
- **Subsumtions-Chips** auf Definitionen im Lern-Modus (Anwendungsfälle
  als kleine Buttons, Bahnhof-Effekt sichtbar machen)
- **Server-Hosting** (adapter-node, kleiner Server, PWA für iPhone)

## Prinzipien (unverändert)
Text = einzige Quelle für Kanten · Mensch als Reviewer · IDs sind
Maschinensache · ein Austauschformat für alles · Design: ruhig, dezent, haptisch
## Konzept: Zwei Bahnhöfe (Erkennen + Durchprüfen)

Zentrale Design-Entscheidung für die Lernwirkung. Kein neues Datenmodell nötig.

Die App trainiert zwei Kernkompetenzen, jede über einen eigenen "Bahnhof"
(geteilter Knoten, auf den viele Fälle verweisen):

1. DEFINITION (bestehend) — sitzt TIEF im Prüfungsbaum, beim Subsumieren.
   Viele Fälle teilen einen Rechtsbegriff. Trainiert: Fälle DURCHPRÜFEN.

2. THEMA / SIGNAL (neu) — sitzt OBEN am Sachverhalt, beim Erkennen.
   Viele Fälle teilen ein Erkennungsmuster (Arglist, Sachmangel,
   Minderjährigkeit, Stellvertretung, Verzug …). Trainiert: Fälle ERKENNEN.

Warum kein festes Signal→AGL-Mapping: Ein Signalwort löst ein THEMA aus,
nicht direkt eine AGL. Welche AGLs geprüft werden, ergibt sich erst aus der
Gesamtkonstellation. Die Variabilität ("arglist kann § 123, § 823 II iVm
§ 263, c.i.c. auslösen und § 444 aushebeln — je nach Fall") ist der
LERNINHALT der Themen-Karte, nicht ein Problem der Fallkarte.

Umsetzung (alles über bestehende Mechanismen):
- Signalwort im Sachverhalt = normaler Link auf eine Themen-Karte:
  [[bewusst überdeckt|thema_arglist]]
- Themen-Karte = simpel-Karte (evtl. später eigener Typ 'thema').
  Rückseite im Chips-Mode = die Fälle/Konstellationen des Themas.
- Damit bekommt der CHIPS-Mode endlich seinen klaren Job:
  horizontale Sammlung gleichrangiger Verweise (Bahnhof sichtbar gemacht).
- Vorderseite bleibt FLIESSTEXT (Fälle grob kennen ist gewollter Wert),
  nur lesbarer gemacht + Signalwörter dezent markiert.

Offene Fragen vor dem Bau:
- Eigener Kartentyp 'thema' oder 'simpel' mit Konvention?
- Chips unter Definitionen/Themen automatisch aus eingehenden Kanten
  befüllen (Bahnhof automatisch) statt von Hand tippen?
- Set der Themen: geschätzt 30–60 wiederkehrende Muster (überschaubar).
