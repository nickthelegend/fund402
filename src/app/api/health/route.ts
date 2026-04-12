import { NextResponse } from "next/server";
import { getActiveVaultCount } from "../../../lib/db";

export async function GET() {
  try {
    const activeVaults = await getActiveVaultCount();
    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      contract_id: process.env.FUND402_VAULT_CONTRACT_ID ?? "not_set",
      network: process.env.STELLAR_NETWORK ?? "testnet",
      checks: {
        database: "ok",
        active_vaults: activeVaults
      }
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json({
      status: "degraded",
      timestamp: new Date().toISOString(),
      contract_id: process.env.FUND402_VAULT_CONTRACT_ID ?? "not_set",
      network: process.env.STELLAR_NETWORK ?? "testnet",
      checks: {
        database: "offline"
      }
    }, { status: 503 });
  }
}
