import { supabase } from '$lib/server/supabase';
import type { KartenTyp } from '$lib/types';

const ERLAUBTE_TYPEN: KartenTyp[] = [
	'fall',
	'schema',
	'definition',
	'subsumtion',
	'simpel',
	'thema'
];

const ERLAUBTE_MODES = ['open', 'struktur'];

function zielIdsAusText(text: string): Set<string> {
	const regex = /\[\[[^\]|]+\|([^\]]+)\]\]/g;
	const ids = new Set<string>();
	let treffer;

	while ((treffer = regex.exec(text)) !== null) {
		ids.add(treffer[1].trim());
	}

	return ids;
}

export async function speichereKarteSupabase(daten: {
	id: string;
	type: KartenTyp;
	area?: string | null;
	front: string;
	back?: string;
	chips?: string;
	title?: string | null;
	ref?: string | null;
	mode?: string;
}) {
	const {
		id,
		type,
		area,
		front,
		back,
		chips,
		title,
		ref,
		mode
	} = daten;

	if (!id || !type || typeof front !== 'string') {
		throw new Error('id, type und front sind Pflicht');
	}

	if (!ERLAUBTE_TYPEN.includes(type)) {
		throw new Error(
			`Unbekannter Typ "${type}". Erlaubt: ${ERLAUBTE_TYPEN.join(', ')}`
		);
	}

	if (mode !== undefined && !ERLAUBTE_MODES.includes(mode)) {
		throw new Error(
			`Unbekannter Mode "${mode}". Erlaubt: ${ERLAUBTE_MODES.join(', ')}`
		);
	}

	// 1. Karte in Supabase speichern/aktualisieren.
	const { error: nodeError } = await supabase
		.from('nodes')
		.upsert(
			{
				id,
				type,
				area: area ?? null,
				front,
				back: back ?? '',
				chips: chips ?? '',
				title: title ?? null,
				ref: ref ?? null,
				mode: mode ?? 'open',
				updated_at: new Date().toISOString()
			},
			{ onConflict: 'id' }
		);

	if (nodeError) {
		throw nodeError;
	}

	// 2. Alle bisherigen ausgehenden Kanten dieser Karte löschen.
	const { error: deleteError } = await supabase
		.from('edges')
		.delete()
		.eq('from_id', id);

	if (deleteError) {
		throw deleteError;
	}

	// 3. Neue Kanten aus front + back + chips erzeugen.
	const gesamtText = [front, back ?? '', chips ?? ''].join('\n');
	const zielIds = [...zielIdsAusText(gesamtText)]
		.filter((zielId) => zielId !== id);

	if (zielIds.length > 0) {
		const { data: vorhandeneNodes, error: nodesError } = await supabase
			.from('nodes')
			.select('id')
			.in('id', zielIds);

		if (nodesError) {
			throw nodesError;
		}

		const vorhandeneIds = new Set(
			(vorhandeneNodes ?? []).map((node) => node.id)
		);

		const kanten = zielIds
			.filter((zielId) => vorhandeneIds.has(zielId))
			.map((zielId, position) => ({
				from_id: id,
				to_id: zielId,
				position
			}));

		if (kanten.length > 0) {
			const { error: edgesError } = await supabase
				.from('edges')
				.insert(kanten);

			if (edgesError) {
				throw edgesError;
			}
		}
	}

	return { ok: true, id };
}
