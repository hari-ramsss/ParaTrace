"use client";

import { createTheme, ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { useTheme } from "next-themes";
import { useEffect, useState, useMemo } from "react";



export default function MuiProvider({ children }: { children: React.ReactNode }) {
    const { resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const theme = useMemo(() => {
        const mode = mounted && resolvedTheme === "light" ? "light" : "dark";
        return createTheme({
            palette: {
                mode: mode,
                background: {
                    default: mode === "dark" ? "#111111" : "#f8f9fa",
                    paper: mode === "dark" ? "#18181b" : "#ffffff",
                },
                primary: {
                    main: mode === "dark" ? "#ffffff" : "#0e0e0e",
                },
                text: {
                    primary: mode === "dark" ? "#ffffff" : "#0e0e0e",
                    secondary: mode === "dark" ? "#a1a1a1" : "#6c757d",
                },
            },
            typography: {
                fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
            },
            components: {
                MuiCssBaseline: {
                    styleOverrides: {
                        body: {
                            backgroundColor: "transparent",
                        },
                    },
                },
            },
        });
    }, [mounted, resolvedTheme]);

    // Prevent hydration mismatch by not rendering until mounted
    if (!mounted) {
        return <>{children}</>;
    }

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline enableColorScheme />
            {children}
        </ThemeProvider>
    );
}
