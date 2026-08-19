import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { supabase } from '$lib/server/supabase';

export const AUTH_COOKIE = 'facta_session';
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const SESSION_CONTEXT = 'facta-private-session-v1';
const GUEST_SESSION_CONTEXT = 'facta-guest-session-v1';

type GastToken = { portalId: string; version: number; erstellt: number };

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

export function hasheGastPasswort(passwort: string): { salt: string; hash: string } {
	const salt = randomBytes(16).toString('base64url');
	const hash = scryptSync(passwort, salt, 64).toString('base64url');
	return { salt, hash };
}

export function pruefeGastPasswort(eingabe: string, salt: string, erwarteterHash: string): boolean {
	try {
		const ist = scryptSync(eingabe, salt, 64);
		const erwartet = Buffer.from(erwarteterHash, 'base64url');
		return ist.length === erwartet.length && timingSafeEqual(ist, erwartet);
	} catch {
		return false;
	}
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

function gastSignatur(nutzlast: string): string {
	return createHmac('sha256', env.FACTA_SESSION_SECRET!)
		.update(`${GUEST_SESSION_CONTEXT}:${nutzlast}`)
		.digest('base64url');
}

export function erzeugeGastSitzung(portalId: string, version: number): string {
	if (!authIstKonfiguriert()) throw new Error('Facta-Login ist nicht konfiguriert.');
	const nutzlast = Buffer.from(
		JSON.stringify({ portalId, version, erstellt: Date.now() } satisfies GastToken),
		'utf8'
	).toString('base64url');
	return `guest.${nutzlast}.${gastSignatur(nutzlast)}`;
}

export async function ermittleSitzung(
	token: string | undefined
): Promise<App.Locals['sitzung'] | null> {
	if (pruefeSitzung(token)) return { rolle: 'owner' };
	if (!token || !authIstKonfiguriert()) return null;

	const [art, nutzlast, signatur] = token.split('.');
	if (
		art !== 'guest' ||
		!nutzlast ||
		!signatur ||
		!sicherGleich(signatur, gastSignatur(nutzlast))
	) {
		return null;
	}

	let daten: GastToken;
	try {
		daten = JSON.parse(Buffer.from(nutzlast, 'base64url').toString('utf8')) as GastToken;
	} catch {
		return null;
	}

	const alter = Date.now() - daten.erstellt;
	if (
		!daten.portalId ||
		!Number.isInteger(daten.version) ||
		!Number.isFinite(daten.erstellt) ||
		alter < 0 ||
		alter > SESSION_MAX_AGE_SECONDS * 1000
	)
		return null;

	const { data, error } = await supabase
		.from('guest_portals')
		.select('id, name, active, expires_at, session_version')
		.eq('id', daten.portalId)
		.maybeSingle();

	if (error || !data || !data.active || data.session_version !== daten.version) return null;
	if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) return null;

	return { rolle: 'guest', portalId: data.id, portalName: data.name };
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
