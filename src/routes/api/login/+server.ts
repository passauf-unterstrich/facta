import { json } from '@sveltejs/kit';
import {
	AUTH_COOKIE,
	authCookieOptionen,
	authIstKonfiguriert,
	erzeugeSitzung,
	pruefePasswort
} from '$lib/server/auth';
import type { RequestHandler } from './$types';

function sicheresZiel(next: unknown): string {
	if (
		typeof next !== 'string' ||
		!next.startsWith('/') ||
		next.startsWith('//') ||
		next.startsWith('/login')
	) {
		return '/';
	}
	return next;
}

export const POST: RequestHandler = async ({ request, cookies }) => {
	if (request.headers.get('content-type')?.split(';', 1)[0] !== 'application/json') {
		return json({ message: 'Ungültige Anmeldung.' }, { status: 415 });
	}

	if (!authIstKonfiguriert()) {
		return json(
			{ message: 'Der Zugang ist noch nicht vollständig konfiguriert.' },
			{ status: 503 }
		);
	}

	let eingabe: { passwort?: unknown; next?: unknown };
	try {
		eingabe = (await request.json()) as { passwort?: unknown; next?: unknown };
	} catch {
		return json({ message: 'Ungültige Anmeldung.' }, { status: 400 });
	}

	const passwort = typeof eingabe.passwort === 'string' ? eingabe.passwort : '';
	if (!pruefePasswort(passwort)) {
		await new Promise((resolve) => setTimeout(resolve, 700));
		return json({ message: 'Das Passwort stimmt nicht.' }, { status: 400 });
	}

	cookies.set(AUTH_COOKIE, erzeugeSitzung(), authCookieOptionen());
	return json({ ok: true, next: sicheresZiel(eingabe.next) });
};
