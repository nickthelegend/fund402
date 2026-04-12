import { NextRequest, NextResponse } from "next/server";
import { getDb, saveDb } from "../../../../../lib/db";
import { createClient } from "redis";
import * as StellarSdk from "@stellar/stellar-sdk";

const redisClient = createClient({
  url: process.env.REDIS_URL ?? "redis://localhost:6379",
});

let redisConnected = false;
async function getRedis() {
  if (!redisConnected) {
    await redisClient.connect();
    redisConnected = true;
  }
  return redisClient;
}

// ─── STELLAR CONFIG ──────────────────────────────────────────────────────────

const IS_MAINNET = process.env.STELLAR_NETWORK === "mainnet";
const NETWORK_PASSPHRASE = IS_MAINNET
  ? StellarSdk.Networks.PUBLIC
  : StellarSdk.Networks.TESTNET;
const HORIZON_URL = IS_MAINNET
  ? "https://horizon.stellar.org"
  : "https://horizon-testnet.stellar.org";
const CAIP2_NETWORK = IS_MAINNET ? "stellar:mainnet" : "stellar:testnet";
const USDC_ISSUER = IS_MAINNET
  ? "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
  : "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

// x402 header names
const HDR_PAYMENT_REQUIRED = "payment-required";
const HDR_PAYMENT_SIGNATURE = "payment-signature";
const HDR_PAYMENT_RESPONSE = "payment-response";

// ─── CORS HEADERS ────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": `${HDR_PAYMENT_SIGNATURE}, content-type`,
  "Access-Control-Expose-Headers": `${HDR_PAYMENT_REQUIRED}, ${HDR_PAYMENT_RESPONSE}`,
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

// ─── RATE LIMITING ───────────────────────────────────────────────────────────

async function checkGlobalRateLimit(): Promise<boolean> {
  try {
    const r = await getRedis();
    const key = "rl:global";
    const count = await r.incr(key);
    if (count === 1) await r.expire(key, 60);
    return count <= 10000;
  } catch {
    return true; // if redis is down, don't block
  }
}

async function checkChallengeRateLimit(vaultId: string, ip: string): Promise<boolean> {
  try {
    const r = await getRedis();
    const key = `rl:challenge:${vaultId}:${ip}`;
    const count = await r.incr(key);
    if (count === 1) await r.expire(key, 60);
    return count <= 120;
  } catch {
    return true;
  }
}

async function checkPayerRateLimit(vaultId: string, payer: string): Promise<boolean> {
  try {
    const r = await getRedis();
    const key = `rl:payer:${vaultId}:${payer}`;
    const count = await r.incr(key);
    if (count === 1) await r.expire(key, 60);
    return count <= 100;
  } catch {
    return true;
  }
}

// ─── REPLAY PREVENTION ───────────────────────────────────────────────────────

async function isAlreadySettled(txHash: string): Promise<boolean> {
  try {
    const r = await getRedis();
    const val = await r.get(`settled:${txHash}`);
    return val !== null;
  } catch {
    return false;
  }
}

async function markSettled(txHash: string, payer: string, vaultId: string): Promise<void> {
  try {
    const r = await getRedis();
    await r.setEx(
      `settled:${txHash}`,
      86400, // 24 hours
      JSON.stringify({ txHash, payer, vaultId, settledAt: Date.now() })
    );
  } catch {
    // non-fatal if redis is down
  }
}

// ─── SSRF PROTECTION ─────────────────────────────────────────────────────────

function isAllowedUrl(raw: string): boolean {
  // Allow localhost for demo/development purposes
  if (process.env.NODE_ENV !== "production") return true;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    const h = u.hostname;
    if (h === "localhost" || h === "127.0.0.1" || h === "::1") return false;
    if (/^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
    return true;
  } catch {
    return false;
  }
}

// ─── TX POLLING ──────────────────────────────────────────────────────────────

async function pollTransactionConfirmation(
  horizon: StellarSdk.Horizon.Server,
  txHash: string,
  maxAttempts = 15,
  intervalMs = 2000
): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const tx = await horizon.transactions().transaction(txHash).call();
      if (tx.successful) return tx;
      throw new Error(`Transaction failed on chain: ${txHash}`);
    } catch (err: unknown) {
      // NotFoundError means not yet confirmed — keep polling
      if (
        typeof err === "object" &&
        err !== null &&
        "name" in err &&
        (err as { name: string }).name === "NotFoundError" &&
        i < maxAttempts - 1
      ) {
        await new Promise((res) => setTimeout(res, intervalMs));
        continue;
      }
      throw err;
    }
  }
  throw new Error(`Transaction ${txHash} not confirmed after ${maxAttempts} attempts`);
}

// ─── MAIN HANDLER ────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: { vault_id: string; path: string[] } }
) {
  const { vault_id, path } = params;
  const fullPath = path.join("/");
  const clientIp = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";

  // ── Global rate limit ──
  const globalOk = await checkGlobalRateLimit();
  if (!globalOk) {
    return NextResponse.json(
      { error: "global_rate_limit_exceeded" },
      { status: 429, headers: CORS_HEADERS }
    );
  }

  // ── Load vault from DB ──
  const db = getDb();
  const vaultRow = db.vaults[vault_id];

  if (!vaultRow || !vaultRow.active) {
    console.warn(`[fund402] ❌ Vault not found or inactive: ${vault_id}`);
    return NextResponse.json(
      { error: "vault_not_found", vault_id },
      { status: 404, headers: CORS_HEADERS }
    );
  }

  // ── Check for payment-signature ──
  const paymentSignatureHeader = req.headers.get(HDR_PAYMENT_SIGNATURE);

  // ══════════════════════════════════════════════════════════════
  // PATH A: No payment header → issue 402 challenge
  // ══════════════════════════════════════════════════════════════
  if (!paymentSignatureHeader) {
    console.log(`[fund402] 🔍 Request to ${vault_id}/${fullPath} from ${clientIp}`);
    const challengeOk = await checkChallengeRateLimit(vault_id, clientIp);
    if (!challengeOk) {
      console.warn(`[fund402] 🛑 Rate limit exceeded for ${clientIp}`);
      return NextResponse.json(
        { error: "challenge_rate_limit_exceeded" },
        { status: 429, headers: CORS_HEADERS }
      );
    }

    console.log(`[fund402] 🎫 Issuing 402 Challenge: ${vaultRow.price_usdc} USDC`);
    const paymentRequiredBody = {
      x402Version: 2,
      accepts: [
        {
          scheme: "exact",
          network: CAIP2_NETWORK,
          asset: USDC_ISSUER,
          amount: String(vaultRow.price_usdc),
          payTo: vaultRow.provider_address,
          maxTimeoutSeconds: 300,
        },
      ],
      resource: {
        url: req.url,
        description: vaultRow.description ?? `fund402 vault: ${vault_id}`,
        mimeType: "application/json",
      },
    };

    const encoded = Buffer.from(JSON.stringify(paymentRequiredBody)).toString("base64");

    return new NextResponse(JSON.stringify(paymentRequiredBody), {
      status: 402,
      headers: {
        "Content-Type": "application/json",
        [HDR_PAYMENT_REQUIRED]: encoded,
        ...CORS_HEADERS,
      },
    });
  }

  // ══════════════════════════════════════════════════════════════
  // PATH B: Payment header present → validate + settle + proxy
  // ══════════════════════════════════════════════════════════════
  try {
    console.log(`[fund402] 💳 Received Payment Signature for ${vault_id}`);
    // ── Decode payment-signature ──
    let paymentPayload: {
      x402Version: number;
      scheme: string;
      network: string;
      payload: { transaction: string; agentAddress: string; txHash?: string };
      extensions?: { "payment-identifier"?: string };
    };
    try {
      paymentPayload = JSON.parse(
        Buffer.from(paymentSignatureHeader, "base64").toString("utf-8")
      );
    } catch {
      console.error(`[fund402] ❌ Malformed payment signature payload`);
      return NextResponse.json(
        { error: "malformed_payment_signature" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // ── Validate x402 version ──
    if (paymentPayload.x402Version !== 2) {
      console.warn(`[fund402] ❌ Unsupported version: ${paymentPayload.x402Version}`);
      return NextResponse.json(
        { error: "unsupported_x402_version", got: paymentPayload.x402Version },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // ── Validate network matches ──
    if (paymentPayload.network !== CAIP2_NETWORK) {
      return NextResponse.json(
        { error: "network_mismatch", expected: CAIP2_NETWORK, got: paymentPayload.network },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const txXdr = paymentPayload.payload?.transaction;
    const agentAddress = paymentPayload.payload?.agentAddress;
    if (!txXdr || !agentAddress) {
      return NextResponse.json(
        { error: "missing_transaction_or_agent" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // ── Deserialize + get tx hash ──
    let tx: StellarSdk.Transaction;
    let txHash: string;
    try {
      tx = StellarSdk.TransactionBuilder.fromXDR(txXdr, NETWORK_PASSPHRASE) as StellarSdk.Transaction;
      txHash = tx.hash().toString("hex");
      console.log(`[fund402] ⚙️  Parsed Transaction: ${txHash}`);
    } catch {
      return NextResponse.json(
        { error: "invalid_transaction_xdr" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // ── Replay prevention ──
    const alreadySettled = await isAlreadySettled(txHash);
    if (alreadySettled) {
      console.warn(`[fund402] 🔁 Replay detected! Hash already settled: ${txHash}`);
      return NextResponse.json(
        { error: "transaction_already_settled", txHash },
        { status: 409, headers: CORS_HEADERS }
      );
    }

    // ── Per-payer rate limit ──
    const payerOk = await checkPayerRateLimit(vault_id, agentAddress);
    if (!payerOk) {
      return NextResponse.json(
        { error: "payer_rate_limit_exceeded" },
        { status: 429, headers: CORS_HEADERS }
      );
    }

    // ── Submit transaction to Stellar ──
    // The agent SDK may have already submitted the transaction.
    // Check if a txHash was provided and verify it on-chain first.
    console.log(`[fund402] 🌎 Processing JIT loan settlement...`);
    const horizon = new StellarSdk.Horizon.Server(HORIZON_URL);
    
    const preSubmittedHash = paymentPayload.payload?.txHash;
    
    if (preSubmittedHash) {
      // Agent already submitted — just verify it exists on-chain
      console.log(`[fund402] ⚡ Agent pre-submitted tx: ${preSubmittedHash}`);
      txHash = preSubmittedHash;
    } else {
      // Legacy path: gateway submits the transaction
      try {
        await horizon.submitTransaction(tx);
        console.log(`[fund402] ✅ Transaction submitted by gateway!`);
      } catch (submitErr: unknown) {
        const errMsg =
          typeof submitErr === "object" && submitErr !== null && "response" in submitErr
            ? JSON.stringify((submitErr as { response: unknown }).response)
            : String(submitErr);
        console.error("[fund402] ❌ Horizon submit error:", errMsg);
        return NextResponse.json(
          { error: "transaction_submission_failed", detail: errMsg },
          { status: 400, headers: CORS_HEADERS }
        );
      }
    }

    // ── Poll for confirmation ──
    let confirmedTx: any;
    try {
      console.log(`[fund402] ⏳ Waiting for ledger confirmation...`);
      confirmedTx = await pollTransactionConfirmation(horizon, txHash);
      console.log(`[fund402] ⭐ Confirmed in ledger ${confirmedTx.ledger}`);
    } catch (pollErr) {
      return NextResponse.json(
        { error: "transaction_confirmation_timeout", txHash },
        { status: 504, headers: CORS_HEADERS }
      );
    }

    // ── Mark as settled in Redis ──
    await markSettled(txHash, agentAddress, vault_id);

    // ── Record in Postgres ──
    const currentDb = getDb();
    currentDb.calls.push({
      id: crypto.randomUUID(),
      vault_id,
      tx_hash: txHash,
      agent_address: agentAddress,
      amount_usdc: vaultRow.price_usdc,
      status: 'confirmed',
      created_at: new Date().toISOString()
    });
    saveDb(currentDb);

    // ── SSRF check on origin ──
    if (!isAllowedUrl(vaultRow.origin_url)) {
      return NextResponse.json(
        { error: "origin_url_blocked_ssrf" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // ── Forward to origin API ──
    console.log(`[fund402] 🚀 Forwarding request to origin: ${vaultRow.origin_url}`);
    const originUrl = new URL(`${vaultRow.origin_url}/${fullPath}`);
    req.nextUrl.searchParams.forEach((value, key) => {
      originUrl.searchParams.set(key, value);
    });

    let originResponse: Response;
    try {
      originResponse = await fetch(originUrl.toString(), {
        method: req.method,
        headers: {
          Accept: "application/json",
          "x-fund402-vault-id": vault_id,
          "x-fund402-payer": agentAddress,
          "x-fund402-txhash": txHash,
          "x-fund402-block": String(confirmedTx.ledger),
        },
      });
      console.log(`[fund402] ✅ Origin responded with ${originResponse.status}`);
    } catch (fetchErr) {
      console.error(`[fund402] ❌ Origin fetch failed: ${fetchErr}`);
      return NextResponse.json(
        { error: "origin_fetch_failed", origin: originUrl.toString(), detail: String(fetchErr) },
        { status: 502, headers: CORS_HEADERS }
      );
    }

    const responseBody = await originResponse.text();

    // ── Build payment-response receipt ──
    const explorerBase = IS_MAINNET
      ? "https://stellar.expert/explorer/public"
      : "https://stellar.expert/explorer/testnet";

    const paymentResponseBody = {
      success: true,
      transaction: txHash,
      network: CAIP2_NETWORK,
      payer: agentAddress,
      ledger: confirmedTx.ledger,
      explorerUrl: `${explorerBase}/tx/${txHash}`,
    };
    const paymentResponseEncoded = Buffer.from(
      JSON.stringify(paymentResponseBody)
    ).toString("base64");

    return new NextResponse(responseBody, {
      status: originResponse.status,
      headers: {
        "Content-Type": originResponse.headers.get("content-type") ?? "application/json",
        [HDR_PAYMENT_RESPONSE]: paymentResponseEncoded,
        ...CORS_HEADERS,
      },
    });
  } catch (err) {
    console.error("[fund402] ❌ Unhandled gateway error:", err);
    return NextResponse.json(
      { error: "internal_gateway_error", detail: String(err) },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

// Also handle POST for providers that use POST APIs
export async function POST(
  req: NextRequest,
  context: { params: { vault_id: string; path: string[] } }
) {
  return GET(req, context);
}
