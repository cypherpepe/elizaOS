import type { IAgentRuntime, Memory, State } from "@elizaos/core";
import {
    composeContext,
    generateObjectDeprecated,
    ModelClass,
} from "@elizaos/core";
import type { Address, Hash } from "viem";
import { parseEther } from "viem";
import { initWalletProvider, WalletProvider } from "../providers/wallet";
import type { SupportedChain, SwapParams, Transaction } from "../types";
import { swapTemplate } from "../templates";

const PARASWAP_API_URL = "https://api.paraswap.io";

export class SwapAction {
    private readonly ERC20_ABI = [
        {
            constant: false,
            inputs: [
                { name: "spender", type: "address" },
                { name: "amount", type: "uint256" },
            ],
            name: "approve",
            outputs: [{ name: "", type: "bool" }],
            payable: false,
            stateMutability: "nonpayable",
            type: "function",
        },
        {
            name: "allowance",
            type: "function",
            stateMutability: "view",
            inputs: [
                { name: "owner", type: "address" },
                { name: "spender", type: "address" },
            ],
            outputs: [{ name: "", type: "uint256" }],
        },
    ] as const;

    private tokenDecimals: Map<string, number> = new Map();
    public tokenAddresses: Map<string, string> = new Map();

    constructor(private walletProvider: WalletProvider) {}

    private async getSwapData(params: SwapParams) {
        const inputTokenDecimals =
            this.tokenDecimals.get(params.fromToken.toLowerCase()) || 18;
        const amount = (
            Number(params.amount) * Math.pow(10, inputTokenDecimals)
        ).toString();

        const queryParams = {
            srcToken: params.fromToken,
            destToken: params.toToken,
            amount: amount,
            userAddress: this.walletProvider.getAddress(),
            network: this.walletProvider
                .getChainConfigs(params.chain)
                .id.toString(),
            version: "6.2",
            side: "SELL",
            slippage: "250",
        };

        const response = await fetch(
            `${PARASWAP_API_URL}/swap?${new URLSearchParams(queryParams)}`
        );

        if (!response.ok)
            throw new Error(
                (await response.json()).message || "Failed to get swap quote"
            );
        return response.json();
    }

    public async validateTokens(
        inputToken: string,
        outputToken: string
    ): Promise<boolean> {
        const chainId = this.walletProvider.getCurrentChain().id;
        const response = await fetch(`${PARASWAP_API_URL}/tokens/${chainId}`);

        if (!response.ok) {
            throw new Error("Failed to fetch token list");
        }

        const { tokens } = await response.json();

        // Store token symbols (lowercase) and their decimals in the map
        tokens.forEach(
            (token: { symbol: string; decimals: number; address: string }) => {
                this.tokenDecimals.set(
                    token.symbol.toLowerCase(),
                    token.decimals
                );
                this.tokenAddresses.set(
                    token.symbol.toLowerCase(),
                    token.address
                );
            }
        );

        return (
            this.tokenDecimals.has(inputToken.toLowerCase()) &&
            this.tokenDecimals.has(outputToken.toLowerCase())
        );
    }

    async swap(params: SwapParams): Promise<Transaction> {
        const walletClient = this.walletProvider.getWalletClient(params.chain);
        const chainConfig = this.walletProvider.getChainConfigs(params.chain);
        const [fromAddress] = await walletClient.getAddresses();
        const swapData = await this.getSwapData(params);

        const txResponse = await walletClient.sendTransaction({
            account: walletClient.account,
            to: swapData.txParams.to as Address,
            data: swapData.txParams.data as `0x${string}`,
            value: BigInt(swapData.txParams.value || "0"),
            chain: chainConfig,
            kzg: undefined,
        });

        return {
            hash: txResponse,
            from: fromAddress,
            to: swapData.txParams.to as Address,
            value: BigInt(swapData.txParams.value || "0"),
            data: swapData.txParams.data as `0x${string}`,
            chainId: chainConfig.id,
        };
    }

    async approveTokenIfNeeded(
        amount: string,
        tokenAddress: string,
        spenderAddress: string,
        callback?: any
    ): Promise<Hash | null> {
        try {
            const currentChain = this.walletProvider
                .getCurrentChain()
                .name.toLowerCase() as SupportedChain;
            const walletClient =
                this.walletProvider.getWalletClient(currentChain);
            const publicClient =
                this.walletProvider.getPublicClient(currentChain);
            const amountBigInt = BigInt(amount);

            const allowance = await publicClient.readContract({
                address: tokenAddress as Address,
                abi: this.ERC20_ABI,
                functionName: "allowance",
                args: [
                    this.walletProvider.getAddress(),
                    spenderAddress as Address,
                ],
            });

            if (allowance >= amountBigInt) {
                return null;
            }

            const hash = await walletClient.writeContract({
                address: tokenAddress as Address,
                abi: this.ERC20_ABI,
                functionName: "approve",
                args: [spenderAddress as Address, amountBigInt],
                account: walletClient.account,
                chain: this.walletProvider.getCurrentChain(),
            });

            if (callback) {
                callback({
                    text: `Successfully approved ${amount} tokens. Hash: ${hash}`,
                });
            }
        } catch (error) {
            if (callback) {
                callback({
                    text: `Token Approval Error: ${error.message}`,
                });
            }
        }
    }
}

export const swapAction = {
    name: "swap",
    description: "Swap tokens using ParaSwap v6.2",
    handler: async (
        runtime: IAgentRuntime,
        _message: Memory,
        state: State,
        _options: any,
        callback?: any
    ) => {
        try {
            const walletProvider = await initWalletProvider(runtime);
            const action = new SwapAction(walletProvider);
            const content = await generateObjectDeprecated({
                runtime,
                context: composeContext({ state, template: swapTemplate }),
                modelClass: ModelClass.LARGE,
            });

            if (
                !(await action.validateTokens(
                    content.inputToken,
                    content.outputToken
                ))
            ) {
                if (callback) {
                    callback({
                        text: `Error: One or both tokens are not supported on ParaSwap`,
                    });
                }
                return false;
            }

            if (content.inputToken !== "ETH") {
                await action.approveTokenIfNeeded(
                    parseEther(content.amount).toString(),
                    action.tokenAddresses.get(content.inputToken.toLowerCase()),
                    "0x6a000f20005980200259b80c5102003040001068",
                    callback
                );
            }

            const swapResp = await action.swap({
                chain: content.chain,
                fromToken: content.inputToken,
                toToken: content.outputToken,
                amount: content.amount,
            });

            if (callback) {
                callback({
                    text: `Successfully swapped ${content.amount} ${content.inputToken} to ${content.outputToken}\nTransaction Hash: ${swapResp.hash}`,
                    content: {
                        success: true,
                        hash: swapResp.hash,
                        recipient: swapResp.to,
                        chain: content.chain,
                    },
                });
            }
            return true;
        } catch (error) {
            if (callback)
                callback({
                    text: `Error: ${error instanceof Error ? error.message : String(error)}`,
                });
            return false;
        }
    },
    template: swapTemplate,
    validate: async (runtime: IAgentRuntime) => {
        const privateKey = runtime.getSetting("EVM_PRIVATE_KEY");
        return typeof privateKey === "string" && privateKey.startsWith("0x");
    },
    examples: [
        [
            {
                user: "user",
                content: {
                    text: "Swap 1 ETH for USDC on Base",
                    action: "TOKEN_SWAP",
                },
            },
            {
                user: "user",
                content: {
                    text: "Swap 1 USDC for DAI",
                    action: "TOKEN_SWAP",
                },
            },
        ],
    ],
    similes: ["TOKEN_SWAP", "EXCHANGE_TOKENS", "TRADE_TOKENS", "SWAP_TOKENS"],
};
