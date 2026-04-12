const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/fund402',
});

async function runMigration() {
  try {
    const migrationPath = path.resolve(__dirname, '../database/migrations/001_initial.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Running migration...');
    await pool.query(sql);
    console.log('Migration completed successfully.');

    console.log('Seeding demo data...');
    const seedSql = `
      INSERT INTO vaults (
        id,
        provider_address,
        origin_url,
        price_usdc,
        description,
        active
      ) VALUES (
        'a0000000-0000-0000-0000-000000000001',
        'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
        'http://localhost:3000/api/demo-paid-endpoint',
        200000,
        'fund402 demo vault — XLM/BTC/Stellar price data',
        true
      ) ON CONFLICT (id) DO UPDATE SET
        origin_url = EXCLUDED.origin_url,
        active = true;

      INSERT INTO pool_state (id, total_liquidity, total_borrowed, total_calls, total_revenue_usdc)
      VALUES (1, 100000000000, 12345000000, 0, 0)
      ON CONFLICT (id) DO NOTHING;
    `;
    await pool.query(seedSql);
    console.log('Seeding completed successfully.');

    process.exit(0);
  } catch (err) {
    console.error('Migration/Seeding failed:', err);
    process.exit(1);
  }
}

runMigration();
