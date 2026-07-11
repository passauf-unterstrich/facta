import type { KartenTyp } from '$lib/types';

const PRAEFIX: Record<KartenTyp, string> = {
	fall: 'fall',
	schema: 'agl',
	definition: 'def',
	subsumtion: 'sub',
	simpel: 'k',
	thema: 'thema'
};

/**
 * Erzeugt eine sprechende, kollisionsfreie ID aus einem Text.
 * "Was ist ein Angebot?" → def_was_ist_ein_angebot (Kollision → _2, _3 …)
 * IDs sind Maschinensache: snake_case, Umlaute → ae/oe/ue, § → p.
 */
export function baueId(typ: KartenTyp, text: string, istVergeben: (id: string) => boolean): string {
	const slug = text
		.toLowerCase()
		.replace(/ä/g, 'ae')
		.replace(/ö/g, 'oe')
		.replace(/ü/g, 'ue')
		.replace(/ß/g, 'ss')
		.replace(/§/g, 'p')
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '')
		.split('_')
		.slice(0, 4)
		.join('_');

	let id = `${PRAEFIX[typ]}_${slug}`;
	let n = 2;
	while (istVergeben(id)) id = `${PRAEFIX[typ]}_${slug}_${n++}`;
	return id;
}
