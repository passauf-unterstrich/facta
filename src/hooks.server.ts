import { redirect, type Handle } from '@sveltejs/kit';
import { AUTH_COOKIE, ermittleSitzung } from '$lib/server/auth';

function sichereAntwort(response: Response): Response {
	response.headers.set('Cache-Control', 'private, no-store, max-age=0');
	response.headers.set('Pragma', 'no-cache');
	response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet, noimageindex');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'no-referrer');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	return response;
}

export const handle: Handle = async ({ event, resolve }) => {
	const pfad = event.url.pathname;
	const istOeffentlich =
		pfad === '/login' ||
		pfad === '/api/login' ||
		pfad.startsWith('/gast/') ||
		pfad === '/api/gast/login';
	const sitzung = await ermittleSitzung(event.cookies.get(AUTH_COOKIE));

	if (!istOeffentlich && !sitzung) {
		if (pfad.startsWith('/api/')) {
			return sichereAntwort(
				new Response(JSON.stringify({ message: 'Anmeldung erforderlich' }), {
					status: 401,
					headers: { 'Content-Type': 'application/json' }
				})
			);
		}

		const weiter = `${pfad}${event.url.search}`;
		throw redirect(303, `/login?next=${encodeURIComponent(weiter)}`);
	}

	if (sitzung) event.locals.sitzung = sitzung;

	if (sitzung?.rolle === 'guest') {
		const nurEigentuemer =
			pfad.startsWith('/verwalten') ||
			pfad.startsWith('/api/admin/') ||
			pfad === '/api/import' ||
			pfad === '/api/export' ||
			pfad === '/api/prompt' ||
			(pfad.startsWith('/api/nodes') && event.request.method !== 'GET');
		if (nurEigentuemer) {
			if (pfad.startsWith('/api/')) {
				return sichereAntwort(
					new Response(JSON.stringify({ message: 'Nur im Eigentümerzugang verfügbar' }), {
						status: 403,
						headers: { 'Content-Type': 'application/json' }
					})
				);
			}
			throw redirect(303, '/');
		}
	}

	return sichereAntwort(await resolve(event));
};
