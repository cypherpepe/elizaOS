import {
    ActionExample,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    ModelClass,
    State,
    elizaLogger,
    type Action,
    composeContext,
    generateObject,
} from "@elizaos/core";
import { solidityPackedKeccak256 } from "ethers";
import { getAccountId, getUSDCAddress, getVaultAddress } from "../helpers";
import {
    getAllowedChains,
    SupportedChain,
    supportedChainIdsSchema,
} from "../network";
import { initWalletProvider } from "@elizaos/plugin-evm";
import { vaultAbi } from "../abi/vault";
import {
    createPublicClient,
    encodeFunctionData,
    erc20Abi,
    getContract,
    http,
} from "viem";
import { z } from "zod";
import BigNumber from "bignumber.js";
import { privateKeyToAccount } from "viem/accounts";

const depositSchema = z.object({
    chain_name: supportedChainIdsSchema,
    amount: z.string(),
});

const depositTemplate = (allowedChains: string[]) => `
{{recentMessages}}

Given the recent messages.

Extract the following information about the requested Orderly Network deposit:
- Chain name from supported chain IDs: ${allowedChains.join(", ")}
- USDC amount to deposit

Respond with a JSON markdown block containing only the extracted values.

Example response:
\`\`\`json
{
    "chain_name": "base",
    "amount": "1.5"
}
\`\`\``;

async function depositUSDC(
    runtime: IAgentRuntime,
    chain: SupportedChain,
    amount: string
): Promise<string> {
    const usdcAmount = new BigNumber(amount)
        .multipliedBy(new BigNumber(10).pow(6))
        .toFixed(0);

    const walletProvider = await initWalletProvider(runtime);
    const address = walletProvider.getAddress();
    const account = privateKeyToAccount(
        runtime.getSetting("EVM_PRIVATE_KEY") as `0x${string}`
    );

    const publicClient = createPublicClient({
        chain: walletProvider.getCurrentChain(),
        transport: http(),
    });

    const brokerId = runtime.getSetting("ORDERLY_BROKER_ID");
    if (!brokerId) {
        throw new Error("ORDERLY_BROKER_ID is not set");
    }

    const walletClient = walletProvider.getWalletClient(chain);

    // check usdc allowance
    const usdcAllowance = await publicClient.readContract({
        address: getUSDCAddress(chain),
        abi: erc20Abi,
        functionName: "allowance",
        args: [address, getVaultAddress(chain)],
    });
    elizaLogger.info("USDC allowance:", usdcAllowance);

    if (usdcAllowance < BigInt(usdcAmount)) {
        elizaLogger.info("Approving USDC...");
        elizaLogger.info("getVaultAddress(chainName):", getVaultAddress(chain));
        elizaLogger.info("usdcAmount:", usdcAmount);
        const hash = await walletClient.sendTransaction({
            account,
            to: getUSDCAddress(chain),
            data: encodeFunctionData({
                abi: erc20Abi,
                functionName: "approve",
                args: [getVaultAddress(chain), BigInt(usdcAmount)],
            }),
            chain: walletProvider.getCurrentChain(),
        });
        elizaLogger.info("Approved USDC", hash);
    }

    const depositInput = {
        brokerHash: solidityPackedKeccak256(["string"], [brokerId]),
        tokenAmount: usdcAmount,
        tokenHash: solidityPackedKeccak256(["string"], ["USDC"]),
        accountId: getAccountId(address, brokerId),
    };
    const depositFee = await publicClient.readContract({
        address: getVaultAddress(chain),
        abi: vaultAbi,
        functionName: "getDepositFee",
        args: [address, depositInput],
    });

    const contract = getContract({
        address: getVaultAddress(chain),
        abi: vaultAbi,
        client: { public: publicClient, wallet: walletClient },
    });
    const tx = await contract.write.deposit([depositInput], {
        value: depositFee,
    });
    return tx;
}

export const deposit: Action = {
    name: "DEPOSIT_USDC",
    similes: [],
    validate: async (_runtime: IAgentRuntime, _message: Memory) => {
        return true;
    },
    description: "Deposit USDC into Orderly Network",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<boolean> => {
        // Initialize or update state
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        // Compose deposit context
        const allowedChains = getAllowedChains(runtime);
        const depositContext = composeContext({
            state,
            template: depositTemplate(allowedChains),
        });

        // Generate deposit content
        const content = await generateObject({
            runtime,
            context: depositContext,
            modelClass: ModelClass.SMALL,
            schema: depositSchema,
        });

        // Validate deposit content
        elizaLogger.info("Deposit content:", content.object);
        const depositContent = depositSchema.safeParse(content.object);
        if (!depositContent.success) {
            elizaLogger.error("Invalid content for DEPOSIT_USDC action.");
            if (callback) {
                callback({
                    text: "Unable to process deposit request. Invalid content provided.",
                    content: { error: "Invalid deposit content" },
                });
            }
            return false;
        }

        try {
            const { chain_name: chainName, amount } = depositContent.data;
            const txHash = await depositUSDC(
                runtime,
                chainName,
                amount.toString()
            );

            if (callback) {
                callback({
                    text: `Successfully deposited ${amount} USDC from ${chainName} into Orderly Network\nTransaction: ${txHash}`,
                    content: {
                        success: true,
                        signature: txHash,
                        amount: amount,
                        chainName: chainName,
                    },
                });
            }

            return true;
        } catch (error) {
            elizaLogger.error("Error during USDC deposit:", error);
            if (callback) {
                callback({
                    text: `Error depositing USDC: ${error}`,
                    content: { error: error },
                });
            }
            return false;
        }
    },

    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Deposit 1.5 USDC to Orderly Network",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "I'll deposit 1.5 USDC now...",
                    action: "DEPOSIT_USDC",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Successfully deposited 1.5 USDC to Orderly Network\nTransaction: ABC123XYZ",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;
