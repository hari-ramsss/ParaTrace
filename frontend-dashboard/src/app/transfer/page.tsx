"use client";

import { useState, useMemo } from "react";
import { ArrowRight, Wallet, CheckCircle2, ArrowDown, ChevronDown, ArrowRightLeft, MousePointer2, User, AlertTriangle } from "lucide-react";
import { useWallet } from "@/components/WalletProvider";

// Dynamic import for Polkadot API to avoid SSR issues
let ApiPromise: any;
let WsProvider: any;

export default function TransferPage() {
    const { selectedAccount, isConnecting, connect, disconnect } = useWallet();

    const [amount, setAmount] = useState("1");
    // Updated state to handle multiple parachains instead of just A/B
    const [sourceChain, setSourceChain] = useState<number>(0);
    const [destChain, setDestChain] = useState<number>(1000);
    const [isSourceOpen, setIsSourceOpen] = useState(false);
    const [isDestOpen, setIsDestOpen] = useState(false);

    // Recipient address state
    const [sendToSelf, setSendToSelf] = useState(true);
    const [recipient, setRecipient] = useState("");

    const [status, setStatus] = useState<"idle" | "connecting" | "signing" | "broadcasting" | "success" | "error">("idle");
    const [txHash, setTxHash] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Address format detection
    const isEvmAddress = (addr: string) => /^0x[0-9a-fA-F]{40}$/.test(addr.trim());
    const isSS58Address = (addr: string) => /^[1-9A-HJ-NP-Za-km-z]{46,48}$/.test(addr.trim());

    const recipientType = useMemo(() => {
        const addr = recipient.trim();
        if (!addr) return null;
        if (isEvmAddress(addr)) return "evm" as const;
        if (isSS58Address(addr)) return "ss58" as const;
        return "invalid" as const;
    }, [recipient]);

    // EVM addresses only valid when destination is Polkadot Hub (relay chain 0)
    const isEvmRecipientBlocked = recipientType === "evm" && destChain !== 0;

    // Convert EVM H160 to zero-padded AccountId32 hex
    // Use literal zeros instead of .repeat() to avoid build-time evaluation issues
    const evmToAccountId32Hex = (evmAddr: string): string => {
        const clean = evmAddr.toLowerCase().replace("0x", "");
        return "0x000000000000000000000000" + clean; // 24 zeros = 12 bytes padding + 20 byte address
    };

    // Validation
    const isSameChain = sourceChain === destChain;

    // Check if form can be submitted
    const canSubmit = (status === "idle" || status === "error") &&
        !isSameChain &&
        (sendToSelf || (recipientType === "ss58" || (recipientType === "evm" && !isEvmRecipientBlocked)));

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

            // 1. Connect to the correct source chain RPC dynamically
            let rpcUrl = "wss://westend-rpc.polkadot.io";
            if (sourceChain === 1000) rpcUrl = "wss://westend-asset-hub-rpc.polkadot.io";
            if (sourceChain === 1002) rpcUrl = "wss://westend-bridge-hub-rpc.polkadot.io";
            if (sourceChain === 1005) rpcUrl = "wss://westend-coretime-rpc.polkadot.io";

            const provider = new WsProvider(rpcUrl);
            const api = await ApiPromise.create({ provider });

            setStatus("signing");

            // Resolve the beneficiary AccountId32 hex
            let beneficiaryAccountHex: string;
            if (sendToSelf) {
                beneficiaryAccountHex = api.createType("AccountId32", selectedAccount.address).toHex();
            } else if (recipientType === "evm") {
                // EVM → zero-padded AccountId32 (only reaches here if dest is Polkadot Hub)
                beneficiaryAccountHex = evmToAccountId32Hex(recipient.trim());
            } else {
                // SS58 → AccountId32
                beneficiaryAccountHex = api.createType("AccountId32", recipient.trim()).toHex();
            }

            // 2. Build XCM V3 Teleport parameters dynamically based on source/dest
            let dest, beneficiary, assets, tx;
            const plancks = BigInt(parseFloat(amount) * 1e12).toString();

            const isRelaySource = sourceChain === 0;
            const isRelayDest = destChain === 0;

            if (isRelaySource && !isRelayDest) {
                // Relay -> Parachain (downward teleport)
                dest = { V3: { parents: 0, interior: { X1: { Parachain: destChain } } } };
                beneficiary = {
                    V3: { parents: 0, interior: { X1: { AccountId32: { id: beneficiaryAccountHex, network: null } } } }
                };
                assets = {
                    V3: [{ id: { Concrete: { parents: 0, interior: "Here" } }, fun: { Fungible: plancks } }]
                };
                tx = api.tx.xcmPallet.teleportAssets(dest, beneficiary, assets, 0);

            } else if (!isRelaySource && isRelayDest) {
                // Parachain -> Relay (upward teleport)
                dest = { V3: { parents: 1, interior: "Here" } };
                beneficiary = {
                    V3: { parents: 0, interior: { X1: { AccountId32: { id: beneficiaryAccountHex, network: null } } } }
                };
                assets = {
                    V3: [{ id: { Concrete: { parents: 1, interior: "Here" } }, fun: { Fungible: plancks } }]
                };
                tx = api.tx.polkadotXcm.teleportAssets(dest, beneficiary, assets, 0);
            } else {
                // Parachain -> Parachain (lateral teleport via Relay)
                dest = { V3: { parents: 1, interior: { X1: { Parachain: destChain } } } };
                beneficiary = {
                    V3: { parents: 0, interior: { X1: { AccountId32: { id: beneficiaryAccountHex, network: null } } } }
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
                    <div className="text-center py-12">
                        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                            <MousePointer2 className="w-8 h-8 text-primary animate-bounce-slow" />
                        </div>
                        <h3 className="text-xl font-bold text-foreground mb-3">Wallet Connection Required</h3>
                        <p className="text-muted mb-8 max-w-sm mx-auto leading-relaxed">
                            To perform live XCM transfers, please connect your Polkadot wallet using the button in the navigation bar above.
                        </p>

                        <button
                            onClick={connect}
                            disabled={isConnecting}
                            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:opacity-90 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                        >
                            <Wallet className="w-5 h-5" />
                            {isConnecting ? "Connecting Extension..." : "Connect Wallet Now"}
                        </button>
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
                            <div className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-bold text-primary uppercase tracking-wider">
                                Active
                            </div>
                        </div>

                        {/* Network Selection */}
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 relative">
                            {/* Source Selection */}
                            <div className="p-4 rounded-xl flex-1 border border-border bg-card w-full relative">
                                <label className="text-xs text-muted mb-2 block">From Network</label>
                                <button
                                    type="button"
                                    onClick={() => { setIsSourceOpen(!isSourceOpen); setIsDestOpen(false); }}
                                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary focus:border-primary outline-none flex items-center justify-between hover:border-primary/50 transition-all duration-200"
                                    disabled={status !== "idle" && status !== "error"}
                                >
                                    <span>
                                        {sourceChain === 0 ? "Westend Relay" :
                                            sourceChain === 1000 ? "Asset Hub" :
                                                sourceChain === 1002 ? "Bridge Hub" : "Coretime"} ({sourceChain})
                                    </span>
                                    <ChevronDown className="w-4 h-4 text-muted" />
                                </button>

                                {/* Source Dropdown Menu */}
                                {isSourceOpen && status === "idle" && (
                                    <div className="absolute top-[calc(100%+0.5rem)] left-0 w-full bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden">
                                        {[
                                            { id: 0, name: "Westend Relay" },
                                            { id: 1000, name: "Asset Hub" },
                                            { id: 1002, name: "Bridge Hub" },
                                            { id: 1005, name: "Coretime" }
                                        ].map((net) => (
                                            <button
                                                key={net.id}
                                                type="button"
                                                onClick={() => { setSourceChain(net.id); setIsSourceOpen(false); }}
                                                className={`w-full text-left px-4 py-3 text-sm transition-colors hover:bg-primary/10 hover:text-primary ${sourceChain === net.id ? "text-primary bg-primary/5 font-semibold" : "text-foreground"}`}
                                            >
                                                {net.name} ({net.id})
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Arrow Swap Button */}
                            <button
                                type="button"
                                onClick={() => {
                                    // Actually swap the chains!
                                    const temp = sourceChain;
                                    setSourceChain(destChain);
                                    setDestChain(temp);
                                }}
                                className="w-10 h-10 rounded-full bg-background border border-border flex items-center justify-center shadow-sm shrink-0 z-10 sm:static absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 sm:translate-x-0 sm:translate-y-0 hover:bg-primary hover:text-primary-foreground transition-all duration-200 group"
                            >
                                <ArrowRightLeft className="w-4 h-4 text-muted group-hover:text-inherit hidden sm:block" />
                                <ArrowDown className="w-4 h-4 text-muted group-hover:text-inherit sm:hidden block" />
                            </button>

                            {/* Destination Selection */}
                            <div className="p-4 rounded-xl flex-1 border border-border bg-card w-full text-left sm:text-right relative">
                                <label className="text-xs text-muted mb-2 block font-medium">To Network</label>
                                <button
                                    type="button"
                                    onClick={() => { setIsDestOpen(!isDestOpen); setIsSourceOpen(false); }}
                                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary focus:border-primary outline-none flex items-center justify-between sm:flex-row-reverse hover:border-primary/50 transition-all duration-200"
                                    disabled={status !== "idle" && status !== "error"}
                                    dir="ltr"
                                >
                                    <span>
                                        {destChain === 0 ? "Westend Relay" :
                                            destChain === 1000 ? "Asset Hub" :
                                                destChain === 1002 ? "Bridge Hub" : "Coretime"} ({destChain})
                                    </span>
                                    <ChevronDown className="w-4 h-4 text-muted" />
                                </button>

                                {/* Dest Dropdown Menu */}
                                {isDestOpen && status === "idle" && (
                                    <div className="absolute top-[calc(100%+0.5rem)] left-0 w-full bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden text-left">
                                        {[
                                            { id: 0, name: "Westend Relay" },
                                            { id: 1000, name: "Asset Hub" },
                                            { id: 1002, name: "Bridge Hub" },
                                            { id: 1005, name: "Coretime" }
                                        ].map((net) => (
                                            <button
                                                key={net.id}
                                                type="button"
                                                onClick={() => { setDestChain(net.id); setIsDestOpen(false); }}
                                                className={`w-full text-left sm:text-right px-4 py-3 text-sm transition-colors hover:bg-primary/10 hover:text-primary ${destChain === net.id ? "text-primary bg-primary/5 font-semibold" : "text-foreground"}`}
                                            >
                                                {net.name} ({net.id})
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Recipient Address */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="block text-sm font-medium text-muted flex items-center gap-2">
                                    <User className="w-4 h-4" />
                                    Recipient
                                </label>
                                <button
                                    type="button"
                                    onClick={() => { setSendToSelf(!sendToSelf); setRecipient(""); }}
                                    className="text-xs text-primary hover:underline transition-colors"
                                    disabled={status !== "idle" && status !== "error"}
                                >
                                    {sendToSelf ? "Send to another address" : "Send to myself"}
                                </button>
                            </div>

                            {sendToSelf ? (
                                <div className="p-3 rounded-xl bg-background border border-border flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted">Sending to your own address on the destination chain</p>
                                        <p className="text-xs font-mono text-foreground/60 truncate w-48 sm:w-96">{selectedAccount.address}</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <input
                                        type="text"
                                        value={recipient}
                                        onChange={(e) => setRecipient(e.target.value)}
                                        placeholder="SS58 address (5Grw...) or EVM address (0x...)"
                                        className={`w-full px-4 py-3 rounded-xl bg-background border text-foreground placeholder:text-muted focus:outline-none focus:ring-1 transition-all font-mono text-sm ${recipient && recipientType === "invalid"
                                            ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/20"
                                            : isEvmRecipientBlocked
                                                ? "border-amber-500/50 focus:border-amber-500 focus:ring-amber-500/20"
                                                : "border-border focus:border-primary focus:ring-primary/50"
                                            }`}
                                        disabled={status !== "idle" && status !== "error"}
                                    />

                                    {/* Address format feedback */}
                                    {recipient && recipientType === "ss58" && (
                                        <p className="text-xs text-emerald-400 flex items-center gap-1">
                                            <CheckCircle2 className="w-3 h-3" /> Substrate (SS58) address detected
                                        </p>
                                    )}
                                    {recipient && recipientType === "evm" && !isEvmRecipientBlocked && (
                                        <p className="text-xs text-emerald-400 flex items-center gap-1">
                                            <CheckCircle2 className="w-3 h-3" /> EVM address detected — will be mapped to AccountId32 on Polkadot Hub
                                        </p>
                                    )}
                                    {isEvmRecipientBlocked && (
                                        <p className="text-xs text-amber-400 flex items-center gap-1">
                                            <AlertTriangle className="w-3 h-3" /> EVM addresses are only supported when destination is Westend Relay (Polkadot Hub). Change destination or use an SS58 address.
                                        </p>
                                    )}
                                    {recipient && recipientType === "invalid" && (
                                        <p className="text-xs text-red-400 flex items-center gap-1">
                                            <AlertTriangle className="w-3 h-3" /> Invalid address format. Enter an SS58 (5Grw...) or EVM (0x...) address.
                                        </p>
                                    )}
                                </div>
                            )}
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

                        {/* Same chain warning */}
                        {isSameChain && (
                            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 shrink-0" />
                                Source and destination must be different chains for XCM teleport.
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={!canSubmit}
                            className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
                        >
                            {status === "idle" || status === "error" ? (
                                <>Teleport {sendToSelf ? "to " : ""}{destChain === 0 ? "Westend Relay" : destChain === 1000 ? "Asset Hub" : destChain === 1002 ? "Bridge Hub" : "Coretime"} <ArrowRight className="w-5 h-5" /></>
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
                                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                </div>
                                <h4 className="text-emerald-400 font-medium mb-1">XCM Message Dispatched</h4>
                                <p className="text-sm text-emerald-500/80 mb-3">Head over to the Dashboard to watch your ParaTrace indexer catch it live!</p>
                                <a
                                    href={`${sourceChain === 1000 ? "https://assethub-westend.subscan.io" : sourceChain === 1002 ? "https://bridgehub-westend.subscan.io" : "https://westend.subscan.io"}/block/${txHash}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs text-foreground underline opacity-70 hover:opacity-100 transition-opacity"
                                >
                                    View Block on Subscan
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
