"use client";

import { useEffect, useState } from "react";
import { Activity, Users, AlertTriangle, BarChart3 } from "lucide-react";
import StatCard from "@/components/StatCard";
import RecentActivity from "@/components/RecentActivity";
import RiskChart from "@/components/RiskChart";
import RiskTrendChart from "@/components/ChainActivityChart";
import { getDashboardStats, type TransactionEvent } from "@/lib/registry";

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

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 animate-fade-in">
      {/* Hero */}
      <div className="mb-10">
        <h1 className="text-4xl font-bold text-white mb-2">
          Risk Intelligence{" "}
          <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
            Dashboard
          </span>
        </h1>
        <p className="text-gray-400 text-lg">
          Real-time cross-chain risk profiling for Polkadot XCM transfers
        </p>
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
          color="violet"
        />
        <StatCard
          title="Wallets Monitored"
          value={loading ? "—" : data?.totalWallets ?? 0}
          subtitle="Unique addresses"
          icon={Users}
          color="blue"
        />
        <StatCard
          title="Flagged Wallets"
          value={loading ? "—" : data?.flaggedCount ?? 0}
          subtitle="Above risk threshold"
          icon={AlertTriangle}
          color="red"
        />
        <StatCard
          title="Avg Risk Score"
          value={loading ? "—" : data?.avgScore ?? 0}
          subtitle="Across all wallets"
          icon={BarChart3}
          color="amber"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        {loading ? (
          <>
            <div className="h-[350px] bg-white/5 rounded-2xl animate-pulse" />
            <div className="h-[350px] bg-white/5 rounded-2xl animate-pulse" />
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
