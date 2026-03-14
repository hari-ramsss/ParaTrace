import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Navbar from "@/components/Navbar";
import MuiProvider from "@/components/MuiProvider";
import NetworkStatus from "@/components/NetworkStatus";
import "./globals.css";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ParaTrace — Cross-Chain Risk Intelligence",
  description:
    "Real-time cross-chain risk profiling for Polkadot. Monitor XCM transfers, detect suspicious patterns, and flag high-risk wallets.",
  keywords: ["Polkadot", "XCM", "risk", "cross-chain", "ParaTrace", "blockchain"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} antialiased bg-grid min-h-screen`}>
        <MuiProvider>
          <Navbar />
          <main className="pt-16 pb-12">{children}</main>
          <NetworkStatus rpcUrl={process.env.NEXT_PUBLIC_ETH_RPC_URL || "https://services.polkadothub-rpc.com/testnet"} />
        </MuiProvider>
      </body>
    </html>
  );
}

