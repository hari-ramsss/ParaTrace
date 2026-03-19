"use client";

import { useEffect, useState, useRef } from "react";
import { useTheme } from "@mui/material/styles";
import type { TourStep } from "./tourSteps";

interface TourOverlayProps {
    step: TourStep;
    isVisible: boolean;
}

interface TargetRect {
    top: number;
    left: number;
    width: number;
    height: number;
}

export default function TourOverlay({ step, isVisible }: TourOverlayProps) {
    const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
    const observerRef = useRef<ResizeObserver | null>(null);
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";

    useEffect(() => {
        if (!isVisible || step.disableOverlay) {
            setTargetRect(null);
            return;
        }

        const updatePosition = () => {
            const element = document.querySelector(step.target);
            if (element) {
                const rect = element.getBoundingClientRect();
                const padding = step.spotlightPadding ?? 4;
                setTargetRect({
                    top: rect.top - padding,
                    left: rect.left - padding,
                    width: rect.width + padding * 2,
                    height: rect.height + padding * 2,
                });
            }
        };

        updatePosition();

        const element = document.querySelector(step.target);
        if (element) {
            observerRef.current = new ResizeObserver(updatePosition);
            observerRef.current.observe(element);
        }

        window.addEventListener("scroll", updatePosition, true);
        window.addEventListener("resize", updatePosition);

        return () => {
            observerRef.current?.disconnect();
            window.removeEventListener("scroll", updatePosition, true);
            window.removeEventListener("resize", updatePosition);
        };
    }, [step, isVisible]);

    if (!isVisible) return null;

    const overlayColor = isDark ? "rgba(0, 0, 0, 0.8)" : "rgba(0, 0, 0, 0.6)";

    return (
        <div className="fixed inset-0 z-[9998] pointer-events-none">
            <svg className="w-full h-full" style={{ pointerEvents: "auto" }}>
                <defs>
                    <mask id="spotlight-mask">
                        <rect x="0" y="0" width="100%" height="100%" fill="white" />
                        {targetRect && (
                            <rect
                                x={targetRect.left}
                                y={targetRect.top}
                                width={targetRect.width}
                                height={targetRect.height}
                                rx="12"
                                ry="12"
                                fill="black"
                                className="transition-all duration-300 ease-out"
                            />
                        )}
                    </mask>
                </defs>
                <rect
                    x="0"
                    y="0"
                    width="100%"
                    height="100%"
                    fill={overlayColor}
                    mask="url(#spotlight-mask)"
                    className="transition-opacity duration-300"
                />
            </svg>

            {targetRect && (
                <div
                    className="absolute rounded-xl ring-2 ring-violet-500/60 shadow-[0_0_30px_rgba(139,92,246,0.4)] transition-all duration-300 ease-out pointer-events-none"
                    style={{
                        top: targetRect.top,
                        left: targetRect.left,
                        width: targetRect.width,
                        height: targetRect.height,
                    }}
                />
            )}
        </div>
    );
}
