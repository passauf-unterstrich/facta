import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import type { Karte, KartenTyp } from '$lib/types';
import type { RequestHandler } from './$types';

const ERLAUBTE_TYPEN: KartenTyp[] = ['fall', 'schema', 'definition', 'subsumtion', 'simpel', 'thema'];
const ERLAUBTE_MODES = ['open', 'struktur'];

// GET /api/nodes → alle Karten
export const GET: RequestHandler = () => {
	const nodes = db.prepare('SELECT * FROM nodes ORDER BY id').all() as Karte[];
	return json(nodes);
};

// Liest alle [[Begriff|ziel_id]]-Links aus einem Text. Ein Set, weil
// derselbe Link zweimal im Text trotzdem nur EINE Kante ergeben soll.
function zielIdsAusText(text: string): Set<string> {
	const regex = /\[\[[^\]|]+\|([^\]]+)\]\]/g;
	const ids = new Set<string>();
	let treffer;
	while ((treffer = regex.exec(text)) !== null) {
		ids.add(treffer[1].trim());
	}
	return ids;
}

// POST /api/nodes → Upsert + Kanten-Sync über ALLE drei Textfelder
// (front, back, chips). Der Text ist die einzige Quelle für Kanten.
export const POST: RequestHandler = async ({ request }) => {
	const daten = await request.json();
	const { id, type, area, front, back, chips, title, ref, mode } = daten as {
		id: string;
		type: KartenTyp;
		area?: string | null;
		front: string;
		back?: string;
		chips?: string;
		title?: string | null;
		ref?: string | null;
		mode?: string;
	};

	// front muss VORHANDEN sein, darf aber leer sein ('' ist ok).
	if (!id || !type || typeof front !== 'string') {
		throw error(400, 'id, type und front sind Pflicht');
	}
	if (!ERLAUBTE_TYPEN.includes(type)) {
		throw error(400, `Unbekannter Typ "${type}". Erlaubt: ${ERLAUBTE_TYPEN.join(', ')}`);
	}
	if (mode !== undefined && !ERLAUBTE_MODES.includes(mode)) {
		throw error(400, `Unbekannter Mode "${mode}". Erlaubt: ${ERLAUBTE_MODES.join(', ')}`);
	}

	const speichern = db.transaction(() => {
		db.prepare(
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
		).run(id, type, area ?? null, front, back ?? '', chips ?? '', title ?? null, ref ?? null, mode ?? 'open');

		// Kanten-Sync: alle ausgehenden löschen, aus dem Text neu aufbauen.
		db.prepare('DELETE FROM edges WHERE from_id = ?').run(id);

		const einfuegen = db.prepare(
			'INSERT OR IGNORE INTO edges (from_id, to_id, position) VALUES (?, ?, ?)'
		);
		const existiert = db.prepare('SELECT 1 FROM nodes WHERE id = ?');

		let pos = 0;
		const gesamtText = [front, back ?? '', chips ?? ''].join('\n');
		for (const zielId of zielIdsAusText(gesamtText)) {
			if (zielId !== id && existiert.get(zielId)) {
				einfuegen.run(id, zielId, pos++);
			}
		}
	});
	speichern();

	return json({ ok: true, id });
};
