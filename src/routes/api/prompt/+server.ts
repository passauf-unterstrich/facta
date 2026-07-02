import { bauePrompt } from '$lib/server/prompt';
import type { RequestHandler } from './$types';

// GET /api/prompt → den aktuellen System-Prompt als Text
export const GET: RequestHandler = () => {
	return new Response(bauePrompt(), {
		headers: { 'Content-Type': 'text/plain; charset=utf-8' }
	});
};