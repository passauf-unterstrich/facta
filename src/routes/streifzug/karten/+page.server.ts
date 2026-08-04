import { db } from '$lib/server/db';
import type { Karte } from '$lib/types';
import type { PageServerLoad } from './$types';

// Alle Karten laden — der Client filtert nach ?area= und mischt.
export const load: PageServerLoad = () => {
	const nodes = db.prepare('SELECT * FROM nodes').all() as Karte[];
	return { nodes };
};
