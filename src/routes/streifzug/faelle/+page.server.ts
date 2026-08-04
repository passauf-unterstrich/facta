import { db } from '$lib/server/db';
import type { Karte } from '$lib/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const faelle = db.prepare("SELECT * FROM nodes WHERE type = 'fall'").all() as Karte[];
	return { faelle };
};
