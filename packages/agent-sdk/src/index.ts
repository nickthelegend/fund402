// @nickthelegend/fund402
// Stellar-native Axios interceptor for autonomous AI agents

import axios, { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import * as StellarSdk from "@stellar/stellar-sdk";

export interface Fund402Config {
  agentSecretKey: string;
  agentPublicKey: string;
  vaultContractId: string;
  networkPassphrase: string;
  horizonUrl: string;
  sorobanRpcUrl: string;
  onEvent?: (event: Fund402Event) => void;
}

export interface Fund402Event {
  type: "intercepted_402" | "simulating_borrow" | "signing_transaction" | "payment_sent" | "request_retried" | "payment_confirmed";
  data: Record<string, unknown>;
  timestamp: number;
}

export interface PaymentRequiredBody {
  x402Version: 2;
  accepts: PaymentOption[];
  resource: ResourceInfo;
  error?: string;
}

export interface PaymentOption {
  scheme: "exact";
  network: string;
  asset: string;
  amount: string;
  payTo: string;
  maxTimeoutSeconds: number;
}

export interface ResourceInfo {
  url: string;
  description?: string;
  mimeType?: string;
}

export function withPaymentInterceptor(config: Fund402Config): AxiosInstance {
  const instance = axios.create();
  const sorobanServer = new StellarSdk.rpc.Server(config.sorobanRpcUrl);
  const horizonServer = new StellarSdk.Horizon.Server(config.horizonUrl);
  const keypair = StellarSdk.Keypair.fromSecret(config.agentSecretKey);

  instance.interceptors.response.use(
    (response) => {
      return response;
    },
    async (error) => {
      if (error.response?.status !== 402) throw error;

      const paymentRequiredHeader = error.response.headers["payment-required"];
      if (!paymentRequiredHeader) throw error;

      const paymentBody: PaymentRequiredBody = JSON.parse(
        Buffer.from(paymentRequiredHeader, "base64").toString("utf-8")
      );

      config.onEvent?.({
        type: "intercepted_402",
        data: { resource: paymentBody.resource.url, amount: paymentBody.accepts[0].amount },
        timestamp: Date.now(),
      });

      const option = paymentBody.accepts.find(o => o.network.includes("stellar"));
      if (!option) throw new Error("No Stellar payment option found");

      const amount = BigInt(option.amount);
      const merchant = option.payTo;

      // 1. Simulate Borrow
      config.onEvent?.({ type: "simulating_borrow", data: { amount: amount.toString() }, timestamp: Date.now() });
      
      const vaultContract = new StellarSdk.Contract(config.vaultContractId);
      const simulateTx = new StellarSdk.TransactionBuilder(
        await horizonServer.loadAccount(config.agentPublicKey),
        { fee: "100", networkPassphrase: config.networkPassphrase }
      )
        .addOperation(
          vaultContract.call("simulate_borrow", StellarSdk.nativeToScVal(amount, { type: "i128" }))
        )
        .setTimeout(30)
        .build();

      const simulationResponse = await sorobanServer.simulateTransaction(simulateTx);
      let requiredCollateralXlm = amount * 150n / 100n; // Default if simulation fails for some reason
      
      if (StellarSdk.rpc.Api.isSimulationSuccess(simulationResponse) && simulationResponse.result?.retval) {
        const native = StellarSdk.scValToNative(simulationResponse.result.retval);
        if (native && typeof native.required_collateral_xlm === "bigint") {
          requiredCollateralXlm = native.required_collateral_xlm;
        }
      }

      // 2. Build, Prepare, Sign, and Submit borrow_and_pay
      config.onEvent?.({ type: "signing_transaction", data: { merchant }, timestamp: Date.now() });

      const vaultIdScVal = StellarSdk.nativeToScVal("vault_1", { type: "string" });
      const borrowTx = new StellarSdk.TransactionBuilder(
        await horizonServer.loadAccount(config.agentPublicKey),
        { fee: "10000000", networkPassphrase: config.networkPassphrase }
      )
        .addOperation(
          vaultContract.call(
            "borrow_and_pay",
            StellarSdk.nativeToScVal(config.agentPublicKey, { type: "address" }),
            StellarSdk.nativeToScVal(merchant, { type: "address" }),
            StellarSdk.nativeToScVal(amount, { type: "i128" }),
            StellarSdk.nativeToScVal(requiredCollateralXlm, { type: "i128" }),
            vaultIdScVal
          )
        )
        .setTimeout(60)
        .build();

      // Prepare the transaction (adds footprint, resource limits)
      const preparedTx = await sorobanServer.prepareTransaction(borrowTx) as StellarSdk.Transaction;
      preparedTx.sign(keypair);

      // Submit directly to Soroban RPC
      const sendResult = await sorobanServer.sendTransaction(preparedTx);

      // Poll for confirmation
      if (sendResult.status === "PENDING") {
        let getResult;
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 2000));
          getResult = await sorobanServer.getTransaction(sendResult.hash);
          if (getResult.status !== "NOT_FOUND") break;
        }
        if (!getResult || getResult.status !== "SUCCESS") {
          throw new Error(`borrow_and_pay failed: ${getResult ? JSON.stringify(getResult) : "timeout"}`);
        }
      } else if (sendResult.status === "ERROR") {
        throw new Error(`borrow_and_pay submit error: ${JSON.stringify(sendResult)}`);
      }

      // 3. Attach proof (tx hash) and retry
      config.onEvent?.({ type: "payment_sent", data: { txHash: sendResult.hash }, timestamp: Date.now() });

      const originalRequest = error.config as InternalAxiosRequestConfig;
      
      const paymentSignature = {
        x402Version: 2,
        scheme: "exact",
        network: config.networkPassphrase === StellarSdk.Networks.PUBLIC ? "stellar:mainnet" : "stellar:testnet",
        payload: {
          transaction: preparedTx.toXDR(),
          agentAddress: config.agentPublicKey,
          txHash: sendResult.hash
        }
      };

      originalRequest.headers["payment-signature"] = Buffer.from(JSON.stringify(paymentSignature)).toString("base64");

      config.onEvent?.({ type: "request_retried", data: { url: originalRequest.url }, timestamp: Date.now() });

      return instance(originalRequest);
    }
  );

  return instance;
}



export function extractTxHash(txXdr: string, networkPassphrase: string): string {
  const tx = StellarSdk.TransactionBuilder.fromXDR(txXdr, networkPassphrase);
  return tx.hash().toString("hex");
}

export function testnetConfig(): Partial<Fund402Config> {
  return {
    networkPassphrase: StellarSdk.Networks.TESTNET,
    horizonUrl: "https://horizon-testnet.stellar.org",
    sorobanRpcUrl: "https://soroban-testnet.stellar.org",
  };
}

export function mainnetConfig(): Partial<Fund402Config> {
  return {
    networkPassphrase: StellarSdk.Networks.PUBLIC,
    horizonUrl: "https://horizon.stellar.org",
    sorobanRpcUrl: "https://soroban-testnet.stellar.org", // Soroban RPC often shares testnet URL or has custom ones
  };
}
