import { marked } from 'marked';

// Verwandelt Kartentext in HTML — in zwei Stufen:
// 1. Unsere [[Begriff|ziel_id]]-Links werden zu klickbaren <a>-Tags
//    mit data-link. (Kein href="#" — die Seite entscheidet selbst,
//    was ein Klick tut: Layer öffnen.)
// 2. marked übersetzt den Rest (fett, Listen, Überschriften …).
export function rendere(text: string, typMap?: Map<string, string>): string {
	const mitLinks = text.replace(
		/\[\[([^\]|]+)\|([^\]]+)\]\]/g,
		(_m, label, ziel) => {
			// Zeigt der Link auf eine Themen-Karte, wird er zum gelben
			// Signal-Marker statt zum blauen Struktur-Verweis.
			const istThema = typMap?.get(ziel) === 'thema';
			const klasse = istThema ? 'inline-link signal' : 'inline-link';
			return `<button type="button" class="${klasse}" data-link="${ziel}">${label}</button>`;
		}
	);
	// Führende Leerzeichen werden zu geschützten Leerzeichen:
	// Einrückung bleibt sichtbar (A. → I. → 1.), und 4+ Leerzeichen
	// kippen nicht mehr in Markdowns Code-Block-Falle.
	const eingerueckt = mitLinks.replace(/^ +/gm, (m) => '\u00A0'.repeat(m.length));
	// breaks: einfacher Zeilenumbruch im Text = Umbruch auf der Karte
	return marked.parse(eingerueckt, { async: false, breaks: true });
}

// Für Listen & Vorschauen: Markdown-Zeichen entfernen, nur Klartext.
// "Was ist ein **Angebot**?" → "Was ist ein Angebot?"
export function klartext(text: string): string {
	return text
		.replace(/\[\[([^\]|]+)\|[^\]]+\]\]/g, '$1') // [[Text|id]] → Text
		.replace(/\*\*([^*]+)\*\*/g, '$1')
		.replace(/\*([^*]+)\*/g, '$1')
		.replace(/^#+\s*/gm, '')
		.replace(/`([^`]+)`/g, '$1');
}
// Für einzeilige Beschriftungen (Schalen, Chips): Markdown rendern,
// aber ohne <p>-Umhüllung — bleibt eine Zeile.
export function rendereInline(text: string): string {
	const mitLinks = text.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$1');
	return marked.parseInline(mitLinks, { async: false }) as string;
}
