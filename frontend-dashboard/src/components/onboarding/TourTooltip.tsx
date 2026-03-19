"use client";

import { useEffect, useState, useRef } from "react";
import { X, ChevronLeft, ChevronRight, SkipForward } from "lucide-react";
import type { TourStep } from "./tourSteps";

interface TourTooltipProps {
    step: TourStep;
    currentIndex: number;
    totalSteps: number;
    onNext: () => void;
    onPrev: () => void;
    onSkip: () => void;
    onClose: () => void;
    isVisible: boolean;
}

interface Position {
    top: number;
    left: number;
    arrowPosition: "top" | "bottom" | "left" | "right" | "none";
}

export default function TourTooltip({
    step,
    currentIndex,
    totalSteps,
    onNext,
    onPrev,
    onSkip,
    onClose,
    isVisible,
}: TourTooltipProps) {
    const [targetPosition, setTargetPosition] = useState<Position | null>(null);
    const [animatedPosition, setAnimatedPosition] = useState<{ top: number; left: number } | null>(null);
    const [arrowPosition, setArrowPosition] = useState<Position["arrowPosition"]>("none");
    const [isInitialized, setIsInitialized] = useState(false);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const animationRef = useRef<number | null>(null);

    // Smooth lerp animation for position
    useEffect(() => {
        if (!targetPosition) {
            setAnimatedPosition(null);
            return;
        }

        if (!animatedPosition) {
            setAnimatedPosition({ top: targetPosition.top, left: targetPosition.left });
            setArrowPosition(targetPosition.arrowPosition);
            setIsInitialized(true);
            return;
        }

        const lerp = (start: number, end: number, t: number) => start + (end - start) * t;
        const ease = 0.08; // Slower animation (lower = slower)

        const animate = () => {
            setAnimatedPosition((prev) => {
                if (!prev) return { top: targetPosition.top, left: targetPosition.left };

                const newPos = {
                    top: lerp(prev.top, targetPosition.top, ease),
                    left: lerp(prev.left, targetPosition.left, ease),
                };

                // Check if close enough to stop animating
                const isClose =
                    Math.abs(newPos.top - targetPosition.top) < 0.5 &&
                    Math.abs(newPos.left - targetPosition.left) < 0.5;

                if (isClose) {
                    setArrowPosition(targetPosition.arrowPosition);
                    return { top: targetPosition.top, left: targetPosition.left };
                }

                animationRef.current = requestAnimationFrame(animate);
                return newPos;
            });
        };

        // Update arrow position when halfway through animation
        setTimeout(() => setArrowPosition(targetPosition.arrowPosition), 150);

        animationRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [targetPosition]);

    useEffect(() => {
        if (!isVisible) {
            setIsInitialized(false);
            setTargetPosition(null);
            setAnimatedPosition(null);
            return;
        }

        const calculatePosition = () => {
            const element = document.querySelector(step.target);
            const tooltip = tooltipRef.current;

            if (!tooltip) return;

            const tooltipRect = tooltip.getBoundingClientRect();
            const padding = 16;
            const arrowSize = 8;

            if (step.placement === "center" || !element) {
                const top = window.innerHeight / 2 - tooltipRect.height / 2;
                const left = window.innerWidth / 2 - tooltipRect.width / 2;
                setTargetPosition({ top, left, arrowPosition: "none" });
                setIsInitialized(true);
                return;
            }

            const targetRect = element.getBoundingClientRect();
            let top: number;
            let left: number;
            let newArrowPosition: Position["arrowPosition"];

            // Determine best placement based on available space
            let finalPlacement = step.placement;
            const spaceBelow = window.innerHeight - targetRect.bottom;
            const spaceAbove = targetRect.top;
            const spaceRight = window.innerWidth - targetRect.right;
            const spaceLeft = targetRect.left;

            // Auto-adjust placement if not enough space
            if (finalPlacement === "bottom" && spaceBelow < tooltipRect.height + padding * 2) {
                if (spaceAbove > spaceBelow) finalPlacement = "top";
            } else if (finalPlacement === "top" && spaceAbove < tooltipRect.height + padding * 2) {
                if (spaceBelow > spaceAbove) finalPlacement = "bottom";
            } else if (finalPlacement === "right" && spaceRight < tooltipRect.width + padding * 2) {
                if (spaceLeft > spaceRight) finalPlacement = "left";
            } else if (finalPlacement === "left" && spaceLeft < tooltipRect.width + padding * 2) {
                if (spaceRight > spaceLeft) finalPlacement = "right";
            }

            switch (finalPlacement) {
                case "bottom":
                    top = targetRect.bottom + padding + arrowSize;
                    left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
                    newArrowPosition = "top";
                    break;
                case "top":
                    top = targetRect.top - tooltipRect.height - padding - arrowSize;
                    left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
                    newArrowPosition = "bottom";
                    break;
                case "left":
                    top = targetRect.top + targetRect.height / 2 - tooltipRect.height / 2;
                    left = targetRect.left - tooltipRect.width - padding - arrowSize;
                    newArrowPosition = "right";
                    break;
                case "right":
                    top = targetRect.top + targetRect.height / 2 - tooltipRect.height / 2;
                    left = targetRect.right + padding + arrowSize;
                    newArrowPosition = "left";
                    break;
                default:
                    top = targetRect.bottom + padding;
                    left = targetRect.left;
                    newArrowPosition = "top";
            }

            // Clamp horizontal position to viewport
            const viewportWidth = window.innerWidth;
            if (left < padding) left = padding;
            if (left + tooltipRect.width > viewportWidth - padding) {
                left = viewportWidth - tooltipRect.width - padding;
            }

            // Clamp vertical position to viewport
            if (top < padding) top = padding;
            if (top + tooltipRect.height > window.innerHeight - padding) {
                top = window.innerHeight - tooltipRect.height - padding;
            }

            setTargetPosition({ top, left, arrowPosition: newArrowPosition });
            setIsInitialized(true);
        };

        const element = document.querySelector(step.target);
        if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
            setTimeout(calculatePosition, 400);
        } else {
            setTimeout(calculatePosition, 100);
        }

        window.addEventListener("resize", calculatePosition);
        window.addEventListener("scroll", calculatePosition, true);
        return () => {
            window.removeEventListener("resize", calculatePosition);
            window.removeEventListener("scroll", calculatePosition, true);
        };
    }, [step, isVisible]);

    if (!isVisible) return null;

    const isFirstStep = currentIndex === 0;
    const isLastStep = currentIndex === totalSteps - 1;

    const arrowClasses = {
        top: "-top-2 left-1/2 -translate-x-1/2 border-b-0 border-r-0",
        bottom: "-bottom-2 left-1/2 -translate-x-1/2 border-t-0 border-l-0",
        left: "-left-2 top-1/2 -translate-y-1/2 border-t-0 border-r-0",
        right: "-right-2 top-1/2 -translate-y-1/2 border-b-0 border-l-0",
        none: "hidden",
    };

    return (
        <div
            ref={tooltipRef}
            className={`fixed z-[9999] w-80 max-w-[calc(100vw-2rem)] transition-opacity duration-300 ${
                isInitialized ? "opacity-100" : "opacity-0"
            }`}
            style={{
                top: animatedPosition?.top ?? 0,
                left: animatedPosition?.left ?? 0,
            }}
        >
            {arrowPosition !== "none" && (
                <div
                    className={`absolute w-4 h-4 bg-card border border-border rotate-45 transition-all duration-200 ${
                        arrowClasses[arrowPosition]
                    }`}
                />
            )}

            <div className="bg-card rounded-2xl border border-border shadow-xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                    <h3 className="text-lg font-bold text-foreground font-serif">
                        {step.title}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-foreground/5 transition-colors"
                        aria-label="Close tour"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="px-5 py-4">
                    <p className="text-sm text-muted leading-relaxed">{step.content}</p>
                </div>

                <div className="flex items-center justify-between px-5 py-4 border-t border-border bg-foreground/[0.02]">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted font-medium">
                            {currentIndex + 1} / {totalSteps}
                        </span>
                        <div className="flex gap-1">
                            {Array.from({ length: totalSteps }).map((_, i) => (
                                <div
                                    key={i}
                                    className={`w-1.5 h-1.5 rounded-full transition-colors ${
                                        i === currentIndex
                                            ? "bg-violet-500"
                                            : i < currentIndex
                                            ? "bg-violet-500/40"
                                            : "bg-border"
                                    }`}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {!isFirstStep && (
                            <button
                                onClick={onPrev}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-muted hover:text-foreground transition-colors"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                Back
                            </button>
                        )}
                        {isFirstStep && (
                            <button
                                onClick={onSkip}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-muted hover:text-foreground transition-colors"
                            >
                                Skip
                                <SkipForward className="w-4 h-4" />
                            </button>
                        )}
                        <button
                            onClick={onNext}
                            className="flex items-center gap-1 px-4 py-2 rounded-lg bg-violet-500 text-white text-sm font-bold hover:bg-violet-600 transition-colors"
                        >
                            {isLastStep ? "Finish" : "Next"}
                            {!isLastStep && <ChevronRight className="w-4 h-4" />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
