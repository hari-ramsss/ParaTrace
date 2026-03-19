"use client";

import { getRiskLevel } from "@/lib/constants";
import { useTheme } from "@mui/material/styles";

interface RiskGaugeProps {
    score: number;
    size?: "sm" | "md" | "lg";
}

const sizeMap = {
    sm: { container: "w-20 h-20", text: "text-lg", label: "text-[10px]" },
    md: { container: "w-32 h-32", text: "text-3xl", label: "text-xs" },
    lg: { container: "w-44 h-44", text: "text-5xl", label: "text-sm" },
};

export default function RiskGauge({ score, size = "md" }: RiskGaugeProps) {
    const level = getRiskLevel(score);
    const s = sizeMap[size];
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";

    // SVG circular progress
    const radius = 42;
    const circumference = 2 * Math.PI * radius;
    const progress = (score / 100) * circumference;

    return (
        <div className={`${s.container} relative flex items-center justify-center`}>
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                {/* Background circle */}
                <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="none"
                    stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.08)"}
                    strokeWidth="6"
                />
                {/* Progress circle */}
                <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="none"
                    stroke={level.color}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference - progress}
                    className="transition-all duration-1000 ease-out"
                    style={{
                        filter: `drop-shadow(0 0 8px ${level.color}50)`,
                    }}
                />
            </svg>
            <div className="text-center z-10">
                <span className={`${s.text} font-bold text-foreground`}>{score}</span>
                <p className={`${s.label} font-medium mt-0.5`} style={{ color: level.color }}>
                    {level.label} Risk
                </p>
            </div>
        </div>
    );
}
