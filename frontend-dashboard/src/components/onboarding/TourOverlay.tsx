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
    const [animatedRect, setAnimatedRect] = useState<TargetRect | null>(null);
    const animationRef = useRef<number | null>(null);
    const observerRef = useRef<ResizeObserver | null>(null);
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";

    // Smooth animation using lerp
    useEffect(() => {
        if (!targetRect) {
            setAnimatedRect(null);
            return;
        }

        if (!animatedRect) {
            setAnimatedRect(targetRect);
            return;
        }

        const lerp = (start: number, end: number, t: number) => start + (end - start) * t;
        const ease = 0.08; // Slower animation (lower = slower, matches tooltip)

        const animate = () => {
            setAnimatedRect((prev) => {
                if (!prev) return targetRect;

                const newRect = {
                    top: lerp(prev.top, targetRect.top, ease),
                    left: lerp(prev.left, targetRect.left, ease),
                    width: lerp(prev.width, targetRect.width, ease),
                    height: lerp(prev.height, targetRect.height, ease),
                };

                // Check if close enough to stop animating
                const isClose =
                    Math.abs(newRect.top - targetRect.top) < 0.5 &&
                    Math.abs(newRect.left - targetRect.left) < 0.5 &&
                    Math.abs(newRect.width - targetRect.width) < 0.5 &&
                    Math.abs(newRect.height - targetRect.height) < 0.5;

                if (isClose) {
                    return targetRect;
                }

                animationRef.current = requestAnimationFrame(animate);
                return newRect;
            });
        };

        animationRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [targetRect]);

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

        // Delay initial position calculation to allow scroll to complete
        const timer = setTimeout(updatePosition, 350);

        const element = document.querySelector(step.target);
        if (element) {
            observerRef.current = new ResizeObserver(updatePosition);
            observerRef.current.observe(element);
        }

        window.addEventListener("scroll", updatePosition, true);
        window.addEventListener("resize", updatePosition);

        return () => {
            clearTimeout(timer);
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
                        {animatedRect && (
                            <rect
                                x={animatedRect.left}
                                y={animatedRect.top}
                                width={animatedRect.width}
                                height={animatedRect.height}
                                rx="12"
                                ry="12"
                                fill="black"
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

            {animatedRect && (
                <div
                    className="absolute rounded-xl ring-2 ring-violet-500/60 shadow-[0_0_30px_rgba(139,92,246,0.4)] pointer-events-none"
                    style={{
                        top: animatedRect.top,
                        left: animatedRect.left,
                        width: animatedRect.width,
                        height: animatedRect.height,
                    }}
                />
            )}
        </div>
    );
}
