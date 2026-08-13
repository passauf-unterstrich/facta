import { json, error } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import { holeKarteSupabase, holeKinderSupabase } from '$lib/server/db/supabase-queries';
import type { RequestHandler } from './$types';

// GET /api/nodes/[id] → die Karte + ihre Kinder
export const GET: RequestHandler = async ({ params }) => {
	const id = params.id!;

	const node = await holeKarteSupabase(id);
	if (!node) {
		throw error(404, `Karte "${id}" nicht gefunden`);
	}

	const children = await holeKinderSupabase(id);

	return json({ node, children });
};

// DELETE /api/nodes/[id] → Karte löschen.
// Text = Wahrheit gilt auch beim Löschen:
// In allen Karten, die auf diese Karte verlinken,
// wird [[Wort|id]] zu blankem Wort entschärft.
export const DELETE: RequestHandler = async ({ params }) => {
	const id = params.id!;

	// 1. Prüfen, ob die Karte existiert.
	const { data: vorhanden, error: findError } = await supabase
		.from('nodes')
		.select('id')
		.eq('id', id)
		.maybeSingle();

	if (findError) {
		throw error(500, findError.message);
	}

	if (!vorhanden) {
		throw error(404, `Karte "${id}" nicht gefunden`);
	}

	// 2. Alle Karten finden, die auf diese Karte verlinken.
	const { data: betroffene, error: affectedError } = await supabase
		.from('nodes')
		.select('id, front, back')
		.or(`front.like.%|${id}]]%,back.like.%|${id}]]%`)
		.neq('id', id);

	if (affectedError) {
		throw error(500, affectedError.message);
	}

	// IDs sind per Konstruktion [a-z0-9_] — regex-sicher.
	const linkRegex = new RegExp(`\\[\\[([^\\]|]+)\\|${id}\\]\\]`, 'g');

	// 3. Links in betroffenen Karten entschärfen.
	for (const n of betroffene ?? []) {
		const front = n.front.replace(linkRegex, '$1');
		const back = n.back.replace(linkRegex, '$1');

		if (front !== n.front || back !== n.back) {
			const { error: updateError } = await supabase
				.from('nodes')
				.update({
					front,
					back,
					updated_at: new Date().toISOString()
				})
				.eq('id', n.id);

			if (updateError) {
				throw error(500, updateError.message);
			}
		}
	}

	// 4. Karte löschen.
	// Die Foreign Keys in edges sorgen für ON DELETE CASCADE.
	const { error: deleteError } = await supabase
		.from('nodes')
		.delete()
		.eq('id', id);

	if (deleteError) {
		throw error(500, deleteError.message);
	}

	return json({ ok: true });
};
