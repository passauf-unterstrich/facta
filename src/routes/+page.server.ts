import { db } from '$lib/server/db';
import type { Karte } from '$lib/types';
import type { PageServerLoad } from './$types';

// Läuft auf dem SERVER, bevor die Seite rendert. Kein fetch, kein
// HTTP-Umweg — direkter Griff in die Datenbank. Was hier returned
// wird, liegt in der Seite als fertiges `data` bereit.
export const load: PageServerLoad = () => {
	const nodes = db.prepare('SELECT * FROM nodes ORDER BY updated_at DESC').all() as Karte[];

	return { nodes };
};
