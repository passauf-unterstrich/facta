import { json } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import {
	AUTH_COOKIE,
	authCookieOptionen,
	erzeugeGastSitzung,
	pruefeGastPasswort
} from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
	if (request.headers.get('content-type')?.split(';', 1)[0] !== 'application/json')
		return json({ message: 'Ungültige Anmeldung.' }, { status: 415 });
	let eingabe: { slug?: unknown; passwort?: unknown };
	try {
		eingabe = (await request.json()) as typeof eingabe;
	} catch {
		return json({ message: 'Ungültige Anmeldung.' }, { status: 400 });
	}
	const slug = typeof eingabe.slug === 'string' ? eingabe.slug : '';
	const passwort = typeof eingabe.passwort === 'string' ? eingabe.passwort : '';
	const { data, error } = await supabase
		.from('guest_portals')
		.select('id, active, expires_at, session_version, password_salt, password_hash')
		.eq('slug', slug)
		.maybeSingle();
	const abgelaufen = !!data?.expires_at && new Date(data.expires_at).getTime() <= Date.now();
	if (
		error ||
		!data ||
		!data.active ||
		abgelaufen ||
		!pruefeGastPasswort(passwort, data.password_salt, data.password_hash)
	) {
		await new Promise((resolve) => setTimeout(resolve, 700));
		return json(
			{ message: 'Das Passwort stimmt nicht oder der Zugang ist geschlossen.' },
			{ status: 400 }
		);
	}
	let ip = 'unbekannt';
	try {
		ip = getClientAddress();
	} catch {
		/* lokale Vorschau */
	}
	await supabase.from('guest_login_events').insert({ portal_id: data.id, ip });
	cookies.set(AUTH_COOKIE, erzeugeGastSitzung(data.id, data.session_version), authCookieOptionen());
	return json({ ok: true });
};
