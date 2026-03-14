"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Search, ArrowRight, ArrowDownUp } from "lucide-react";
import RiskGauge from "@/components/RiskGauge";
import WalletRiskRadar from "@/components/WalletRiskRadar";
import { getFullProfile, getRecentTransactions, type WalletProfile, type TransactionEvent } from "@/lib/registry";
import { formatVolume, formatTimestamp, formatDuration, getChainName } from "@/lib/utils";
import { getRiskLevel } from "@/lib/constants";

export default function WalletLookupContent() {
    const searchParams = useSearchParams();
    const [address, setAddress] = useState("");
    const [profile, setProfile] = useState<WalletProfile | null>(null);
    const [walletTxs, setWalletTxs] = useState<TransactionEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searched, setSearched] = useState(false);

    const doSearch = useCallback(async (addr: string) => {
        if (!addr.trim()) return;

        setLoading(true);
        setError(null);
        setSearched(true);
        setAddress(addr);

        try {
            const [data, allTxs] = await Promise.all([
                getFullProfile(addr.trim()),
                getRecentTransactions(50),
            ]);
            setProfile(data);

            // Filter transactions for this wallet
            const filtered = allTxs.filter(
                (tx) => tx.wallet.toLowerCase() === addr.trim().toLowerCase()
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
                <h1 className="text-3xl font-bold text-white mb-2">Wallet Lookup</h1>
                <p className="text-gray-400">Enter any EVM address to view its full risk profile</p>
            </div>

            {/* Search */}
            <form onSubmit={handleSearch} className="mb-10">
                <div className="flex gap-3">
                    <div className="flex-1 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                        <input
                            type="text"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder="0x... (EVM H160 address)"
                            className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all font-mono text-sm"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading ? "Loading..." : <>Lookup <ArrowRight className="w-4 h-4" /></>}
                    </button>
                </div>
            </form>

            {/* Error */}
            {error && (
                <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* Results */}
            {profile && searched && !loading && (
                <div className="space-y-6">
                    {/* Risk Score Hero & Radar */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 rounded-2xl border border-white/5 bg-[#12121a] p-8 flex flex-col sm:flex-row items-center gap-8 shadow-inner">
                            <RiskGauge score={profile.riskScore} size="lg" />
                            <div className="flex-1 space-y-3">
                                <div>
                                    <p className="text-sm text-gray-400 mb-1">Address</p>
                                    <p className="text-white font-mono text-xs break-all opacity-80">{address}</p>
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
                        <InfoCard label="Total Volume" value={`${formatVolume(profile.totalVolume)} PAS`} />
                        <InfoCard label="Transaction Count" value={profile.txCount.toString()} />
                        <InfoCard label="Avg Time Between Txs" value={formatDuration(profile.avgTimeBetweenTxs)} />
                        <InfoCard label="Unique Chains" value={profile.uniqueChains.toString()} />
                        <InfoCard label="Flagged Interactions" value={profile.flaggedInteractions.toString()} />
                        <InfoCard label="Last Transaction" value={formatTimestamp(profile.lastTxTimestamp)} />
                    </div>

                    {/* Active Chains */}
                    {profile.chainBitmap > 0 && (
                        <div className="rounded-2xl border border-white/5 bg-[#12121a] p-6">
                            <h3 className="text-sm font-medium text-gray-400 mb-3">Active Chains</h3>
                            <div className="flex flex-wrap gap-2">
                                {getActiveChains(profile.chainBitmap).map((chain) => (
                                    <span
                                        key={chain}
                                        className="px-3 py-1 rounded-full bg-violet-500/10 text-violet-400 text-xs font-medium border border-violet-500/10"
                                    >
                                        {chain}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Transaction History */}
                    <div className="rounded-2xl border border-white/5 bg-[#12121a] p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <ArrowDownUp className="w-4 h-4 text-gray-400" />
                            <h3 className="text-lg font-semibold text-white">Transaction History</h3>
                        </div>
                        {walletTxs.length === 0 ? (
                            <p className="text-gray-500 text-sm text-center py-6">
                                No transaction events found for this wallet
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {walletTxs.map((tx, i) => {
                                    const level = getRiskLevel(tx.newScore);
                                    return (
                                        <div
                                            key={`${tx.transactionHash}-${i}`}
                                            className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="w-2 h-2 rounded-full shrink-0"
                                                    style={{ backgroundColor: level.color }}
                                                />
                                                <div>
                                                    <p className="text-sm text-gray-300">
                                                        {getChainName(tx.sourceChain)} → {getChainName(tx.destChain)}
                                                    </p>
                                                    <p className="text-xs text-gray-600 font-mono">
                                                        Block #{tx.blockNumber}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm text-white font-medium">
                                                    {formatVolume(tx.amount)} PAS
                                                </p>
                                                <p className="text-xs" style={{ color: level.color }}>
                                                    Score: {tx.newScore}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Empty state */}
            {searched && !loading && !profile && !error && (
                <div className="text-center py-16 text-gray-500">
                    No data found for this address
                </div>
            )}
        </div>
    );
}

function InfoCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className="text-lg font-semibold text-white">{value}</p>
        </div>
    );
}
