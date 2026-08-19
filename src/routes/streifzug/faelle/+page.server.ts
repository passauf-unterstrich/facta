import { supabase } from '$lib/server/supabase';
import { ladeAlleSeiten } from '$lib/server/db/supabase-pages';
import { ladeSichtbareIds } from '$lib/server/guest-access';
import type { KartenAuswahl } from '$lib/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const [alleFaelle, sichtbareIds] = await Promise.all([
		ladeAlleSeiten<KartenAuswahl>((von, bis) =>
			supabase.from('nodes').select('id, area').eq('type', 'fall').order('id').range(von, bis)
		),
		ladeSichtbareIds(locals.sitzung!)
	]);
	const faelle = sichtbareIds ? alleFaelle.filter((fall) => sichtbareIds.has(fall.id)) : alleFaelle;

	return { faelle };
};
