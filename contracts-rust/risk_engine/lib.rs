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
        /// Calculates a risk score safely using saturating arithmetic.
        /// Selector 0x0a0b0c0d matches the Solidity interface.
        #[ink(message, selector = 0x0a0b0c0d)]
        pub fn calculate_score(&self, volume: u128, tx_count: u32) -> u8 {
            let mut score: u8 = 0;
            
            // 10 PAS (10^18 precision)
            if volume > 10_000_000_000_000_000_000 { 
                score = score.saturating_add(40); 
            } 
            
            if tx_count > 50 { 
                score = score.saturating_add(50); 
            }
            
            // Ensure the final return never exceeds 100
            if score > 100 { 100 } else { score }
        }
    }
}