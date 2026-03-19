"use client";

import { useEffect, useState } from "react";
import { Wifi, WifiOff, Clock } from "lucide-react";

interface NetworkStatusProps {
    rpcUrl: string;
}

export default function NetworkStatus({ rpcUrl }: NetworkStatusProps) {
    const [status, setStatus] = useState<"connected" | "disconnected" | "checking">("checking");
    const [blockNumber, setBlockNumber] = useState<number | null>(null);
    const [lastChecked, setLastChecked] = useState<string>("");

    useEffect(() => {
        async function checkStatus() {
            try {
                const res = await fetch(rpcUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        jsonrpc: "2.0",
                        method: "eth_blockNumber",
                        params: [],
                        id: 1,
                    }),
                });
                const data = await res.json();
                if (data.result) {
                    setBlockNumber(parseInt(data.result, 16));
                    setStatus("connected");
                } else {
                    setStatus("disconnected");
                }
            } catch {
                setStatus("disconnected");
            }
            setLastChecked(new Date().toLocaleTimeString());
        }

        checkStatus();
        const interval = setInterval(checkStatus, 60000); // check every minute
        return () => clearInterval(interval);
    }, [rpcUrl]);

    return (
        <footer className="fixed bottom-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-xl border-t border-border">
            <div className="max-w-7xl mx-auto px-6 h-10 flex items-center justify-between text-xs text-muted">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                        {status === "connected" ? (
                            <Wifi className="w-3 h-3 text-emerald-400" />
                        ) : status === "disconnected" ? (
                            <WifiOff className="w-3 h-3 text-red-400" />
                        ) : (
                            <div className="w-3 h-3 rounded-full bg-amber-400 animate-pulse" />
                        )}
                        <span
                            className={
                                status === "connected"
                                    ? "text-emerald-400"
                                    : status === "disconnected"
                                        ? "text-red-400"
                                        : "text-amber-400"
                            }
                        >
                            {status === "connected" ? "Connected" : status === "disconnected" ? "Disconnected" : "Checking..."}
                        </span>
                    </div>
                    {blockNumber !== null && (
                        <span>Block #{blockNumber.toLocaleString()}</span>
                    )}
                </div>

                <div className="flex items-center gap-4">
                    <span>Polkadot Hub Testnet</span>
                    {lastChecked && (
                        <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {lastChecked}
                        </span>
                    )}
                </div>
            </div>
        </footer>
    );
}
