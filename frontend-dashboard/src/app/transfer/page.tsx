"use client";

import { useState } from "react";
import { ArrowRight, Wallet, Activity, ArrowDown } from "lucide-react";
import { usePolkadotWallet } from "@/hooks/usePolkadotWallet";

// Dynamic import for Polkadot API to avoid SSR issues
let ApiPromise: any;
let WsProvider: any;

export default function TransferPage() {
    const { connectWallet, logout, accounts, selectedAccount, setSelectedAccount, isConnecting, error: walletError } = usePolkadotWallet();

    const [amount, setAmount] = useState("1");
    const [direction, setDirection] = useState<"RelayToAssetHub" | "AssetHubToRelay">("RelayToAssetHub");
    const [status, setStatus] = useState<"idle" | "connecting" | "signing" | "broadcasting" | "success" | "error">("idle");
    const [txHash, setTxHash] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleTransfer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedAccount) return;

        setStatus("connecting");
        setErrorMessage(null);
        setTxHash(null);

        try {
            if (!ApiPromise) {
                const polkadotApi = await import("@polkadot/api");
                ApiPromise = polkadotApi.ApiPromise;
                WsProvider = polkadotApi.WsProvider;
            }

            // 1. Connect to the correct source chain RPC
            const rpcUrl = direction === "RelayToAssetHub"
                ? "wss://westend-rpc.polkadot.io"
                : "wss://westend-asset-hub-rpc.polkadot.io";

            const provider = new WsProvider(rpcUrl);
            const api = await ApiPromise.create({ provider });

            setStatus("signing");

            // 2. Build XCM V3 Teleport parameters based on direction
            let dest, beneficiary, assets, tx;
            const plancks = BigInt(parseFloat(amount) * 1e12).toString();

            if (direction === "RelayToAssetHub") {
                dest = { V3: { parents: 0, interior: { X1: { Parachain: 1000 } } } };
                beneficiary = {
                    V3: {
                        parents: 0,
                        interior: {
                            X1: {
                                AccountId32: { id: api.createType("AccountId32", selectedAccount.address).toHex(), network: null }
                            }
                        }
                    }
                };
                assets = {
                    V3: [{ id: { Concrete: { parents: 0, interior: "Here" } }, fun: { Fungible: plancks } }]
                };
                tx = api.tx.xcmPallet.teleportAssets(dest, beneficiary, assets, 0);

            } else {
                // Asset Hub -> Relay Chain
                dest = { V3: { parents: 1, interior: "Here" } };
                beneficiary = {
                    V3: {
                        parents: 0,
                        interior: {
                            X1: {
                                AccountId32: { id: api.createType("AccountId32", selectedAccount.address).toHex(), network: null }
                            }
                        }
                    }
                };
                assets = {
                    V3: [{ id: { Concrete: { parents: 1, interior: "Here" } }, fun: { Fungible: plancks } }]
                };
                tx = api.tx.polkadotXcm.teleportAssets(dest, beneficiary, assets, 0);
            }

            const { web3FromAddress } = await import("@polkadot/extension-dapp");
            const injector = await web3FromAddress(selectedAccount.address);

            setStatus("broadcasting");

            const hash = await new Promise<string>((resolve, reject) => {
                tx.signAndSend(selectedAccount.address, { signer: injector.signer }, ({ status, events, dispatchError }: any) => {
                    if (dispatchError) {
                        if (dispatchError.isModule) {
                            const decoded = api.registry.findMetaError(dispatchError.asModule);
                            reject(new Error(`${decoded.section}.${decoded.name}: ${decoded.docs.join(" ")}`));
                        } else {
                            reject(new Error(dispatchError.toString()));
                        }
                    } else if (status.isInBlock || status.isFinalized) {
                        resolve(status.isInBlock ? status.asInBlock.toHex() : status.asFinalized.toHex());
                    }
                }).catch(reject);
            });

            setTxHash(hash);
            setStatus("success");

        } catch (err) {
            console.error("XCM Transfer failed:", err);
            setErrorMessage(err instanceof Error ? err.message : "Transaction failed");
            setStatus("error");
        }
    };

    return (
        <div className="max-w-2xl mx-auto px-6 py-10 animate-fade-in">
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold text-foreground mb-2">Live XCM Transfer Demo</h1>
                <p className="text-muted">
                    Send WND across chains. The ParaTrace indexer will detect this live and update the dashboard automatically.
                </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-8 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1/2 bg-primary/10 blur-[100px] pointer-events-none" />

                {!selectedAccount ? (
                    <div className="text-center py-8">
                        <Wallet className="w-12 h-12 text-primary mx-auto mb-4 opacity-80" />
                        <h3 className="text-lg font-medium text-foreground mb-2">Connect Polkadot Wallet</h3>
                        <p className="text-sm text-muted mb-6">Connect Talisman or Polkadot.js to initiate a live cross-chain transfer.</p>

                        <button
                            onClick={connectWallet}
                            disabled={isConnecting}
                            className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-colors disabled:opacity-50"
                        >
                            {isConnecting ? "Connecting..." : "Connect Extension"}
                        </button>

                        {walletError && <p className="mt-4 text-sm text-red-400">{walletError}</p>}
                    </div>
                ) : (
                    <form onSubmit={handleTransfer} className="space-y-6 relative z-10">
                        <div className="flex items-center justify-between p-4 rounded-xl bg-background border border-border">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                                    <Wallet className="w-4 h-4 text-primary-foreground" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-foreground">{selectedAccount.meta.name || "Connected Account"}</p>
                                    <p className="text-xs text-muted font-mono truncate w-40 sm:w-64">{selectedAccount.address}</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={logout}
                                className="text-xs text-muted hover:text-foreground transition-colors"
                            >
                                Disconnect
                            </button>
                        </div>

                        {/* Direction Toggle */}
                        <div className="flex items-center justify-center gap-4 relative">
                            <div className={`p-4 rounded-xl flex-1 border transition-colors ${direction === "RelayToAssetHub" ? "bg-primary/5 border-primary/20" : "bg-card border-border"}`}>
                                <p className="text-xs text-muted mb-1">From Network</p>
                                <p className="font-medium text-foreground">{direction === "RelayToAssetHub" ? "Westend Relay" : "Asset Hub (1000)"}</p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setDirection(d => d === "RelayToAssetHub" ? "AssetHubToRelay" : "RelayToAssetHub")}
                                className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background border border-border flex items-center justify-center hover:bg-secondary transition-colors z-10 shadow-sm"
                                disabled={status !== "idle" && status !== "error"}
                            >
                                <ArrowRight className={`w-5 h-5 text-muted transition-transform ${direction === "AssetHubToRelay" ? "rotate-180" : ""}`} />
                            </button>

                            <div className={`p-4 rounded-xl flex-1 text-right border transition-colors ${direction === "AssetHubToRelay" ? "bg-primary/5 border-primary/20" : "bg-card border-border"}`}>
                                <p className="text-xs text-muted mb-1">To Network</p>
                                <p className="font-medium text-foreground">{direction === "RelayToAssetHub" ? "Asset Hub (1000)" : "Westend Relay"}</p>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-muted mb-2">Amount (WND)</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    required
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="w-full pl-4 pr-16 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all font-mono"
                                    placeholder="1.0"
                                    disabled={status !== "idle" && status !== "error"}
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted font-medium">
                                    WND
                                </span>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={status !== "idle" && status !== "error"}
                            className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {status === "idle" || status === "error" ? (
                                <>Teleport to Asset Hub <ArrowRight className="w-5 h-5" /></>
                            ) : status === "connecting" ? (
                                "Connecting to Westend RPC..."
                            ) : status === "signing" ? (
                                "Please sign in your wallet..."
                            ) : status === "broadcasting" ? (
                                "Waiting for block inclusion..."
                            ) : (
                                "Transfer Successful!"
                            )}
                        </button>

                        {/* Status Messages */}
                        {status === "success" && txHash && (
                            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col items-center text-center animate-fade-in">
                                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center mb-3">
                                    <Activity className="w-5 h-5 text-emerald-400" />
                                </div>
                                <h4 className="text-emerald-400 font-medium mb-1">XCM Message Dispatched</h4>
                                <p className="text-sm text-emerald-500/80 mb-3">Head over to the Dashboard to watch your ParaTrace indexer catch it live!</p>
                                <a
                                    href={`https://westend.subscan.io/extrinsic/${txHash}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs text-white underline opacity-70 hover:opacity-100 transition-opacity"
                                >
                                    View on Subscan
                                </a>
                            </div>
                        )}

                        {status === "error" && errorMessage && (
                            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
                                {errorMessage}
                            </div>
                        )}
                    </form>
                )}
            </div>
        </div>
    );
}
