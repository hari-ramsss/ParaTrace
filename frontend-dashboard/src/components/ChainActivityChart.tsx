"use client";

import { useRef, useState, useEffect } from "react";
import { LineChart } from "@mui/x-charts/LineChart";
import type { TransactionEvent } from "@/lib/registry";

interface RiskTrendChartProps {
    transactions: TransactionEvent[];
}

export default function RiskTrendChart({ transactions }: RiskTrendChartProps) {
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
            <div className="rounded-2xl border border-white/5 bg-[#12121a] p-6 flex flex-col items-center justify-center min-h-[300px]">
                <p className="text-gray-500 text-sm">No trend data available yet</p>
            </div>
        );
    }

    // Show the last 20 transactions in chronological order (oldest → newest)
    const recent = [...transactions].reverse().slice(-20);

    const scores = recent.map((tx) => tx.newScore);
    const labels = recent.map((_, i) => i + 1);

    // Compute a simple moving average (window of 5) for the trend line
    const movingAvg = scores.map((_, i) => {
        const window = scores.slice(Math.max(0, i - 4), i + 1);
        return Math.round(window.reduce((a, b) => a + b, 0) / window.length);
    });

    // Color the area based on the latest score
    const latestScore = scores[scores.length - 1] ?? 0;
    const trendColor = latestScore <= 50 ? "#22c55e" : latestScore <= 75 ? "#f59e0b" : "#ef4444";

    return (
        <div ref={containerRef} className="rounded-2xl border border-white/5 bg-[#12121a] p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Risk Score Trend</h3>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: trendColor }} />
                    <span className="text-xs text-gray-400">
                        Latest: {latestScore}
                    </span>
                </div>
            </div>
            <LineChart
                xAxis={[
                    {
                        data: labels,
                        label: "Recent Transactions",
                        scaleType: "point",
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
                        color: "#8b5cf680",
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
                    "& .MuiChartsAxis-line": { stroke: "#ffffff10" },
                    "& .MuiChartsAxis-tick": { stroke: "#ffffff10" },
                    "& .MuiLineElement-root": { strokeWidth: 2 },
                    "& .MuiMarkElement-root": { scale: "0.5" },
                    "& .MuiChartsLegend-label": { fontSize: "11px !important", fill: "#9ca3af !important" },
                }}
            />
            {/* Threshold reference */}
            <div className="flex items-center justify-center gap-6 mt-3 text-[10px] text-gray-500">
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
