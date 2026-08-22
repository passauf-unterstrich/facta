import { error, json } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import { ladeSichtbareIds } from '$lib/server/guest-access';
import { ladeAlleSeiten } from '$lib/server/db/supabase-pages';
import type { Karte } from '$lib/types';
import type { RequestHandler } from './$types';

const SUCHFELDER = ['front', 'back', 'title', 'ref'] as const;
const natuerlicheSortierung = new Intl.Collator('de', { numeric: true, sensitivity: 'base' });

function suchbegriffe(suche: string): string[] {
	// Nur Buchstaben und Zahlen werden an den PostgREST-Filter übergeben.
	// „§ 71 GVG“ wird zu ["71", "GVG"] und findet deshalb auch
	// „§§ 13, 71 GVG“ oder „§ 71 Abs. 1 GVG“.
	return [...new Set(suche.normalize('NFKC').match(/[\p{L}\p{N}]+/gu) ?? [])];
}

function sortierwert(karte: Karte): string {
	return (karte.title?.trim() || karte.ref?.trim() || karte.front).trim();
}

async function sucheNachBegriff(begriff: string, gebiet: string | null): Promise<Karte[]> {
	return ladeAlleSeiten<Karte>((von, bis) => {
		let abfrage = supabase
			.from('nodes')
			.select('id, type, area, front, back, chips, title, ref, mode, created_at, updated_at')
			.or(SUCHFELDER.map((feld) => `${feld}.ilike.%${begriff}%`).join(','))
			.order('id')
			.range(von, bis);
		if (gebiet) abfrage = abfrage.eq('area', gebiet);
		return abfrage;
	});
}

export const GET: RequestHandler = async ({ url, locals }) => {
	const suche = (url.searchParams.get('q') ?? '').replace(/\s+/g, ' ').trim();
	const gebiet = url.searchParams.get('area')?.trim() || null;
	if (suche.length < 2) return json({ results: [] });
	if (suche.length > 160) throw error(400, 'Der Suchbegriff ist zu lang.');

	try {
		const sichtbareIdsPromise = ladeSichtbareIds(locals.sitzung!);
		const begriffe = suchbegriffe(suche);
		if (begriffe.length === 0) return json({ results: [] });
		const trefferJeBegriff = await Promise.all(
			begriffe.map((begriff) => sucheNachBegriff(begriff, gebiet))
		);
		const kartenById = new Map(
			trefferJeBegriff.flat().map((karte) => [karte.id, karte] as const)
		);
		let gemeinsameIds = new Set(trefferJeBegriff[0].map((karte) => karte.id));
		for (const treffer of trefferJeBegriff.slice(1)) {
			const ids = new Set(treffer.map((karte) => karte.id));
			gemeinsameIds = new Set([...gemeinsameIds].filter((id) => ids.has(id)));
		}

		const sichtbareIds = await sichtbareIdsPromise;
		const ergebnisse = [...gemeinsameIds]
			.map((id) => kartenById.get(id)!)
			.filter((karte) => !sichtbareIds || sichtbareIds.has(karte.id))
			.sort(
				(a, b) =>
					natuerlicheSortierung.compare(sortierwert(a), sortierwert(b)) ||
					a.id.localeCompare(b.id)
			);

		return json({ results: ergebnisse });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Die Suche ist fehlgeschlagen.';
		throw error(500, message);
	}
};
