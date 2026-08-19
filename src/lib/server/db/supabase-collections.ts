import { supabase } from '$lib/server/supabase';
import type { KartenVorschau, KantenVorschau } from '$lib/types';
import { ladeAlleSeiten } from './supabase-pages';

const natuerlicheSortierung = new Intl.Collator('de', {
	numeric: true,
	sensitivity: 'base'
});

function sortierbegriff(karte: KartenVorschau): string {
	return (karte.ref?.trim() || karte.title?.trim() || karte.front).trim();
}

/** Lädt alle Karten kompakt und sortiert ihre sichtbaren Deckblätter natürlich. */
export async function ladeKartenVorschauen(): Promise<KartenVorschau[]> {
	const nodes = await ladeAlleSeiten<KartenVorschau>((von, bis) =>
		supabase
			.from('nodes')
			.select('id, type, area, front, title, ref')
			// Die unveränderliche ID hält Seitengrenzen auch bei parallelen Imports stabil.
			.order('id')
			.range(von, bis)
	);

	return nodes
		.sort(
			(a, b) =>
				natuerlicheSortierung.compare(sortierbegriff(a), sortierbegriff(b)) ||
				a.id.localeCompare(b.id)
		)
		.map(({ id, type, area, front, title, ref }) => ({ id, type, area, front, title, ref }));
}

/** Lädt alle Kanten mit genau den Feldern, die Übersichten benötigen. */
export function ladeKantenVorschauen(): Promise<KantenVorschau[]> {
	return ladeAlleSeiten<KantenVorschau>((von, bis) =>
		supabase.from('edges').select('id, from_id, to_id').order('id').range(von, bis)
	);
}
