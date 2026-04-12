const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
  connectionString: 'postgresql://localhost:5432/fund402'
});

async function seed() {
  try {
    await client.connect();
    console.log('Connected to Postgres');
    
    const sqlPath = path.join(__dirname, 'database/migrations/001_initial.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    await client.query(sql);
    console.log('Migration applied');
    
    const seedVault = `
      INSERT INTO vaults (id, owner_address, merchant_address, origin_url, name) 
      VALUES ('a0000000-0000-0000-0000-000000000001', 'GA3L2OOK75ALKGS7NUFITP6LPLTWO22ZVR7POETNUO5DZR4SINUGKRAT', 'GA3L2OOK75ALKGS7NUFITP6LPLTWO22ZVR7POETNUO5DZR4SINUGKRAT', 'https://mock-api.fund402.workers.dev', 'Demo Price Feed') 
      ON CONFLICT (id) DO NOTHING;
    `;
    await client.query(seedVault);
    console.log('Demo vault seeded');
    
  } catch (err) {
    console.error('Seed failed:', err);
  } finally {
    await client.end();
  }
}

seed();
