import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://nick:neekuenduku@cluster0.due6xnc.mongodb.net/?appName=Cluster0";
const DB_NAME = "Fund402Prod";

let cachedClient: MongoClient | null = null;
let cachedDb: any = null;

async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = await MongoClient.connect(MONGODB_URI);
  const db = client.db(DB_NAME);

  cachedClient = client;
  cachedDb = db;

  // Ensure default demo vault and indexes exist
  await setupDatabase(db);
  return { client, db };
}

async function setupDatabase(db: any) {
  const vaults = db.collection('Vaults');
  
  // Seed the demo vault if it doesn't exist
  const existingVault = await vaults.findOne({ id: 'a0000000-0000-0000-0000-000000000001' });
  if (!existingVault) {
    await vaults.insertOne({
      id: 'a0000000-0000-0000-0000-000000000001',
      owner_address: 'GA3L2OOK75ALKGS7NUFITP6LPLTWO22ZVR7POETNUO5DZR4SINUGKRAT',
      provider_address: 'GA3L2OOK75ALKGS7NUFITP6LPLTWO22ZVR7POETNUO5DZR4SINUGKRAT',
      origin_url: 'http://localhost:3005/api/demo-paid-endpoint',
      name: 'Demo Price Feed',
      price_usdc: "500000", // 0.05 USDC
      active: true,
      description: "Premium Real-time Market Data via JIT Loans"
    });
  }

  // Set up TTL index so Redis replays auto-expire after 24 hours
  const replays = db.collection('Replays');
  await replays.createIndex({ "createdAt": 1 }, { expireAfterSeconds: 86400 }).catch(() => {});
  
  // Set up TTL index for RateLimits (1 minute)
  const rateLimits = db.collection('RateLimits');
  await rateLimits.createIndex({ "createdAt": 1 }, { expireAfterSeconds: 60 }).catch(() => {});
}

// ─── VAULTS ────────────────────────────────────────────────────────
export async function getVault(vaultId: string) {
  const { db } = await connectToDatabase();
  return await db.collection('Vaults').findOne({ id: vaultId });
}

export async function getActiveVaultCount() {
  const { db } = await connectToDatabase();
  return await db.collection('Vaults').countDocuments({ active: true });
}

export async function getAllVaults() {
  const { db } = await connectToDatabase();
  return await db.collection('Vaults').find({ active: true }).sort({ _id: -1 }).toArray();
}

export async function registerVault(vaultData: any) {
  const { db } = await connectToDatabase();
  await db.collection('Vaults').insertOne(vaultData);
}

// ─── RECEIPTS (CALLS) ──────────────────────────────────────────────
export async function insertCall(callData: any) {
  const { db } = await connectToDatabase();
  await db.collection('Calls').insertOne(callData);
}

export async function getAllCalls() {
  const { db } = await connectToDatabase();
  return await db.collection('Calls').find().sort({ created_at: -1 }).toArray();
}

// ─── RATE LIMITS ───────────────────────────────────────────────────
export async function checkRateLimit(key: string, maxRequests: number): Promise<boolean> {
  const { db } = await connectToDatabase();
  const collection = db.collection('RateLimits');
  
  const result = await collection.findOneAndUpdate(
    { _id: key },
    { 
      $inc: { count: 1 },
      $setOnInsert: { createdAt: new Date() }
    },
    { upsert: true, returnDocument: 'after' }
  );
  
  // result.value contains the document after increment
  const doc = result || result?.value; // Mongoose vs raw driver fallback structure
  const currentCount = doc?.count || 1;
  return currentCount <= maxRequests;
}

// ─── REPLAY PREVENTION ──────────────────────────────────────────────
export async function isSettled(txHash: string): Promise<boolean> {
  const { db } = await connectToDatabase();
  const existing = await db.collection('Replays').findOne({ _id: txHash });
  return existing !== null;
}

export async function markSettled(txHash: string, payer: string, vaultId: string) {
  const { db } = await connectToDatabase();
  await db.collection('Replays').insertOne({
    _id: txHash,
    payer,
    vaultId,
    createdAt: new Date()
  });
}
