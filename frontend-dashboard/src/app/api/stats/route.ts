import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { REGISTRY_ABI, REGISTRY_ADDRESS, ETH_RPC_URL } from "@/lib/constants";

export async function GET() {
    try {
        const provider = new ethers.JsonRpcProvider(ETH_RPC_URL);
        const contract = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, provider);
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 50000);

        const [txEvents, flagEvents] = await Promise.all([
            contract.queryFilter(contract.filters.TransactionRecorded(), fromBlock, currentBlock),
            contract.queryFilter(contract.filters.WalletFlagged(), fromBlock, currentBlock),
        ]);

        const uniqueWallets = new Set(txEvents.map((e) => (e as ethers.EventLog).args[0]));
        const flaggedWallets = new Set(flagEvents.map((e) => (e as ethers.EventLog).args[0]));

        return NextResponse.json({
            totalTransactions: txEvents.length,
            totalWallets: uniqueWallets.size,
            flaggedCount: flaggedWallets.size,
            currentBlock,
        });
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Failed to fetch stats" },
            { status: 500 }
        );
    }
}
