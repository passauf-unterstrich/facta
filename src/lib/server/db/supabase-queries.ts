import { supabase } from '$lib/server/supabase';
import type { Karte, Kind } from '$lib/types';

/** Eine Karte per ID — oder undefined. */
export async function holeKarteSupabase(id: string): Promise<Karte | undefined> {
	const { data, error } = await supabase
		.from('nodes')
		.select('*')
		.eq('id', id)
		.maybeSingle();

	if (error) {
		throw error;
	}

	return data as Karte | undefined;
}

/**
 * Die Kinder einer Karte:
 * Zielkarten ihrer ausgehenden Kanten, angereichert um
 * edge_id/label/position.
 */
export async function holeKinderSupabase(id: string): Promise<Kind[]> {
	const { data, error } = await supabase
		.from('edges')
		.select(`
			id,
			label,
			position,
			to_id,
			nodes!edges_to_id_fkey (*)
		`)
		.eq('from_id', id)
		.order('position', { ascending: true })
		.order('id', { ascending: true });

	if (error) {
		throw error;
	}

	return (data ?? []).map((edge) => {
		const node = edge.nodes as unknown as Karte;

		return {
			...node,
			edge_id: edge.id,
			label: edge.label,
			position: edge.position
		};
	});
}
