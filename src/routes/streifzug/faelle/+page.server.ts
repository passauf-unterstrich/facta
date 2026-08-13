import { supabase } from '$lib/server/supabase';
import type { Karte } from '$lib/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const { data: faelle, error } = await supabase
		.from('nodes')
		.select('*')
		.eq('type', 'fall');

	if (error) {
		throw error;
	}

	return { faelle: faelle as Karte[] };
};
