export * from "./actions/account";

import type { Plugin } from "@elizaos/core";
import { TrustgoInfoAction } from "./actions/account";
import { GetAttestationAction } from "./actions/mint_attestation";
import { OnchainReputaionAction } from "./actions/reputation";
import { ShowAttestationAction } from "./actions/attestation_info"

export const trustgoPlugin: Plugin = {
    name: "TrustaOnChainReputation",
    description: "user call trustgo to fetch trustgo information from trustgo website",
    providers: [],
    evaluators: [],
    services: [],
    actions: [TrustgoInfoAction, OnchainReputaionAction, GetAttestationAction, ShowAttestationAction],
};

export default trustgoPlugin;
