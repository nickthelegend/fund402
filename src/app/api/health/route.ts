import { NextResponse } from "next/server";
import { Pool } from "pg";
import { createClient } from "redis";

const db = new Pool({
  connectionString: process.env.DATABASE_URL ?? "postgresql://localhost:5432/fund402",
});

export async function GET() {
  const checks: Record<string, string> = {};
  let allOk = true;

  // DB check
  try {
    await db.query("SELECT 1");
    checks.database = "connected";
  } catch {
    checks.database = "error";
    allOk = false;
  }

  // Redis check
  try {
    const r = createClient({ url: process.env.REDIS_URL ?? "redis://localhost:6379" });
    await r.connect();
    await r.ping();
    await r.disconnect();
    checks.redis = "connected";
  } catch {
    checks.redis = "error — non-fatal";
    // redis down is non-fatal for demo
  }

  // Stellar Horizon check
  try {
    const res = await fetch("https://horizon-testnet.stellar.org/", { signal: AbortSignal.timeout(3000) });
    checks.stellar_horizon = res.ok ? "reachable" : "degraded";
  } catch {
    checks.stellar_horizon = "unreachable";
    allOk = false;
  }

  return NextResponse.json({
    status: allOk ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    contract_id: process.env.FUND402_VAULT_CONTRACT_ID ?? "not_set",
    network: process.env.STELLAR_NETWORK ?? "testnet",
    checks,
  }, {
    status: allOk ? 200 : 503,
  });
}
