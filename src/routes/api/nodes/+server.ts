import { json, error } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import { speichereKarteSupabase } from '$lib/server/db/supabase-node-write';
import type { Karte, KartenTyp } from '$lib/types';
import type { RequestHandler } from './$types';

const ERLAUBTE_TYPEN: KartenTyp[] = [
	'fall',
	'schema',
	'definition',
	'subsumtion',
	'simpel',
	'thema'
];

const ERLAUBTE_MODES = ['open', 'struktur'];

// GET /api/nodes → alle Karten
export const GET: RequestHandler = async () => {
	const { data, error: supabaseError } = await supabase
		.from('nodes')
		.select('*')
		.order('id');

	if (supabaseError) {
		throw error(500, supabaseError.message);
	}

	return json(data as Karte[]);
};

// POST /api/nodes → Upsert + Kanten-Sync über alle drei Textfelder
export const POST: RequestHandler = async ({ request }) => {
	const daten = await request.json();

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
	} = daten as {
		id: string;
		type: KartenTyp;
		area?: string | null;
		front: string;
		back?: string;
		chips?: string;
		title?: string | null;
		ref?: string | null;
		mode?: string;
	};

	if (!id || !type || typeof front !== 'string') {
		throw error(400, 'id, type und front sind Pflicht');
	}

	if (!ERLAUBTE_TYPEN.includes(type)) {
		throw error(
			400,
			`Unbekannter Typ "${type}". Erlaubt: ${ERLAUBTE_TYPEN.join(', ')}`
		);
	}

	if (mode !== undefined && !ERLAUBTE_MODES.includes(mode)) {
		throw error(
			400,
			`Unbekannter Mode "${mode}". Erlaubt: ${ERLAUBTE_MODES.join(', ')}`
		);
	}

	try {
		const result = await speichereKarteSupabase({
			id,
			type,
			area,
			front,
			back,
			chips,
			title,
			ref,
			mode
		});

		return json(result);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
		throw error(500, message);
	}
};
