import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import type { FactaExport } from '$lib/types';
import type { RequestHandler } from './$types';

// POST /api/import → komplettes JSON (nodes + edges) in EINER Transaktion.
// Der alte Import feuerte pro Karte einen HTTP-Request — bei Abbruch
// stand ein halber Fall in der DB. Jetzt: alles oder nichts.
export const POST: RequestHandler = async ({ request }) => {
	const daten = (await request.json()) as FactaExport;
	const nodes = daten.nodes ?? [];
	const edges = daten.edges ?? [];

	if (nodes.length === 0) {
		throw error(400, 'Keine nodes im JSON gefunden');
	}

	const nodeStmt = db.prepare(
		`INSERT INTO nodes (id, type, area, front, back, chips, title, ref, mode)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT(id) DO UPDATE SET
		   type = excluded.type,
		   area = excluded.area,
		   front = excluded.front,
		   back = excluded.back,
		   chips = excluded.chips,
		   title = excluded.title,
		   ref = excluded.ref,
		   mode = excluded.mode,
		   updated_at = datetime('now')`
	);
	const edgeStmt = db.prepare(
		'INSERT OR IGNORE INTO edges (from_id, to_id, label, position) VALUES (?, ?, ?, ?)'
	);
	const existiert = db.prepare('SELECT 1 FROM nodes WHERE id = ?');

	// Kollisions-Radar: Welche IDs existieren SCHON? Der Upsert wird
	// sie überschreiben — das muss der Mensch als Reviewer sehen,
	// bis die Merge-API (Roadmap) Duplikate intelligent auflöst.
	const kollisionen = nodes.map((n) => n.id).filter((id) => existiert.get(id));

	const importiere = db.transaction(() => {
		// Erst alle Karten (müssen existieren, bevor Kanten auf sie zeigen)
		for (const n of nodes) {
			nodeStmt.run(
				n.id,
				n.type,
				n.area ?? null,
				n.front,
				n.back ?? '',
				n.title ?? null,
				n.ref ?? null,
				// Altdaten-Brücke: agls/schema aus früheren Exporten → struktur.
				// Bewusst als string behandelt — alte Dateien kennen den
				// aktuellen KartenMode-Typ nicht.
				['agls', 'schema'].includes(n.mode as string) ? 'struktur' : (n.mode ?? 'open')
			);
		}
		// Dann die Kanten — nur wenn beide Enden existieren.
		// Kaputte Kanten im JSON werden gezählt statt alles zu sprengen.
		let uebersprungen = 0;
		for (const [i, e] of edges.entries()) {
			if (existiert.get(e.from_id) && existiert.get(e.to_id)) {
				edgeStmt.run(e.from_id, e.to_id, e.label ?? null, e.position ?? i);
			} else {
				uebersprungen++;
			}
		}
		return uebersprungen;
	});

	const uebersprungen = importiere();
	return json({
		ok: true,
		nodes: nodes.length,
		edges: edges.length - uebersprungen,
		uebersprungen,
		kollisionen
	});
};
