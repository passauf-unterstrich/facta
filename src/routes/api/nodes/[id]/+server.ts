import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import type { Karte, Kind } from '$lib/types';
import type { RequestHandler } from './$types';

// GET /api/nodes/[id] → die Karte + ihre Kinder (Zielkarten ihrer Links)
export const GET: RequestHandler = ({ params }) => {
	const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(params.id) as
		| Karte
		| undefined;

	if (!node) {
		throw error(404, `Karte "${params.id}" nicht gefunden`);
	}

	// JOIN = zwei Regale in einem Griff: die Kanten-Zeile liefert
	// edge_id/label/position, die verbundene nodes-Zeile die Zielkarte.
	// Sortiert nach position → Kinder erscheinen in Leserichtung des Texts.
	const children = db
		.prepare(
			`SELECT nodes.*, edges.id AS edge_id, edges.label, edges.position
			 FROM edges
			 JOIN nodes ON nodes.id = edges.to_id
			 WHERE edges.from_id = ?
			 ORDER BY edges.position, edges.id`
		)
		.all(params.id) as Kind[];

	return json({ node, children });
};

// DELETE /api/nodes/[id] → Karte löschen.
// Kein manuelles Kanten-Aufräumen mehr: ON DELETE CASCADE im Schema
// reißt alle Verbindungen von/zu dieser Karte automatisch mit ab.
export const DELETE: RequestHandler = ({ params }) => {
	const ergebnis = db.prepare('DELETE FROM nodes WHERE id = ?').run(params.id);

	if (ergebnis.changes === 0) {
		throw error(404, `Karte "${params.id}" nicht gefunden`);
	}

	return json({ ok: true });
};