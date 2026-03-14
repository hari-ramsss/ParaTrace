"use client";

import { PieChart } from "@mui/x-charts/PieChart";
import { useDrawingArea } from "@mui/x-charts/hooks";
import { styled } from "@mui/material/styles";
import type { WalletProfile } from "@/lib/registry";

interface WalletRiskRadarProps {
    profile: WalletProfile;
}

// MUI X-Charts doesn't have a Radar chair yet, but we can build a beautiful 
// multi-dimension analysis using a customized Polar/Pie area or just 
// a clear breakdown table. 
// Actually, for a security "WOW" factor, let's use a themed breakdown 
// with progress bars that feel like a "threat profile".

export default function WalletRiskRadar({ profile }: WalletRiskRadarProps) {
    // Normalize dimensions 0-100 for visualization
    const dimensions = [
        { label: "Volume Exposure", value: Math.min(100, Number(profile.totalVolume / 1000000000000n)), color: "#8b5cf6" },
        { label: "Tx Frequency", value: Math.min(100, profile.txCount * 5), color: "#a855f7" },
        { label: "XCM Diversity", value: Math.min(100, profile.uniqueChains * 20), color: "#d946ef" },
        { label: "Network Velocity", value: profile.avgTimeBetweenTxs > 0 ? Math.min(100, (3600 / profile.avgTimeBetweenTxs) * 10) : 0, color: "#ec4899" },
        { label: "Flagged Proximity", value: Math.min(100, profile.flaggedInteractions * 25), color: "#f43f5e" },
    ];

    return (
        <div className="rounded-2xl border border-white/5 bg-[#12121a] p-6 h-full">
            <h3 className="text-lg font-semibold text-white mb-6">Threat Vector Analysis</h3>
            <div className="space-y-5">
                {dimensions.map((dim) => (
                    <div key={dim.label} className="space-y-2">
                        <div className="flex justify-between text-xs font-medium">
                            <span className="text-gray-400 uppercase tracking-wider">{dim.label}</span>
                            <span style={{ color: dim.color }}>{Math.round(dim.value)}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-1000 ease-out"
                                style={{
                                    width: `${dim.value}%`,
                                    backgroundColor: dim.color,
                                    boxShadow: `0 0 10px ${dim.color}40`
                                }}
                            />
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-8 p-3 rounded-xl bg-violet-500/5 border border-violet-500/10">
                <p className="text-[10px] text-gray-500 leading-relaxed">
                    This vector analysis identifies specific suspicious behaviors based on on-chain heuristics and cross-chain interaction patterns.
                </p>
            </div>
        </div>
    );
}
