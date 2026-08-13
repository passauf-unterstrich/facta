import { supabase } from '$lib/server/supabase';
import { ladeAlleSeiten } from '$lib/server/db/supabase-pages';
import type { FactaExport } from '$lib/types';
import type { RequestHandler } from './$types';

// GET /api/export → die komplette Wissensbasis als JSON-Download.
// Export-Format = Import-Format = KI-Pipeline-Format.
export const GET: RequestHandler = async () => {
	const [nodes, edges] = await Promise.all([
		ladeAlleSeiten<FactaExport['nodes'][number]>((von, bis) =>
			supabase
				.from('nodes')
				.select('id, type, area, front, back, chips, title, ref, mode')
				.order('id')
				.range(von, bis)
		),
		ladeAlleSeiten<FactaExport['edges'][number]>((von, bis) =>
			supabase.from('edges').select('from_id, to_id, label, position').order('id').range(von, bis)
		)
	]);

	const datum = new Date().toISOString().slice(0, 10);

	return new Response(JSON.stringify({ nodes, edges }, null, 2), {
		headers: {
			'Content-Type': 'application/json',
			'Content-Disposition': `attachment; filename="facta-export-${datum}.json"`
		}
	});
};
