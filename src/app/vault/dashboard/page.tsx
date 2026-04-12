"use client";
import { useState, useEffect } from "react";

interface VaultRow {
  id: string;
  description: string;
  price_usdc: number;
  origin_url: string;
  call_count: number;
  revenue_usdc: number;
}

interface CallRow {
  id: string;
  tx_hash: string;
  payer_address: string;
  amount_usdc: number;
  created_at: string;
}

export default function ProviderDashboard() {
  const [vaults, setVaults] = useState<VaultRow[]>([]);
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/vault/list").then((r) => r.json()),
      fetch("/api/vault/calls").then((r) => r.json()),
    ]).then(([v, c]) => {
      setVaults(v.vaults ?? []);
      setCalls(c.calls ?? []);
      setLoading(false);
    });
  }, []);

  const fmt = (stroops: number) => `$${(stroops / 1e7).toFixed(4)}`;
  const shortHash = (h: string) => `${h.slice(0, 8)}...${h.slice(-6)}`;
  const shortAddr = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050508] flex items-center justify-center">
        <p className="text-[#00C0FF] animate-pulse">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#050508] text-white p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[#00C0FF]">Provider Dashboard</h1>
            <p className="text-gray-400 text-sm mt-1">Manage your fund402 API vaults</p>
          </div>
          
          <a
            href="/vault/register"
            className="bg-[#00C0FF] text-black font-semibold px-5 py-2 rounded-lg hover:bg-[#00a8df] transition text-sm"
          >
            + Register New Vault
          </a>
        </div>

        {/* Vault list */}
        <div className="space-y-4 mb-10">
          {vaults.length === 0 && (
            <div className="bg-[#111] border border-white/10 rounded-xl p-8 text-center">
              <p className="text-gray-400">No vaults yet.</p>
              <a href="/vault/register" className="text-[#00C0FF] text-sm mt-2 inline-block hover:underline">
                Register your first vault →
              </a>
            </div>
          )}
          {vaults.map((v) => (
            <div key={v.id} className="bg-[#111] border border-white/10 rounded-xl p-5">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold">{v.description || "Unnamed Vault"}</p>
                  <p className="text-xs text-gray-500 font-mono mt-1">{v.id}</p>
                </div>
                <span className="text-green-400 text-xs bg-green-400/10 px-2 py-1 rounded">Active</span>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-4">
                <div>
                  <p className="text-xs text-gray-400">Price/call</p>
                  <p className="font-mono font-semibold">{fmt(v.price_usdc)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Total calls</p>
                  <p className="font-mono font-semibold">{v.call_count ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Revenue</p>
                  <p className="font-mono font-semibold text-green-400">{fmt(v.revenue_usdc ?? 0)}</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                <p className="text-xs text-gray-500 font-mono">{`http://localhost:3000/v/${v.id}/`}</p>
                <button
                  onClick={() => navigator.clipboard.writeText(`http://localhost:3000/v/${v.id}/`)}
                  className="text-xs text-[#00C0FF] hover:underline"
                >
                  Copy URL
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Recent calls table */}
        <div className="bg-[#111] border border-white/10 rounded-xl p-6">
          <h2 className="font-semibold mb-4">Recent Agent Calls</h2>
          {calls.length === 0 ? (
            <p className="text-gray-500 text-sm">No calls yet. Share your wrapped URL with an AI agent.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 text-left border-b border-white/5">
                    <th className="pb-2">Payer</th>
                    <th className="pb-2">Amount</th>
                    <th className="pb-2">Tx Hash</th>
                    <th className="pb-2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((c) => (
                    <tr key={c.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-2 font-mono text-xs">{shortAddr(c.payer_address)}</td>
                      <td className="py-2 text-green-400">{fmt(c.amount_usdc)}</td>
                      <td className="py-2 font-mono text-xs">
                        <a
                          href={`https://stellar.expert/explorer/testnet/tx/${c.tx_hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#00C0FF] hover:underline"
                        >
                          {shortHash(c.tx_hash)}
                        </a>
                      </td>
                      <td className="py-2 text-gray-400 text-xs">
                        {new Date(c.created_at).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
