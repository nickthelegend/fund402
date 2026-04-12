import { NextResponse } from "next/server";
import { Pool } from "pg";

const db = new Pool({ connectionString: process.env.DATABASE_URL ?? "postgresql://localhost:5432/fund402" });

export async function GET() {
  try {
    const result = await db.query(
      `SELECT id, tx_hash, payer_address, amount_usdc, status, created_at
       FROM calls ORDER BY created_at DESC LIMIT 50`
    );
    return NextResponse.json({ calls: result.rows });
  } catch (err) {
    return NextResponse.json({ calls: [], error: String(err) });
  }
}
