import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import type { Karte, Kante } from '$lib/types';
import type { PageServerLoad } from './$types';

// Für die Spalten brauchen wir den ganzen Graphen auf einmal:
// jede Spalte ist nur ein Blick auf dieselben Daten.
export const load: PageServerLoad = ({ params }) => {
	const start = db.prepare('SELECT * FROM nodes WHERE id = ?').get(params.id) as Karte | undefined;
	if (!start) throw error(404, `Karte "${params.id}" nicht gefunden`);

	const nodes = db.prepare('SELECT * FROM nodes').all() as Karte[];
	const edges = db.prepare('SELECT * FROM edges ORDER BY position, id').all() as Kante[];

	return { start, nodes, edges };
};
