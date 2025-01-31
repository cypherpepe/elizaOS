import fetch from 'node-fetch';
import type {IAgentRuntime} from "@elizaos/core";

export const initBtcFunProvider = (runtime: IAgentRuntime) => {

    const btcfunApiURL = runtime.getSetting("BTCFUN_API_URL") ?? process.env.BTCFUN_API_URL
    if (!btcfunApiURL) {
        throw new Error("BTCFUN_API_URL is not set");
    }

    return new BtcfunProvider(btcfunApiURL);
};

export class BtcfunProvider {
    private apiUrl: string;

    constructor(apiUrl: string) {
        this.apiUrl = apiUrl;
    }

    async validateToken(tokenType: string, address: string, ticker: string) {
        const url = tokenType === "runes"
            ? `${this.apiUrl}/api/v1/import/rune_validate`
            : `${this.apiUrl}/api/v1/import/brc20_validate`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                address: address,
                ticker: ticker,
            }),
        });

        if (!response.ok) {
            throw new Error(`Error: ${response.statusText}`);
        }

        return response.json();
    }

    async createOrder(tokenType: string, paymentFromPubKey: string, paymentFrom: string, ordinalsFromPubKey: string, ordinalsFrom: string, feeRate: number, tick: string, addressFundraisingCap: string, mintDeadline: number, mintCap: string) {
        const url = tokenType === "runes"
            ? `${this.apiUrl}/api/v1/import/rune_order`
            : `${this.apiUrl}/api/v1/import/brc20_order`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                payment_from_pub_key: paymentFromPubKey,
                payment_from: paymentFrom,
                ordinals_from_pub_key: ordinalsFromPubKey,
                ordinals_from: ordinalsFrom,
                fee_rate: feeRate,
                tick: tick,
                address_fundraising_cap: addressFundraisingCap,
                mint_deadline: mintDeadline,
                mint_cap: mintCap,
            }),
        });

        if (!response.ok) {
            throw new Error(`Error: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.code === "OK" && result.data) {
            const { order_id, psbt_hex } = result.data;
            return { order_id, psbt_hex };
        } else {
            console.log("Invalid response", result)
            throw new Error("Invalid response");
        }
    }

    async broadcastOrder(orderId: string, signedPsbtHex: string) {
        const response = await fetch(`${this.apiUrl}/api/v1/import/broadcast`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                order_id: orderId,
                signed_psbt_hex: signedPsbtHex,
            }),
        });

        if (!response.ok) {
            throw new Error(`Error: ${response.statusText}`);
        }
        const result = await response.json();
        console.log("broadcastOrder result", result);

        if (result.code === "OK" && result.data) {
            return result.data;
        }
    }
}
