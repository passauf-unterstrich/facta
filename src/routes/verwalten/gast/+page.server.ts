import { supabase } from '$lib/server/supabase';
import { ladeKartenVorschauen } from '$lib/server/db/supabase-collections';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [{ data: portal, error: portalError }, nodes] = await Promise.all([
		supabase
			.from('guest_portals')
			.select('id, name, slug, active, expires_at, created_at')
			.order('created_at')
			.limit(1)
			.maybeSingle(),
		ladeKartenVorschauen()
	]);
	if (portalError) throw portalError;
	if (!portal)
		return { portal: null, shares: [], events: [], roots: nodes.filter((n) => n.type === 'fall') };

	const [{ data: shares, error: shareError }, { data: events, error: eventError }] =
		await Promise.all([
			supabase
				.from('guest_tree_shares')
				.select('root_id, node_count, created_at')
				.eq('portal_id', portal.id)
				.order('created_at'),
			supabase
				.from('guest_login_events')
				.select('id, logged_in_at, ip')
				.eq('portal_id', portal.id)
				.order('logged_in_at', { ascending: false })
				.limit(50)
		]);
	if (shareError) throw shareError;
	if (eventError) throw eventError;
	const nodeMap = new Map(nodes.map((node) => [node.id, node]));
	return {
		portal,
		shares: (shares ?? []).map((share) => ({
			...share,
			title: nodeMap.get(share.root_id)?.title ?? nodeMap.get(share.root_id)?.front ?? share.root_id
		})),
		events: events ?? [],
		roots: nodes
			.filter((node) => node.type === 'fall')
			.map((node) => ({ id: node.id, title: node.title ?? node.front, area: node.area }))
	};
};
