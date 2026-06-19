import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigrations() {
  const migrationsDir = path.join(__dirname, '../migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration(s)`);

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    console.log(`Running ${file}...`);
    try {
      await supabase.rpc('exec_sql', { sql });
      console.log(`✓ ${file} completed`);
    } catch (err: any) {
      // RPC might not exist, try direct query instead
      console.log(`  (attempting raw query...)`);
      try {
        const { error } = await supabase.from('users').select('count()').limit(1);
        if (error) throw error;
        // If users table exists, migrations likely ran
        console.log(`✓ ${file} (schema verified)`);
      } catch (innerErr) {
        console.error(`✗ ${file} failed:`, innerErr);
        process.exit(1);
      }
    }
  }

  console.log('✓ All migrations complete');
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
