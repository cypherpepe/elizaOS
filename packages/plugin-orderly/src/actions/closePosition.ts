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
import {
    createOrderAtOrderly,
    getAccountId,
    getAllowedSymbols,
    getOrderlyKey,
    getPosition,
} from "../helpers";
import {
    getAllowedChains,
    SupportedChain,
    supportedChainIdsSchema,
} from "../network";
import { initWalletProvider } from "@elizaos/plugin-evm";
import { z } from "zod";
import { API, OrderSide } from "@orderly.network/types";
import { OrderType } from "@orderly.network/types";

const closePositionSchema = z.object({
    chain_name: supportedChainIdsSchema,
    symbol: z.string(),
});

const closePositionTemplate = (
    allowedChains: string[],
    allowedSymbols: string[]
) => `
{{recentMessages}}

Given the recent messages.

Extract the following information about the requested Orderly Network position closing:
- Chain name from supported chain IDs: ${allowedChains.join(", ")}
- Symbol to buy out of these given symbols: ${allowedSymbols.join(", ")}

Respond with a JSON markdown block containing only the extracted values.

Example response:
\`\`\`json
{
    "chain_name": "base",
    "symbol": "PERP_ETH_USDC"
}
\`\`\``;

async function closePositionAction(
    runtime: IAgentRuntime,
    chainName: SupportedChain,
    position: API.Position
): Promise<void> {
    const walletProvider = await initWalletProvider(runtime);
    const address = walletProvider.getAddress();
    const brokerId = runtime.getSetting("ORDERLY_BROKER_ID");
    if (!brokerId) {
        throw new Error("ORDERLY_BROKER_ID is not set");
    }

    const accountId = await getAccountId(address, brokerId);
    const orderlyKey = await getOrderlyKey(runtime);
    await createOrderAtOrderly(chainName, accountId, orderlyKey, {
        order_type: OrderType.MARKET,
        side: position.position_qty > 0 ? OrderSide.SELL : OrderSide.BUY,
        symbol: position.symbol,
        reduce_only: true,
        order_quantity: String(Math.abs(position.position_qty)),
    });
}

export const closePosition: Action = {
    name: "CLOSE_POSITION",
    similes: [],
    validate: async (_runtime: IAgentRuntime, _message: Memory) => {
        return true;
    },
    description: "Close a position at Orderly Network",
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

        // Compose close position context
        const allowedChains = getAllowedChains(runtime);
        const allowedSymbols = await getAllowedSymbols(
            runtime.getSetting("ORDERLY_NETWORK") as "mainnet" | "testnet"
        );
        const transferContext = composeContext({
            state,
            template: closePositionTemplate(allowedChains, allowedSymbols),
        });

        // Generate close position content
        const content = await generateObject({
            runtime,
            context: transferContext,
            modelClass: ModelClass.SMALL,
            schema: closePositionSchema,
        });

        // Validate close position content
        elizaLogger.info("Close position content:", content.object);
        const closePositionContent = closePositionSchema.safeParse(
            content.object
        );
        if (!closePositionContent.success) {
            elizaLogger.error("Invalid content for CLOSE_POSITION action.");
            if (callback) {
                callback({
                    text: "Unable to process close position request. Invalid content provided.",
                    content: { error: "Invalid close position content" },
                });
            }
            return false;
        }

        try {
            const { chain_name: chainName, symbol } = closePositionContent.data;
            const orderlyKey = await getOrderlyKey(runtime);
            const brokerId = runtime.getSetting("ORDERLY_BROKER_ID");
            if (!brokerId) {
                throw new Error("ORDERLY_BROKER_ID is not set");
            }
            const walletProvider = await initWalletProvider(runtime);
            const address = walletProvider.getAddress();
            const accountId = await getAccountId(address, brokerId);
            const position = await getPosition(
                chainName,
                accountId,
                orderlyKey,
                symbol
            );
            await closePositionAction(runtime, chainName, position);

            if (callback) {
                callback({
                    text: `Successfully closed position ${symbol} on ${chainName}`,
                    content: {
                        success: true,
                        chainName: chainName,
                        symbol: symbol,
                    },
                });
            }

            return true;
        } catch (error) {
            elizaLogger.error("Error during position closing:", error);
            if (callback) {
                callback({
                    text: `Error closing position: ${error}`,
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
                    text: "Close the position PERP_ETH_USDC on base",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Close the position PERP_ETH_USDC on base",
                    action: "CLOSE_POSITION",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Successfully closed position PERP_ETH_USDC on base",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;
