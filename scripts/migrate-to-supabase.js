import Database from 'better-sqlite3';
import { createClient } from '@supabase/supabase-js';

const db = new Database('data/facta-before-supabase.sqlite', {
  readonly: true
});

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL oder SUPABASE_SECRET_KEY fehlt.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

const nodes = db.prepare('SELECT * FROM nodes').all();
const edges = db.prepare('SELECT * FROM edges').all();
const reviewState = db.prepare('SELECT * FROM review_state').all();

console.log('SQLite-Backup gelesen:');
console.log(`  nodes: ${nodes.length}`);
console.log(`  edges: ${edges.length}`);
console.log(`  review_state: ${reviewState.length}`);

if (nodes.length !== 402 || edges.length !== 356 || reviewState.length !== 0) {
  throw new Error('Sicherheitsprüfung fehlgeschlagen.');
}

console.log('\nÜbertrage nodes in Paketen...');

const BATCH_SIZE = 50;

for (let i = 0; i < nodes.length; i += BATCH_SIZE) {
  const batch = nodes.slice(i, i + BATCH_SIZE);

  const { error } = await supabase
    .from('nodes')
    .upsert(batch, { onConflict: 'id' });

  if (error) {
    throw error;
  }

  console.log(
    `✓ nodes ${i + 1}-${Math.min(i + BATCH_SIZE, nodes.length)} übertragen`
  );
}

console.log('\nÜbertrage edges in Paketen...');

for (let i = 0; i < edges.length; i += BATCH_SIZE) {
  const batch = edges.slice(i, i + BATCH_SIZE);

  const { error } = await supabase
    .from('edges')
    .upsert(batch, { onConflict: 'from_id,to_id' });

  if (error) {
    throw error;
  }

  console.log(
    `✓ edges ${i + 1}-${Math.min(i + BATCH_SIZE, edges.length)} übertragen`
  );
}

console.log('\nÜbertrage review_state...');

if (reviewState.length > 0) {
  const { error } = await supabase
    .from('review_state')
    .upsert(reviewState, { onConflict: 'node_id' });

  if (error) {
    throw error;
  }
}

console.log('✓ review_state übertragen');

console.log('\nPrüfe Supabase...');

const { count: nodeCount, error: nodeCountError } = await supabase
  .from('nodes')
  .select('*', { count: 'exact', head: true });

if (nodeCountError) {
  throw nodeCountError;
}

const { count: edgeCount, error: edgeCountError } = await supabase
  .from('edges')
  .select('*', { count: 'exact', head: true });

if (edgeCountError) {
  throw edgeCountError;
}

console.log(`  Supabase nodes: ${nodeCount}`);
console.log(`  Supabase edges: ${edgeCount}`);

if (nodeCount !== 402 || edgeCount !== 356) {
  throw new Error(
    `VERIFIKATION FEHLGESCHLAGEN: Erwartet 402/356, gefunden ${nodeCount}/${edgeCount}.`
  );
}

console.log('\n========================================');
console.log('✓ MIGRATION ERFOLGREICH');
console.log('✓ 402 Karten');
console.log('✓ 356 Verknüpfungen');
console.log('✓ Lokale Datenbank wurde NICHT verändert');
console.log('========================================');

db.close();
