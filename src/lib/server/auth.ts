import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const AUTH_COOKIE = 'facta_session';
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const SESSION_CONTEXT = 'facta-private-session-v1';

export function authIstKonfiguriert(): boolean {
	return (env.FACTA_PASSWORD?.length ?? 0) >= 16 && (env.FACTA_SESSION_SECRET?.length ?? 0) >= 32;
}

function sicherGleich(a: string, b: string): boolean {
	const aHash = createHash('sha256').update(a, 'utf8').digest();
	const bHash = createHash('sha256').update(b, 'utf8').digest();
	return timingSafeEqual(aHash, bHash);
}

export function pruefePasswort(eingabe: string): boolean {
	return authIstKonfiguriert() && sicherGleich(eingabe, env.FACTA_PASSWORD!);
}

function signiere(zeit: string): string {
	return createHmac('sha256', env.FACTA_SESSION_SECRET!)
		.update(`${SESSION_CONTEXT}:${zeit}`)
		.digest('base64url');
}

export function erzeugeSitzung(): string {
	if (!authIstKonfiguriert()) throw new Error('Facta-Login ist nicht konfiguriert.');
	const zeit = Date.now().toString(36);
	return `${zeit}.${signiere(zeit)}`;
}

export function pruefeSitzung(token: string | undefined): boolean {
	if (!token || !authIstKonfiguriert()) return false;
	const teile = token.split('.');
	if (teile.length !== 2) return false;
	const [zeit, signatur] = teile;
	const erstellt = Number.parseInt(zeit, 36);
	const alter = Date.now() - erstellt;
	if (!Number.isFinite(erstellt) || alter < 0 || alter > SESSION_MAX_AGE_SECONDS * 1000)
		return false;
	return sicherGleich(signatur, signiere(zeit));
}

export function authCookieOptionen() {
	return {
		path: '/',
		httpOnly: true,
		secure: !dev,
		sameSite: 'strict' as const,
		maxAge: SESSION_MAX_AGE_SECONDS
	};
}
