import { redirect } from '@sveltejs/kit';
import { AUTH_COOKIE, authCookieOptionen } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies }) => {
	cookies.delete(AUTH_COOKIE, { ...authCookieOptionen(), maxAge: 0 });
	throw redirect(303, '/login');
};
