import { IAgentRuntime, Memory, Provider, State } from "@elizaos/core";
import { WalletProvider } from "@elizaos/plugin-evm";
import { Chain } from "viem/chains";
import { createPublicClient, erc20Abi } from "viem";
import { http } from "viem";
import {
    getAccountId,
    getClientHolding,
    getOrderlyKey,
    getOrders,
    getPositions,
    getUSDCAddress,
} from "../helpers";
import { SupportedChain, supportedChains } from "../network";
import BigNumber from "bignumber.js";
import { API } from "@orderly.network/types";

const genChainsFromRuntime = (
    runtime: IAgentRuntime
): Record<string, Chain> => {
    const chainNames =
        (runtime.character.settings?.chains?.evm as SupportedChain[]) || [];
    const chains: Record<string, Chain> = {};

    chainNames.forEach((chainName) => {
        const rpcUrl = runtime.getSetting(
            "ETHEREUM_PROVIDER_" + chainName.toUpperCase()
        );
        const chain = WalletProvider.genChainFromName(chainName, rpcUrl);
        chains[chainName] = chain;
    });

    const mainnet_rpcurl = runtime.getSetting("EVM_PROVIDER_URL");
    if (mainnet_rpcurl) {
        const chain = WalletProvider.genChainFromName(
            "mainnet",
            mainnet_rpcurl
        );
        chains["mainnet"] = chain;
    }

    return chains;
};

function formatOrder(order: API.Order): string {
    return `Order ID: ${order.order_id} - Symbol: ${order.symbol.split("_")[1]} - Side: ${order.side} - Price: ${order.price} - Quantity: ${order.quantity} - Status: ${order.status} - Created At: ${new Date(
        order.created_time
    ).toLocaleString()} - Updated At: ${new Date(
        order.updated_time
    ).toLocaleString()}`;
}

function formatPosition(position: API.Position): string {
    return `Symbol: ${position.symbol.split("_")[1]} - Side: ${position.position_qty > 0 ? "LONG" : "SHORT"} - Avg Open Price: ${position.average_open_price} - Mark Price: ${position.mark_price} - Quantity: ${Math.abs(
        position.position_qty
    )} - Est. Liquidation Price: ${position.est_liq_price} - 24h pnl: ${position.pnl_24_h} - Created At: ${new Date(
        position.timestamp
    ).toLocaleString()}`;
}

const orderlyProvider: Provider = {
    get: async (
        runtime: IAgentRuntime,
        _message: Memory,
        state?: State
    ): Promise<string | null> => {
        try {
            const privateKey = runtime.getSetting(
                "EVM_PRIVATE_KEY"
            ) as `0x${string}`;
            if (!privateKey) {
                throw new Error("EVM_PRIVATE_KEY is missing");
            }
            const orderlyKey = await getOrderlyKey(runtime);
            const brokerId = runtime.getSetting("ORDERLY_BROKER_ID");
            if (!brokerId) {
                throw new Error("ORDERLY_BROKER_ID is not set");
            }

            const chains = genChainsFromRuntime(runtime);
            const evmProvider = new WalletProvider(
                privateKey,
                runtime.cacheManager,
                chains
            );

            const address = evmProvider.getAddress();
            const balance = await evmProvider.getWalletBalance();
            const publicClient = createPublicClient({
                chain: evmProvider.getCurrentChain(),
                transport: http(),
            });
            const chainName = Object.entries(supportedChains).find(
                ([_, chain]) =>
                    Number(chain.id) === evmProvider.getCurrentChain().id
            )?.[0] as SupportedChain | undefined;
            if (!chainName) {
                throw new Error("Connected chain not supported");
            }
            const usdcBalance = await publicClient.readContract({
                address: getUSDCAddress(chainName),
                abi: erc20Abi,
                functionName: "balanceOf",
                args: [address],
            });

            const orderlyBalance = await getClientHolding(
                chainName,
                getAccountId(address, brokerId),
                orderlyKey
            );
            const incompleteOrders = await getOrders(
                chainName,
                getAccountId(address, brokerId),
                orderlyKey,
                "INCOMPLETE"
            );
            const completedOrders = await getOrders(
                chainName,
                getAccountId(address, brokerId),
                orderlyKey,
                "COMPLETED"
            );
            const positionsAggregated = await getPositions(
                chainName,
                getAccountId(address, brokerId),
                orderlyKey
            );
            const positionInfo = Object.assign({}, positionsAggregated) as any;
            positionInfo.rows = undefined;
            const positions = positionsAggregated.rows.filter(
                (position) => position.position_qty !== 0
            );

            const leverage =
                1 / positionsAggregated.current_margin_ratio_with_orders;

            const chain = evmProvider.getCurrentChain();
            const agentName = state?.agentName || "The agent";
            return `${agentName}'s EVM Wallet Address: ${address}\nEVM Wallet ETH Balance (this is NOT the Orderly account balance): ${balance} ${chain.nativeCurrency.symbol}\nEVM Wallet USDC Balance (this is NOT the Orderly account balance): ${new BigNumber(String(usdcBalance)).dividedBy(new BigNumber(10).pow(6)).toFixed(6)} USDC\nOrderly account balance (this is the balance that is available for trading on Orderly): ${orderlyBalance} USDC\nChain ID: ${chain.id}, Name: ${chain.name}\nIncomplete Orders: ${incompleteOrders.map(formatOrder).join("\n")}\nCompleted Orders: ${completedOrders.map(formatOrder).join("\n")}\nOpen Positions: ${positions.map(formatPosition).join("\n")}\nPosition Info: ${JSON.stringify(positionInfo)}\nAccount Leverage: ${leverage.toFixed(2)}x`;
        } catch (error) {
            console.error("Error in Orderly wallet provider:", error);
            return null;
        }
    },
};

export { orderlyProvider };
