import {
    Action,
    composeContext,
    generateObjectDeprecated,
    HandlerCallback,
    ModelClass,
    type IAgentRuntime,
    type Memory,
    type State,
} from "@elizaos/core";

import { initTrustgoProvider } from "../providers/trustgoProvider";

import { AttestationParams, chain_id_map} from "../types"

import { attestationTemplate } from "../templates";

const buildAttestationDetails = async (
    state: State,
    runtime: IAgentRuntime
): Promise<AttestationParams[]> => {

    const context = composeContext({
        state,
        template: attestationTemplate,
    });

    const attestationDetails = (await generateObjectDeprecated({
        runtime,
        context,
        modelClass: ModelClass.EMBEDDING,
    })) as AttestationParams[];

    return attestationDetails;
};

export const GetAttestationAction: Action = {
    name: "TRUSTGO_GET_ATTESTATION",
    description: "Submit onchain performance score of connected address to the blockchain, the score must uses omnichain reputation score and must over 1.",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: any,
        callback?: HandlerCallback
    ) => {
        console.log("trustgo mint action handler called");

        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        const trustgoProvider = await initTrustgoProvider(runtime);

        // Compose transfer context
        const paramOptions:AttestationParams[] = await buildAttestationDetails(
            state,
            runtime
        );

        let paramOption = {
            chain: "omnichain"
        }

        if (paramOptions.length > 0){
            paramOption = paramOptions[paramOptions.length-1];
        }

        let resp_text = `Your media attestations:`;
        console.log("attestation paramOptions: ", paramOptions);

        if (paramOption == null || paramOption.chain == "omnichain"){
            const txnHash = await trustgoProvider.trustgoCheckOmniChainAttestation();
            const attestation = await trustgoProvider.trustgoSubmitAttestation(txnHash);
            resp_text = `${resp_text} omnichain id: ${attestation.data.id} - data: ${attestation.data.decode_data} \n`;
        }else{
            const chainId = chain_id_map.get(paramOption.chain);
            const txnHash = await trustgoProvider.trustgoCheckL2Attestation(chainId);
            const attestation = await trustgoProvider.trustgoSubmitAttestation(txnHash);
            resp_text = `${resp_text} ${paramOption.chain} id: ${attestation.data.id} - data: ${attestation.data.decode_data} \n`;
        }

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
        console.log("trustgo mint action validate called");
        return true;
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Please help me to mint the attestation of my address",
                    action: "TRUSTGO_GET_ATTESTATION",
                },
            },
            {
                user: "{{user1}}",
                content: {
                    text: "mint my linea media score",
                    action: "TRUSTGO_GET_ATTESTATION",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "Ok, the reputation of your connected address is meet the requirement(>=1), I will help you to mint the attestation.",
                    action: "TRUSTGO_GET_ATTESTATION",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "Please confirm the transacation & detail in your wallet, when the transaction is confirmed, the attestation will be send to your wallet soon.",
                    action: "TRUSTGO_GET_ATTESTATION",
                },
            },
        ],
    ],
    similes: [
        "TRUSTGO_MINT_ATTESTATION",
    ],
};
