import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db";
import { createClient } from "redis";

export async function GET() {
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
