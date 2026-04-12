import { NextRequest, NextResponse } from "next/server";
import { registerVault } from "../../../../lib/db";
import { randomUUID } from "crypto";

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
    
    await registerVault({
      id: vaultId,
      provider_address: providerAddress,
      origin_url: originUrl,
      price_usdc: priceUsdc,
      description: description ?? "",
      active: true
    });

    const gateway = process.env.NEXTAUTH_URL ?? "https://fund402.vercel.app";
    const wrappedUrl = `${gateway}/v/${vaultId}/`;

    return NextResponse.json({ vaultId, wrappedUrl });
  } catch (err) {
    console.error("[register vault]", err);
    return NextResponse.json({ error: "internal_error", detail: String(err) }, { status: 500 });
  }
}
