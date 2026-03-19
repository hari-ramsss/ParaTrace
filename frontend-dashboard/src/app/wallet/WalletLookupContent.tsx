"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Search, ArrowRight, History, AlertTriangle } from "lucide-react";
import Alert from "@/components/Alert";
import RiskGauge from "@/components/RiskGauge";
import WalletRiskRadar from "@/components/WalletRiskRadar";
import { getFullProfile, getRecentTransactions, type WalletProfile, type TransactionEvent } from "@/lib/registry";
import { formatVolume, formatTimestamp, formatDuration, getChainName } from "@/lib/utils";
import { getRiskLevel, getChainExplorerUrl, getBlockscoutTxUrl } from "@/lib/constants";
import Tooltip from "@mui/material/Tooltip";

const ChainConnectionGraph = dynamic(() => import("@/components/ChainConnectionGraph"), {
    ssr: false,
    loading: () => <div className="h-[400px] w-full animate-pulse bg-card rounded-2xl border border-border mt-6 flex items-center justify-center text-muted text-sm">Loading Interaction Graph...</div>
});

export default function WalletLookupContent() {
    const searchParams = useSearchParams();
    const [address, setAddress] = useState("");
    const [profile, setProfile] = useState<WalletProfile | null>(null);
    const [walletTxs, setWalletTxs] = useState<TransactionEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searched, setSearched] = useState(false);
    const [partialData, setPartialData] = useState(false);
    const [failedChunks, setFailedChunks] = useState(0);
    const [totalChunks, setTotalChunks] = useState(0);

    const doSearch = useCallback(async (addr: string) => {
        if (!addr.trim()) return;

        setLoading(true);
        setError(null);
        setSearched(true);
        setAddress(addr);
        setPartialData(false);

        try {
            // Explicitly type the results to avoid inference issues with Promise.all
            const [profileData, txResult]: [WalletProfile, { events: TransactionEvent[]; metadata: any }] = await Promise.all([
                getFullProfile(addr.trim()),
                getRecentTransactions(50),
            ]);

            if (txResult.metadata?.isPartial) {
                setPartialData(true);
                setFailedChunks(txResult.metadata.failedChunks);
                setTotalChunks(txResult.metadata.totalChunks);
            }

            setProfile(profileData);

            // Filter transactions for this wallet
            const filtered = txResult.events.filter(
                (tx: TransactionEvent) => tx.wallet.toLowerCase() === addr.trim().toLowerCase()
            );
            setWalletTxs(filtered);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to fetch profile");
            setProfile(null);
            setWalletTxs([]);
        } finally {
            setLoading(false);
        }
    }, []);

    // Auto-search if ?address= query param exists (from flagged/transactions page links)
    useEffect(() => {
        const paramAddr = searchParams.get("address");
        if (paramAddr) {
            doSearch(paramAddr);
        }
    }, [searchParams, doSearch]);

    async function handleSearch(e: React.FormEvent) {
        e.preventDefault();
        doSearch(address);
    }

    // Decode chain bitmap to list of active chains
    function getActiveChains(bitmap: number): string[] {
        const chains: string[] = [];
        for (let i = 0; i < 16; i++) {
            if (bitmap & (1 << i)) {
                chains.push(getChainName(i));
            }
        }
        return chains;
    }

    return (
        <div className="max-w-4xl mx-auto px-6 py-10 animate-fade-in">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-foreground mb-2">Wallet Lookup</h1>
                <p className="text-muted">Enter any EVM address to view its full risk profile</p>
            </div>

            {/* Search */}
            <form onSubmit={handleSearch} className="mb-10">
                <div className="flex gap-3">
                    <div className="flex-1 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
                        <input
                            type="text"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder="0x... (EVM H160 address)"
                            className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-background border border-border text-foreground placeholder:-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all font-mono text-sm"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-8 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2 shadow-lg"
                    >
                        {loading ? "Loading..." : <>Lookup <ArrowRight className="w-4 h-4" /></>}
                    </button>
                </div>
            </form>

            {/* Error */}
            {error && (
                <Alert
                    variant="error"
                    title="Error"
                    message={error}
                    icon={<AlertTriangle className="w-5 h-5" />}
                />
            )}

            {/* Partial Data Warning */}
            {partialData && profile && (
                <Alert
                    variant="warning"
                    title="Partial Data Loaded"
                    message={`Some transaction history could not be loaded (${failedChunks} of ${totalChunks} chunks failed). Transaction history may be incomplete.`}
                    icon={<AlertTriangle className="w-5 h-5" />}
                />
            )}

            {/* Results */}
            {profile && searched && !loading && (
                <div className="space-y-6">
                    {/* Risk Score Hero & Radar */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-8 flex flex-col sm:flex-row items-center gap-8 shadow-sm">
                            <RiskGauge score={profile.riskScore} size="lg" />
                            <div className="flex-1 space-y-3">
                                <div>
                                    <p className="text-sm text-muted mb-1">Address</p>
                                    <p className="text-foreground font-mono text-xs break-all opacity-80">{address}</p>
                                </div>
                                <div className="flex gap-4">
                                    <div
                                        className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wider ${profile.isFlagged
                                            ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                            : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                            }`}
                                    >
                                        {profile.isFlagged ? "🚨 FLAGGED" : "✅ CLEAR"}
                                    </div>
                                    <div
                                        className="px-3 py-1 rounded-full text-[10px] font-bold tracking-wider border"
                                        style={{
                                            color: getRiskLevel(profile.riskScore).color,
                                            borderColor: `${getRiskLevel(profile.riskScore).color}33`,
                                            background: `${getRiskLevel(profile.riskScore).color}11`,
                                        }}
                                    >
                                        {getRiskLevel(profile.riskScore).label} RISK
                                    </div>
                                </div>
                            </div>
                        </div>
                        <WalletRiskRadar profile={profile} />
                    </div>

                    {/* Behavioral Breakdown */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <InfoCard label="Total Volume" value={`${formatVolume(profile.totalVolume)} WND`} />
                        <InfoCard label="Transaction Count" value={profile.txCount.toString()} />
                        <InfoCard label="Avg Time Between Txs" value={formatDuration(profile.avgTimeBetweenTxs)} />
                        <InfoCard label="Unique Chains" value={profile.uniqueChains.toString()} />
                        <InfoCard label="Flagged Interactions" value={profile.flaggedInteractions.toString()} />
                        <InfoCard label="Last Transaction" value={formatTimestamp(profile.lastTxTimestamp)} />
                    </div>

                    {/* Chain Interaction Graph */}
                    <ChainConnectionGraph
                        walletAddress={address}
                        transactions={walletTxs}
                    />

                    {/* Active Chains */}
                    {profile.chainBitmap > 0 && (
                        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                            <h3 className="text-sm font-medium text-muted mb-3">Active Chains</h3>
                            <div className="flex flex-wrap gap-2">
                                {getActiveChains(profile.chainBitmap).map((chain) => (
                                    <span
                                        key={chain}
                                        className="px-3 py-1 rounded-full bg-secondary text-foreground text-xs font-medium border border-border"
                                    >
                                        {chain}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Transaction History */}
                    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <History className="w-4 h-4 text-muted" />
                            <h3 className="text-lg font-semibold text-foreground">Transaction History</h3>
                        </div>
                        {walletTxs.length === 0 ? (
                            <p className="text-muted text-sm text-center py-6">
                                No transaction events found for this wallet
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {walletTxs.map((tx, i) => {
                                    const level = getRiskLevel(tx.newScore);
                                    const sourceName = getChainName(tx.sourceChain);
                                    const destName = getChainName(tx.destChain);
                                    const sourceExplorer = getChainExplorerUrl(tx.sourceChain);
                                    const destExplorer = getChainExplorerUrl(tx.destChain);
                                    return (
                                        <Tooltip
                                            key={`${tx.transactionHash}-${i}`}
                                            title={
                                                <span>
                                                    To view on Subscan, search by block number:<br />
                                                    • {sourceName}: {new URL(sourceExplorer).hostname}<br />
                                                    • {destName}: {new URL(destExplorer).hostname}<br />
                                                    <em>(EVM addresses cannot be searched on Subscan)</em>
                                                </span>
                                            }
                                            arrow
                                            placement="top"
                                        >
                                            <div
                                                className="flex items-center justify-between p-3 rounded-xl bg-background hover:bg-secondary transition-colors border border-transparent hover:border-border cursor-default"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className="w-2 h-2 rounded-full shrink-0"
                                                        style={{ backgroundColor: level.color }}
                                                    />
                                                    <div>
                                                        <p className="text-sm text-foreground">
                                                            {sourceName} → {destName}
                                                        </p>
                                                        <a
                                                            href={`${sourceExplorer}/block/${tx.blockNumber}`}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="text-xs text-muted font-mono hover:text-primary hover:underline transition-colors"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            Block #{tx.blockNumber}
                                                        </a>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm text-foreground font-medium">
                                                        {formatVolume(tx.amount)} WND
                                                    </p>
                                                    <p className="text-xs" style={{ color: level.color }}>
                                                        Score: {tx.newScore}
                                                    </p>
                                                    <a
                                                        href={getBlockscoutTxUrl(tx.transactionHash)}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-[10px] text-primary hover:underline opacity-70 hover:opacity-100 transition-opacity"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        View Tx ↗
                                                    </a>
                                                </div>
                                            </div>
                                        </Tooltip>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Empty state */}
            {searched && !loading && !profile && !error && (
                <div className="text-center py-16 text-muted">
                    No data found for this address
                </div>
            )}
        </div>
    );
}

function InfoCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border border-border bg-card shadow-sm p-4">
            <p className="text-xs text-muted mb-1">{label}</p>
            <p className="text-lg font-semibold text-foreground">{value}</p>
        </div>
    );
}
