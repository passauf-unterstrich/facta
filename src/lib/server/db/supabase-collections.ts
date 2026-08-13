import { supabase } from '$lib/server/supabase';
import type { Karte, KartenVorschau, KantenVorschau } from '$lib/types';
import { ladeAlleSeiten } from './supabase-pages';

type KartenVorschauMitStand = KartenVorschau & Pick<Karte, 'updated_at'>;

/** Lädt alle Karten kompakt und sortiert sie wie bisher nach Aktualität. */
export async function ladeKartenVorschauen(): Promise<KartenVorschau[]> {
	const nodes = await ladeAlleSeiten<KartenVorschauMitStand>((von, bis) =>
		supabase
			.from('nodes')
			.select('id, type, area, front, title, updated_at')
			// Die unveränderliche ID hält Seitengrenzen auch bei parallelen Imports stabil.
			.order('id')
			.range(von, bis)
	);

	return nodes
		.sort((a, b) => b.updated_at.localeCompare(a.updated_at) || a.id.localeCompare(b.id))
		.map(({ id, type, area, front, title }) => ({ id, type, area, front, title }));
}

/** Lädt alle Kanten mit genau den Feldern, die Übersichten benötigen. */
export function ladeKantenVorschauen(): Promise<KantenVorschau[]> {
	return ladeAlleSeiten<KantenVorschau>((von, bis) =>
		supabase.from('edges').select('id, from_id, to_id').order('id').range(von, bis)
	);
}
