# Fund402 Gateway & Soroban Vault

Fund402 is an autonomous protocol for AI commerce. It bridges the gap between machine-to-machine payments and AI agents by providing **Just-In-Time (JIT) Flash Loans** on the Stellar Network using Soroban. 

When an AI agent hits a paywall (HTTP 402 Payment Required), the Fund402 Gateway issues an L402-compliant challenge. If the agent lacks funds, the Gateway facilitates an instant USDC JIT loan from the Fund402 Soroban Vault, enabling the agent to pay the paywall, access the data, and resolve the loan—all in a single on-chain transaction.

## 🚀 Architecture Flow

```mermaid
sequenceDiagram
    participant Agent as AI Agent (fund402 SDK)
    participant Gateway as Fund402 Gateway
    participant Mongo as MongoDB (State)
    participant Stellar as Soroban Vault
    participant Origin as Paid API Origin
    
    Agent->>Gateway: GET /api/v/vault_1/data
    Gateway-->>Agent: 402 Payment Required (Challenge)
    
    Note over Agent: Agent invokes interceptor SDK
    Agent->>Stellar: Prepare & Sign `borrow_and_pay`
    Stellar-->>Agent: Emits Settlement txHash
    
    Agent->>Gateway: Retry GET with `payment-signature: txHash`
    Gateway->>Mongo: Check Rate Limits / Replays
    Gateway->>Stellar: Verify txHash on Horizon
    Note over Gateway: If Valid & Confirmed
    
    Gateway->>Mongo: Log Receipt to `Calls` DB
    Gateway->>Origin: Proxy Request (Server-side)
    Origin-->>Gateway: 200 OK (Premium Data)
    Gateway-->>Agent: 200 OK + `payment-response` receipt
```

## 📁 Repository Structure

*   **/contracts/fund402_vault/**: The core Soroban smart contract for the liquidity pool and JIT loans.
*   **/src/app/api/v/[vault_id]/**: The Next.js API Gateway that intercepts, challenges, and proxies HTTP requests based on Stellar network payments.
*   **/packages/agent-sdk/**: The universal Axios interceptor SDK used by AI agents to automatically negotiate 402 challenges.

## 🛠 Setup & Running

**Prerequisites:** Node.js, MongoDB cluster (for state/rate limits), and the Stellar CLI.

1.  **Install Dependencies:**
    ```bash
    npm install
    # Wait for the postinstall script to build the local agent-sdk
    ```

2.  **Configure Environment:**
    Ensure your `.env.local` is set with your Testnet Horizon, Soroban RPC, MongoDB, and the Vault Contract ID:
    ```
    STELLAR_NETWORK=testnet
    SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
    HORIZON_URL=https://horizon-testnet.stellar.org
    MONGODB_URI=mongodb+srv://...
    FUND402_VAULT_CONTRACT_ID=<YOUR_DEPLOYED_CONTRACT_ID>
    USDC_ISSUER=GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
    ```

3.  **Run the Gateway:**
    ```bash
    npm run dev
    # Runs on localhost:3005
    ```

## 🔗 Live Demonstration (Stellar Testnet)

See the protocol in action on-chain:

*   **Agent Autonomous Payment (JIT Loan)**: [68f766a8...2a700](https://stellar.expert/explorer/testnet/tx/68f766a8580b8fec9b25b8e077c46f078f783d264c957d0e8bacea7d8522a700)
*   **Agent Autonomous Payment (JIT Loan)**: [f73b165d...0b67b](https://stellar.expert/explorer/testnet/tx/f73b165d2c069335902ad7d2ad4ce440fe93f44c79eda2e8dcef09a06eb0b67b)
*   **Vault Liquidity Deposit**: [c18519dd...90f9](https://stellar.expert/explorer/testnet/tx/c18519dd844c30de6c3d85cea11d01c7eeda4b34822d33c4d63ad155df7490f9)

The Gateway uses MongoDB to configure the origins and merchant addresses for active vaults and to track all confirmed 402 payments.
