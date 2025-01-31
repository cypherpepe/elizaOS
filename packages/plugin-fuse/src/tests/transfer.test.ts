import { describe, it, expect, beforeEach } from "vitest";
import { generatePrivateKey } from "viem/accounts";
import { Chain } from "viem";
import { TransferAction } from "../actions/transfer";
import { WalletProvider } from "../providers/wallet";

describe("Transfer Action", () => {
    let wp: WalletProvider;

    beforeEach(async () => {
        const pk = generatePrivateKey();
        const customChains = prepareChains();
        wp = new WalletProvider(pk, customChains);
    });
    describe("Constructor", () => {
        it("should initialize with wallet provider", () => {
            const ta = new TransferAction(wp);

            expect(ta).toBeDefined();
        });
    });
    describe("Transfer", () => {
        let ta: TransferAction;
        let receiverAddress: `0x${string}`;

        beforeEach(() => {
            ta = new TransferAction(wp);
            receiverAddress = wp.getAddress();
        });

        it("throws if not enough gas", async () => {
            await expect(
                ta.transfer({
                    fromChain: "fuse",
                    toAddress: receiverAddress,
                    amount: "1",
                })
            ).rejects.toThrow(
                "Transfer failed: The total cost (gas * gas fee + value) of executing this transaction exceeds the balance of the account."
            );
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
