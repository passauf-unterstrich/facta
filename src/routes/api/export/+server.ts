import { db } from '$lib/server/db';
import type { RequestHandler } from './$types';

// GET /api/export → die komplette Wissensbasis als JSON-Download.
// Dein Backup-Knopf: Export-Format = Import-Format = KI-Pipeline-Format.
export const GET: RequestHandler = () => {
	const nodes = db.prepare('SELECT id, type, area, front, back FROM nodes ORDER BY id').all();
	const edges = db
		.prepare('SELECT from_id, to_id, label, position FROM edges ORDER BY id')
		.all();

	const datum = new Date().toISOString().slice(0, 10);

	return new Response(JSON.stringify({ nodes, edges }, null, 2), {
		headers: {
			'Content-Type': 'application/json',
			// Sagt dem Browser: nicht anzeigen, als Datei speichern
			'Content-Disposition': `attachment; filename="facta-export-${datum}.json"`
		}
	});
};