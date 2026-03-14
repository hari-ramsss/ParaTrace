"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { getFlaggedWallets, type FlaggedEvent } from "@/lib/registry";
import { truncateAddress } from "@/lib/utils";
import { getRiskLevel } from "@/lib/constants";
import Link from "next/link";

export default function FlaggedWalletsPage() {
    const [flagged, setFlagged] = useState<FlaggedEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchData() {
            try {
                const data = await getFlaggedWallets();
                setFlagged(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to fetch");
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    return (
        <div className="max-w-5xl mx-auto px-6 py-10 animate-fade-in">
            {/* Header */}
            <div className="mb-8 flex items-center gap-3">
                <div className="p-2 rounded-xl bg-red-500/10">
                    <AlertTriangle className="w-6 h-6 text-red-400" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-white">Flagged Wallets</h1>
                    <p className="text-gray-400">Wallets that exceeded the risk threshold</p>
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
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="h-12 bg-white/5 rounded-xl animate-pulse" />
                        ))}
                    </div>
                ) : flagged.length === 0 ? (
                    <div className="p-16 text-center text-gray-500">
                        <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-30" />
                        <p>No flagged wallets found</p>
                        <p className="text-sm mt-1">Wallets are flagged when their risk score exceeds the threshold</p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-white/5">
                                <th className="text-left px-6 py-4 text-xs text-gray-500 font-medium uppercase tracking-wider">Wallet</th>
                                <th className="text-center px-6 py-4 text-xs text-gray-500 font-medium uppercase tracking-wider">Risk Score</th>
                                <th className="text-right px-6 py-4 text-xs text-gray-500 font-medium uppercase tracking-wider">Block</th>
                            </tr>
                        </thead>
                        <tbody>
                            {flagged.map((f, i) => {
                                const level = getRiskLevel(f.riskScore);
                                return (
                                    <tr
                                        key={`${f.transactionHash}-${i}`}
                                        className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                                    >
                                        <td className="px-6 py-4">
                                            <Link
                                                href={`/wallet?address=${f.wallet}`}
                                                className="font-mono text-sm text-violet-400 hover:text-violet-300 transition-colors"
                                            >
                                                {truncateAddress(f.wallet, 8)}
                                            </Link>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span
                                                className="inline-block px-3 py-1 rounded-full text-xs font-bold"
                                                style={{
                                                    color: level.color,
                                                    background: `${level.color}15`,
                                                }}
                                            >
                                                {f.riskScore}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right text-sm text-gray-500 font-mono">
                                            #{f.blockNumber}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
