"use client";
import { useEffect, useState } from "react";
import { Activity, Users, AlertTriangle, BarChart3 } from "lucide-react";
import StatCard from "@/components/StatCard";
import RecentActivity from "@/components/RecentActivity";
import RiskChart from "@/components/RiskChart";
import RiskTrendChart from "@/components/ChainActivityChart";
import { getDashboardStats, type TransactionEvent } from "@/lib/registry";
import grained from "@/utils/grained";
import Link from "next/link";

interface DashboardData {
  totalTransactions: number;
  totalWallets: number;
  flaggedCount: number;
  recentTransactions: TransactionEvent[];
  allTransactions: TransactionEvent[];
  riskDistribution: { low: number; medium: number; high: number };
  avgScore: number;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const stats = await getDashboardStats();

        // Compute risk distribution from transaction scores
        let low = 0, medium = 0, high = 0, totalScore = 0;
        const walletScores = new Map<string, number>();
        for (const tx of stats.allTransactions) {
          walletScores.set(tx.wallet, tx.newScore);
        }
        for (const score of walletScores.values()) {
          totalScore += score;
          if (score <= 50) low++;
          else if (score <= 75) medium++;
          else high++;
        }

        setData({
          ...stats,
          riskDistribution: { low, medium, high },
          avgScore: walletScores.size > 0 ? Math.round(totalScore / walletScores.size) : 0,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch data");
      } finally {
        setLoading(false);
      }
    }
    fetchData();

    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const options = {
        animate: true,
        patternWidth: 311.79,
        patternHeight: 96.22,
        grainOpacity: 0.37,
        grainDensity: 1,
        grainWidth: 1.3,
        grainHeight: 1,
      };

      const cleanup = grained("#hero-banner", options);
      return () => {
        if (cleanup) cleanup();
      };
    }
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 animate-fade-in">
      {/* Hero */}
      <div
        id="hero-banner"
        className="relative mb-16 py-12 flex flex-col items-center text-center rounded-3xl border border-border transition-colors duration-300 bg-card overflow-hidden shadow-sm"
      >
        <h1 className="text-6xl font-bold text-foreground mb-6 font-serif max-w-4xl tracking-tight leading-tight relative z-20">
          Risk Intelligence Dashboard
        </h1>
        <p className="text-muted text-xl font-dm-sans max-w-2xl mb-10 leading-relaxed relative z-20">
          Everything you need to monitor cross-chain risk for Polkadot XCM transfers in real-time.
        </p>
        <div className="flex items-center gap-4 relative z-20">
          <Link href="/transactions" className="px-8 py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2 group shadow-lg">
            Start Monitoring <span className="text-lg group-hover:translate-x-1 transition-transform">→</span>
          </Link>
          <Link href="#analytics" className="px-8 py-3 bg-secondary text-foreground font-bold rounded-xl hover:opacity-80 transition-opacity shadow-lg cursor-pointer">
            View Analytics
          </Link>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <strong>Connection Error:</strong> {error}. Make sure the RPC endpoint is reachable.
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        <StatCard
          title="Total Transactions"
          value={loading ? "—" : data?.totalTransactions ?? 0}
          subtitle="Recorded XCM transfers"
          icon={Activity}
        />
        <StatCard
          title="Wallets Monitored"
          value={loading ? "—" : data?.totalWallets ?? 0}
          subtitle="Unique addresses"
          icon={Users}
        />
        <StatCard
          title="Flagged Wallets"
          value={loading ? "—" : data?.flaggedCount ?? 0}
          subtitle="Above risk threshold"
          icon={AlertTriangle}
        />
        <StatCard
          title="Avg Risk Score"
          value={loading ? "—" : data?.avgScore ?? 0}
          subtitle="Across all wallets"
          icon={BarChart3}
        />
      </div>

      {/* Charts Row */}
      <div id="analytics" className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10 scroll-mt-24">
        {loading ? (
          <>
            <div className="h-[350px] bg-card rounded-2xl animate-pulse" />
            <div className="h-[350px] bg-card rounded-2xl animate-pulse" />
          </>
        ) : (
          <>
            <RiskChart
              transactions={data?.allTransactions ?? []}
            />
            <RiskTrendChart
              transactions={data?.allTransactions ?? []}
            />
          </>
        )}
      </div>

      {/* Recent Activity */}
      <RecentActivity
        transactions={data?.recentTransactions ?? []}
        loading={loading}
      />
    </div>
  );
}
