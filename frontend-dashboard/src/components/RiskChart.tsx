"use client";

import { useRef, useState, useEffect } from "react";
import { ScatterChart } from "@mui/x-charts/ScatterChart";
import { useTheme } from "@mui/material/styles";
import type { TransactionEvent } from "@/lib/registry";
import { formatVolume } from "@/lib/utils";

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
        y: Number(tx.amount) / 1e12, // Convert to WND units (assuming 12 decimals)
    }));

    return (
        <div ref={containerRef} className="rounded-2xl border border-border bg-card p-6">
            <h3 className="text-xl font-bold text-foreground mb-1">Outlier Analysis</h3>
            <p className="text-xs text-muted mb-4 font-dm-sans">Value (WND) vs Risk Score</p>

            <div className="flex items-center justify-center overflow-hidden">
                <ScatterChart
                    series={[
                        {
                            data,
                            label: "XCM Transfers",
                            color: isDark ? "#ffffff" : "#000000",
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
