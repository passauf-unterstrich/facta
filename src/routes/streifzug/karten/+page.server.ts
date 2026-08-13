import { supabase } from '$lib/server/supabase';
import { ladeAlleSeiten } from '$lib/server/db/supabase-pages';
import type { KartenAuswahl } from '$lib/types';
import type { PageServerLoad } from './$types';

// Alle Karten laden — der Client filtert nach ?area= und mischt.
export const load: PageServerLoad = async () => {
	const nodes = await ladeAlleSeiten<KartenAuswahl>((von, bis) =>
		supabase.from('nodes').select('id, area').order('id').range(von, bis)
	);

	return { nodes };
};
