import { NextResponse } from "next/server";
import { getAllCalls } from "../../../../lib/db";

export async function GET() {
  try {
    const calls = await getAllCalls();
    return NextResponse.json({ calls: calls.slice(0, 50) });
  } catch (err) {
    return NextResponse.json({ calls: [], error: String(err) });
  }
}
