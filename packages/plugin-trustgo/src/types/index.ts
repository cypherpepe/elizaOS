
import * as viemChains from "viem/chains";

const _SupportedChainList = Object.keys(viemChains) as Array<
    keyof typeof viemChains
>;
export type SupportedChain = (typeof _SupportedChainList)[number];

export interface TrustGoRespone<T> {
  code: string,
  message: string,
  data: T,
  datetime: string,
  success: boolean
}

export interface TrustGoPagedRespone<T> {
    total: string,
    current: string,
    size: string,
    items: T[]
}


export interface TrustGoLoginInfo {
    verified: string,
    token: string
}


export interface TrustGoInfo {
    account_address: string,
    invite_code: string,
    gathered_point: object,
    is_activate: boolean
}


export interface TrustGoMediaScore {
    chain_id: string,
    chain_name: string,
    address: string,
    score: string,
    attest_type: string,
    period: string,
    fee: string
}

export interface TrustGoAttestation {
    id: string,
    created_at: string,
    updated_at: string,
    chain_id: string,
    account_address: string,
    txn_hash: string,
    txn_status: string,
    schema_id: string,
    schema_tag: string,
    attestation_id: string,
    subject: string,

    attestation_data: string,
    decode_data: string,
    expire_date: string

}

export interface TrustGoOmniChainEgibility {
    code: string,
    message: string,
    eligibility: boolean
}

export interface TrustGoContractCalldata {
    chainId: string,
    from: string,
    to: string,
    value: string,
    data: string
}

export interface TrustGoOmniChainResponse {
    code: string,
    message: string,
    tx: TrustGoContractCalldata
}

export interface TrustGoL2AttestationResponse {
    calldata: TrustGoContractCalldata,
}

// Action parameters
export interface AttestationParams {
    chain: string;
}

export const support_chains = [
    "zksync", "base", "scroll", "manta", "mantle", "optimism", "linea"
];

export const chain_id_map = new Map([
    ["zksync", "324"],
    ["base", "8453"],
    ["scroll", "534352"],
    ["manta", "169"],
    ["mantle", "5000"],
    ["optimism", "10"],
    ["linea", "59144"]
]);
