import { ladeKantenVorschauen, ladeKartenVorschauen } from '$lib/server/db/supabase-collections';
import { ladeSichtbareIds } from '$lib/server/guest-access';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const [alleNodes, alleEdges, sichtbareIds] = await Promise.all([
		ladeKartenVorschauen(),
		ladeKantenVorschauen(),
		ladeSichtbareIds(locals.sitzung!)
	]);
	const nodes = sichtbareIds ? alleNodes.filter((node) => sichtbareIds.has(node.id)) : alleNodes;
	const edges = sichtbareIds
		? alleEdges.filter((edge) => sichtbareIds.has(edge.from_id) && sichtbareIds.has(edge.to_id))
		: alleEdges;

	return {
		nodes,
		edges
	};
};
