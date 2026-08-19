import { supabase } from '$lib/server/supabase';
import { ladeAlleSeiten } from '$lib/server/db/supabase-pages';
import { ladeSichtbareIds } from '$lib/server/guest-access';
import type { KartenAuswahl } from '$lib/types';
import type { PageServerLoad } from './$types';

// Alle Karten laden — der Client filtert nach ?area= und mischt.
export const load: PageServerLoad = async ({ locals }) => {
	const [alleNodes, sichtbareIds] = await Promise.all([
		ladeAlleSeiten<KartenAuswahl>((von, bis) =>
			supabase.from('nodes').select('id, area').order('id').range(von, bis)
		),
		ladeSichtbareIds(locals.sitzung!)
	]);
	const nodes = sichtbareIds ? alleNodes.filter((node) => sichtbareIds.has(node.id)) : alleNodes;

	return { nodes };
};
