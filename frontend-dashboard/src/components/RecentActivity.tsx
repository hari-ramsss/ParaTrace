"use client";

import { truncateAddress, formatVolume, getChainName } from "@/lib/utils";
import { getRiskLevel } from "@/lib/constants";
import type { TransactionEvent } from "@/lib/registry";

interface RecentActivityProps {
    transactions: TransactionEvent[];
    loading?: boolean;
}

export default function RecentActivity({ transactions, loading }: RecentActivityProps) {
    if (loading) {
        return (
            <div className="rounded-2xl border border-border bg-card p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Recent Activity</h3>
                <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-14 bg-foreground/5 rounded-xl animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="text-xl font-bold text-foreground mb-4 font-serif">Recent Activity</h3>
            {transactions.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">No transactions recorded yet</p>
            ) : (
                <div className="space-y-2">
                    {transactions.map((tx, i) => {
                        const level = getRiskLevel(tx.newScore);
                        return (
                            <div
                                key={`${tx.transactionHash}-${i}`}
                                className="flex items-center justify-between p-3 rounded-xl hover:bg-foreground/5 transition-colors border border-transparent hover:border-border"
                            >
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-2 h-2 rounded-full"
                                        style={{ backgroundColor: level.color }}
                                    />
                                    <div>
                                        <p className="text-sm font-mono text-foreground break-all">
                                            {tx.wallet}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {getChainName(tx.sourceChain)} → {getChainName(tx.destChain)}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-foreground font-medium font-dm-sans">
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
    );
}
