/**
 * Schalen: In den Modi agls/schema/chips ist die Rückseite eine Liste
 * von Zeilen — jede Zeile entweder ein reiner [[Label|ziel]]-Link
 * (= tappbare Schale) oder blanker Text (= Zwischenüberschrift).
 * Parser und Serialisierer sind exakte Umkehrfunktionen: Der Text
 * bleibt die einzige Wahrheit, die Schalen sind nur seine Ansicht.
 */
export type Zeile = { label: string; ziel: string | null; section?: boolean };

export function parseZeilen(text: string): Zeile[] {
	return text
		.split('\n')
		.filter((z) => z.trim() !== '')
		.map((z) => {
			const zeile = z.trim();
			// Section: ## Überschrift (Markdown-Syntax, menschenlesbar)
			const sec = zeile.match(/^##\s*(.*)$/);
			if (sec) return { label: sec[1], ziel: null, section: true };
			// Schale mit Link
			const m = zeile.match(/^\[\[([^\]|]+)\|([^\]]+)\]\]$/);
			if (m) return { label: m[1], ziel: m[2] };
			// Schale ohne Link (z.B. gerade erst angelegt)
			return { label: zeile, ziel: null };
		});
}

export function serialisiere(zeilen: Zeile[]): string {
	return zeilen
		.filter((z) => z.label.trim() !== '' || z.section)
		.map((z) => {
			if (z.section) return `## ${z.label}`;
			return z.ziel ? `[[${z.label}|${z.ziel}]]` : z.label;
		})
		.join('\n');
}

// Zeichen-Offset des Labels der Zeile k im serialisierten Text.
// MUSS spiegelbildlich zu serialisiere() rechnen — gleiche Filter,
// gleiche Präfixe — sonst landen Links in der falschen Zeile.
export function zeilenOffset(zeilen: Zeile[], k: number): number {
	let offset = 0;
	for (let i = 0; i < zeilen.length; i++) {
		const z = zeilen[i];
		const wird = z.label.trim() !== '' || z.section;
		if (!wird) continue; // Zeile fällt beim Serialisieren weg
		if (i === k) {
			// Innerhalb der Ziel-Zeile: das Label beginnt nach dem Präfix
			return offset + (z.section ? '## '.length : z.ziel ? '[['.length : 0);
		}
		const text = z.section ? `## ${z.label}` : z.ziel ? `[[${z.label}|${z.ziel}]]` : z.label;
		offset += text.length + 1; // +1 für den Zeilenumbruch
	}
	return offset;
}
