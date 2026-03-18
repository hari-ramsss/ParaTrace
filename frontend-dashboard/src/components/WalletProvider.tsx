"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { InjectedAccountWithMeta } from "@polkadot/extension-inject/types";

interface WalletContextType {
    selectedAccount: InjectedAccountWithMeta | null;
    allAccounts: InjectedAccountWithMeta[];
    isConnecting: boolean;
    error: string | null;
    connect: () => Promise<void>;
    disconnect: () => void;
    setSelectedAccount: (account: InjectedAccountWithMeta | null) => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
    const [selectedAccount, setSelectedAccount] = useState<InjectedAccountWithMeta | null>(null);
    const [allAccounts, setAllAccounts] = useState<InjectedAccountWithMeta[]>([]);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const connect = useCallback(async () => {
        setIsConnecting(true);
        setError(null);
        try {
            const { web3Enable, web3Accounts } = await import("@polkadot/extension-dapp");
            const extensions = await web3Enable("ParaTrace");

            if (extensions.length === 0) {
                throw new Error("No Polkadot extension found. Please install Talisman or Polkadot.js.");
            }

            const accounts = await web3Accounts();
            if (accounts.length === 0) {
                throw new Error("No accounts found. Please create one in your wallet extension.");
            }

            setAllAccounts(accounts);
            // Default to the first account if none selected
            setSelectedAccount((prev) => prev || accounts[0]);
        } catch (err) {
            console.error("Failed to connect wallet:", err);
            setError(err instanceof Error ? err.message : "Connection failed");
        } finally {
            setIsConnecting(false);
        }
    }, []); // Removed selectedAccount dependency

    const disconnect = useCallback(() => {
        setSelectedAccount(null);
        setAllAccounts([]);
        setError(null);
        localStorage.removeItem("paratrace_wallet_connected");
    }, []);

    // Optionally auto-connect if previously connected (using localStorage or session)
    useEffect(() => {
        const wasConnected = localStorage.getItem("paratrace_wallet_connected");
        if (wasConnected === "true") {
            connect();
        }
    }, [connect]);

    useEffect(() => {
        if (selectedAccount) {
            localStorage.setItem("paratrace_wallet_connected", "true");
        } else {
            localStorage.removeItem("paratrace_wallet_connected");
        }
    }, [selectedAccount]);

    return (
        <WalletContext.Provider
            value={{
                selectedAccount,
                allAccounts,
                isConnecting,
                error,
                connect,
                disconnect,
                setSelectedAccount,
            }}
        >
            {children}
        </WalletContext.Provider>
    );
}

export function useWallet() {
    const context = useContext(WalletContext);
    if (context === undefined) {
        throw new Error("useWallet must be used within a WalletProvider");
    }
    return context;
}
