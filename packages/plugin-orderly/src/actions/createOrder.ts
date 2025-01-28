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
} from "../helpers";
import {
    getAllowedChains,
    SupportedChain,
    supportedChainIdsSchema,
} from "../network";
import { initWalletProvider } from "@elizaos/plugin-evm";
import { z } from "zod";
import { OrderEntity, OrderSide } from "@orderly.network/types";
import { OrderType } from "@orderly.network/types";

const createOrderSchema = z.object({
    chain_name: supportedChainIdsSchema,
    symbol: z.string(),
    order_type: z.nativeEnum(OrderType),
    order_price: z
        .string()
        .transform((value) => value || undefined)
        .optional(),
    order_quantity: z
        .string()
        .transform((value) => value || undefined)
        .optional(),
    side: z.nativeEnum(OrderSide),
});

const createOrderTemplate = (
    allowedChains: string[],
    allowedSymbols: string[]
) => `
{{recentMessages}}

Given the recent messages.

Extract the following information about the requested Orderly Network order creation:
- Chain name from supported chain IDs: ${allowedChains.join(", ")}
- Symbol to buy out of these given symbols: ${allowedSymbols.join(", ")}
- Order type from supported order types: ${Object.values(OrderType).join(", ")}
- Order price
- Order quantity
- Order side from supported order sides: ${Object.values(OrderSide).join(", ")}

Respond with a JSON markdown block containing only the extracted values.

Example response:
\`\`\`json
{
    "chain_name": "base",
    "symbol": "PERP_ETH_USDC",
    "order_type": "MARKET",
    "order_price": "1000",
    "order_quantity": "1",
    "side": "BUY"
}
\`\`\``;

async function createOrderAction(
    runtime: IAgentRuntime,
    chainName: SupportedChain,
    order: OrderEntity
): Promise<void> {
    const walletProvider = await initWalletProvider(runtime);
    const address = walletProvider.getAddress();
    const brokerId = runtime.getSetting("ORDERLY_BROKER_ID");
    if (!brokerId) {
        throw new Error("ORDERLY_BROKER_ID is not set");
    }

    const accountId = await getAccountId(address, brokerId);
    const orderlyKey = await getOrderlyKey(runtime);
    if (order.order_type === OrderType.MARKET) {
        order.order_price = undefined;
    }
    await createOrderAtOrderly(chainName, accountId, orderlyKey, order);
}

export const createOrder: Action = {
    name: "CREATE_ORDER",
    similes: [],
    validate: async (_runtime: IAgentRuntime, _message: Memory) => {
        return true;
    },
    description: "Create an order at Orderly Network",
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

        // Compose create order context
        const allowedChains = getAllowedChains(runtime);
        const allowedSymbols = await getAllowedSymbols(
            runtime.getSetting("ORDERLY_NETWORK") as "mainnet" | "testnet"
        );
        const transferContext = composeContext({
            state,
            template: createOrderTemplate(allowedChains, allowedSymbols),
        });

        // Generate create order content
        const content = await generateObject({
            runtime,
            context: transferContext,
            modelClass: ModelClass.SMALL,
            schema: createOrderSchema,
        });

        // Validate create order content
        elizaLogger.info("Create order content:", content.object);
        const createOrderContent = createOrderSchema.safeParse(content.object);
        if (!createOrderContent.success) {
            elizaLogger.error("Invalid content for CREATE_ORDER action.");
            if (callback) {
                callback({
                    text: "Unable to process create order request. Invalid content provided.",
                    content: { error: "Invalid create order content" },
                });
            }
            return false;
        }

        try {
            const { chain_name: chainName, ...order } = createOrderContent.data;
            await createOrderAction(runtime, chainName, order);

            if (callback) {
                callback({
                    text: `Successfully created order ${JSON.stringify(
                        order
                    )} on ${chainName}`,
                    content: {
                        success: true,
                        chainName: chainName,
                        order: order,
                    },
                });
            }

            return true;
        } catch (error) {
            elizaLogger.error("Error during order creation:", error);
            if (callback) {
                callback({
                    text: `Error creating order: ${error}`,
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
                    text: "Create a market order to buy 1 ETH at $1000",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Create a market order to buy 1 ETH at $1000",
                    action: "CREATE_ORDER",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Successfully created order to buy 1 ETH at $1000",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;
