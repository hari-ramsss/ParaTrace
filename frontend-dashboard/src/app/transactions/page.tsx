"use client";

import { useEffect, useState } from "react";
import { ArrowRightLeft, ArrowRight, AlertTriangle } from "lucide-react";
import Alert from "@/components/Alert";
import { getRecentTransactions, type TransactionEvent } from "@/lib/registry";
import { truncateAddress, formatVolume, getChainName } from "@/lib/utils";
import { getRiskLevel, getChainExplorerUrl, getBlockscoutTxUrl } from "@/lib/constants";
import Tooltip from "@mui/material/Tooltip";
import Link from "next/link";

export default function TransactionsPage() {
    const [transactions, setTransactions] = useState<TransactionEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [partialData, setPartialData] = useState(false);
    const [failedChunks, setFailedChunks] = useState(0);
    const [totalChunks, setTotalChunks] = useState(0);

    useEffect(() => {
        async function fetchData() {
            try {
                const result = await getRecentTransactions(50);

                if (result.metadata.isPartial) {
                    setPartialData(true);
                    setFailedChunks(result.metadata.failedChunks);
                    setTotalChunks(result.metadata.totalChunks);
                }

                setTransactions(result.events);
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

    const handleRetry = () => {
        setError(null);
        setPartialData(false);
        setLoading(true);
        window.location.reload();
    };

    return (
        <div className="max-w-6xl mx-auto px-6 py-10 animate-fade-in">
            {/* Header */}
            <div className="mb-8 flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10">
                    <ArrowRightLeft className="w-6 h-6 text-primary" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Transaction Feed</h1>
                    <p className="text-muted">Recent XCM transfers recorded on-chain</p>
                </div>
            </div>

            {error && !transactions.length && (
                <Alert
                    variant="error"
                    title="Connection Error"
                    message="Unable to fetch transaction data. Please check your connection."
                    icon={<AlertTriangle className="w-5 h-5" />}
                    action={{
                        label: "Retry",
                        onClick: handleRetry
                    }}
                />
            )}

            {partialData && transactions.length > 0 && (
                <Alert
                    variant="warning"
                    title="Partial Data Loaded"
                    message={`Some transaction data could not be loaded (${failedChunks} of ${totalChunks} chunks failed). Showing ${transactions.length} transactions from available blocks.`}
                    icon={<AlertTriangle className="w-5 h-5" />}
                    action={{
                        label: "Retry",
                        onClick: handleRetry
                    }}
                />
            )}

            {/* Table */}
            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
                {loading ? (
                    <div className="p-6 space-y-3">
                        {[...Array(8)].map((_, i) => (
                            <div key={i} className="h-12 bg-secondary rounded-xl animate-pulse" />
                        ))}
                    </div>
                ) : transactions.length === 0 ? (
                    <div className="p-16 text-center text-muted">
                        <ArrowRightLeft className="w-12 h-12 mx-auto mb-4 opacity-30" />
                        <p>No transactions recorded yet</p>
                        <p className="text-sm mt-1">Transactions will appear here once the indexer records XCM transfers</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-border bg-background">
                                    <th className="text-left px-6 py-4 text-xs text-muted font-medium uppercase tracking-wider">Wallet</th>
                                    <th className="text-center px-6 py-4 text-xs text-muted font-medium uppercase tracking-wider">Route</th>
                                    <th className="text-right px-6 py-4 text-xs text-muted font-medium uppercase tracking-wider">Amount</th>
                                    <th className="text-center px-6 py-4 text-xs text-muted font-medium uppercase tracking-wider">Score</th>
                                    <th className="text-right px-6 py-4 text-xs text-muted font-medium uppercase tracking-wider">Block</th>
                                    <th className="text-center px-6 py-4 text-xs text-muted font-medium uppercase tracking-wider">Tx Proof</th>
                                </tr>
                            </thead>
                            <tbody>
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
                                            followCursor
                                        >
                                            <tr
                                                className="border-b border-border hover:bg-secondary transition-colors cursor-default"
                                            >
                                                <td className="px-6 py-4">
                                                    <Link href={`/wallet?address=${tx.wallet}`} className="hover:text-primary transition-colors hover:underline break-all">
                                                        {tx.wallet}
                                                    </Link>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center justify-center gap-2 text-sm">
                                                        <span className="text-foreground">{sourceName}</span>
                                                        <ArrowRight className="w-3 h-3 text-muted" />
                                                        <span className="text-foreground">{destName}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right text-sm text-foreground font-medium">
                                                    {formatVolume(tx.amount)} WND
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
                                                <td className="px-6 py-4 text-right text-sm font-mono">
                                                    <a
                                                        href={`${sourceExplorer}/block/${tx.blockNumber}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-muted hover:text-primary hover:underline transition-colors"
                                                    >
                                                        #{tx.blockNumber}
                                                    </a>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <a
                                                        href={getBlockscoutTxUrl(tx.transactionHash)}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-xs text-primary hover:underline font-medium"
                                                    >
                                                        View ↗
                                                    </a>
                                                </td>
                                            </tr>
                                        </Tooltip>
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
