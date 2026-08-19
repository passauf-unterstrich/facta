import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => ({
	rolle: locals.sitzung?.rolle ?? null,
	portalName: locals.sitzung?.rolle === 'guest' ? locals.sitzung.portalName : null
});
