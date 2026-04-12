import { NextResponse } from "next/server";
import { getAllVaults } from "../../../../lib/db";

export async function GET() {
  try {
    const vaults = await getAllVaults();
    return NextResponse.json({ vaults });
  } catch (err) {
    return NextResponse.json({ vaults: [], error: String(err) });
  }
}
