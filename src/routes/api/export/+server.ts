import { supabase } from '$lib/server/supabase';
import type { RequestHandler } from './$types';

// GET /api/export → die komplette Wissensbasis als JSON-Download.
// Export-Format = Import-Format = KI-Pipeline-Format.
export const GET: RequestHandler = async () => {
	const { data: nodes, error: nodesError } = await supabase
		.from('nodes')
		.select('id, type, area, front, back, chips, title, ref, mode')
		.order('id');

	if (nodesError) {
		throw new Error(nodesError.message);
	}

	const { data: edges, error: edgesError } = await supabase
		.from('edges')
		.select('from_id, to_id, label, position')
		.order('id');

	if (edgesError) {
		throw new Error(edgesError.message);
	}

	const datum = new Date().toISOString().slice(0, 10);

	return new Response(
		JSON.stringify({ nodes, edges }, null, 2),
		{
			headers: {
				'Content-Type': 'application/json',
				'Content-Disposition': `attachment; filename="facta-export-${datum}.json"`
			}
		}
	);
};
