import { error, json } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import type { RequestHandler } from './$types';

// Löscht ausschließlich die bewusst kurzlebigen Klausur-Merkkarten.
// Der Eigentümerschutz für /api/admin/* sitzt zentral in hooks.server.ts.
export const DELETE: RequestHandler = async () => {
	const { data, error: deleteError } = await supabase
		.from('nodes')
		.delete()
		.eq('area', 'kernwissen_klausur')
		.select('id');

	if (deleteError) throw error(500, deleteError.message);

	return json({ ok: true, nodes: data?.length ?? 0 });
};
