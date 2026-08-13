import { supabase } from '$lib/server/supabase';
import type { Karte } from '$lib/types';
import type { PageServerLoad } from './$types';

// Alle Karten laden — der Client filtert nach ?area= und mischt.
export const load: PageServerLoad = async () => {
	const { data: nodes, error } = await supabase
		.from('nodes')
		.select('*');

	if (error) {
		throw error;
	}

	return { nodes: nodes as Karte[] };
};
