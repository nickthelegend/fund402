import fs from 'fs';
import path from 'path';

const DB_PATH = '/Users/jaibajrang/Desktop/Projects/stellar/fund402_store.json';

interface LocalDB {
  vaults: Record<string, any>;
  calls: any[];
}

const DEFAULT_DB: LocalDB = {
  vaults: {
    'a0000000-0000-0000-0000-000000000001': {
      id: 'a0000000-0000-0000-0000-000000000001',
      owner_address: 'GA3L2OOK75ALKGS7NUFITP6LPLTWO22ZVR7POETNUO5DZR4SINUGKRAT',
      provider_address: 'GA3L2OOK75ALKGS7NUFITP6LPLTWO22ZVR7POETNUO5DZR4SINUGKRAT',
      origin_url: 'http://localhost:3005/api/demo-paid-endpoint',
      name: 'Demo Price Feed',
      price_usdc: "500000", // 0.05 USDC (assuming 7 decimals or specific scaling)
      active: true,
      description: "Premium Real-time Market Data via JIT Loans"
    }
  },
  calls: []
};

export function getDb(): LocalDB {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2));
    return DEFAULT_DB;
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

export function saveDb(db: LocalDB) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}
