import { redirect } from '@sveltejs/kit';
import { AUTH_COOKIE, authIstKonfiguriert, pruefeSitzung } from '$lib/server/auth';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
	if (pruefeSitzung(cookies.get(AUTH_COOKIE))) throw redirect(303, '/');
	return { konfiguriert: authIstKonfiguriert() };
};
