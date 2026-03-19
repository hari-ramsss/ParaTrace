"use client";

import { useEffect } from "react";
import { useOnboarding } from "./OnboardingProvider";
import TourOverlay from "./TourOverlay";
import TourTooltip from "./TourTooltip";

export default function OnboardingTour() {
    const {
        isActive,
        currentStep,
        steps,
        nextStep,
        prevStep,
        skipTour,
        endTour,
    } = useOnboarding();

    useEffect(() => {
        if (!isActive) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            switch (e.key) {
                case "Escape":
                    endTour(false);
                    break;
                case "ArrowRight":
                case "Enter":
                    nextStep();
                    break;
                case "ArrowLeft":
                    prevStep();
                    break;
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isActive, nextStep, prevStep, endTour]);

    useEffect(() => {
        if (!isActive) return;

        // Prevent manual scrolling via wheel/touch while allowing programmatic scroll
        const preventScroll = (e: WheelEvent | TouchEvent) => {
            e.preventDefault();
        };

        window.addEventListener("wheel", preventScroll, { passive: false });
        window.addEventListener("touchmove", preventScroll, { passive: false });

        return () => {
            window.removeEventListener("wheel", preventScroll);
            window.removeEventListener("touchmove", preventScroll);
        };
    }, [isActive]);

    if (!isActive || !steps[currentStep]) return null;

    const step = steps[currentStep];

    return (
        <>
            <TourOverlay step={step} isVisible={isActive} />
            <TourTooltip
                step={step}
                currentIndex={currentStep}
                totalSteps={steps.length}
                onNext={nextStep}
                onPrev={prevStep}
                onSkip={skipTour}
                onClose={() => endTour(false)}
                isVisible={isActive}
            />
        </>
    );
}
