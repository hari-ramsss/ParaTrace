"use client";

import { truncateAddress, formatVolume, getChainName } from "@/lib/utils";
import { getRiskLevel, getChainExplorerUrl, getBlockscoutTxUrl } from "@/lib/constants";
import Tooltip from "@mui/material/Tooltip";
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
                <p className="text-muted text-sm text-center py-8">No transactions recorded yet</p>
            ) : (
                <div className="space-y-2">
                    {transactions.map((tx, i) => {
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
                                    className="flex items-center justify-between p-3 rounded-xl hover:bg-foreground/5 transition-colors border border-transparent hover:border-border cursor-default"
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
                                            <p className="text-xs text-muted">
                                                {sourceName} → {destName}
                                            </p>
                                            <a
                                                href={`${sourceExplorer}/block/${tx.blockNumber}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-[10px] text-muted hover:text-primary hover:underline transition-colors"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                Block #{tx.blockNumber}
                                            </a>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm text-foreground font-medium font-dm-sans">
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
    );
}
