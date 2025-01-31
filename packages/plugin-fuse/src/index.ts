export * from "./actions/transfer";
export * from "./providers/wallet";
export * from "./types";

import type { Plugin } from "@elizaos/core";
import { createTokenAction } from "./actions/createToken";
import { transferAction } from "./actions/transfer";
import { fuseWalletProvider } from "./providers/wallet";

export const fusePlugin: Plugin = {
    name: "fuse",
    description: "Fuse blockchain integration plugin",
    providers: [fuseWalletProvider],
    evaluators: [],
    services: [],
    actions: [createTokenAction, transferAction],
};

export default fusePlugin;
