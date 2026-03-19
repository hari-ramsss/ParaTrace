"use client";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
    const { resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [isTransitioning, setIsTransitioning] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <div className="w-10 h-10 rounded-xl border border-white/[0.05] dark:border-white/[0.05] flex items-center justify-center">
                <div className="w-5 h-5 bg-white/10 rounded-full animate-pulse" />
            </div>
        );
    }

    const isDark = resolvedTheme === "dark";

    const toggleTheme = (event: React.MouseEvent) => {
        const x = event.clientX;
        const y = event.clientY;

        // Fallback or early return if transition already in progress
        if (!(document as any).startViewTransition || isTransitioning) {
            setTheme(isDark ? "light" : "dark");
            return;
        }

        setIsTransitioning(true);
        document.documentElement.classList.add("view-transition-active");

        const transition = (document as any).startViewTransition(() => {
            setTheme(isDark ? "light" : "dark");
        });

        transition.ready.then(() => {
            const endRadius = Math.hypot(
                Math.max(x, window.innerWidth - x),
                Math.max(y, window.innerHeight - y)
            );

            document.documentElement.animate(
                {
                    clipPath: [
                        `circle(0px at ${x}px ${y}px)`,
                        `circle(${endRadius}px at ${x}px ${y}px)`,
                    ],
                },
                {
                    duration: 600,
                    easing: "cubic-bezier(0.4, 0, 0.2, 1)",
                    pseudoElement: "::view-transition-new(root)",
                }
            );
        });

        transition.finished.then(() => {
            document.documentElement.classList.remove("view-transition-active");
            setIsTransitioning(false);
        });
    };

    return (
        <button
            onClick={toggleTheme}
            disabled={isTransitioning}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 border border-black/5 dark:border-white/5 hover:bg-primary hover:text-primary-foreground text-muted hover:shadow-lg group"
            aria-label="Toggle theme"
        >
            {isDark ? (
                <Sun className="w-5 h-5 transition-transform group-hover:rotate-45" />
            ) : (
                <Moon className="w-5 h-5 transition-transform group-hover:-rotate-12" />
            )}
        </button>
    );
}
