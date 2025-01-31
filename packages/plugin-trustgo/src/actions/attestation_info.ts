import {
    Action,
    HandlerCallback,
    type IAgentRuntime,
    type Memory,
    type State,
} from "@elizaos/core";

import { initTrustgoProvider } from "../providers/trustgoProvider";

import { TrustGoAttestation} from "../types"

export const ShowAttestationAction: Action = {
    name: "TRUSTGO_SHOW_ATTESTATION",
    description: "when user want to show trustgo attestations.",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: any,
        callback?: HandlerCallback
    ) => {
        console.log("trustgo attest action handler called");

        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        const trustgoProvider = await initTrustgoProvider(runtime);
        const trustgoResp: TrustGoAttestation[] = await trustgoProvider.trustgoMediaAttestations();

        if (callback) {
            let resp_text = "Your media attestations: \n";
            trustgoResp.forEach((item, index) => {
                resp_text =  `${resp_text} ${item.id} - ${item.decode_data}\n`;
              });
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
        console.log("trustgo attest action validate called");
        return true;
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "I currently have obtained which attestations",
                    action: "TRUSTGO_SHOW_ATTESTATION",
                },
            },

            {
                user: "{{agent}}",
                content: {
                    text: "Show your attestations, please wait for a wait.",
                    action: "TRUSTGO_SHOW_ATTESTATION",
                },
            },

            {
                user: "{{user1}}",
                content: {
                    text: "show my attestations",
                    action: "TRUSTGO_SHOW_ATTESTATION",
                },
            },
        ],
    ],
    similes: [
        "TRUSTGO_LIST_ATTESTATION",
        "TRUSTGO_MY_ATTESTATION",
    ],
};
