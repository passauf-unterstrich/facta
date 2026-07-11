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
