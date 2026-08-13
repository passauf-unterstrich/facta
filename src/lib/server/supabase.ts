import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';

const supabaseUrl = env.SUPABASE_URL;
const supabaseSecretKey = env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
	throw new Error('SUPABASE_URL oder SUPABASE_SECRET_KEY fehlt.');
}

export const supabase = createClient(
	supabaseUrl,
	supabaseSecretKey
);
