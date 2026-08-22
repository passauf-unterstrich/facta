import { json, error } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import { speichereKarteSupabase } from '$lib/server/db/supabase-node-write';
import { ladeAlleSeiten } from '$lib/server/db/supabase-pages';
import type { KartenVorschau, KartenTyp } from '$lib/types';
import type { RequestHandler } from './$types';
import { ladeSichtbareIds } from '$lib/server/guest-access';
import { findeHauptbaumIdSupabase } from '$lib/server/db/supabase-tree';

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
export const GET: RequestHandler = async ({ locals }) => {
	try {
		const [alleNodes, sichtbareIds] = await Promise.all([
			ladeAlleSeiten<KartenVorschau>((von, bis) =>
				supabase
					.from('nodes')
					.select('id, type, area, front, title, ref')
					.order('id')
					.range(von, bis)
			),
			ladeSichtbareIds(locals.sitzung!)
		]);
		const nodes = sichtbareIds ? alleNodes.filter((node) => sichtbareIds.has(node.id)) : alleNodes;
		return json(nodes);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Karten konnten nicht geladen werden';
		throw error(500, message);
	}
};

// POST /api/nodes → Upsert + Kanten-Sync über alle drei Textfelder
export const POST: RequestHandler = async ({ request }) => {
	const daten = await request.json();

	const { id, type, area, front, back, chips, title, ref, mode, quelleId, quelleBaumId } = daten as {
		id: string;
		type: KartenTyp;
		area?: string | null;
		front: string;
		back?: string;
		chips?: string;
		title?: string | null;
		ref?: string | null;
		mode?: string;
		quelleId?: string;
		quelleBaumId?: string | null;
	};

	if (!id || !type || typeof front !== 'string') {
		throw error(400, 'id, type und front sind Pflicht');
	}

	if (!ERLAUBTE_TYPEN.includes(type)) {
		throw error(400, `Unbekannter Typ "${type}". Erlaubt: ${ERLAUBTE_TYPEN.join(', ')}`);
	}

	if (mode !== undefined && !ERLAUBTE_MODES.includes(mode)) {
		throw error(400, `Unbekannter Mode "${mode}". Erlaubt: ${ERLAUBTE_MODES.join(', ')}`);
	}

	try {
		let gespeicherteChips = chips;
		if (area === 'kernwissen_klausur' && typeof quelleId === 'string' && quelleId.trim()) {
			const sichereQuelleId = quelleId.trim();
			const { data: quelle, error: quelleError } = await supabase
				.from('nodes')
				.select('id')
				.eq('id', sichereQuelleId)
				.maybeSingle();
			if (quelleError) throw quelleError;
			if (!quelle) throw error(400, 'Die Ausgangskarte wurde nicht gefunden.');
			let hauptbaumId: string | null = null;

			if (typeof quelleBaumId === 'string' && quelleBaumId.trim()) {
				const kandidat = quelleBaumId.trim();
				const { data: hauptbaum, error: hauptbaumError } = await supabase
					.from('nodes')
					.select('id, type')
					.eq('id', kandidat)
					.maybeSingle();
				if (hauptbaumError) throw hauptbaumError;
				if (hauptbaum?.type === 'fall') hauptbaumId = hauptbaum.id;
			}

			hauptbaumId ??= await findeHauptbaumIdSupabase(sichereQuelleId);
			const herkunft =
				hauptbaumId === sichereQuelleId
					? [`[[Zum Hauptbaum|${sichereQuelleId}]]`]
					: [
							`[[Zur Ausgangskarte|${sichereQuelleId}]]`,
							...(hauptbaumId ? [`[[Zum Hauptbaum|${hauptbaumId}]]`] : [])
						];
			gespeicherteChips = [...herkunft, ...(chips?.trim() ? [chips.trim()] : [])].join('\n');
		}

		const result = await speichereKarteSupabase({
			id,
			type,
			area,
			front,
			back,
			chips: gespeicherteChips,
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
