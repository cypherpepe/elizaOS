import {
    Action,
    HandlerCallback,
    type IAgentRuntime,
    type Memory,
    type State,
} from "@elizaos/core";

import { initTrustgoProvider } from "../providers/trustgoProvider";

import { TrustGoMediaScore } from "../types"


export const OnchainReputaionAction: Action = {
    name: "TRUSTGO_ONCHAIN_REPUTATION",
    description: "Help users to check their onchain reputation score based on user-submitted address",
    handler: async (
            runtime: IAgentRuntime,
            message: Memory,
            state: State,
            _options: any,
            callback?: HandlerCallback
        ) => {
            console.log("trustgo L2 media score action handler called");

            if (!state) {
                state = (await runtime.composeState(message)) as State;
            } else {
                state = await runtime.updateRecentMessageState(state);
            }

            const trustgoProvider = await initTrustgoProvider(runtime);
            let resp_text = "trustgo media scores: \n";
            const trustgoResp: TrustGoMediaScore[] = await trustgoProvider.trustgoMediaScore();
            console.log("trustgoResp: ", trustgoResp);
            trustgoResp.forEach((item, index) => {
                resp_text =  `${resp_text} ${item.chain_name} - ${item.score}\n`;
              });

            const omnichainMediaScore: TrustGoMediaScore = await trustgoProvider.trustgoOmniChainMediaScore();
            resp_text =  `${resp_text} omnichain - ${omnichainMediaScore.score}\n`;

            if (callback) {
                callback({
                    text: resp_text,
                    content: {
                        success: true
                    },
                });
            }
            return true;

        },
        validate: async (runtime: IAgentRuntime) => {
            console.log("trustgo L2 media action validate called");
            return true;
        },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Show me my onchain Reputation",
                    action: "TRUSTGO_ONCHAIN_REPUTATION",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "I will summarize your onchain reputation based on your submitted address, please wait for a wait.",
                    action: "TRUSTGO_ONCHAIN_REPUTATION",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "Based on the transaction history of the submitted address, your onchain reputation socre is 95. \n Your most interacted chain is: Ethereum. \nYour most interacted protocol is: Uniswap",
                    action: "TRUSTGO_ONCHAIN_REPUTATION",
                },
            },
        ],
    ],
    similes: [
        "TRUSTGO_ONCHAIN_SCORE",
        "TRUSTGO_ONCHAIN_PERFORMANCE"
    ],
};
