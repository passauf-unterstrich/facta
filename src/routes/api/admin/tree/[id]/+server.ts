import { json } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ params }) => {
	const { data, error } = await supabase.rpc('delete_facta_tree', { p_root_id: params.id });
	if (error) return json({ message: error.message }, { status: 500 });
	if (!data?.ok)
		return json(
			{
				message: `Der Baum wird noch von ${data?.externalReferences ?? 1} Karte(n) außerhalb des Baums verwendet und wurde deshalb nicht gelöscht.`
			},
			{ status: 409 }
		);
	return json(data);
};
