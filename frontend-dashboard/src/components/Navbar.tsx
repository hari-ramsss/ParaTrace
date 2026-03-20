"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, Menu, X, LayoutDashboard, Users, AlertTriangle, Search, Sun, Moon, Wallet, LogOut, ChevronDown, List, Zap } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import { useWallet } from "./WalletProvider";
import { truncateAddress } from "@/lib/utils";

const NAV_ITEMS = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/wallet", label: "Wallet Lookup", icon: Search },
    { href: "/flagged", label: "Flagged Wallets", icon: AlertTriangle },
    { href: "/transactions", label: "Transactions", icon: List },
    { href: "/transfer", label: "XCM Transfer", icon: Zap },
];

export default function Navbar() {
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);
    const { selectedAccount, isConnecting, connect, disconnect } = useWallet();

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-b border-border">
            <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                {/* Logo */}
                <Link
                    href="/"
                    className="flex items-center gap-3 group"
                    onClick={() => setMobileOpen(false)}
                >
                    <img
                        src="/polkadot.png"
                        alt="Polkadot"
                        className="w-10 h-10 transition-all"
                        style={{ filter: "var(--logo-filter)" }}
                    />
                    <span className="text-xl font-bold font-serif text-foreground tracking-tight">
                        ParaTrace
                    </span>
                </Link>

                {/* Desktop Nav Links */}
                <div data-tour="nav-links" className="hidden md:flex items-center gap-1">
                    {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                        const isActive = pathname === href;
                        const tourId = label.toLowerCase().replace(" ", "-");
                        return (
                            <Link
                                key={href}
                                href={href}
                                data-tour={`nav-${tourId}`}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-dm-sans font-medium transition-all duration-200 ${isActive
                                    ? "text-foreground bg-foreground/5"
                                    : "text-muted hover:text-foreground hover:bg-foreground/5"
                                    }`}
                            >
                                <Icon className="w-4 h-4" />
                                {label}
                            </Link>
                        );
                    })}
                    <div className="ml-2 pl-2 border-l border-border flex items-center gap-3">
                        <div data-tour="theme-toggle">
                            <ThemeToggle />
                        </div>

                        {selectedAccount ? (
                            <div className="flex items-center gap-2 pl-2 border-l border-border">
                                <div className="flex flex-col items-end mr-1">
                                    <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Connected</span>
                                    <span className="text-sm font-medium text-foreground leading-tight">
                                        {selectedAccount.meta.name || truncateAddress(selectedAccount.address)}
                                    </span>
                                </div>
                                <button
                                    onClick={disconnect}
                                    className="p-2 rounded-lg text-muted hover:text-red-400 hover:bg-red-400/10 transition-all"
                                    title="Disconnect Wallet"
                                >
                                    <LogOut className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <button
                                data-tour="connect-wallet"
                                onClick={connect}
                                disabled={isConnecting}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-all shadow-md active:scale-95 disabled:opacity-50"
                            >
                                <Wallet className="w-4 h-4" />
                                {isConnecting ? "Connecting..." : "Connect"}
                            </button>
                        )}
                    </div>
                </div>

                {/* Mobile Hamburger */}
                <button
                    className="md:hidden p-2 rounded-lg text-muted hover:text-foreground hover:bg-foreground/5 transition-colors"
                    onClick={() => setMobileOpen(!mobileOpen)}
                    aria-label="Toggle menu"
                >
                    {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
            </div>

            {/* Mobile Menu */}
            {mobileOpen && (
                <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-xl animate-fade-in">
                    <div className="px-4 py-3 space-y-1">
                        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                            const isActive = pathname === href;
                            return (
                                <Link
                                    key={href}
                                    href={href}
                                    onClick={() => setMobileOpen(false)}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${isActive
                                        ? "bg-foreground/5 text-foreground font-bold"
                                        : "text-muted hover:text-foreground hover:bg-foreground/5"
                                        }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    {label}
                                </Link>
                            );
                        })}

                        {/* Mobile Wallet Section */}
                        <div className="pt-2 mt-2 border-t border-border">
                            {selectedAccount ? (
                                <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-foreground/5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                                            <Wallet className="w-4 h-4 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-primary uppercase tracking-wider">Connected</p>
                                            <p className="text-sm font-medium text-foreground">
                                                {selectedAccount.meta.name || truncateAddress(selectedAccount.address)}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => { disconnect(); setMobileOpen(false); }}
                                        className="p-2 rounded-lg text-muted hover:text-red-400 transition-colors"
                                    >
                                        <LogOut className="w-5 h-5" />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => { connect(); setMobileOpen(false); }}
                                    disabled={isConnecting}
                                    className="w-full flex items-center justify-center gap-3 px-4 py-4 rounded-xl bg-primary text-primary-foreground font-bold shadow-lg"
                                >
                                    <Wallet className="w-5 h-5" />
                                    {isConnecting ? "Connecting..." : "Connect Wallet"}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </nav>
    );
}
