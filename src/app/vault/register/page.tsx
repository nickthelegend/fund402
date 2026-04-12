"use client";
import { useState } from "react";

export default function RegisterVault() {
  const [form, setForm] = useState({
    originUrl: "",
    priceUsdc: "0.02",
    description: "",
    providerAddress: "",
  });
  const [result, setResult] = useState<{ vaultId: string; wrappedUrl: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/vault/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originUrl: form.originUrl,
          priceUsdc: Math.round(parseFloat(form.priceUsdc) * 1e7),
          description: form.description,
          providerAddress: form.providerAddress,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Registration failed");
      setResult(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050508] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#00C0FF]">Register API Vault</h1>
          <p className="text-gray-400 mt-1 text-sm">
            Wrap any API behind fund402 and start earning USDC per call
          </p>
        </div>

        {result ? (
          <div className="bg-[#0a1a0a] border border-green-500/30 rounded-xl p-6">
            <p className="text-green-400 font-semibold mb-4">✅ Vault Registered!</p>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-400 mb-1">Vault ID</p>
                <p className="font-mono text-white bg-black px-3 py-2 rounded">{result.vaultId}</p>
              </div>
              <div>
                <p className="text-gray-400 mb-1">Wrapped URL (share with agents)</p>
                <p className="font-mono text-[#00C0FF] bg-black px-3 py-2 rounded break-all">
                  {result.wrappedUrl}
                </p>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(result.wrappedUrl)}
                className="w-full border border-[#00C0FF]/40 text-[#00C0FF] py-2 rounded-lg text-sm hover:bg-[#00C0FF]/10 transition"
              >
                Copy Wrapped URL
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-[#111] border border-white/10 rounded-xl p-6 space-y-4">
            <div>
              <label className="text-sm text-gray-400 block mb-1">Your Stellar Address (GXXX...)</label>
              <input
                className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-[#00C0FF] outline-none"
                placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                value={form.providerAddress}
                onChange={(e) => setForm({ ...form, providerAddress: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-1">Origin API URL</label>
              <input
                className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-[#00C0FF] outline-none"
                placeholder="https://api.yourservice.com/v1"
                value={form.originUrl}
                onChange={(e) => setForm({ ...form, originUrl: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-1">Price per call (USDC)</label>
              <input
                className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-[#00C0FF] outline-none"
                placeholder="0.02"
                type="number"
                step="0.001"
                min="0.001"
                value={form.priceUsdc}
                onChange={(e) => setForm({ ...form, priceUsdc: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-1">Description</label>
              <input
                className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-[#00C0FF] outline-none"
                placeholder="Premium price data for AI agents"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              onClick={handleSubmit}
              disabled={loading || !form.originUrl || !form.providerAddress}
              className="w-full bg-[#00C0FF] text-black font-semibold py-3 rounded-lg hover:bg-[#00a8df] transition disabled:opacity-40"
            >
              {loading ? "Registering..." : "Register Vault →"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
