import muster from './muster.json?raw';

// Bewusst schlanker Prompt: EIN Muster (ein echter, vom Nutzer selbst
// aufgebauter Fall), eine klare Regel — die KI reproduziert den Stil.
// Kein Bahnhof, keine Wiederverwendung, keine Themen-/Definitions-
// Systematik. Jeder Fall ist ein geschlossener Baum.
export function bauePrompt(): string {
	return `Du wandelst juristische Fälle in Facta-Lernkarten um. Facta bildet Fälle als Baum aus verlinkten Karten ab: ein fall an der Spitze, darunter schema-Karten für Anspruchsgrundlagen, darunter simpel-Karten für Merkmale, Argumentation und Wissen.

Deine Aufgabe: Aus dem gegebenen Sachverhalt + Lösung ein JSON-Objekt erzeugen, das GENAU dem Stil des unten stehenden Musters folgt. Der Nutzer hat das Muster selbst aufgebaut — reproduziere es.

Ausgabeformat: NUR das JSON-Objekt, keine Erklärung, kein Markdown drumherum.


━━━ REGELN ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Jeder Fall ist ein GESCHLOSSENER Baum. Lege ALLE Karten neu an,
   auch wenn Konzepte in anderen Fällen ähnlich vorkommen. Keine
   Wiederverwendung, kein Verweis auf externe IDs.

2. Verwende AUSSCHLIESSLICH die Kartentypen: fall · schema · simpel.

3. Struktur:
   - fall (genau einer): der Sachverhalt vorn, die geprüften AGLs
     als Link-Zeilen hinten. mode "struktur".
   - schema: eine Anspruchsgrundlage / ein Prüfungspunkt. Rückseite
     als Struktur (Zeilen, Sections mit ##). mode "struktur".
   - simpel: alles andere — Definitionen, Subsumtionen, Zwischen-
     schritte, konkrete Argumentation. mode "open" für Fließtext
     oder "struktur", wenn eine Karte selbst wieder verzweigt.

4. Kanten entstehen NUR aus [[Text|ziel_id]]-Links im front, back
   oder chips. Das "edges"-Array bleibt IMMER leer []. Die App
   erzeugt die Kanten beim Import automatisch aus den Links.

5. Chips (kleines Feld unter der Karte, Format wie back-Zeilen)
   sind für Vertiefungen, Rechtsprechungshinweise, Nebenaspekte.
   Kein Zwang — nur wenn im Muster an vergleichbarer Stelle
   auch Chips stehen.


━━━ FORMAT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{
  "nodes": [
    {
      "id": "praefix_slug_snake_case",
      "type": "fall" | "schema" | "simpel",
      "area": "kapitalgesellschaftsrecht" | "zivilrecht" | ...,
      "title": "Kurztitel oder null",
      "ref": "Aktenzeichen (nur bei fall) oder null",
      "mode": "open" | "struktur",
      "front": "Vorderseite",
      "back": "Rückseite",
      "chips": ""
    }
  ],
  "edges": []
}

IDs: praefix_slug in snake_case, Umlaute → ae/oe/ue, § → p.
Präfixe: fall_ · agl_ (für schema) · k_ (für simpel).
Struktur-Rückseiten: eine [[Label|ziel_id]]-Zeile je Prüfungspunkt,
"## Überschrift" für Sections. Blanke Zeilen im back bewusst
sparsam.

Sprache: deutsch, präzise, echte Umlaute (ä/ö/ü/ß).
**Fett** für die zentralen Begriffe. *Kursiv* für den Sachverhalt.


━━━ MUSTER (real, vom Nutzer aufgebaut — reproduziere den Stil) ━━

${muster}
`;
}
