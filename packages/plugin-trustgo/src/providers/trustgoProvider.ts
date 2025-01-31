import { type Hex } from "viem";
import { type IAgentRuntime, elizaLogger } from "@elizaos/core";
import type {
    Chain
} from "viem";
import * as viemChains from "viem/chains";
import { WalletProvider, initWalletProvider } from "@elizaos/plugin-evm";
import NodeCache from "node-cache";

import {
    SupportedChain,
    TrustGoRespone,
    TrustGoInfo,
    TrustGoMediaScore,
    chain_id_map,
    TrustGoPagedRespone,
    TrustGoAttestation,
    TrustGoLoginInfo,
    TrustGoOmniChainEgibility,
    TrustGoOmniChainResponse,
    TrustGoContractCalldata,
    TrustGoL2AttestationResponse
} from "../types";

export class TrustgoProvider {
    private cache: NodeCache;
    private CACHE_EXPIRY_SEC = 5;
    private trustgoEndpoint: string = "https://mp.trustalabs.ai";
    private defaultChain: SupportedChain = "mainnet";
    private attestationChain: SupportedChain = "linea";
    chains: Record<string, Chain> = {
        mainnet: viemChains.mainnet,
        linea: viemChains.linea,
    };
    private evmWallet: WalletProvider;

    constructor(
    ) {
        this.cache = new NodeCache({ stdTTL: this.CACHE_EXPIRY_SEC });
    }

    async initWallet(runtime: IAgentRuntime) {
        this.evmWallet = await initWalletProvider(runtime);
        this.evmWallet.addChain(this.chains);
        console.log("chains:", this.evmWallet.chains);
    }

    async getTrustgoAuth(): Promise<string | null> {
        const cacheKey = "trustgo_auth";
        const cachedData = await this.getCachedData<string>(cacheKey);
        if (cachedData) {
            elizaLogger.log("Returning cached trustgo auth: ", cachedData);
            return cachedData;
        }

        try {
            const auth = await this.checkSignedMessage();
            const auth_token = auth.data.token;
            this.setCachedData<string>(cacheKey, auth_token);
            return auth_token;

        } catch (error) {
            console.error("Error getting wallet balance:", error);
            return null;
        }
    }


    async signMessage(message: string): Promise<string | null> {

        try {
            const client = this.evmWallet.getWalletClient(this.defaultChain);
            const signature = await client.signMessage({
                account: this.evmWallet.account,
                message: message,
            });
            return signature;
        } catch (error) {
            console.error("Error sign message:", error);
            return null;
        }
    }

    async checkSignedMessage(): Promise<TrustGoRespone<TrustGoLoginInfo> | null> {
        const message = 'Please sign this message to confirm you are the owner of this address and Sign in to TrustGo App';
        const signature = await this.signMessage(message);
        const check_body = {
            "mode": "evm",
            "address": this.evmWallet.account.address,
            "message": message,
            "signature":signature
        };
        console.log("check_body: ", check_body);
        const result = await(await fetch(`${this.trustgoEndpoint}/accounts/check_signed_message`, {
            "headers": {
              "accept": "application/json, text/plain, */*",
              "accept-language": "zh-CN,zh;q=0.9",
              "content-type": "application/json",
            },
            "body": JSON.stringify(check_body),
            "method": "POST"
          })).json();
        console.log("sign in trustgo: ", result);
        return result;
    }

    async trustgoInfo(): Promise<TrustGoRespone<TrustGoInfo> | null> {
        const auth_token = await this.getTrustgoAuth();
        const result = await(await fetch(`${this.trustgoEndpoint}/accounts/invite_info`, {
            "headers": {
              "accept": "application/json, text/plain, */*",
              "accept-language": "zh-CN,zh;q=0.9",
              "content-type": "application/json",
              "authorization": `TOKEN ${auth_token}`,
            },
            "method": "GET"
          })).json();
        console.log("trustgoInfo: ", result);
        return result;
    }

    async trustgoMediaByChain(chainId: string): Promise<TrustGoRespone<TrustGoMediaScore> | null> {
        const auth_token = await this.getTrustgoAuth();
        const result = await(await fetch(`${this.trustgoEndpoint}/accounts/attest_info?attest_type=media&chain_id=${chainId}`, {
            "headers": {
              "accept": "application/json, text/plain, */*",
              "accept-language": "zh-CN,zh;q=0.9",
              "content-type": "application/json",
              "authorization": `TOKEN ${auth_token}`,
            },
            "method": "GET"
          })).json();
        //console.log(`trustgo media chain ${chainId}: `, result);
        return result
    }

    async trustgoMediaScore(): Promise<TrustGoMediaScore[] | null> {
        let result: TrustGoMediaScore[] = [];

        let keys = chain_id_map.keys()

        for(let key of keys) {
            const scoreInfo = await this.trustgoMediaByChain(chain_id_map.get(key));
            scoreInfo.data.chain_name = key;
            result.push(scoreInfo.data);
        }

        return result
    }

    async trustgoOmniChainMediaScore(): Promise<TrustGoMediaScore | null> {
        const result:TrustGoRespone<TrustGoMediaScore> = await(await fetch(`${this.trustgoEndpoint}/trustgo/all_chain_media_score?account=${this.evmWallet.account.address}`, {
            "headers": {
              "accept": "application/json, text/plain, */*",
              "accept-language": "zh-CN,zh;q=0.9",
              "content-type": "application/json"
            },
            "method": "GET"
          })).json();
        console.log(`trustgo omnichain media ${this.evmWallet.account.address}: `, result);

        return result.data
    }

    async trustgoMediaAttestations(): Promise<TrustGoAttestation[] | null> {
        const auth_token = await this.getTrustgoAuth();
        const result: TrustGoRespone<TrustGoPagedRespone<TrustGoAttestation>>= await(await fetch(`${this.trustgoEndpoint}/accounts/attestation?attest_type=media`, {
            "headers": {
              "accept": "application/json, text/plain, */*",
              "accept-language": "zh-CN,zh;q=0.9",
              "content-type": "application/json",
              "authorization": `TOKEN ${auth_token}`,
            },
            "method": "GET"
          })).json();
        const attestations = result.data.items;

        return attestations
    }

    async trustgoCheckOmniChainAttestation(): Promise<string | null> {

        console.log("trustgo Check OmniChain Attestation");

        const walletClient = this.evmWallet.getWalletClient(this.attestationChain);

        const auth_token = await this.getTrustgoAuth();
        const egibility: TrustGoOmniChainEgibility= await(await fetch(`${this.trustgoEndpoint}/attestations/all_chain_media/check?recipient=${walletClient.account.address}`, {
            "headers": {
              "accept": "application/json, text/plain, */*",
              "accept-language": "zh-CN,zh;q=0.9",
              "content-type": "application/json",
              "authorization": `TOKEN ${auth_token}`,
            },
            "method": "GET"
          })).json();

        console.log("trustgo Check OmniChain Attestation eligibility: ", egibility.eligibility);

        if (egibility.eligibility == false){

            return null;
        }

        const result: TrustGoOmniChainResponse= await(await fetch(`${this.trustgoEndpoint}/attestations/all_chain_media/claim?recipient=${walletClient.account.address}`, {
            "headers": {
              "accept": "application/json, text/plain, */*",
              "accept-language": "zh-CN,zh;q=0.9",
              "content-type": "application/json",
              "authorization": `TOKEN ${auth_token}`,
            },
            "method": "GET"
          })).json();
        const tx = result.tx;

        try {
            const txnHash = await walletClient.sendTransaction({
                account: walletClient.account,
                to: tx.to,
                value: tx.value,
                data: tx.data as Hex,
                kzg: undefined,
                chain: undefined
            });

            console.log("trustgo Check OmniChain Attestation transaction hash: ", txnHash);

            return txnHash;

        } catch (error) {
            throw new Error(`attest failed: ${error.message}`);
        }
    }

    async trustgoCheckL2Attestation(chainId: string): Promise<string | null> {
        console.log("trustgo Check OmniChain Attestation");

        const walletClient = this.evmWallet.getWalletClient(this.attestationChain);
        const auth_token = await this.getTrustgoAuth();
        const resp: TrustGoRespone<TrustGoL2AttestationResponse> = await(await fetch(`${this.trustgoEndpoint}/accounts/attest_calldata?attest_type=media&chain_id=${chainId}`, {
            "headers": {
              "accept": "application/json, text/plain, */*",
              "accept-language": "zh-CN,zh;q=0.9",
              "content-type": "application/json",
              "authorization": `TOKEN ${auth_token}`,
            },
            "method": "GET"
          })).json();

        console.log("resp:", resp);

        const tx: TrustGoContractCalldata = resp.data.calldata;

        try {
            const txnHash = await walletClient.sendTransaction({
                account: walletClient.account,
                to: tx.to,
                value: tx.value,
                data: tx.data as Hex,
                kzg: undefined,
                chain: undefined
            });

            console.log("trustgo Check OmniChain Attestation transaction hash: ", txnHash);

            return txnHash;

        } catch (error) {
            throw new Error(`attest failed: ${error.message}`);
        }

    }

    async trustgoMakeMintData(): Promise<TrustGoAttestation[] | null> {
        const auth_token = await this.getTrustgoAuth();
        const result: TrustGoRespone<TrustGoPagedRespone<TrustGoAttestation>>= await(await fetch(`${this.trustgoEndpoint}/attestations/all_chain_media/claim`, {
            "headers": {
              "accept": "application/json, text/plain, */*",
              "accept-language": "zh-CN,zh;q=0.9",
              "content-type": "application/json",
              "authorization": `TOKEN ${auth_token}`,
            },
            "method": "POST"
          })).json();
        const attestations = result.data.items;

        return attestations
    }

    async trustgoSubmitAttestation(txnHash: string) {
        const auth_token = await this.getTrustgoAuth();
        const check_body = {
            "attest_type": "media",
            "txn_hash": txnHash
        };
        const result: TrustGoRespone<TrustGoAttestation>= await(await fetch(`${this.trustgoEndpoint}/accounts/attestation`, {
            "headers": {
              "accept": "application/json, text/plain, */*",
              "accept-language": "zh-CN,zh;q=0.9",
              "content-type": "application/json",
              "authorization": `TOKEN ${auth_token}`,
            },
            "body": JSON.stringify(check_body),
            "method": "POST"
          })).json();

        return result
    }

    private async getCachedData<T>(key: string): Promise<T | null> {
        // Check in-memory cache first
        const cachedData = this.cache.get<T>(key);
        if (cachedData) {
            return cachedData;
        }

        return null;
    }

    private async setCachedData<T>(cacheKey: string, data: T): Promise<void> {
        // Set in-memory cache
        this.cache.set(cacheKey, data);
    }

}


export const initTrustgoProvider = async (runtime: IAgentRuntime) => {
    const p = new TrustgoProvider();
    await p.initWallet(runtime);
    return p;
};
