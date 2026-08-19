import { supabase } from '$lib/server/supabase';
import { ladeAlleSeiten } from '$lib/server/db/supabase-pages';

type FreigabeZeile = { node_id: string; root_id: string };
type Sitzung = NonNullable<App.Locals['sitzung']>;

export async function ladeSichtbareIds(sitzung: Sitzung): Promise<Set<string> | null> {
	if (sitzung.rolle === 'owner') return null;
	const zeilen = await ladeAlleSeiten<FreigabeZeile>((von, bis) =>
		supabase
			.from('guest_tree_nodes')
			.select('node_id, root_id')
			.eq('portal_id', sitzung.portalId)
			.order('node_id')
			.order('root_id')
			.range(von, bis)
	);
	return new Set(zeilen.map((zeile) => zeile.node_id));
}

export async function darfKarteSehen(sitzung: Sitzung, id: string): Promise<boolean> {
	if (sitzung.rolle === 'owner') return true;
	const { data, error } = await supabase
		.from('guest_tree_nodes')
		.select('node_id')
		.eq('portal_id', sitzung.portalId)
		.eq('node_id', id)
		.limit(1)
		.maybeSingle();
	if (error) throw error;
	return !!data;
}
