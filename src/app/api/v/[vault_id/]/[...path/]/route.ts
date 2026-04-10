import { NextRequest, NextResponse } from "next/server";
import * as StellarSdk from "@stellar/stellar-sdk";

const SOROBAN_RPC_URL = process.env.SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = process.env.NETWORK_PASSPHRASE || StellarSdk.Networks.TESTNET;

export async function GET(
  request: NextRequest,
  { params }: { params: { vault_id: string; path: string[] } }
) {
  return handleRequest(request, params);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { vault_id: string; path: string[] } }
) {
  return handleRequest(request, params);
}

async function handleRequest(
  request: NextRequest,
  { vault_id, path }: { vault_id: string; path: string[] }
) {
  const paymentSignature = request.headers.get("payment-signature");

  if (!paymentSignature) {
    // Return 402 Payment Required
    const paymentChallenge = {
      x402Version: 2,
      accepts: [
        {
          scheme: "exact",
          network: "stellar:testnet",
          asset: "USDC:GBBD67IFXCLW6T52V6SREUO6S2I6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6", // Placeholder Testnet USDC
          amount: "1000000", // 0.1 USDC
          payTo: "GADYBNPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU", // Placeholder Merchant
          maxTimeoutSeconds: 60,
        },
      ],
      resource: {
        url: request.url,
        description: `Access to ${path.join("/")} via vault ${vault_id}`,
      },
    };

    const encodedChallenge = Buffer.from(JSON.stringify(paymentChallenge)).toString("base64");

    return new NextResponse(
      JSON.stringify({ error: "Payment required", challenge: paymentChallenge }),
      {
        status: 402,
        headers: {
          "payment-required": encodedChallenge,
          "Content-Type": "application/json",
        },
      }
    );
  }

  // Handle Payment Signature
  try {
    const xdr = Buffer.from(paymentSignature, "base64").toString();
    const transaction = StellarSdk.TransactionBuilder.fromXDR(xdr, NETWORK_PASSPHRASE);
    
    // Submit to Soroban
    const server = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
    const submission = await server.sendTransaction(transaction as StellarSdk.Transaction);

    if (submission.status === "PENDING" || submission.status === "SUCCESS") {
      // payment successful, actually "do the work"
      return NextResponse.json({
        message: "Payment confirmed. Request processed.",
        vault: vault_id,
        path: path.join("/"),
        data: {
          result: "Premium data for AI agent",
          timestamp: Date.now()
        }
      });
    } else {
      return NextResponse.json({ error: "Payment submission failed", details: submission }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: "Invalid payment signature", details: (err as Error).message }, { status: 400 });
  }
}
