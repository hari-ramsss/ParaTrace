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
    const [position, setPosition] = useState<Position | null>(null);
    const [isPositioned, setIsPositioned] = useState(false);
    const tooltipRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isVisible) {
            setIsPositioned(false);
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
                setPosition({ top, left, arrowPosition: "none" });
                setIsPositioned(true);
                return;
            }

            const targetRect = element.getBoundingClientRect();
            let top: number;
            let left: number;
            let arrowPosition: Position["arrowPosition"];

            switch (step.placement) {
                case "bottom":
                    top = targetRect.bottom + padding + arrowSize;
                    left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
                    arrowPosition = "top";
                    break;
                case "top":
                    top = targetRect.top - tooltipRect.height - padding - arrowSize;
                    left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
                    arrowPosition = "bottom";
                    break;
                case "left":
                    top = targetRect.top + targetRect.height / 2 - tooltipRect.height / 2;
                    left = targetRect.left - tooltipRect.width - padding - arrowSize;
                    arrowPosition = "right";
                    break;
                case "right":
                    top = targetRect.top + targetRect.height / 2 - tooltipRect.height / 2;
                    left = targetRect.right + padding + arrowSize;
                    arrowPosition = "left";
                    break;
                default:
                    top = targetRect.bottom + padding;
                    left = targetRect.left;
                    arrowPosition = "top";
            }

            const viewportWidth = window.innerWidth;
            if (left < padding) left = padding;
            if (left + tooltipRect.width > viewportWidth - padding) {
                left = viewportWidth - tooltipRect.width - padding;
            }

            setPosition({ top, left, arrowPosition });
            setIsPositioned(true);
        };

        const element = document.querySelector(step.target);
        if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
            setTimeout(calculatePosition, 400);
        } else {
            calculatePosition();
        }

        window.addEventListener("resize", calculatePosition);
        return () => window.removeEventListener("resize", calculatePosition);
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
            className={`fixed z-[9999] w-80 max-w-[calc(100vw-2rem)] transition-all duration-300 ease-out ${
                isPositioned ? "opacity-100 scale-100" : "opacity-0 scale-95"
            }`}
            style={{
                top: position?.top ?? 0,
                left: position?.left ?? 0,
            }}
        >
            {position && position.arrowPosition !== "none" && (
                <div
                    className={`absolute w-4 h-4 bg-card border border-border rotate-45 ${
                        arrowClasses[position.arrowPosition]
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
