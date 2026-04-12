# @nickthelegend/fund402

Drop-in Axios interceptor for autonomous AI agents on Stellar.
Automatically handles HTTP 402 Payment Required via Just-In-Time USDC loans.

## Install

```bash
npm install @nickthelegend/fund402
```

## Usage

```typescript
import { withPaymentInterceptor, testnetConfig } from "@nickthelegend/fund402";

const agent = withPaymentInterceptor({
  ...testnetConfig(),
  agentSecretKey: process.env.AGENT_SECRET_KEY!,
  agentPublicKey: process.env.AGENT_PUBLIC_KEY!,
  vaultContractId: "CDXTW6IMQTPTWWBV7T5FYZZHXQFLWFXAQZHI32SHQS3YHKL6YLM7APD5",
  onEvent: (event) => console.log(event.type, event.data),
});

// One line — handles 402, borrows USDC, pays, retries, returns data
const { data } = await agent.get("https://your-fund402-vault-url/prices/XLM-USDC/spot");
```

## Events

| Event | Description |
|-------|-------------|
| `intercepted_402` | HTTP 402 received, starting JIT loan flow |
| `simulating_borrow` | Calling simulate_borrow on Soroban (read-only) |
| `signing_transaction` | Building and signing borrow_and_pay tx |
| `payment_sent` | Transaction submitted to Stellar Horizon |
| `request_retried` | Original request retried with payment-signature |
| `payment_confirmed` | On-chain confirmation received |

## Config

| Field | Description |
|-------|-------------|
| `agentSecretKey` | Agent's Stellar secret key (SXXX...) |
| `agentPublicKey` | Agent's Stellar public key (GXXX...) |
| `vaultContractId` | fund402 vault Soroban contract ID |
| `networkPassphrase` | Stellar network passphrase |
| `horizonUrl` | Stellar Horizon URL |
| `sorobanRpcUrl` | Soroban RPC URL |
| `onEvent` | Optional event callback |

## Networks

```typescript
import { testnetConfig, mainnetConfig } from "@nickthelegend/fund402";

// Testnet
const agent = withPaymentInterceptor({ ...testnetConfig(), ... });

// Mainnet
const agent = withPaymentInterceptor({ ...mainnetConfig(), ... });
```

Built for the Stellar Agents Hackathon 2026.
