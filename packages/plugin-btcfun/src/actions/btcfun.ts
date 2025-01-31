import { ByteArray, formatEther, parseEther, type Hex } from "viem";
import {
    composeContext,
    generateObjectDeprecated,
    HandlerCallback,
    ModelClass,
    type IAgentRuntime,
    type Memory,
    type State,
} from "@elizaos/core";

import { networks, Psbt } from 'bitcoinjs-lib';
import { BIP32Factory } from 'bip32';
import {randomBytes} from 'crypto';
import * as ecc from 'tiny-secp256k1';
import { BtcWallet, privateKeyFromWIF } from "@okxweb3/coin-bitcoin";
import { base } from "@okxweb3/crypto-lib";
import { mintTemplate } from "../templates";
import {initBtcFunProvider} from "../providers/btcfun.ts";
export { mintTemplate };

function checkTokenType(tokenType: string) {
    if (tokenType.toLowerCase() !== "brc20" && tokenType.toLowerCase() !== "runes") {
        throw new Error("Invalid token type");
    }
}

export const btcfunMintAction = {
    name: "mint",
    description: "btcfun mint brc20/runes",
    handler: async (
        runtime: IAgentRuntime,
        _message: Memory,
        state: State,
        _options: any,
        callback?: HandlerCallback
    ) => {
        console.log("btcfun action handler called");
        const btcfunProvider = initBtcFunProvider(runtime);

        const chainCode = randomBytes(32);
        const bip32Factory = BIP32Factory(ecc);
        const network = networks.bitcoin;
        const privateKeyWif = runtime.getSetting("BTC_PRIVATE_KEY_WIF") ?? process.env.BTC_PRIVATE_KEY_WIF;
        let address = runtime.getSetting("ADDRESS") ?? process.env.ADDRESS;

        const privateKey = base.fromHex(privateKeyFromWIF(privateKeyWif, network));
        const privateKeyHex = base.toHex(privateKey);
        const privateKeyBuffer = Buffer.from(privateKeyHex, 'hex');
        const keyPair = bip32Factory.fromPrivateKey(privateKeyBuffer, chainCode, network);
        const publicKeyBuffer = Buffer.from(keyPair.publicKey);
        const publicKeyHex = publicKeyBuffer.toString('hex');

        // Compose mint context
        const mintContext = composeContext({
            state,
            template: mintTemplate,
        });
        const content = await generateObjectDeprecated({
            runtime,
            context: mintContext,
            modelClass: ModelClass.LARGE,
        });
        let tokenType = content.tokenType;
        let tick = content.inputToken;
        let mintcap = content.mintcap ?? runtime.getSetting("MINTCAP");
        let mintdeadline = content.mintdeadline ?? runtime.getSetting("MINTDEADLINE");
        let addressFundraisingCap = content.addressFundraisingCap ?? runtime.getSetting("ADDRESS_FUNDRAISING_CAP");
        console.log("begin to mint token", tick, content)
        checkTokenType(tokenType)
        //validateToken
        await btcfunProvider.validateToken(tokenType, address, tick);
        console.log("validate token success")

        try {
            let {order_id, psbt_hex} = await btcfunProvider.createOrder(
                tokenType, publicKeyHex, address, publicKeyHex, address, 10,
                tick, addressFundraisingCap, mintdeadline, mintcap)
            const psbt = Psbt.fromHex(psbt_hex)
            let wallet = new BtcWallet()
            const toSignInputs = [];
            psbt.data.inputs.forEach((input, index)=>{
                toSignInputs.push({
                    index: index,
                    address: address,
                    sighashTypes: [0],
                    disableTweakSigner: false,
                });
            })

            let params = {
                type: 3,
                psbt: psbt_hex,
                autoFinalized: false,
                toSignInputs: toSignInputs,
            };

            let signParams = {
                privateKey: privateKeyWif,
                data: params,
            };
            let signedPsbtHex = await wallet.signTransaction(signParams);
            const txHash = await btcfunProvider.broadcastOrder(order_id, signedPsbtHex)
            console.log('signedPsbtHex: ', signedPsbtHex, 'orderID: ', order_id, 'txhash', txHash)
            if (callback) {
                callback({
                    text: `Successfully mint ${tokenType} ${tick} tokens, mintcap ${mintcap}, mintdeadline ${mintdeadline}, addressFundraisingCap ${addressFundraisingCap} ,txhash ${txHash}`,
                    content: {
                        success: true,
                        orderID: order_id,
                    },
                });
            }
        } catch (error) {
            console.error('Error:', error);
        }
    },
    template: mintTemplate,
    validate: async (runtime: IAgentRuntime) => {
        const privateKey = runtime.getSetting("BTC_PRIVATE_KEY_WIF");
        return typeof privateKey === "string" && privateKey.length > 0;
    },
    examples: [
        [
            {
                user: "assistant",
                content: {
                    text: "I'll help you mint 100000000 BRC20 Party",
                    action: "MINT_BRC20",
                },
            },
            {
                user: "assistant",
                content: {
                    text: "I'll help you mint 100000000 RUNES Party",
                    action: "MINT_RUNES",
                },
            },
            {
                user: "user",
                content: {
                    text: "import token BRC20 `Party`, mintcap 100000, addressFundraisingCap 10 mintdeadline 864000",
                    action: "MINT_BRC20",
                },
            },
            {
                user: "user",
                content: {
                    text: "import token RUNES `Party2`, mintcap 100000, addressFundraisingCap 10 mintdeadline 864000",
                    action: "MINT_RUNES",
                },
            },
        ],
    ],
    similes: ["MINT_BRC20","MINT_RUNES"],
};
