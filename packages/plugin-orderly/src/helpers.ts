import { match } from "ts-pattern";
import { encodeAbiParameters, encodePacked } from "viem";
import bs58 from "bs58";

import { SupportedChain, supportedChains } from "./network";
import { Address, keccak256 } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { IAgentRuntime } from "@elizaos/core";
import { signAsync } from "@noble/ed25519";
import { getPublicKeyAsync } from "@noble/ed25519";
import { API, OrderEntity } from "@orderly.network/types";

export const MESSAGE_TYPES = {
    EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
    ],
    Registration: [
        { name: "brokerId", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "timestamp", type: "uint64" },
        { name: "registrationNonce", type: "uint256" },
    ],
    AddOrderlyKey: [
        { name: "brokerId", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "orderlyKey", type: "string" },
        { name: "scope", type: "string" },
        { name: "timestamp", type: "uint64" },
        { name: "expiration", type: "uint64" },
    ],
    Withdraw: [
        { name: "brokerId", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "receiver", type: "address" },
        { name: "token", type: "string" },
        { name: "amount", type: "uint256" },
        { name: "withdrawNonce", type: "uint64" },
        { name: "timestamp", type: "uint64" },
    ],
    SettlePnl: [
        { name: "brokerId", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "settleNonce", type: "uint64" },
        { name: "timestamp", type: "uint64" },
    ],
    DelegateSigner: [
        { name: "delegateContract", type: "address" },
        { name: "brokerId", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "timestamp", type: "uint64" },
        { name: "registrationNonce", type: "uint256" },
        { name: "txHash", type: "bytes32" },
    ],
    DelegateAddOrderlyKey: [
        { name: "delegateContract", type: "address" },
        { name: "brokerId", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "orderlyKey", type: "string" },
        { name: "scope", type: "string" },
        { name: "timestamp", type: "uint64" },
        { name: "expiration", type: "uint64" },
    ],
    DelegateWithdraw: [
        { name: "delegateContract", type: "address" },
        { name: "brokerId", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "receiver", type: "address" },
        { name: "token", type: "string" },
        { name: "amount", type: "uint256" },
        { name: "withdrawNonce", type: "uint64" },
        { name: "timestamp", type: "uint64" },
    ],
    DelegateSettlePnl: [
        { name: "delegateContract", type: "address" },
        { name: "brokerId", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "settleNonce", type: "uint64" },
        { name: "timestamp", type: "uint64" },
    ],
};

export function isTestnet(chain: SupportedChain): boolean {
    return supportedChains[chain]?.network === "testnet";
}

export function getChainId(chain: SupportedChain): string {
    return supportedChains[chain].id;
}

export function getVaultAddress(chainId: SupportedChain): Address {
    return match(chainId)
        .with("mainnet", () => "0x816f722424b49cf1275cc86da9840fbd5a6167e9")
        .with("arbitrum", () => "0x816f722424B49Cf1275cc86DA9840Fbd5a6167e9")
        .with("optimism", () => "0x816f722424b49cf1275cc86da9840fbd5a6167e9")
        .with("base", () => "0x816f722424b49cf1275cc86da9840fbd5a6167e9")
        .with("mantle", () => "0x816f722424b49cf1275cc86da9840fbd5a6167e9")
        .with("sei", () => "0x816f722424B49Cf1275cc86DA9840Fbd5a6167e9")
        .with("sepolia", () => "0x0EaC556c0C2321BA25b9DC01e4e3c95aD5CDCd2f")
        .with(
            "arbitrumSepolia",
            () => "0x0EaC556c0C2321BA25b9DC01e4e3c95aD5CDCd2f"
        )
        .with(
            "optimismSepolia",
            () => "0xEfF2896077B6ff95379EfA89Ff903598190805EC"
        )
        .with("baseSepolia", () => "0xdc7348975aE9334DbdcB944DDa9163Ba8406a0ec")
        .with(
            "mantleSepoliaTestnet",
            () => "0xfb0E5f3D16758984E668A3d76f0963710E775503"
        )
        .with("seiDevnet", () => "0xA603f6e124259d37e43dd5008cB7613164D6a6e3")
        .exhaustive() as Address;
}

export function getVerifyingAddress(chain: SupportedChain): string {
    return match(isTestnet(chain))
        .with(false, () => "0x6F7a338F2aA472838dEFD3283eB360d4Dff5D203")
        .with(true, () => "0x1826B75e2ef249173FC735149AE4B8e9ea10abff")
        .exhaustive();
}

export function getUSDCAddress(chain: SupportedChain): Address {
    return match(chain)
        .with("mainnet", () => "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48")
        .with("arbitrum", () => "0xaf88d065e77c8cC2239327C5EDb3A432268e5831")
        .with("optimism", () => "0x0b2c639c533813f4aa9d7837caf62653d097ff85")
        .with("base", () => "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913")
        .with("mantle", () => "0x09bc4e0d864854c6afb6eb9a9cdf58ac190d0df9")
        .with("sei", () => "0x3894085Ef7Ff0f0aeDf52E2A2704928d1Ec074F1")
        .with("sepolia", () => "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238")
        .with(
            "arbitrumSepolia",
            () => "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d"
        )
        .with(
            "optimismSepolia",
            () => "0x5fd84259d66Cd46123540766Be93DFE6D43130D7"
        )
        .with("baseSepolia", () => "0x036CbD53842c5426634e7929541eC2318f3dCF7e")
        .with(
            "mantleSepoliaTestnet",
            () => "0xAcab8129E2cE587fD203FD770ec9ECAFA2C88080"
        )
        .with("seiDevnet", () => "0xd5164A5a83c64E59F842bC091E06614b84D95fF5")
        .exhaustive() as Address;
}

export function getBaseUrl(chain: SupportedChain): string {
    return match(isTestnet(chain))
        .with(false, () => "https://api-evm.orderly.org")
        .with(true, () => "https://testnet-api-evm.orderly.org")
        .exhaustive();
}

export function getBaseUrlFromNetwork(network: "mainnet" | "testnet"): string {
    return match(network)
        .with("mainnet", () => "https://api-evm.orderly.org")
        .with("testnet", () => "https://testnet-api-evm.orderly.org")
        .exhaustive();
}

export type EIP712Domain = {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
};

export function getOffChainDomain(chain: SupportedChain): EIP712Domain {
    return {
        name: "Orderly",
        version: "1",
        chainId: Number(getChainId(chain)),
        verifyingContract: "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC",
    };
}

export function getOnChainDomain(chain: SupportedChain): EIP712Domain {
    return {
        name: "Orderly",
        version: "1",
        chainId: Number(getChainId(chain)),
        verifyingContract: getVerifyingAddress(chain),
    };
}

export function getAccountId(address: Address, brokerId: string) {
    return keccak256(
        encodeAbiParameters(
            [{ type: "address" }, { type: "bytes32" }],
            [address, keccak256(encodePacked(["string"], [brokerId]))]
        )
    );
}

export async function getOrderlyKey(
    runtime: IAgentRuntime
): Promise<Uint8Array> {
    const orderlyKey = runtime.getSetting(
        "ORDERLY_PRIVATE_KEY"
    ) as `ed25519:${string}`;
    if (!orderlyKey) {
        throw new Error("ORDERLY_PRIVATE_KEY is not set");
    }
    return bs58.decode(orderlyKey.substring(8));
}

export async function signAndSendRequest(
    accountId: string,
    orderlyKey: Uint8Array,
    input: URL | string,
    init?: RequestInit | undefined
): Promise<Response> {
    const timestamp = Date.now();
    const encoder = new TextEncoder();

    const url = new URL(input);
    let message = `${String(timestamp)}${init?.method ?? "GET"}${url.pathname}${url.search}`;
    if (init?.body) {
        message += init.body;
    }
    const orderlySignature = await signAsync(
        encoder.encode(message),
        orderlyKey
    );

    return fetch(input, {
        headers: {
            "Content-Type":
                init?.method !== "GET" && init?.method !== "DELETE"
                    ? "application/json"
                    : "application/x-www-form-urlencoded",
            "orderly-timestamp": String(timestamp),
            "orderly-account-id": accountId,
            "orderly-key": `ed25519:${bs58.encode(await getPublicKeyAsync(orderlyKey))}`,
            "orderly-signature": base64EncodeURL(orderlySignature),
            ...(init?.headers ?? {}),
        },
        ...(init ?? {}),
    });
}

export async function withdrawUSDCFromOrderly(
    runtime: IAgentRuntime,
    chain: SupportedChain,
    brokerId: string,
    accountId: string,
    orderlyKey: Uint8Array,
    amount: string,
    receiver: string
): Promise<void> {
    const nonceRes = await signAndSendRequest(
        accountId,
        orderlyKey,
        `${getBaseUrl(chain)}/v1/withdraw_nonce`
    );
    const nonceJson = await nonceRes.json();
    const withdrawNonce = nonceJson.data.withdraw_nonce as string;

    const withdrawMessage = {
        brokerId,
        chainId: Number(supportedChains[chain].id),
        receiver,
        token: "USDC",
        amount: Number(amount),
        timestamp: Date.now(),
        withdrawNonce,
    };

    const PRIVATE_KEY = runtime.getSetting("EVM_PRIVATE_KEY")!;
    const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);

    const signature = await account.signTypedData({
        message: withdrawMessage,
        primaryType: "Withdraw",
        types: MESSAGE_TYPES,
        domain: getOnChainDomain(chain) as any,
    });
    const res = await signAndSendRequest(
        accountId,
        orderlyKey,
        `${getBaseUrl(chain)}/v1/withdraw_request`,
        {
            method: "POST",
            body: JSON.stringify({
                message: withdrawMessage,
                signature,
                userAddress: account.address,
                verifyingContract: getVerifyingAddress(chain),
            }),
        }
    );
    const withdrawJson = await res.json();
    if (!withdrawJson.success) {
        throw new Error(withdrawJson.message);
    }
}

export async function settlePnlFromOrderly(
    runtime: IAgentRuntime,
    chain: SupportedChain,
    brokerId: string,
    accountId: string,
    orderlyKey: Uint8Array
): Promise<void> {
    const nonceRes = await signAndSendRequest(
        accountId,
        orderlyKey,
        `${getBaseUrl(chain)}/v1/settle_nonce`
    );
    const nonceJson = await nonceRes.json();
    const settleNonce = nonceJson.data.settle_nonce as string;

    const settlePnlMessage = {
        brokerId,
        chainId: Number(supportedChains[chain].id),
        settleNonce,
        timestamp: Date.now(),
    };

    const PRIVATE_KEY = runtime.getSetting("EVM_PRIVATE_KEY")!;
    const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);

    const signature = await account.signTypedData({
        message: settlePnlMessage,
        primaryType: "SettlePnl",
        types: MESSAGE_TYPES,
        domain: getOnChainDomain(chain) as any,
    });
    const res = await signAndSendRequest(
        accountId,
        orderlyKey,
        `${getBaseUrl(chain)}/v1/settle_pnl`,
        {
            method: "POST",
            body: JSON.stringify({
                message: settlePnlMessage,
                signature,
                userAddress: account.address,
                verifyingContract: getVerifyingAddress(chain),
            }),
        }
    );
    const settlePnlJson = await res.json();
    if (!settlePnlJson.success) {
        throw new Error(settlePnlJson.message);
    }
}

export async function getClientHolding(
    chainId: SupportedChain,
    accountId: string,
    orderlyKey: Uint8Array
): Promise<number> {
    const res = await signAndSendRequest(
        accountId,
        orderlyKey,
        `${getBaseUrl(chainId)}/v1/client/holding`
    );
    if (!res.ok) {
        throw new Error(`Could not fetch client holding: ${await res.text()}`);
    }
    const json = await res.json();
    if (!json.success) {
        throw new Error(json.message);
    }
    const holdings = json.data.holding as API.Holding[];
    return holdings.find(({ token }) => token === "USDC")?.holding ?? 0;
}

export async function getOrders(
    chainId: SupportedChain,
    accountId: string,
    orderlyKey: Uint8Array,
    status: "COMPLETED" | "INCOMPLETE"
): Promise<API.Order[]> {
    const res = await signAndSendRequest(
        accountId,
        orderlyKey,
        `${getBaseUrl(chainId)}/v1/orders?status=${status}`
    );
    if (!res.ok) {
        throw new Error(`Could not fetch orders: ${await res.text()}`);
    }
    const json = (await res.json()) as {
        success: boolean;
        message?: string;
        data: { rows: API.Order[] };
    };
    if (!json.success) {
        throw new Error(json.message);
    }
    return json.data.rows;
}

export async function getPositions(
    chainId: SupportedChain,
    accountId: string,
    orderlyKey: Uint8Array
): Promise<API.PositionAggregated & { rows: API.Position[] }> {
    const res = await signAndSendRequest(
        accountId,
        orderlyKey,
        `${getBaseUrl(chainId)}/v1/positions`
    );
    if (!res.ok) {
        throw new Error(`Could not fetch positions: ${await res.text()}`);
    }
    const json = (await res.json()) as {
        success: boolean;
        message?: string;
        data: API.PositionAggregated & { rows: API.Position[] };
    };
    if (!json.success) {
        throw new Error(json.message);
    }
    return json.data;
}

export async function getPosition(
    chainId: SupportedChain,
    accountId: string,
    orderlyKey: Uint8Array,
    symbol: string
): Promise<API.Position> {
    const res = await signAndSendRequest(
        accountId,
        orderlyKey,
        `${getBaseUrl(chainId)}/v1/position/${symbol}`
    );
    if (!res.ok) {
        throw new Error(`Could not fetch positions: ${await res.text()}`);
    }
    const json = (await res.json()) as {
        success: boolean;
        message?: string;
        data: API.Position;
    };
    if (!json.success) {
        throw new Error(json.message);
    }
    return json.data;
}

export async function createOrderAtOrderly(
    chain: SupportedChain,
    accountId: string,
    orderlyKey: Uint8Array,
    order: OrderEntity
): Promise<string> {
    const res = await signAndSendRequest(
        accountId,
        orderlyKey,
        `${getBaseUrl(chain)}/v1/order`,
        {
            method: "POST",
            body: JSON.stringify(order),
        }
    );
    const json = (await res.json()) as {
        success: boolean;
        message?: string;
        data: { order_id: string };
    };
    if (!json.success) {
        throw new Error(json.message);
    }
    return json.data.order_id;
}

function base64EncodeURL(byteArray: Uint8Array) {
    return btoa(
        Array.from(new Uint8Array(byteArray))
            .map((val) => {
                return String.fromCharCode(val);
            })
            .join("")
    )
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
}

export async function getAllowedSymbols(
    network: "mainnet" | "testnet"
): Promise<string[]> {
    const response = await fetch(
        `${getBaseUrlFromNetwork(network)}/v1/public/info`
    );
    const symbols = (await response.json()) as {
        data: {
            rows: { symbol: string }[];
        };
    };
    return symbols.data.rows.map(({ symbol }) => symbol);
}

export async function getSymbolInfo(
    network: "mainnet" | "testnet",
    symbol: string
): Promise<API.Symbol> {
    const response = await fetch(
        `${getBaseUrlFromNetwork(network)}/v1/public/info/${symbol}`
    );
    const symbols = (await response.json()) as {
        data: API.Symbol;
    };
    return symbols.data;
}
