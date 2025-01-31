import {btcfunMintAction} from "./actions/btcfun.ts";

export * from "./providers/btcfun";

import type { Plugin } from "@elizaos/core";

export const btcfunPlugin: Plugin = {
    name: "btcfun",
    description: "btcfun plugin",
    providers: [],
    evaluators: [],
    services: [],
    actions: [btcfunMintAction],
};

export default btcfunPlugin;
