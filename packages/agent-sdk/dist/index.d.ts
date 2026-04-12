import { AxiosInstance } from "axios";
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
export declare function withPaymentInterceptor(config: Fund402Config): AxiosInstance;
export declare function extractTxHash(txXdr: string, networkPassphrase: string): string;
export declare function testnetConfig(): Partial<Fund402Config>;
export declare function mainnetConfig(): Partial<Fund402Config>;
