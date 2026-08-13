import { error } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import type { Karte, Kante } from '$lib/types';
import type { PageServerLoad } from './$types';

// Für die Spalten brauchen wir den ganzen Graphen auf einmal:
// jede Spalte ist nur ein Blick auf dieselben Daten.
export const load: PageServerLoad = async ({ params }) => {
	const { data: start, error: startError } = await supabase
		.from('nodes')
		.select('*')
		.eq('id', params.id)
		.maybeSingle();

	if (startError) {
		throw startError;
	}

	if (!start) {
		throw error(404, `Karte "${params.id}" nicht gefunden`);
	}

	const { data: nodes, error: nodesError } = await supabase
		.from('nodes')
		.select('*');

	if (nodesError) {
		throw nodesError;
	}

	const { data: edges, error: edgesError } = await supabase
		.from('edges')
		.select('*')
		.order('position', { ascending: true })
		.order('id', { ascending: true });

	if (edgesError) {
		throw edgesError;
	}

	return {
		start: start as Karte,
		nodes: nodes as Karte[],
		edges: edges as Kante[]
	};
};
