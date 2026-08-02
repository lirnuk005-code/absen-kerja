import pg from 'pg';

const { Client } = pg;
const connectionString = 'postgresql://postgres:Maythesicko%2312@db.qzzzhurevbtmwivdewvu.supabase.co:5432/postgres';

const client = new Client({ connectionString });

async function run() {
  try {
    await client.connect();
    console.log('Connected to DB');

    // Add entry_type column
    await client.query(`
      ALTER TABLE time_entries 
      ADD COLUMN IF NOT EXISTS entry_type VARCHAR(50) DEFAULT 'work';
    `);
    
    console.log('Added entry_type column successfully');
  } catch (error) {
    console.error('Error executing SQL:', error);
  } finally {
    await client.end();
  }
}

run();
