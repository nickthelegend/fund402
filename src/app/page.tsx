"use client";
import { useState } from "react";

const CONTRACT_ID = "CDXTW6IMQTPTWWBV7T5FYZZHXQFLWFXAQZHI32SHQS3YHKL6YLM7APD5";
const DEMO_VAULT_URL = "http://localhost:3005/v/a0000000-0000-0000-0000-000000000001/";

const CODE_SNIPPET = `import { withPaymentInterceptor, testnetConfig } from "@nickthelegend/fund402";

const agent = withPaymentInterceptor({
  ...testnetConfig(),
  agentSecretKey: process.env.AGENT_SECRET_KEY,
  agentPublicKey: process.env.AGENT_PUBLIC_KEY,
  vaultContractId: "CDXTW6IMQTPTWWBV7T5FYZZHXQFLWFXAQZHI32SHQS3YHKL6YLM7APD5",
  onEvent: (e) => console.log(e.type, e.data),
});

// Automatically handles HTTP 402 — borrows USDC, pays, retries
const { data } = await agent.get(
  "http://localhost:3005/v/a0000000-0000-0000-0000-000000000001/prices/XLM-USDC/spot"
);`;

export default function LandingPage() {
  const [copied, setCopied] = useState(false);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="min-h-screen bg-[#050508] text-white">
      {/* NAV */}
      <nav className="border-b border-white/10 px-8 py-4 flex justify-between items-center">
        <span className="text-xl font-bold text-[#00C0FF]">fund402</span>
        <div className="flex gap-4 text-sm">
          <a href="/vault/register" className="text-gray-400 hover:text-white transition">Register API</a>
          <a href="http://localhost:3007" className="text-gray-400 hover:text-white transition">Dashboard</a>
          <a href="http://localhost:3006" className="text-gray-400 hover:text-white transition">Demo Agent</a>
          <a
            href={`https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#00C0FF] hover:underline"
          >
            Contract ↗
          </a>
        </div>
      </nav>

      {/* HERO */}
      <section className="max-w-4xl mx-auto px-8 py-24 text-center">
        <div className="inline-block bg-[#00C0FF]/10 border border-[#00C0FF]/30 text-[#00C0FF] text-xs px-4 py-1 rounded-full mb-6">
          Built for Stellar Agents Hackathon 2026
        </div>
        <h1 className="text-5xl font-bold leading-tight mb-6">
          Buy Now Pay Later<br />
          <span className="text-[#00C0FF]">for AI Agents</span>
        </h1>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
          fund402 lets autonomous AI agents pay for premium APIs instantly by borrowing
          USDC against XLM collateral on Stellar — all in a single await call,
          with zero human intervention.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <a
            href="http://localhost:3006"
            className="bg-[#00C0FF] text-black font-semibold px-8 py-3 rounded-xl hover:bg-[#00a8df] transition"
          >
            Try the Demo →
          </a>
          <a
            href="/vault/register"
            className="border border-white/20 text-white px-8 py-3 rounded-xl hover:bg-white/5 transition"
          >
            Register Your API
          </a>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="max-w-4xl mx-auto px-8 pb-16">
        <h2 className="text-2xl font-bold text-center mb-10">How It Works</h2>
        <div className="grid md:grid-cols-4 gap-4">
          {[
            { step: "1", title: "Agent hits paid API", desc: "Gets HTTP 402 Payment Required response", icon: "🤖" },
            { step: "2", title: "SDK intercepts", desc: "Decodes x402 challenge, calls simulate_borrow on Soroban", icon: "⚡" },
            { step: "3", title: "JIT loan executes", desc: "Locks XLM collateral, borrows USDC, pays provider atomically", icon: "💸" },
            { step: "4", title: "Data returned", desc: "Agent gets data + payment-response receipt with tx hash", icon: "✅" },
          ].map((item) => (
            <div key={item.step} className="bg-[#111] border border-white/10 rounded-xl p-5 text-center">
              <div className="text-2xl mb-3">{item.icon}</div>
              <div className="text-[#00C0FF] text-xs font-mono mb-2">STEP {item.step}</div>
              <p className="font-semibold text-sm mb-2">{item.title}</p>
              <p className="text-gray-400 text-xs leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CODE SNIPPET */}
      <section className="max-w-4xl mx-auto px-8 pb-16">
        <h2 className="text-2xl font-bold text-center mb-6">Drop-in SDK</h2>
        <p className="text-gray-400 text-center text-sm mb-6">
          One package. Any AI agent. Automatic 402 handling.
        </p>
        <div className="bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden">
          <div className="flex justify-between items-center px-4 py-2 border-b border-white/10">
            <span className="text-gray-500 text-xs font-mono">agent.ts</span>
            <button
              onClick={() => copy(CODE_SNIPPET)}
              className="text-xs text-[#00C0FF] hover:underline"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <pre className="p-5 text-xs font-mono text-gray-300 overflow-x-auto leading-relaxed">
            {CODE_SNIPPET}
          </pre>
        </div>
      </section>

      {/* STATS / CONTRACT */}
      <section className="max-w-4xl mx-auto px-8 pb-16">
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-[#111] border border-white/10 rounded-xl p-5">
            <p className="text-xs text-gray-400 mb-1">Network</p>
            <p className="font-semibold text-[#00C0FF]">Stellar Testnet</p>
          </div>
          <div className="bg-[#111] border border-white/10 rounded-xl p-5">
            <p className="text-xs text-gray-400 mb-1">Protocol</p>
            <p className="font-semibold">x402 V2 · Soroban</p>
          </div>
          <div className="bg-[#111] border border-white/10 rounded-xl p-5">
            <p className="text-xs text-gray-400 mb-1">Collateral</p>
            <p className="font-semibold">XLM → USDC · 150% ratio</p>
          </div>
        </div>
        <div className="mt-4 bg-[#111] border border-white/10 rounded-xl p-5">
          <p className="text-xs text-gray-400 mb-2">Deployed Contract</p>
          <div className="flex items-center justify-between">
            <p className="font-mono text-sm text-[#00C0FF] break-all">{CONTRACT_ID}</p>
            <a
              href={`https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-4 text-xs text-gray-400 hover:text-white whitespace-nowrap"
            >
              View on Explorer ↗
            </a>
          </div>
        </div>
        <div className="mt-4 bg-[#111] border border-white/10 rounded-xl p-5">
          <p className="text-xs text-gray-400 mb-2">Test the 402 Challenge Yourself</p>
          <p className="font-mono text-xs text-gray-300 break-all">{DEMO_VAULT_URL}prices/XLM-USDC/spot</p>
          <button
            onClick={() => copy(`curl -s -i "${DEMO_VAULT_URL}prices/XLM-USDC/spot"`)}
            className="mt-2 text-xs text-[#00C0FF] hover:underline"
          >
            Copy curl command
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/10 px-8 py-6 text-center text-gray-600 text-xs">
        fund402 · Built on Stellar · Stellar Agents Hackathon 2026 · MIT License
      </footer>
    </main>
  );
}
