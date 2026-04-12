import { NextRequest, NextResponse } from "next/server";

// This is the "premium origin API" that the fund402 gateway proxies to
// after a successful JIT payment. In production this would be a real
// third-party data provider. For the demo it serves live-ish mock data.

const RESPONSES: Record<string, () => object> = {
  "prices/XLM-USDC/spot": () => ({
    pair: "XLM/USDC",
    price: (0.10 + Math.random() * 0.04).toFixed(6),
    bid: (0.099 + Math.random() * 0.04).toFixed(6),
    ask: (0.101 + Math.random() * 0.04).toFixed(6),
    volume_24h: Math.floor(1_000_000 + Math.random() * 500_000),
    change_24h_pct: ((Math.random() - 0.5) * 6).toFixed(2),
    timestamp: new Date().toISOString(),
    source: "fund402-oracle",
  }),
  "prices/BTC-USD/spot": () => ({
    pair: "BTC/USD",
    price: (80000 + Math.random() * 8000).toFixed(2),
    volume_24h: Math.floor(50_000 + Math.random() * 20_000),
    change_24h_pct: ((Math.random() - 0.5) * 4).toFixed(2),
    timestamp: new Date().toISOString(),
    source: "fund402-oracle",
  }),
  "market/stellar/stats": () => ({
    network: "Stellar",
    ledger_close_time_avg_s: 5,
    total_accounts: 8_000_000 + Math.floor(Math.random() * 100_000),
    total_operations_24h: 12_000_000 + Math.floor(Math.random() * 1_000_000),
    fee_avg_stroops: 100,
    active_validators: 23,
    timestamp: new Date().toISOString(),
    source: "fund402-network",
  }),
  "market/stellar/defi": () => ({
    total_tvl_usdc: 48_000_000 + Math.floor(Math.random() * 2_000_000),
    top_pools: [
      { pair: "XLM/USDC", tvl: 12_000_000, apy: 8.4 },
      { pair: "yXLM/USDC", tvl: 8_500_000, apy: 6.1 },
      { pair: "BTC/XLM", tvl: 5_200_000, apy: 4.9 },
    ],
    timestamp: new Date().toISOString(),
    source: "fund402-defi",
  }),
};

export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path.join("/");
  const generator = RESPONSES[path];

  // Validate this was called via fund402 gateway (has payment headers)
  const vaultId = req.headers.get("x-fund402-vault-id");
  const payer = req.headers.get("x-fund402-payer");
  const txHash = req.headers.get("x-fund402-txhash");

  if (!generator) {
    return NextResponse.json(
      {
        error: "endpoint_not_found",
        requested: path,
        available: Object.keys(RESPONSES),
        hint: "All endpoints require payment via fund402 gateway",
      },
      { status: 404 }
    );
  }

  const data = generator();

  return NextResponse.json({
    ...data,
    _fund402: {
      paid: !!txHash,
      tx_hash: txHash ?? null,
      vault_id: vaultId ?? null,
      payer: payer ?? null,
      protocol: "x402-v2",
      chain: "stellar",
    },
  });
}
