import { db } from '$lib/server/db';
import type { Karte, Kind } from '$lib/types';

/** Eine Karte per ID — oder undefined. */
export function holeKarte(id: string): Karte | undefined {
	return db.prepare('SELECT * FROM nodes WHERE id = ?').get(id) as Karte | undefined;
}

/**
 * Die Kinder einer Karte: Zielkarten ihrer ausgehenden Kanten,
 * angereichert um edge_id/label/position, sortiert in Leserichtung
 * des Texts. EINZIGE Stelle für diesen JOIN — API und Load-Funktionen
 * teilen sich dieselbe Abfrage.
 */
export function holeKinder(id: string): Kind[] {
	return db
		.prepare(
			`SELECT nodes.*, edges.id AS edge_id, edges.label, edges.position
			 FROM edges
			 JOIN nodes ON nodes.id = edges.to_id
			 WHERE edges.from_id = ?
			 ORDER BY edges.position, edges.id`
		)
		.all(id) as Kind[];
}
