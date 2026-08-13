import { error } from '@sveltejs/kit';
import {
	holeKarteSupabase,
	holeKinderSupabase
} from '$lib/server/db/supabase-queries';
import type { PageServerLoad } from './$types';

// Lädt die Startkarte samt Kindern — aus Supabase, vor dem Rendern.
export const load: PageServerLoad = async ({ params }) => {
	const node = await holeKarteSupabase(params.id);

	if (!node) {
		throw error(404, `Karte "${params.id}" nicht gefunden`);
	}

	const children = await holeKinderSupabase(params.id);

	return { node, children };
};
