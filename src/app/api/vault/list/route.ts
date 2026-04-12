import { NextResponse } from "next/server";
import { Pool } from "pg";

const db = new Pool({ connectionString: process.env.DATABASE_URL ?? "postgresql://localhost:5432/fund402" });

export async function GET() {
  try {
    const result = await db.query(`
      SELECT
        v.id, v.description, v.price_usdc, v.origin_url,
        COUNT(c.id)::int AS call_count,
        COALESCE(SUM(c.amount_usdc), 0)::bigint AS revenue_usdc
      FROM vaults v
      LEFT JOIN calls c ON c.vault_id = v.id
      WHERE v.active = true
      GROUP BY v.id
      ORDER BY v.created_at DESC
    `);
    return NextResponse.json({ vaults: result.rows });
  } catch (err) {
    return NextResponse.json({ vaults: [], error: String(err) });
  }
}
