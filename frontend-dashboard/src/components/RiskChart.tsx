"use client";

import { useRef, useState, useEffect } from "react";
import { ScatterChart } from "@mui/x-charts/ScatterChart";
import { useTheme } from "@mui/material/styles";
import { ethers } from "ethers";
import type { TransactionEvent } from "@/lib/registry";

interface RiskValueScatterChartProps {
    transactions: TransactionEvent[];
}

export default function RiskValueScatterChart({ transactions }: RiskValueScatterChartProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const containerRef = useRef<HTMLDivElement>(null);
    const [chartWidth, setChartWidth] = useState(500);

    useEffect(() => {
        function handleResize() {
            if (containerRef.current) {
                setChartWidth(Math.min(containerRef.current.offsetWidth - 48, 600));
            }
        }
        handleResize();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    if (transactions.length === 0) {
        return (
            <div className="rounded-2xl border border-border bg-card p-6 flex flex-col items-center justify-center min-h-[300px]">
                <p className="text-muted text-sm">No transaction data available</p>
            </div>
        );
    }

    // Prepare scatter data: X = Risk Score, Y = Volume (in WND)
    // We only take the last 100 transactions to avoid cluttering
    const data = transactions.slice(0, 100).map((tx, i) => ({
        id: i,
        x: tx.newScore,
        // Use formatUnits to avoid bigint->number precision loss before scaling.
        y: Number.parseFloat(ethers.formatUnits(tx.amount, 12)),
    }));

    const volumes = data.map((p) => p.y).sort((a, b) => a - b);
    const q = (arr: number[], percentile: number) => {
        if (arr.length === 0) return 0;
        const pos = (arr.length - 1) * percentile;
        const base = Math.floor(pos);
        const rest = pos - base;
        const next = arr[base + 1] ?? arr[base];
        return arr[base] + rest * (next - arr[base]);
    };

    const q1 = q(volumes, 0.25);
    const q3 = q(volumes, 0.75);
    const iqr = q3 - q1;
    const lower = q1 - 1.5 * iqr;
    const upper = q3 + 1.5 * iqr;

    const normalPoints = data.filter((p) => p.y >= lower && p.y <= upper);
    const outlierPoints = data.filter((p) => p.y < lower || p.y > upper);

    return (
        <div ref={containerRef} className="rounded-2xl border border-border bg-card p-6">
            <h3 className="text-xl font-bold text-foreground mb-1">Outlier Analysis</h3>
            <p className="text-xs text-muted mb-4 font-dm-sans">Value (WND) vs Risk Score</p>

            <div className="flex items-center justify-center overflow-hidden">
                <ScatterChart
                    series={[
                        {
                            data: normalPoints,
                            label: "Normal Transfers",
                            color: isDark ? "#ffffff" : "#000000",
                        },
                        {
                            data: outlierPoints,
                            label: "Detected Outliers",
                            color: "#ef4444",
                        },
                    ]}
                    width={chartWidth}
                    height={300}
                    xAxis={[
                        {
                            label: "Risk Score",
                            min: 0,
                            max: 100,
                            tickLabelStyle: { fill: "#6b7280", fontSize: 10 },
                            labelStyle: { fill: "#6b7280", fontSize: 11 },
                        },
                    ]}
                    yAxis={[
                        {
                            label: "Volume (WND)",
                            tickLabelStyle: { fill: "#6b7280", fontSize: 10 },
                            labelStyle: { fill: "#6b7280", fontSize: 11 },
                        },
                    ]}
                    sx={{
                        "& .MuiChartsAxis-line": { stroke: isDark ? "#ffffff10" : "#00000010" },
                        "& .MuiChartsAxis-tick": { stroke: isDark ? "#ffffff10" : "#00000010" },
                        "& .MuiChartsLegend-label": { fontSize: "11px !important", fill: isDark ? "#9ca3af !important" : "#4b5563 !important" },
                        "& .MuiScatterValueItem-root": {
                            stroke: "#8b5cf6",
                            strokeWidth: 1,
                            fillOpacity: 0.5,
                        }
                    }}
                />
            </div>
            <p className="text-[10px] text-muted mt-2">
                IQR method (1.5x): {outlierPoints.length} outlier{outlierPoints.length === 1 ? "" : "s"} detected from {data.length} points.
            </p>
            {/* Legend for Quadrants */}
            <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="p-3 rounded-xl border border-border bg-foreground/[0.02]">
                    <p className="text-[11px] text-foreground font-bold uppercase tracking-widest mb-1">High Risk / High Value</p>
                    <p className="text-[10px] text-muted">Critical Alerts (Top Right)</p>
                </div>
                <div className="p-3 rounded-xl border border-border bg-foreground/[0.02]">
                    <p className="text-[11px] text-foreground font-bold uppercase tracking-widest mb-1">High Risk / Low Value</p>
                    <p className="text-[10px] text-muted">Suspicious Dust (Bottom Right)</p>
                </div>
            </div>
        </div>
    );
}
