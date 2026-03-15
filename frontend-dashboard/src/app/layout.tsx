import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import Navbar from "@/components/Navbar";
import MuiProvider from "@/components/MuiProvider";
import NetworkStatus from "@/components/NetworkStatus";
import { ThemeProvider } from "next-themes";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "ParaTrace — Cross-Chain Risk Intelligence",
  description:
    "Real-time cross-chain risk profiling for Polkadot. Monitor XCM transfers, detect suspicious patterns, and flag high-risk wallets.",
  keywords: ["Polkadot", "XCM", "risk", "cross-chain", "ParaTrace", "blockchain"],
  icons: {
    icon: "/polkadot.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${dmSans.variable} ${fraunces.variable} antialiased bg-grid min-h-screen relative`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <MuiProvider>
            <Navbar />
            <main className="pt-16 pb-12">{children}</main>
            <NetworkStatus rpcUrl={process.env.NEXT_PUBLIC_ETH_RPC_URL || "https://services.polkadothub-rpc.com/testnet"} />
          </MuiProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

