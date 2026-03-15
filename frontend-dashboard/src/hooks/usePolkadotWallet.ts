import { useState, useEffect } from "react";
import type { InjectedAccountWithMeta, InjectedExtension } from "@polkadot/extension-inject/types";

export function usePolkadotWallet() {
    const [accounts, setAccounts] = useState<InjectedAccountWithMeta[]>([]);
    const [selectedAccount, setSelectedAccount] = useState<InjectedAccountWithMeta | null>(null);
    const [extension, setExtension] = useState<InjectedExtension | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const connectWallet = async () => {
        setIsConnecting(true);
        setError(null);
        try {
            // Dynamic import because @polkadot/extension-dapp accesses window/document which breaks in SSR
            const { web3Enable, web3Accounts } = await import("@polkadot/extension-dapp");
            const extensions = await web3Enable("ParaTrace Dashboard");

            if (extensions.length === 0) {
                setError("No Polkadot extension found. Please install Polkadot.js or Talisman.");
                setIsConnecting(false);
                return;
            }

            setExtension(extensions[0]);
            const allAccounts = await web3Accounts();

            if (allAccounts.length === 0) {
                setError("No accounts found in your wallet.");
                setIsConnecting(false);
                return;
            }

            setAccounts(allAccounts);
            setSelectedAccount(allAccounts[0]); // Default to first account
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to connect wallet");
        } finally {
            setIsConnecting(false);
        }
    };

    const logout = () => {
        setAccounts([]);
        setSelectedAccount(null);
        setExtension(null);
    };

    return {
        accounts,
        selectedAccount,
        setSelectedAccount,
        extension,
        isConnecting,
        error,
        connectWallet,
        logout
    };
}
