import { IAgentRuntime } from "@elizaos/core";
import * as viemChains from "viem/chains";
import { z } from "zod";

type Chain = {
    network: "mainnet" | "testnet";
    id: string;
    label: string;
};

declare const _SupportedChainList: Array<keyof typeof viemChains>;
type AllSupportedChains = (typeof _SupportedChainList)[number];
export type SupportedChain =
    | (AllSupportedChains & "mainnet")
    | "arbitrum"
    | "optimism"
    | "base"
    | "mantle"
    | "sei"
    | "avalanche"
    | "sepolia"
    | "arbitrumSepolia"
    | "optimismSepolia"
    | "baseSepolia"
    | "mantleSepoliaTestnet"
    | "seiDevnet"
    | "avalancheFuji";

export const supportedChainIdsSchema = z.enum([
    "mainnet",
    "arbitrum",
    "optimism",
    "base",
    "mantle",
    "sei",
    "avalanche",
    "sepolia",
    "arbitrumSepolia",
    "optimismSepolia",
    "baseSepolia",
    "mantleSepoliaTestnet",
    "seiDevnet",
    "avalancheFuji",
]);
export const supportedChainIds = supportedChainIdsSchema.options;

export const supportedChains: Record<SupportedChain, Chain> = {
    mainnet: {
        network: "mainnet",
        id: "0x1",
        label: "Ethereum",
    },
    arbitrum: {
        network: "mainnet",
        id: "0xa4b1",
        label: "Arbitrum One",
    },
    optimism: {
        network: "mainnet",
        id: "0xa",
        label: "OP Mainnet",
    },
    base: {
        network: "mainnet",
        id: "0x2105",
        label: "Base",
    },
    mantle: {
        network: "mainnet",
        id: "0x1388",
        label: "Mantle",
    },
    sei: {
        network: "mainnet",
        id: "0x531",
        label: "Sei",
    },
    avalanche: {
        network: "mainnet",
        id: "0xa86a",
        label: "Avalanche",
    },
    sepolia: {
        network: "testnet",
        id: "0xaa36a7",
        label: "Sepolia",
    },
    arbitrumSepolia: {
        network: "testnet",
        id: "0x66eee",
        label: "Arbitrum Sepolia",
    },
    optimismSepolia: {
        network: "testnet",
        id: "0xaa37dc",
        label: "OP Sepolia",
    },
    baseSepolia: {
        network: "testnet",
        id: "0x14a34",
        label: "Base Sepolia",
    },
    mantleSepoliaTestnet: {
        network: "testnet",
        id: "0x138b",
        label: "Mantle Sepolia",
    },
    seiDevnet: {
        network: "testnet",
        id: "0xae3f3",
        label: "Sei Devnet",
    },
    avalancheFuji: {
        network: "testnet",
        id: "0xa869",
        label: "Avalanche Fuji",
    },
};

export function getAllowedChains(runtime: IAgentRuntime): string[] {
    const chains =
        (runtime.character.settings?.chains?.evm as SupportedChain[]) || [];
    const network = runtime.getSetting("ORDERLY_NETWORK") as
        | "mainnet"
        | "testnet";
    return chains
        .filter((chain) => supportedChainIds.includes(chain as SupportedChain))
        .filter(
            (chain) =>
                supportedChains[chain as SupportedChain].network === network
        );
}
