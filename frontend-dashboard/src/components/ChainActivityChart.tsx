"use client";

import { useRef, useState, useEffect } from "react";
import { LineChart } from "@mui/x-charts/LineChart";
import { useTheme } from "@mui/material/styles";
import type { TransactionEvent } from "@/lib/registry";

interface RiskTrendChartProps {
    transactions: TransactionEvent[];
}

export default function RiskTrendChart({ transactions }: RiskTrendChartProps) {
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
                <p className="text-muted text-sm">No trend data available yet</p>
            </div>
        );
    }

    // Build per-block averages for a cleaner trend signal.
    const byBlock = new Map<number, { total: number; count: number }>();
    for (const tx of transactions) {
        const entry = byBlock.get(tx.blockNumber) ?? { total: 0, count: 0 };
        entry.total += tx.newScore;
        entry.count += 1;
        byBlock.set(tx.blockNumber, entry);
    }

    const recentBlocks = [...byBlock.entries()]
        .sort((a, b) => a[0] - b[0])
        .slice(-20);

    const labels = recentBlocks.map(([block]) => block);
    const scores = recentBlocks.map(([, agg]) => Math.round(agg.total / agg.count));

    // Compute a simple moving average (window of 5) for the trend line
    const movingAvg = scores.map((_, i) => {
        const window = scores.slice(Math.max(0, i - 4), i + 1);
        return Math.round(window.reduce((a, b) => a + b, 0) / window.length);
    });

    // Color the area based on the latest score
    const latestScore = scores[scores.length - 1] ?? 0;
    const trendColor = latestScore <= 50 ? "#22c55e" : latestScore <= 75 ? "#f59e0b" : "#ef4444";

    return (
        <div ref={containerRef} className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-foreground font-serif">Risk Score Trend</h3>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: trendColor }} />
                    <span className="text-xs text-muted font-dm-sans">
                        Latest: {latestScore}
                    </span>
                </div>
            </div>
            <LineChart
                xAxis={[
                    {
                        data: labels,
                        label: "Recent Blocks",
                        scaleType: "linear",
                        tickLabelStyle: { fill: "#6b7280", fontSize: 10 },
                        labelStyle: { fill: "#6b7280", fontSize: 11 },
                    },
                ]}
                yAxis={[
                    {
                        min: 0,
                        max: 100,
                        tickLabelStyle: { fill: "#6b7280", fontSize: 10 },
                    },
                ]}
                series={[
                    {
                        data: scores,
                        label: "Risk Score",
                        color: isDark ? "#ffffff60" : "#00000060",
                        showMark: true,
                        curve: "natural",
                    },
                    {
                        data: movingAvg,
                        label: "Trend (5-tx avg)",
                        color: trendColor,
                        showMark: false,
                        curve: "natural",
                    },
                ]}
                width={chartWidth}
                height={250}
                sx={{
                    "& .MuiChartsAxis-line": { stroke: isDark ? "#ffffff10" : "#00000010" },
                    "& .MuiChartsAxis-tick": { stroke: isDark ? "#ffffff10" : "#00000010" },
                    "& .MuiLineElement-root": { strokeWidth: 2 },
                    "& .MuiMarkElement-root": { scale: "0.5" },
                    "& .MuiChartsLegend-label": { fontSize: "11px !important", fill: isDark ? "#9ca3af !important" : "#4b5563 !important" },
                }}
            />
            {/* Threshold reference */}
            <div className="flex items-center justify-center gap-6 mt-3 text-[10px] text-muted">
                <span className="flex items-center gap-1">
                    <span className="w-6 h-[1px] bg-emerald-500 inline-block" /> 0–50 Low
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-6 h-[1px] bg-amber-500 inline-block" /> 51–75 Medium
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-6 h-[1px] bg-red-500 inline-block" /> 76–100 High
                </span>
            </div>
        </div>
    );
}
