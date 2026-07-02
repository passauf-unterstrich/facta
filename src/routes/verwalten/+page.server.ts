import { db } from '$lib/server/db';
import type { Karte } from '$lib/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const nodes = db
		.prepare('SELECT * FROM nodes ORDER BY updated_at DESC')
		.all() as Karte[];
	return { nodes };
};