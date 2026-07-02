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