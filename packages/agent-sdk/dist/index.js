"use strict";
// @nickthelegend/fund402
// Stellar-native Axios interceptor for autonomous AI agents
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.withPaymentInterceptor = withPaymentInterceptor;
exports.extractTxHash = extractTxHash;
exports.testnetConfig = testnetConfig;
exports.mainnetConfig = mainnetConfig;
const axios_1 = __importDefault(require("axios"));
const StellarSdk = __importStar(require("@stellar/stellar-sdk"));
function withPaymentInterceptor(config) {
    const instance = axios_1.default.create();
    const sorobanServer = new StellarSdk.rpc.Server(config.sorobanRpcUrl);
    const horizonServer = new StellarSdk.Horizon.Server(config.horizonUrl);
    const keypair = StellarSdk.Keypair.fromSecret(config.agentSecretKey);
    instance.interceptors.response.use((response) => {
        return response;
    }, async (error) => {
        if (error.response?.status !== 402)
            throw error;
        const paymentRequiredHeader = error.response.headers["payment-required"];
        if (!paymentRequiredHeader)
            throw error;
        const paymentBody = JSON.parse(Buffer.from(paymentRequiredHeader, "base64").toString("utf-8"));
        config.onEvent?.({
            type: "intercepted_402",
            data: { resource: paymentBody.resource.url, amount: paymentBody.accepts[0].amount },
            timestamp: Date.now(),
        });
        const option = paymentBody.accepts.find(o => o.network.includes("stellar"));
        if (!option)
            throw new Error("No Stellar payment option found");
        const amount = BigInt(option.amount);
        const merchant = option.payTo;
        // 1. Simulate Borrow
        config.onEvent?.({ type: "simulating_borrow", data: { amount: amount.toString() }, timestamp: Date.now() });
        const vaultContract = new StellarSdk.Contract(config.vaultContractId);
        const simulateTx = new StellarSdk.TransactionBuilder(await horizonServer.loadAccount(config.agentPublicKey), { fee: "100", networkPassphrase: config.networkPassphrase })
            .addOperation(vaultContract.call("simulate_borrow", StellarSdk.nativeToScVal(amount, { type: "i128" })))
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
        const borrowTx = new StellarSdk.TransactionBuilder(await horizonServer.loadAccount(config.agentPublicKey), { fee: "10000000", networkPassphrase: config.networkPassphrase })
            .addOperation(vaultContract.call("borrow_and_pay", StellarSdk.nativeToScVal(config.agentPublicKey, { type: "address" }), StellarSdk.nativeToScVal(merchant, { type: "address" }), StellarSdk.nativeToScVal(amount, { type: "i128" }), StellarSdk.nativeToScVal(requiredCollateralXlm, { type: "i128" }), vaultIdScVal))
            .setTimeout(60)
            .build();
        // Prepare the transaction (adds footprint, resource limits)
        const preparedTx = await sorobanServer.prepareTransaction(borrowTx);
        preparedTx.sign(keypair);
        // Submit directly to Soroban RPC
        const sendResult = await sorobanServer.sendTransaction(preparedTx);
        // Poll for confirmation
        if (sendResult.status === "PENDING") {
            let getResult;
            for (let i = 0; i < 30; i++) {
                await new Promise(r => setTimeout(r, 2000));
                getResult = await sorobanServer.getTransaction(sendResult.hash);
                if (getResult.status !== "NOT_FOUND")
                    break;
            }
            if (!getResult || getResult.status !== "SUCCESS") {
                throw new Error(`borrow_and_pay failed: ${getResult ? JSON.stringify(getResult) : "timeout"}`);
            }
        }
        else if (sendResult.status === "ERROR") {
            throw new Error(`borrow_and_pay submit error: ${JSON.stringify(sendResult)}`);
        }
        // 3. Attach proof (tx hash) and retry
        config.onEvent?.({ type: "payment_sent", data: { txHash: sendResult.hash }, timestamp: Date.now() });
        const originalRequest = error.config;
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
    });
    return instance;
}
function extractTxHash(txXdr, networkPassphrase) {
    const tx = StellarSdk.TransactionBuilder.fromXDR(txXdr, networkPassphrase);
    return tx.hash().toString("hex");
}
function testnetConfig() {
    return {
        networkPassphrase: StellarSdk.Networks.TESTNET,
        horizonUrl: "https://horizon-testnet.stellar.org",
        sorobanRpcUrl: "https://soroban-testnet.stellar.org",
    };
}
function mainnetConfig() {
    return {
        networkPassphrase: StellarSdk.Networks.PUBLIC,
        horizonUrl: "https://horizon.stellar.org",
        sorobanRpcUrl: "https://soroban-testnet.stellar.org", // Soroban RPC often shares testnet URL or has custom ones
    };
}
