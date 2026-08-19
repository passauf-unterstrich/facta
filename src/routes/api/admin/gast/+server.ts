import { json } from '@sveltejs/kit';
import { randomBytes } from 'node:crypto';
import { supabase } from '$lib/server/supabase';
import { hasheGastPasswort } from '$lib/server/auth';
import type { RequestHandler } from './$types';

type Portal = { id: string; session_version: number };

async function portal(): Promise<Portal | null> {
	const { data, error } = await supabase
		.from('guest_portals')
		.select('id, session_version')
		.order('created_at')
		.limit(1)
		.maybeSingle();
	if (error) throw error;
	return data;
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as Record<string, unknown>;
		const action = String(body.action ?? '');
		const aktuell = await portal();

		if (action === 'create') {
			if (aktuell) return json({ message: 'Ein Gastportal besteht bereits.' }, { status: 409 });
			const name = String(body.name ?? '').trim() || 'Facta Gastzugang';
			const passwort = String(body.password ?? '');
			if (passwort.length < 16)
				return json({ message: 'Das Passwort muss mindestens 16 Zeichen haben.' }, { status: 400 });
			const { salt, hash } = hasheGastPasswort(passwort);
			const { error } = await supabase
				.from('guest_portals')
				.insert({
					name,
					slug: randomBytes(18).toString('base64url'),
					password_salt: salt,
					password_hash: hash
				});
			if (error) throw error;
			return json({ ok: true });
		}

		if (!aktuell) return json({ message: 'Noch kein Gastportal vorhanden.' }, { status: 404 });
		const neueVersion = aktuell.session_version + 1;

		if (action === 'password') {
			const passwort = String(body.password ?? '');
			if (passwort.length < 16)
				return json({ message: 'Das Passwort muss mindestens 16 Zeichen haben.' }, { status: 400 });
			const { salt, hash } = hasheGastPasswort(passwort);
			const { error } = await supabase
				.from('guest_portals')
				.update({
					password_salt: salt,
					password_hash: hash,
					session_version: neueVersion,
					updated_at: new Date().toISOString()
				})
				.eq('id', aktuell.id);
			if (error) throw error;
		} else if (action === 'rotate_link') {
			const { error } = await supabase
				.from('guest_portals')
				.update({
					slug: randomBytes(18).toString('base64url'),
					session_version: neueVersion,
					updated_at: new Date().toISOString()
				})
				.eq('id', aktuell.id);
			if (error) throw error;
		} else if (action === 'active') {
			const { error } = await supabase
				.from('guest_portals')
				.update({
					active: body.active === true,
					session_version: neueVersion,
					updated_at: new Date().toISOString()
				})
				.eq('id', aktuell.id);
			if (error) throw error;
		} else if (action === 'expiry') {
			const wert =
				typeof body.expiresAt === 'string' && body.expiresAt
					? new Date(body.expiresAt).toISOString()
					: null;
			const { error } = await supabase
				.from('guest_portals')
				.update({
					expires_at: wert,
					session_version: neueVersion,
					updated_at: new Date().toISOString()
				})
				.eq('id', aktuell.id);
			if (error) throw error;
		} else if (action === 'share') {
			const rootId = String(body.rootId ?? '');
			const { data, error } = await supabase.rpc('share_facta_tree', {
				p_portal_id: aktuell.id,
				p_root_id: rootId
			});
			if (error) throw error;
			return json(data);
		} else if (action === 'unshare') {
			const { error } = await supabase
				.from('guest_tree_shares')
				.delete()
				.eq('portal_id', aktuell.id)
				.eq('root_id', String(body.rootId ?? ''));
			if (error) throw error;
		} else if (action === 'clear_events') {
			const { error } = await supabase
				.from('guest_login_events')
				.delete()
				.eq('portal_id', aktuell.id);
			if (error) throw error;
		} else {
			return json({ message: 'Unbekannte Aktion.' }, { status: 400 });
		}
		return json({ ok: true });
	} catch (err) {
		return json(
			{ message: err instanceof Error ? err.message : 'Aktion fehlgeschlagen.' },
			{ status: 500 }
		);
	}
};
