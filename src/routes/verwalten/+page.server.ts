import { ladeKantenVorschauen, ladeKartenVorschauen } from '$lib/server/db/supabase-collections';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [nodes, edges] = await Promise.all([ladeKartenVorschauen(), ladeKantenVorschauen()]);

	return {
		nodes,
		edges
	};
};
