// Temporary file for EternalAI provider
// TODO: Remove this file after the provider interfaces are implemented

import { createPublicClient, http } from 'viem';
import { BigNumber } from 'ethers';
import { Buffer } from 'node:buffer';
import { elizaLogger } from '../index.ts';
import type { IAgentRuntime } from '../types.ts';

export async function getOnChainEternalAISystemPrompt(
    runtime: IAgentRuntime
): Promise<string> | undefined {
    const agentId = runtime.getSetting("ETERNALAI_AGENT_ID");
    const providerUrl = runtime.getSetting("ETERNALAI_RPC_URL");
    const contractAddress = runtime.getSetting("ETERNALAI_AGENT_CONTRACT_ADDRESS");
    
    if (agentId && providerUrl && contractAddress) {
        const contractABI = [
            {
                inputs: [{ internalType: "uint256", name: "_agentId", type: "uint256" }],
                name: "getAgentSystemPrompt",
                outputs: [{ internalType: "bytes[]", name: "", type: "bytes[]" }],
                stateMutability: "view",
                type: "function",
            },
        ];

        const publicClient = createPublicClient({
            transport: http(providerUrl),
        });

        try {
            const validAddress = contractAddress as `0x${string}`;
            const result = await publicClient.readContract({
                address: validAddress,
                abi: contractABI,
                functionName: "getAgentSystemPrompt",
                args: [BigNumber.from(agentId)],
            });
            
            if (result) {
                const value = result[0].toString().replace("0x", "");
                return fetchEternalAISystemPrompt(runtime, Buffer.from(value, "hex").toString("utf-8"));
            }
        } catch (error) {
            elizaLogger.error("Error fetching on-chain system prompt:", error);
        }
    }
    return undefined;
}

export async function fetchEternalAISystemPrompt(
    runtime: IAgentRuntime,
    content: string
): Promise<string> | undefined {
    const IPFS = "ipfs://";
    if (content.includes(IPFS)) {
        const lightHouse = content.replace(IPFS, "https://gateway.lighthouse.storage/ipfs/");
        try {
            const response = await fetch(lightHouse);
            if (response.ok) return await response.text();
            
            const gcs = content.replace(IPFS, "https://cdn.eternalai.org/upload/");
            const gcsResponse = await fetch(gcs);
            if (gcsResponse.ok) return await gcsResponse.text();
            
            throw new Error("Failed to fetch from both IPFS gateways");
        } catch (error) {
            elizaLogger.error("Error fetching EternalAI system prompt:", error);
            throw new Error("Invalid on-chain system prompt");
        }
    }
    return content;
} 