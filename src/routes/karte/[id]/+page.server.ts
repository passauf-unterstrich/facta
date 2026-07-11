import { error } from '@sveltejs/kit';
import { holeKarte, holeKinder } from '$lib/server/db/queries';
import type { PageServerLoad } from './$types';

// Lädt die Startkarte samt Kindern — direkt aus der DB, vor dem Rendern.
export const load: PageServerLoad = ({ params }) => {
	const node = holeKarte(params.id);
	if (!node) throw error(404, `Karte "${params.id}" nicht gefunden`);

	return { node, children: holeKinder(params.id) };
};
