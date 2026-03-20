// Contract ABI for ParaTraceRegistry.sol (read-only functions + events)
export const REGISTRY_ABI = [
  // Oracle / view functions
  "function getRiskScore(address _wallet) external view returns (uint8)",
  "function isWalletFlagged(address _wallet) external view returns (bool)",
  "function getRiskData(address _wallet) external view returns (uint8, bool)",
  "function getFullProfile(address _wallet) external view returns (tuple(uint128 totalVolume, uint32 txCount, uint32 lastTxTimestamp, uint32 avgTimeBetweenTxs, uint16 chainBitmap, uint8 uniqueChains, uint8 flaggedInteractions, uint8 riskScore, bool isFlagged))",
  "function owner() external view returns (address)",
  "function flagThreshold() external view returns (uint8)",

  // Events
  "event TransactionRecorded(address indexed wallet, uint128 amount, uint8 sourceChain, uint8 destChain, uint8 newScore)",
  "event WalletFlagged(address indexed wallet, uint8 riskScore)",
  "event WalletUnflagged(address indexed wallet, uint8 newScore)",
  "event RiskScoreUpdated(address indexed wallet, uint8 oldScore, uint8 newScore)",
];

// Deployed contract address on Polkadot Hub Testnet
export const REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS || "0xbA686106E15b9b27407b94Cb51bf734705cAF80a";

// RPC endpoint
export const ETH_RPC_URL = process.env.NEXT_PUBLIC_ETH_RPC_URL || "https://services.polkadothub-rpc.com/testnet";

// Chain slot ID → human-readable name
export const CHAIN_NAMES: Record<number, string> = {
  0: "Westend Relay",
  1: "Asset Hub",
  2: "Bridge Hub",
  3: "People Chain",
  4: "Coretime",
  5: "Bifrost",
  6: "Moonbeam",
  7: "Astar",
  8: "Acala",
  9: "Parallel",
  15: "Unknown",
};

// Risk level thresholds
export const RISK_LEVELS = {
  LOW: { max: 50, label: "Low", color: "#22c55e" },
  MEDIUM: { max: 75, label: "Medium", color: "#f59e0b" },
  HIGH: { max: 100, label: "High", color: "#ef4444" },
} as const;

export function getRiskLevel(score: number) {
  if (score <= RISK_LEVELS.LOW.max) return RISK_LEVELS.LOW;
  if (score <= RISK_LEVELS.MEDIUM.max) return RISK_LEVELS.MEDIUM;
  return RISK_LEVELS.HIGH;
}

// Chain slot ID → block explorer base URL
export const CHAIN_EXPLORER_URLS: Record<number, string> = {
  0: "https://westend.subscan.io",               // Westend Relay
  1: "https://assethub-westend.subscan.io",      // Asset Hub
  2: "https://bridgehub-westend.subscan.io",     // Bridge Hub
  3: "https://westend.subscan.io",               // People Chain (Westend)
  4: "https://westend.subscan.io",               // Coretime (Westend)
};

export function getChainExplorerUrl(slot: number): string {
  return CHAIN_EXPLORER_URLS[slot] || "https://westend.subscan.io";
}

// Blockscout EVM explorer for Polkadot Hub Testnet
export const BLOCKSCOUT_BASE_URL = "https://blockscout-testnet.polkadot.io";

export function getBlockscoutTxUrl(txHash: string): string {
  return `${BLOCKSCOUT_BASE_URL}/tx/${txHash}`;
}
