"use client";

import { useRef, useState, useEffect } from "react";
import { ScatterChart } from "@mui/x-charts/ScatterChart";
import type { TransactionEvent } from "@/lib/registry";
import { formatVolume } from "@/lib/utils";

interface RiskValueScatterChartProps {
    transactions: TransactionEvent[];
}

export default function RiskValueScatterChart({ transactions }: RiskValueScatterChartProps) {
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
                <p className="text-gray-500 text-sm">No transaction data available</p>
            </div>
        );
    }

    // Prepare scatter data: X = Risk Score, Y = Volume (in PAS)
    // We only take the last 100 transactions to avoid cluttering
    const data = transactions.slice(0, 100).map((tx, i) => ({
        id: i,
        x: tx.newScore,
        y: Number(tx.amount) / 1e12, // Convert to PAS units (assuming 12 decimals)
    }));

    return (
        <div ref={containerRef} className="rounded-2xl border border-white/5 bg-[#12121a] p-6">
            <h3 className="text-lg font-semibold text-white mb-1">Outlier Analysis</h3>
            <p className="text-xs text-gray-500 mb-4">Value (PAS) vs Risk Score</p>

            <div className="flex items-center justify-center overflow-hidden">
                <ScatterChart
                    series={[
                        {
                            data,
                            label: "XCM Transfers",
                            color: "#8b5cf6",
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
                            label: "Volume (PAS)",
                            tickLabelStyle: { fill: "#6b7280", fontSize: 10 },
                            labelStyle: { fill: "#6b7280", fontSize: 11 },
                        },
                    ]}
                    sx={{
                        "& .MuiChartsAxis-line": { stroke: "#ffffff10" },
                        "& .MuiChartsAxis-tick": { stroke: "#ffffff10" },
                        "& .MuiChartsLegend-label": { fontSize: "11px !important", fill: "#9ca3af !important" },
                        "& .MuiScatterValueItem-root": {
                            stroke: "#8b5cf6",
                            strokeWidth: 1,
                            fillOpacity: 0.5,
                        }
                    }}
                />
            </div>
            {/* Legend for Quadrants */}
            <div className="grid grid-cols-2 gap-2 mt-4">
                <div className="p-2 rounded-lg bg-red-500/5 border border-red-500/10">
                    <p className="text-[10px] text-red-400 font-bold uppercase tracking-wider">High Risk / High Value</p>
                    <p className="text-[9px] text-gray-600">Critical Alerts (Top Right)</p>
                </div>
                <div className="p-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
                    <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">High Risk / Low Value</p>
                    <p className="text-[9px] text-gray-600">Suspicious Dust (Bottom Right)</p>
                </div>
            </div>
        </div>
    );
}
