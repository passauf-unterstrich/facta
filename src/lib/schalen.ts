/**
 * Schalen: In den Modi agls/schema/chips ist die Rückseite eine Liste
 * von Zeilen — jede Zeile entweder ein reiner [[Label|ziel]]-Link
 * (= tappbare Schale) oder blanker Text (= Zwischenüberschrift).
 * Parser und Serialisierer sind exakte Umkehrfunktionen: Der Text
 * bleibt die einzige Wahrheit, die Schalen sind nur seine Ansicht.
 */
export type Zeile = { label: string; ziel: string | null };

export function parseZeilen(text: string): Zeile[] {
	return text
		.split('\n')
		.filter((z) => z.trim() !== '')
		.map((z) => {
			const m = z.trim().match(/^\[\[([^\]|]+)\|([^\]]+)\]\]$/);
			return m ? { label: m[1], ziel: m[2] } : { label: z.trim(), ziel: null };
		});
}

export function serialisiere(zeilen: Zeile[]): string {
	return zeilen
		.filter((z) => z.label.trim() !== '')
		.map((z) => (z.ziel ? `[[${z.label}|${z.ziel}]]` : z.label))
		.join('\n');
}
