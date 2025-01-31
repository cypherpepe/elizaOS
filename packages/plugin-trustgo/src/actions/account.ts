import {
    Action,
    HandlerCallback,
    type IAgentRuntime,
    type Memory,
    type State,
} from "@elizaos/core";

import { initTrustgoProvider } from "../providers/trustgoProvider";

import { TrustGoRespone, TrustGoInfo } from "../types"


export const TrustgoInfoAction: Action = {
    name: "TRUSTGO_INFO",
    description: "when user call trustgo to fetch info from trustgo website.",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: any,
        callback?: HandlerCallback
    ) => {
        console.log("trustgo action handler called");

        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        console.log("Transfer action handler called");
        const trustgoProvider = await initTrustgoProvider(runtime);
        const trustgoResp: TrustGoRespone<TrustGoInfo> = await trustgoProvider.trustgoInfo();
        const trustgoInfo: TrustGoInfo = trustgoResp.data;

        if (callback) {
            callback({
                text: `trustgo info: \naccount_address - ${trustgoInfo.account_address}\ninvite_code - ${trustgoInfo.invite_code}\ngathered_point - ${trustgoInfo.gathered_point}`,
                content: {
                    success: true
                },
            });
        }
        return true;

    },
    validate: async (runtime: IAgentRuntime) => {
        console.log("trustgo action validate called");
        return true;
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "fetch my information from trustgo",
                    action: "TRUSTGO_INFO",
                },
            },
            {
                user: "{{user1}}",
                content: {
                    text: "go trustgo",
                    action: "TRUSTGO_INFO",
                },
            },
        ],
    ],
    similes: ["TRUSTGO_ACCOUNT", ],
};
