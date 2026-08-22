import { supabase } from '$lib/server/supabase';
import { ladeAlleSeiten } from '$lib/server/db/supabase-pages';

type KnotenTyp = { id: string; type: string };
type ElternKante = { from_id: string; to_id: string };

/**
 * Ermittelt den nächstgelegenen Fall, von dem eine Karte abstammt.
 * Die Rückwärtssuche ist bewusst serverseitig: So muss der Browser für
 * einen Memorize-Link weder sämtliche Karten noch sämtliche Kanten laden.
 */
export async function findeHauptbaumIdSupabase(startId: string): Promise<string | null> {
	const { data: start, error: startError } = await supabase
		.from('nodes')
		.select('id, type')
		.eq('id', startId)
		.maybeSingle();

	if (startError) throw startError;
	if (!start) return null;
	if (start.type === 'fall') return start.id;

	const besucht = new Set<string>([startId]);
	let ebene = [startId];

	// Kartenbäume sind in Facta sehr flach. Die großzügige Grenze schützt
	// lediglich gegen versehentliche Zyklen oder fehlerhafte Altimporte.
	for (let tiefe = 0; tiefe < 64 && ebene.length > 0; tiefe++) {
		const { data: kanten, error: kantenError } = await supabase
			.from('edges')
			.select('from_id, to_id')
			.in('to_id', ebene);

		if (kantenError) throw kantenError;
		const elternIds = [
			...new Set(
				((kanten ?? []) as ElternKante[])
					.map((kante) => kante.from_id)
					.filter((id) => !besucht.has(id))
			)
		];
		if (elternIds.length === 0) break;
		elternIds.forEach((id) => besucht.add(id));

		const { data: eltern, error: elternError } = await supabase
			.from('nodes')
			.select('id, type')
			.in('id', elternIds);

		if (elternError) throw elternError;
		const elternKnoten = (eltern ?? []) as KnotenTyp[];
		const faelle = elternKnoten
			.filter((node) => node.type === 'fall')
			.sort((a, b) => a.id.localeCompare(b.id, 'de', { numeric: true }));
		if (faelle.length > 0) return faelle[0].id;
		ebene = elternKnoten.map((node) => node.id);
	}

	// Einige alte Imports haben eine fehlende Zwischenkante, behalten aber
	// den eindeutigen ID-Stamm ihres Falls. Derselbe enge Fallback wird auch
	// in der Bibliothek für „Zum Hauptbaum“ verwendet.
	const faelle = await ladeAlleSeiten<KnotenTyp>((von, bis) =>
		supabase
			.from('nodes')
			.select('id, type')
			.eq('type', 'fall')
			.order('id')
			.range(von, bis)
	);
	const passend = faelle
		.filter((fall) => fall.id.endsWith('__fall'))
		.map((fall) => ({ id: fall.id, stamm: fall.id.slice(0, -'__fall'.length) }))
		.filter(({ stamm }) => startId.startsWith(`${stamm}__`))
		.sort((a, b) => b.stamm.length - a.stamm.length)[0];

	return passend?.id ?? null;
}
