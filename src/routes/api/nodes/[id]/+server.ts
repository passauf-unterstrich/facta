import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { holeKarte, holeKinder } from '$lib/server/db/queries';
import type { RequestHandler } from './$types';

// GET /api/nodes/[id] → die Karte + ihre Kinder (Zielkarten ihrer Links)
export const GET: RequestHandler = ({ params }) => {
	const node = holeKarte(params.id!);
	if (!node) throw error(404, `Karte "${params.id}" nicht gefunden`);

	return json({ node, children: holeKinder(params.id!) });
};

// DELETE /api/nodes/[id] → Karte löschen.
// Text = Wahrheit gilt auch beim Löschen: In allen Karten, die auf
// diese verlinken, wird [[Wort|id]] zu blankem Wort entschärft —
// keine toten Links. Kanten sterben per ON DELETE CASCADE.
export const DELETE: RequestHandler = ({ params }) => {
	const id = params.id!;

	const loesche = db.transaction(() => {
		const betroffene = db
			.prepare('SELECT id, front, back FROM nodes WHERE (front LIKE ? OR back LIKE ?) AND id != ?')
			.all(`%|${id}]]%`, `%|${id}]]%`, id) as Array<{ id: string; front: string; back: string }>;

		// IDs sind per Konstruktion [a-z0-9_] — regex-sicher.
		const linkRegex = new RegExp(`\\[\\[([^\\]|]+)\\|${id}\\]\\]`, 'g');
		const update = db.prepare(
			"UPDATE nodes SET front = ?, back = ?, updated_at = datetime('now') WHERE id = ?"
		);
		for (const n of betroffene) {
			update.run(n.front.replace(linkRegex, '$1'), n.back.replace(linkRegex, '$1'), n.id);
		}

		return db.prepare('DELETE FROM nodes WHERE id = ?').run(id).changes;
	});

	if (loesche() === 0) throw error(404, `Karte "${params.id}" nicht gefunden`);

	return json({ ok: true });
};
