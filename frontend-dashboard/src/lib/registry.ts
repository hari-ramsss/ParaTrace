import { ethers } from "ethers";
import { REGISTRY_ABI, REGISTRY_ADDRESS, ETH_RPC_URL } from "./constants";

// Singleton read-only provider and contract instance
let _provider: ethers.JsonRpcProvider | null = null;
let _contract: ethers.Contract | null = null;

function getProvider(): ethers.JsonRpcProvider {
    if (!_provider) {
        _provider = new ethers.JsonRpcProvider(ETH_RPC_URL);
    }
    return _provider;
}

function getContract(): ethers.Contract {
    if (!_contract) {
        _contract = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, getProvider());
    }
    return _contract;
}

// ─── Types ───────────────────────────────────────────────────────────

export interface WalletProfile {
    totalVolume: bigint;
    txCount: number;
    lastTxTimestamp: number;
    avgTimeBetweenTxs: number;
    chainBitmap: number;
    uniqueChains: number;
    flaggedInteractions: number;
    riskScore: number;
    isFlagged: boolean;
}

export interface TransactionEvent {
    wallet: string;
    amount: bigint;
    sourceChain: number;
    destChain: number;
    newScore: number;
    blockNumber: number;
    transactionHash: string;
}

export interface FlaggedEvent {
    wallet: string;
    riskScore: number;
    blockNumber: number;
    transactionHash: string;
}

// ─── Read Functions ──────────────────────────────────────────────────

export async function getFullProfile(address: string): Promise<WalletProfile> {
    const contract = getContract();
    const p = await contract.getFullProfile(address);
    return {
        totalVolume: p.totalVolume,
        txCount: Number(p.txCount),
        lastTxTimestamp: Number(p.lastTxTimestamp),
        avgTimeBetweenTxs: Number(p.avgTimeBetweenTxs),
        chainBitmap: Number(p.chainBitmap),
        uniqueChains: Number(p.uniqueChains),
        flaggedInteractions: Number(p.flaggedInteractions),
        riskScore: Number(p.riskScore),
        isFlagged: p.isFlagged,
    };
}

export async function getRiskScore(address: string): Promise<number> {
    const contract = getContract();
    return Number(await contract.getRiskScore(address));
}

export async function isWalletFlagged(address: string): Promise<boolean> {
    const contract = getContract();
    return await contract.isWalletFlagged(address);
}

// ─── Event Queries ──────────────────────────────────────────────────

export async function getRecentTransactions(count: number = 20): Promise<TransactionEvent[]> {
    const contract = getContract();
    const provider = getProvider();
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 500000); // last ~500000 blocks

    const filter = contract.filters.TransactionRecorded();
    const events = await contract.queryFilter(filter, fromBlock, currentBlock);

    return events
        .slice(-count)
        .reverse()
        .map((e) => {
            const log = e as ethers.EventLog;
            return {
                wallet: log.args[0],
                amount: log.args[1],
                sourceChain: Number(log.args[2]),
                destChain: Number(log.args[3]),
                newScore: Number(log.args[4]),
                blockNumber: log.blockNumber,
                transactionHash: log.transactionHash,
            };
        });
}

export async function getFlaggedWallets(): Promise<FlaggedEvent[]> {
    const contract = getContract();
    const provider = getProvider();
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 500000);

    const filter = contract.filters.WalletFlagged();
    const events = await contract.queryFilter(filter, fromBlock, currentBlock);

    return events.reverse().map((e) => {
        const log = e as ethers.EventLog;
        return {
            wallet: log.args[0],
            riskScore: Number(log.args[1]),
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
        };
    });
}

export async function getDashboardStats() {
    const contract = getContract();
    const provider = getProvider();
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 500000);

    const [txEvents, flagEvents] = await Promise.all([
        contract.queryFilter(contract.filters.TransactionRecorded(), fromBlock, currentBlock),
        contract.queryFilter(contract.filters.WalletFlagged(), fromBlock, currentBlock),
    ]);

    // Count unique wallets
    const uniqueWallets = new Set(
        txEvents.map((e) => (e as ethers.EventLog).args[0])
    );

    // Count unique flagged wallets
    const flaggedWallets = new Set(
        flagEvents.map((e) => (e as ethers.EventLog).args[0])
    );

    // Map all events to TransactionEvent objects
    const mapEvent = (e: ethers.Log) => {
        const log = e as ethers.EventLog;
        return {
            wallet: log.args[0],
            amount: log.args[1],
            sourceChain: Number(log.args[2]),
            destChain: Number(log.args[3]),
            newScore: Number(log.args[4]),
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
        };
    };

    const allTransactions = txEvents.map(mapEvent);

    // Create a safe copy before reversing to prevent in-place mutation bugs
    const reversedTx = [...allTransactions].reverse();

    return {
        totalTransactions: txEvents.length,
        totalWallets: uniqueWallets.size,
        flaggedCount: flaggedWallets.size,
        recentTransactions: reversedTx.slice(0, 5),
        allTransactions: reversedTx,
    };
}
