import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { REGISTRY_ABI, REGISTRY_ADDRESS, ETH_RPC_URL } from "@/lib/constants";

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ address: string }> }
) {
    try {
        const { address } = await params;
        const provider = new ethers.JsonRpcProvider(ETH_RPC_URL);
        const contract = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, provider);

        const p = await contract.getFullProfile(address);

        return NextResponse.json({
            totalVolume: p.totalVolume.toString(),
            txCount: Number(p.txCount),
            lastTxTimestamp: Number(p.lastTxTimestamp),
            avgTimeBetweenTxs: Number(p.avgTimeBetweenTxs),
            chainBitmap: Number(p.chainBitmap),
            uniqueChains: Number(p.uniqueChains),
            flaggedInteractions: Number(p.flaggedInteractions),
            riskScore: Number(p.riskScore),
            isFlagged: p.isFlagged,
        });
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Failed to fetch profile" },
            { status: 500 }
        );
    }
}
