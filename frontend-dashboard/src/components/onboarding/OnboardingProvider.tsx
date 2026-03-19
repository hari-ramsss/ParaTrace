"use client";

import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    useMemo,
} from "react";
import { TOUR_STEPS, type TourStep } from "./tourSteps";

const STORAGE_KEY = "paratrace_onboarding_completed";
const STORAGE_VERSION = "v1";

interface OnboardingContextType {
    isActive: boolean;
    currentStep: number;
    steps: TourStep[];
    hasCompleted: boolean;
    startTour: () => void;
    endTour: (markComplete?: boolean) => void;
    nextStep: () => void;
    prevStep: () => void;
    goToStep: (index: number) => void;
    skipTour: () => void;
    resetTour: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
    const [isActive, setIsActive] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [hasCompleted, setHasCompleted] = useState(true);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const stored = localStorage.getItem(STORAGE_KEY);
        const completed = stored === STORAGE_VERSION;
        setHasCompleted(completed);

        if (!completed) {
            const timer = setTimeout(() => {
                setIsActive(true);
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, []);

    const startTour = useCallback(() => {
        setCurrentStep(0);
        setIsActive(true);
    }, []);

    const endTour = useCallback((markComplete = true) => {
        setIsActive(false);
        setCurrentStep(0);
        if (markComplete) {
            localStorage.setItem(STORAGE_KEY, STORAGE_VERSION);
            setHasCompleted(true);
        }
    }, []);

    const nextStep = useCallback(() => {
        if (currentStep < TOUR_STEPS.length - 1) {
            setCurrentStep((prev) => prev + 1);
        } else {
            endTour(true);
        }
    }, [currentStep, endTour]);

    const prevStep = useCallback(() => {
        if (currentStep > 0) {
            setCurrentStep((prev) => prev - 1);
        }
    }, [currentStep]);

    const goToStep = useCallback((index: number) => {
        if (index >= 0 && index < TOUR_STEPS.length) {
            setCurrentStep(index);
        }
    }, []);

    const skipTour = useCallback(() => {
        endTour(true);
    }, [endTour]);

    const resetTour = useCallback(() => {
        localStorage.removeItem(STORAGE_KEY);
        setHasCompleted(false);
        setCurrentStep(0);
    }, []);

    const value = useMemo(
        () => ({
            isActive,
            currentStep,
            steps: TOUR_STEPS,
            hasCompleted,
            startTour,
            endTour,
            nextStep,
            prevStep,
            goToStep,
            skipTour,
            resetTour,
        }),
        [
            isActive,
            currentStep,
            hasCompleted,
            startTour,
            endTour,
            nextStep,
            prevStep,
            goToStep,
            skipTour,
            resetTour,
        ]
    );

    return (
        <OnboardingContext.Provider value={value}>
            {children}
        </OnboardingContext.Provider>
    );
}

export function useOnboarding() {
    const context = useContext(OnboardingContext);
    if (context === undefined) {
        throw new Error("useOnboarding must be used within an OnboardingProvider");
    }
    return context;
}
