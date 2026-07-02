import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import type { Karte, Kind } from '$lib/types';
import type { PageServerLoad } from './$types';

// Lädt die Startkarte samt Kindern — direkt aus der DB, vor dem Rendern.
export const load: PageServerLoad = ({ params }) => {
	const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(params.id) as
		| Karte
		| undefined;

	if (!node) {
		throw error(404, `Karte "${params.id}" nicht gefunden`);
	}

	const children = db
		.prepare(
			`SELECT nodes.*, edges.id AS edge_id, edges.label, edges.position
			 FROM edges
			 JOIN nodes ON nodes.id = edges.to_id
			 WHERE edges.from_id = ?
			 ORDER BY edges.position, edges.id`
		)
		.all(params.id) as Kind[];

	return { node, children };
};