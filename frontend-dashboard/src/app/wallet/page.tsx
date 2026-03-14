"use client";
import { Suspense } from "react";
import WalletLookupContent from "@/app/wallet/WalletLookupContent";

export default function WalletLookupPage() {
    return (
        <Suspense
            fallback={
                <div className="max-w-4xl mx-auto px-6 py-10">
                    <div className="h-8 w-48 bg-white/5 rounded-lg animate-pulse mb-8" />
                    <div className="h-14 bg-white/5 rounded-xl animate-pulse" />
                </div>
            }
        >
            <WalletLookupContent />
        </Suspense>
    );
}
