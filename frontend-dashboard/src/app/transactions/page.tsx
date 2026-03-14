"use client";

import { useEffect, useState } from "react";
import { Activity, ArrowRight } from "lucide-react";
import { getRecentTransactions, type TransactionEvent } from "@/lib/registry";
import { truncateAddress, formatVolume, getChainName } from "@/lib/utils";
import { getRiskLevel } from "@/lib/constants";
import Link from "next/link";

export default function TransactionsPage() {
    const [transactions, setTransactions] = useState<TransactionEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchData() {
            try {
                const data = await getRecentTransactions(50);
                setTransactions(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to fetch");
            } finally {
                setLoading(false);
            }
        }
        fetchData();

        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="max-w-6xl mx-auto px-6 py-10 animate-fade-in">
            {/* Header */}
            <div className="mb-8 flex items-center gap-3">
                <div className="p-2 rounded-xl bg-violet-500/10">
                    <Activity className="w-6 h-6 text-violet-400" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-white">Transaction Feed</h1>
                    <p className="text-gray-400">Recent XCM transfers recorded on-chain</p>
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* Table */}
            <div className="rounded-2xl border border-white/5 bg-[#12121a] overflow-hidden">
                {loading ? (
                    <div className="p-6 space-y-3">
                        {[...Array(8)].map((_, i) => (
                            <div key={i} className="h-12 bg-white/5 rounded-xl animate-pulse" />
                        ))}
                    </div>
                ) : transactions.length === 0 ? (
                    <div className="p-16 text-center text-gray-500">
                        <Activity className="w-12 h-12 mx-auto mb-4 opacity-30" />
                        <p>No transactions recorded yet</p>
                        <p className="text-sm mt-1">Transactions will appear here once the indexer records XCM transfers</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-white/5">
                                    <th className="text-left px-6 py-4 text-xs text-gray-500 font-medium uppercase tracking-wider">Wallet</th>
                                    <th className="text-center px-6 py-4 text-xs text-gray-500 font-medium uppercase tracking-wider">Route</th>
                                    <th className="text-right px-6 py-4 text-xs text-gray-500 font-medium uppercase tracking-wider">Amount</th>
                                    <th className="text-center px-6 py-4 text-xs text-gray-500 font-medium uppercase tracking-wider">Score</th>
                                    <th className="text-right px-6 py-4 text-xs text-gray-500 font-medium uppercase tracking-wider">Block</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.map((tx, i) => {
                                    const level = getRiskLevel(tx.newScore);
                                    return (
                                        <tr
                                            key={`${tx.transactionHash}-${i}`}
                                            className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                                        >
                                            <td className="px-6 py-4">
                                                <Link
                                                    href={`/wallet?address=${tx.wallet}`}
                                                    className="font-mono text-sm text-violet-400 hover:text-violet-300 transition-colors"
                                                >
                                                    {truncateAddress(tx.wallet, 6)}
                                                </Link>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-center gap-2 text-sm">
                                                    <span className="text-gray-300">{getChainName(tx.sourceChain)}</span>
                                                    <ArrowRight className="w-3 h-3 text-gray-600" />
                                                    <span className="text-gray-300">{getChainName(tx.destChain)}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right text-sm text-white font-medium">
                                                {formatVolume(tx.amount)} PAS
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span
                                                    className="inline-block px-3 py-1 rounded-full text-xs font-bold"
                                                    style={{
                                                        color: level.color,
                                                        background: `${level.color}15`,
                                                    }}
                                                >
                                                    {tx.newScore}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right text-sm text-gray-500 font-mono">
                                                #{tx.blockNumber}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
