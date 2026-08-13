import { supabase } from '$lib/server/supabase';
import { ladeAlleSeiten } from '$lib/server/db/supabase-pages';
import type { KartenAuswahl } from '$lib/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const faelle = await ladeAlleSeiten<KartenAuswahl>((von, bis) =>
		supabase.from('nodes').select('id, area').eq('type', 'fall').order('id').range(von, bis)
	);

	return { faelle };
};
