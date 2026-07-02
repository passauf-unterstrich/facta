import { marked } from 'marked';

// Verwandelt Kartentext in HTML — in zwei Stufen:
// 1. Unsere [[Begriff|ziel_id]]-Links werden zu klickbaren <a>-Tags
//    mit data-link. (Kein href="#" — die Seite entscheidet selbst,
//    was ein Klick tut: Layer öffnen.)
// 2. marked übersetzt den Rest (fett, Listen, Überschriften …).
export function rendere(text: string): string {
	const mitLinks = text.replace(
		/\[\[([^\]|]+)\|([^\]]+)\]\]/g,
		'<button type="button" class="inline-link" data-link="$2">$1</button>'
	);
	return marked.parse(mitLinks, { async: false });
}