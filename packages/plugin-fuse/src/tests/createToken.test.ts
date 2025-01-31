import { describe, it, expect, beforeEach } from "vitest";
import { generatePrivateKey } from "viem/accounts";
import { Chain } from "viem";
import { getEnvVariable } from "@elizaos/core";

import { CreateTokenAction, factoryAddress } from "../actions/createToken";
import { WalletProvider } from "../providers/wallet";

describe("Create Token Action", () => {
    let wp: WalletProvider;
    let wp1: WalletProvider;

    beforeEach(async () => {
        const pk = generatePrivateKey();
        const pk1 = getEnvVariable("FUSE_PRIVATE_KEY") as `0x${string}`;
        const customChains = prepareChains();
        wp = new WalletProvider(pk, customChains);
        if (pk1) {
            wp1 = new WalletProvider(pk1, customChains);
        }
    });
    describe("Constructor", () => {
        it("should initialize with wallet provider", () => {
            const cta = new CreateTokenAction(wp);

            expect(cta).toBeDefined();
        });
    });
    describe("Create Token", () => {
        let cta: CreateTokenAction;
        let cta1: CreateTokenAction;
        let receiverAddress: `0x${string}`;

        beforeEach(() => {
            cta = new CreateTokenAction(wp);
            if (wp1) {
                cta1 = new CreateTokenAction(wp1);
                receiverAddress = wp1.getAddress();
            } else {
                receiverAddress = wp.getAddress();
            }
        });

        it("throws if not enough gas", async () => {
            await expect(
                cta.create({
                    fromChain: "fuse",
                    tokenOwner: receiverAddress,
                    symbol: "TT",
                    name: "Test Token",
                })
            ).rejects.toThrow("Token creation failed:");
        });

        it("creates token", async () => {
            if (wp1) {
                const tx = await cta1.create({
                    fromChain: "fuse",
                    tokenOwner: receiverAddress,
                    symbol: "TTT",
                    name: "Toto Token Test",
                });

                expect(tx).toBeDefined();
                expect(tx.from).toEqual(wp1.getAddress());
                expect(tx.to).toEqual(factoryAddress);
                expect(tx.value).toEqual(0n);
            }
        });
    });
});

const prepareChains = () => {
    const customChains: Record<string, Chain> = {};
    const chainNames = ["fuse"];
    chainNames.forEach(
        (chain) =>
            (customChains[chain] = WalletProvider.genChainFromName(chain))
    );

    return customChains;
};
