"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, Menu, X, Activity, Users, AlertTriangle, Search, Sun, Moon } from "lucide-react";
import ThemeToggle from "./ThemeToggle";

const NAV_ITEMS = [
    { href: "/", label: "Dashboard", icon: Activity },
    { href: "/wallet", label: "Wallet Lookup", icon: Search },
    { href: "/flagged", label: "Flagged Wallets", icon: AlertTriangle },
    { href: "/transactions", label: "Transactions", icon: Activity },
];

export default function Navbar() {
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);

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
                <div className="hidden md:flex items-center gap-1">
                    {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                        const isActive = pathname === href;
                        return (
                            <Link
                                key={href}
                                href={href}
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
                    <div className="ml-2 pl-2 border-l border-border">
                        <ThemeToggle />
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
                    </div>
                </div>
            )}
        </nav>
    );
}
