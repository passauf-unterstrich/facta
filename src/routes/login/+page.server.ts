import { fail, redirect } from '@sveltejs/kit';
import {
	AUTH_COOKIE,
	authCookieOptionen,
	authIstKonfiguriert,
	erzeugeSitzung,
	pruefePasswort,
	pruefeSitzung
} from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
	if (pruefeSitzung(cookies.get(AUTH_COOKIE))) throw redirect(303, '/');
	return { konfiguriert: authIstKonfiguriert() };
};

function sicheresZiel(next: string | null): string {
	if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/login'))
		return '/';
	return next;
}

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		if (!authIstKonfiguriert()) {
			return fail(503, { nichtKonfiguriert: true });
		}

		const formular = await request.formData();
		const passwort = String(formular.get('password') ?? '');
		if (!pruefePasswort(passwort)) {
			await new Promise((resolve) => setTimeout(resolve, 700));
			return fail(400, { falsch: true });
		}

		cookies.set(AUTH_COOKIE, erzeugeSitzung(), authCookieOptionen());
		throw redirect(303, sicheresZiel(url.searchParams.get('next')));
	}
};
