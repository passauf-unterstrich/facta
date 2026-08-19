import { error, redirect } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (locals.sitzung?.rolle === 'guest') throw redirect(303, '/');
	const { data, error: portalError } = await supabase
		.from('guest_portals')
		.select('name, active, expires_at')
		.eq('slug', params.slug)
		.maybeSingle();
	if (portalError || !data) throw error(404, 'Gastzugang nicht gefunden');
	const abgelaufen = !!data.expires_at && new Date(data.expires_at).getTime() <= Date.now();
	return { name: data.name, verfuegbar: data.active && !abgelaufen, slug: params.slug };
};
