import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { randomUUID } from "crypto";

const db = new Pool({
  connectionString: process.env.DATABASE_URL ?? "postgresql://localhost:5432/fund402",
});

function isAllowedUrl(raw: string): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    const h = u.hostname;
    if (h === "localhost" || h === "127.0.0.1") return false;
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { originUrl, priceUsdc, description, providerAddress } = await req.json();

    if (!originUrl || !priceUsdc || !providerAddress) {
      return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
    }

    if (!providerAddress.startsWith("G") || providerAddress.length !== 56) {
      return NextResponse.json({ error: "invalid_stellar_address" }, { status: 400 });
    }

    if (!isAllowedUrl(originUrl)) {
      return NextResponse.json({ error: "origin_url_not_allowed" }, { status: 400 });
    }

    const vaultId = randomUUID();
    await db.query(
      `INSERT INTO vaults (id, provider_address, origin_url, price_usdc, description, active)
       VALUES ($1, $2, $3, $4, $5, true)`,
      [vaultId, providerAddress, originUrl, priceUsdc, description ?? ""]
    );

    const gateway = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const wrappedUrl = `${gateway}/v/${vaultId}/`;

    return NextResponse.json({ vaultId, wrappedUrl });
  } catch (err) {
    console.error("[register vault]", err);
    return NextResponse.json({ error: "internal_error", detail: String(err) }, { status: 500 });
  }
}
