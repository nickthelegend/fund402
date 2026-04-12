import { describe, it, expect } from "vitest";
import axios from "axios";

const VAULT_URL =
  process.env.E2E_VAULT_URL ??
  "http://localhost:3000/v/a0000000-0000-0000-0000-000000000001/";

describe("Phase 1 — x402 Challenge Conformance (no credentials needed)", () => {
  it("returns HTTP 402 on unauthenticated request", async () => {
    try {
      await axios.get(`${VAULT_URL}prices/XLM-USDC/spot`);
      throw new Error("Expected 402 but got 200");
    } catch (err) {
      if (!axios.isAxiosError(err)) throw err;
      expect(err.response?.status).toBe(402);
    }
  });

  it("includes payment-required header on 402", async () => {
    try {
      await axios.get(`${VAULT_URL}prices/XLM-USDC/spot`);
    } catch (err) {
      if (!axios.isAxiosError(err)) throw err;
      const header = err.response?.headers?.["payment-required"];
      expect(header).toBeDefined();
      expect(typeof header).toBe("string");
      expect(header.length).toBeGreaterThan(10);
    }
  });

  it("payment-required header decodes to valid x402 v2 body", async () => {
    try {
      await axios.get(`${VAULT_URL}prices/XLM-USDC/spot`);
    } catch (err) {
      if (!axios.isAxiosError(err)) throw err;
      const header = err.response?.headers?.["payment-required"] as string;
      const body = JSON.parse(Buffer.from(header, "base64").toString("utf-8"));

      expect(body.x402Version).toBe(2);
      expect(Array.isArray(body.accepts)).toBe(true);
      expect(body.accepts.length).toBeGreaterThan(0);

      const option = body.accepts[0];
      expect(option.scheme).toBe("exact");
      expect(option.network).toMatch(/^stellar:/);
      expect(option.amount).toBeDefined();
      expect(option.payTo).toBeDefined();
      expect(option.maxTimeoutSeconds).toBeGreaterThan(0);

      expect(body.resource).toBeDefined();
      expect(body.resource.url).toBeDefined();
    }
  });

  it("CORS headers present on 402 response", async () => {
    try {
      await axios.get(`${VAULT_URL}prices/XLM-USDC/spot`);
    } catch (err) {
      if (!axios.isAxiosError(err)) throw err;
      expect(err.response?.headers?.["access-control-allow-origin"]).toBe("*");
    }
  });

  it("OPTIONS preflight returns 200", async () => {
    const res = await axios.options(`${VAULT_URL}prices/XLM-USDC/spot`);
    expect(res.status).toBe(200);
  });

  it("unknown vault returns 404", async () => {
    try {
      await axios.get(`http://localhost:3000/v/nonexistent-vault-id/test`);
    } catch (err) {
      if (!axios.isAxiosError(err)) throw err;
      expect(err.response?.status).toBe(404);
    }
  });

  it("payment-required body includes resource URL matching request", async () => {
    const endpoint = `${VAULT_URL}prices/BTC-USD/spot`;
    try {
      await axios.get(endpoint);
    } catch (err) {
      if (!axios.isAxiosError(err)) throw err;
      const header = err.response?.headers?.["payment-required"] as string;
      const body = JSON.parse(Buffer.from(header, "base64").toString("utf-8"));
      expect(body.resource.url).toContain("prices/BTC-USD");
    }
  });
});
