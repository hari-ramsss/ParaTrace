'use strict';

require('dotenv').config();

// ─── Network configuration ─────────────────────────────────────────────────

/**
 * Polkadot Hub Westend Testnet — Substrate WS RPC
 * Used by @polkadot/api to subscribe to on-chain events.
 */
const POLKADOT_HUB_WS_RPC =
  process.env.POLKADOT_HUB_WS_RPC || 'wss://westend-rpc.polkadot.io';

/**
 * Asset Hub Westend Testnet — Substrate WS RPC
 * Used by @polkadot/api to subscribe to on-chain events on Asset Hub.
 */
const ASSET_HUB_WS_RPC =
  process.env.ASSET_HUB_WS_RPC || 'wss://westend-asset-hub-rpc.polkadot.io';

/**
 * Polkadot Hub EVM-compatible HTTP RPC
 * Used by ethers.js to send transactions to the Solidity registry.
 */
const ETH_RPC_URL =
  process.env.ETH_RPC_URL || 'https://services.polkadothub-rpc.com/testnet';

// ─── Indexer wallet ───────────────────────────────────────────────────────

/**
 * Private key of the account that signs processWalletAudit() calls.
 * Must be funded with native tokens on Polkadot Hub (for gas).
 */
const INDEXER_PRIVATE_KEY = process.env.INDEXER_PRIVATE_KEY || null;

// ─── Registry contract ────────────────────────────────────────────────────

/** Deployed address of ParaTraceRegistry.sol on Polkadot Hub. */
const REGISTRY_CONTRACT_ADDRESS =
  process.env.REGISTRY_CONTRACT_ADDRESS || null;

/**
 * ABI for ParaTraceRegistry.sol (updated contract).
 *
 * Primary write path: recordTransaction — called once per detected XCM transfer.
 * The contract accumulates volume, tx count, velocity and chain diversity itself.
 * Legacy processWalletAudit kept for backwards-compatibility only.
 */
const REGISTRY_ABI = [
  // ── Main write (called by indexer per XCM transfer) ─────────────────────
  'function recordTransaction(address _wallet, uint128 _amount, uint8 _sourceChain, uint8 _destChain, bool _counterpartyFlagged) external',

  // ── Legacy / simple audit ────────────────────────────────────────────────
  'function processWalletAudit(address _wallet, uint128 _volume, uint32 _count) external',

  // ── Oracle / view functions ──────────────────────────────────────────────
  'function getRiskScore(address _wallet) external view returns (uint8)',
  'function isWalletFlagged(address _wallet) external view returns (bool)',
  'function getRiskData(address _wallet) external view returns (uint8, bool)',
  'function getFullProfile(address _wallet) external view returns (tuple(uint128 totalVolume, uint32 txCount, uint32 lastTxTimestamp, uint32 avgTimeBetweenTxs, uint16 chainBitmap, uint8 uniqueChains, uint8 flaggedInteractions, uint8 riskScore, bool isFlagged))',

  // ── Events ───────────────────────────────────────────────────────────────
  'event TransactionRecorded(address indexed wallet, uint128 amount, uint8 sourceChain, uint8 destChain, uint8 newScore)',
  'event WalletFlagged(address indexed wallet, uint8 riskScore)',
  'event WalletUnflagged(address indexed wallet, uint8 newScore)',
  'event RiskScoreUpdated(address indexed wallet, uint8 oldScore, uint8 newScore)',

  // ── Admin ────────────────────────────────────────────────────────────────
  'function setFlagThreshold(uint8 _threshold) external',
  'function updateRiskEngineAddress(address _newAddress) external',
  'function transferOwnership(address _newOwner) external',
  'function owner() external view returns (address)',
  'function flagThreshold() external view returns (uint8)',
];

// ─── Indexing thresholds ──────────────────────────────────────────────────

/** Skip transfers below this amount (planck / smallest token unit). */
const MIN_TRANSFER_AMOUNT = BigInt(process.env.MIN_TRANSFER_AMOUNT || '0');

// ─── Chain identifiers ────────────────────────────────────────────────────
const CHAIN_NAMES = {
  POLKADOT_HUB: 'Polkadot Hub',
  ASSET_HUB: 'Asset Hub',
};

/**
 * Maps known Substrate parachain IDs to compact uint8 slot IDs (0–15) used
 * in the registry's 16-bit chain bitmap.
 *
 * Slot 0 is reserved for the Relay Chain / Polkadot Hub.
 * Add more entries as you monitor more parachains.
 *
 * Westend / Polkadot system parachains:
 *   Asset Hub   = parachainId 1000
 *   Bridge Hub  = parachainId 1002
 *   People      = parachainId 1004
 *   Coretime    = parachainId 1005
 */
const PARACHAIN_ID_TO_SLOT = {
  0:    0,  // Relay Chain / Polkadot Hub
  1000: 1,  // Asset Hub
  1002: 2,  // Bridge Hub
  1004: 3,  // People Chain
  1005: 4,  // Coretime Chain
  2030: 5,  // Bifrost
  2004: 6,  // Moonbeam
  2006: 7,  // Astar
  2000: 8,  // Acala
  2012: 9,  // Parallel Finance
};

/** Slot used when a parachain ID is not recognised. */
const UNKNOWN_CHAIN_SLOT = 15;

/**
 * Convert a raw parachain ID (number) to its uint8 chain slot.
 * @param {number|null} parachainId
 * @returns {number}  0–15
 */
function parachainToSlot(parachainId) {
  if (parachainId === null || parachainId === undefined) return UNKNOWN_CHAIN_SLOT;
  return PARACHAIN_ID_TO_SLOT[parachainId] ?? UNKNOWN_CHAIN_SLOT;
}

module.exports = {
  POLKADOT_HUB_WS_RPC,
  ASSET_HUB_WS_RPC,
  ETH_RPC_URL,
  INDEXER_PRIVATE_KEY,
  REGISTRY_CONTRACT_ADDRESS,
  REGISTRY_ABI,
  MIN_TRANSFER_AMOUNT,
  CHAIN_NAMES,
  PARACHAIN_ID_TO_SLOT,
  UNKNOWN_CHAIN_SLOT,
  parachainToSlot,
};
