#![cfg_attr(not(feature = "std"), no_std, no_main)]

#[ink::contract]
mod risk_engine {
    #[ink(storage)]
    pub struct RiskEngine {}

    impl RiskEngine {
        #[ink(constructor)]
        pub fn new() -> Self {
            Self {}
        }

        /// Advanced multi-factor risk scoring algorithm.
        ///
        /// This function is completely STATELESS — it performs pure computation
        /// with zero storage reads or writes, keeping gas costs minimal on RISC-V.
        ///
        /// Scoring breakdown (max 100):
        ///   - Volume tiers:           /30
        ///   - Transaction frequency:  /20
        ///   - Velocity (speed):       /20
        ///   - Chain diversity:        /15
        ///   - Flagged interactions:   /15
        #[ink(message)]
        pub fn calculate_score(
            &self,
            total_volume: u128,
            tx_count: u32,
            avg_time_between_txs: u32,
            unique_chains: u8,
            flagged_interactions: u8,
        ) -> u8 {
            let mut score: u8 = 0;

            // ── Factor 1: Volume Tiers (max 30 points) ──────────────────
            // Uses 10^18 precision to match Solidity's wei standard.
            let vol_10: u128 = 10_000_000_000_000_000_000; // 10 PAS
            let vol_50: u128 = 50_000_000_000_000_000_000; // 50 PAS
            let vol_100: u128 = 100_000_000_000_000_000_000; // 100 PAS

            if total_volume > vol_100 {
                score = score.saturating_add(30);
            } else if total_volume > vol_50 {
                score = score.saturating_add(20);
            } else if total_volume > vol_10 {
                score = score.saturating_add(10);
            }

            // ── Factor 2: Transaction Frequency (max 20 points) ─────────
            if tx_count > 100 {
                score = score.saturating_add(20);
            } else if tx_count > 50 {
                score = score.saturating_add(15);
            } else if tx_count > 20 {
                score = score.saturating_add(10);
            }

            // ── Factor 3: Velocity — rapid txs = suspicious (max 20) ────
            // avg_time_between_txs is in seconds. Lower = faster = riskier.
            // A value of 0 means only one tx recorded (no interval yet).
            if avg_time_between_txs > 0 && avg_time_between_txs < 60 {
                score = score.saturating_add(20); // < 1 min average
            } else if avg_time_between_txs > 0 && avg_time_between_txs < 300 {
                score = score.saturating_add(10); // < 5 min average
            }

            // ── Factor 4: Chain Diversity — chain hopping (max 15) ──────
            // Each unique chain adds 3 points, capped at 15.
            let chain_score: u8 = unique_chains.saturating_mul(3);
            score = score.saturating_add(if chain_score > 15 { 15 } else { chain_score });

            // ── Factor 5: Flagged Wallet Interactions (max 15) ──────────
            // Each interaction with a known-flagged wallet adds 5 points.
            let flag_score: u8 = flagged_interactions.saturating_mul(5);
            score = score.saturating_add(if flag_score > 15 { 15 } else { flag_score });

            // ── Final cap at 100 ────────────────────────────────────────
            if score > 100 {
                100
            } else {
                score
            }
        }
    }
}
