import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
	throw new Error('SUPABASE_URL oder SUPABASE_SECRET_KEY fehlt.');
}

export const supabase = createClient(
	supabaseUrl,
	supabaseSecretKey
);
