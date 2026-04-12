# Fund402 Gateway & Soroban Vault

Fund402 is an autonomous protocol for AI commerce. It bridges the gap between machine-to-machine payments and AI agents by providing **Just-In-Time (JIT) Flash Loans** on the Stellar Network using Soroban. 

When an AI agent hits a paywall (HTTP 402 Payment Required), the Fund402 Gateway issues an L402-compliant challenge. If the agent lacks funds, the Gateway facilitates an instant USDC JIT loan from the Fund402 Soroban Vault, enabling the agent to pay the paywall, access the data, and resolve the loan—all in a single on-chain transaction.

## 🚀 Architecture

1.  **Fund402 Gateway:** A Next.js API router that wraps standard HTTP endpoints in L402 paywalls (`HTTP 402` with `payment-required` headers). It verifies incoming Soroban transaction signatures and proxies requests to the upstream origin upon successful ledger confirmation.
2.  **Soroban Vault Contract:** A lending liquidity pool written in Rust. It allows Liquidity Providers (LPs) to earn yield by providing USDC, and allows AI Agents to take uncollateralized flash loans specifically for paying registered merchants.

## 📁 Repository Structure

*   **/contracts/fund402_vault/**: The core Soroban smart contract for the liquidity pool and JIT loans.
*   **/src/app/api/v/[vault_id]/**: The Next.js API Gateway that intercepts, challenges, and proxies HTTP requests based on Stellar network payments.
*   **/packages/agent-sdk/**: The universal Axios interceptor SDK used by AI agents to automatically negotiate 402 challenges.

## 🛠 Setup & Running

**Prerequisites:** Node.js, Redis (for rate limiting), Postgres (for tracking), and the Stellar CLI.

1.  **Install Dependencies:**
    ```bash
    npm install
    # Wait for the postinstall script to build the local agent-sdk
    ```

2.  **Configure Environment:**
    Ensure your `.env.local` is set with your Testnet Horizon, Soroban RPC, and the Vault Contract ID:
    ```
    STELLAR_NETWORK=testnet
    SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
    HORIZON_URL=https://horizon-testnet.stellar.org
    FUND402_VAULT_CONTRACT_ID=<YOUR_DEPLOYED_CONTRACT_ID>
    USDC_ISSUER=GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
    ```

3.  **Run the Gateway:**
    ```bash
    npm run dev
    # Runs on localhost:3005
    ```

The Gateway expects the local database `fund402_store.json` to configure the origins and merchant addresses for active vaults.
