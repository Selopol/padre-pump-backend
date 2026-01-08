import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { pool } from './connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function migrate() {
  console.log('🚀 Starting database migration...');

  try {
    // Read schema file
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf8');

    // Execute schema
    await pool.query(schema);

    console.log('✅ Database migration completed successfully!');
    console.log('');
    console.log('Tables created:');
    console.log('  - developers');
    console.log('  - coins');
    console.log('  - migrations');
    console.log('  - alerts');
    console.log('');
    console.log('Views created:');
    console.log('  - developer_stats');
    console.log('  - recent_alerts');

    // Verify tables
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    console.log('');
    console.log('Verified tables in database:');
    result.rows.forEach(row => {
      console.log(`  ✓ ${row.table_name}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrate();
