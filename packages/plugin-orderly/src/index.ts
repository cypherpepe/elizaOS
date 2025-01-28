import { Plugin } from "@elizaos/core/src/types";
import { orderlyProvider } from "./providers/orderly";
import { deposit } from "./actions/deposit";
import { withdraw } from "./actions/withdraw";
import { createOrder } from "./actions/createOrder";
import { closePosition } from "./actions/closePosition";

export const orderlyPlugin: Plugin = {
    name: "orderly",
    description: "Orderly Plugin for Eliza",
    providers: [orderlyProvider],
    actions: [deposit, withdraw, createOrder, closePosition],
    evaluators: [],
};

export default orderlyPlugin;
