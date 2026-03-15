"use client";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
    const { resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <div className="w-9 h-9 rounded-lg border border-white/[0.05] dark:border-white/[0.05] flex items-center justify-center">
                <div className="w-4 h-4 bg-white/10 rounded-full animate-pulse" />
            </div>
        );
    }

    const isDark = resolvedTheme === "dark";

    return (
        <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 border border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5 text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white"
            aria-label="Toggle theme"
        >
            {isDark ? (
                <Sun className="w-4 h-4" />
            ) : (
                <Moon className="w-4 h-4" />
            )}
        </button>
    );
}
