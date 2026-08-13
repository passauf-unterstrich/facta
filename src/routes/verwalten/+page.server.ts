import { supabase } from '$lib/server/supabase';
import type { Karte, Kante } from '$lib/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const { data: nodes, error: nodesError } = await supabase
		.from('nodes')
		.select('*')
		.order('updated_at', { ascending: false });

	if (nodesError) {
		throw nodesError;
	}

	const { data: edges, error: edgesError } = await supabase
		.from('edges')
		.select('*');

	if (edgesError) {
		throw edgesError;
	}

	return {
		nodes: nodes as Karte[],
		edges: edges as Kante[]
	};
};
