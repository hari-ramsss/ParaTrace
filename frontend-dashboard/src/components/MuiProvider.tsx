"use client";

import { createTheme, ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

const darkTheme = createTheme({
    palette: {
        mode: "dark",
        background: {
            default: "#0a0a0f",
            paper: "#12121a",
        },
        primary: {
            main: "#8b5cf6",
        },
        text: {
            primary: "#ffffff",
            secondary: "#9ca3af",
        },
    },
    typography: {
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
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

export default function MuiProvider({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider theme={darkTheme}>
            <CssBaseline enableColorScheme />
            {children}
        </ThemeProvider>
    );
}
