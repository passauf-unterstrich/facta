import { error } from '@sveltejs/kit';
import { holeKarteSupabase, holeKinderSupabase } from '$lib/server/db/supabase-queries';
import { darfKarteSehen, ladeSichtbareIds } from '$lib/server/guest-access';
import type { PageServerLoad } from './$types';

// Lädt die Startkarte samt Kindern — aus Supabase, vor dem Rendern.
export const load: PageServerLoad = async ({ params, locals }) => {
	if (!(await darfKarteSehen(locals.sitzung!, params.id))) {
		throw error(404, 'Karte nicht gefunden');
	}
	const node = await holeKarteSupabase(params.id);

	if (!node) {
		throw error(404, `Karte "${params.id}" nicht gefunden`);
	}

	const [alleKinder, sichtbareIds] = await Promise.all([
		holeKinderSupabase(params.id),
		ladeSichtbareIds(locals.sitzung!)
	]);
	const children = sichtbareIds
		? alleKinder.filter((kind) => sichtbareIds.has(kind.id))
		: alleKinder;

	return { node, children };
};
