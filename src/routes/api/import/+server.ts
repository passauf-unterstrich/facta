import { json, error } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import type { FactaExport } from '$lib/types';
import type { RequestHandler } from './$types';

// POST /api/import → komplettes JSON (nodes + edges) in EINER Supabase-Transaktion.
export const POST: RequestHandler = async ({ request }) => {
	const daten = (await request.json()) as FactaExport;
	const nodes = daten.nodes ?? [];
	const edges = daten.edges ?? [];

	if (nodes.length === 0) {
		throw error(400, 'Keine nodes im JSON gefunden');
	}

	const { data, error: importError } = await supabase.rpc('import_facta', {
		p_nodes: nodes,
		p_edges: edges
	});

	if (importError) {
		throw error(500, importError.message);
	}

	return json(data);
};
