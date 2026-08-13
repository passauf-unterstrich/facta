import { error } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import { ladeAlleSeiten } from '$lib/server/db/supabase-pages';
import type { Karte, Kante } from '$lib/types';
import type { PageServerLoad } from './$types';

const IDS_PRO_ABFRAGE = 200;

async function holeNodes(ids: string[]): Promise<Karte[]> {
	const nodes: Karte[] = [];

	for (let i = 0; i < ids.length; i += IDS_PRO_ABFRAGE) {
		const { data, error: nodesError } = await supabase
			.from('nodes')
			.select('*')
			.in('id', ids.slice(i, i + IDS_PRO_ABFRAGE));

		if (nodesError) throw nodesError;
		nodes.push(...(data as Karte[]));
	}

	return nodes;
}

// Die Spalten brauchen nur den vom Startknoten aus erreichbaren Teilgraphen.
// So reist nicht bei jedem Graph-Aufruf die komplette Wissensbasis zum Browser.
export const load: PageServerLoad = async ({ params }) => {
	const [startErgebnis, alleEdges] = await Promise.all([
		supabase.from('nodes').select('*').eq('id', params.id).maybeSingle(),
		ladeAlleSeiten<Kante>((von, bis) =>
			supabase.from('edges').select('*').order('id').range(von, bis)
		)
	]);
	const { data: start, error: startError } = startErgebnis;

	if (startError) {
		throw startError;
	}

	if (!start) {
		throw error(404, `Karte "${params.id}" nicht gefunden`);
	}
	alleEdges.sort(
		(a, b) =>
			(a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER) ||
			a.id - b.id
	);

	const kantenNachQuelle = new Map<string, string[]>();
	for (const edge of alleEdges) {
		const ziele = kantenNachQuelle.get(edge.from_id) ?? [];
		ziele.push(edge.to_id);
		kantenNachQuelle.set(edge.from_id, ziele);
	}

	const erreichbareIds = new Set<string>();
	const offen = [start.id];
	while (offen.length > 0) {
		const id = offen.pop()!;
		if (erreichbareIds.has(id)) continue;
		erreichbareIds.add(id);
		offen.push(...(kantenNachQuelle.get(id) ?? []));
	}

	const nodes = await holeNodes([...erreichbareIds]);
	const edges = alleEdges.filter((edge) => erreichbareIds.has(edge.from_id));

	return {
		start: start as Karte,
		nodes,
		edges
	};
};
