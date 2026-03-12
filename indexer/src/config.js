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
 * Minimal ABI for ParaTraceRegistry — only the functions the indexer calls.
 * Full ABI lives in contracts-solidity/artifacts once compiled.
 */
const REGISTRY_ABI = [
  // Record a cross-chain transfer for a wallet; triggers risk scoring.
  'function processWalletAudit(address _wallet, uint128 _volume, uint32 _count) external',
  // Read back risk data for a wallet.
  'function getRiskData(address _wallet) external view returns (uint8, bool)',
];

// ─── Indexing thresholds ──────────────────────────────────────────────────

/** Skip transfers below this amount (planck / smallest token unit). */
const MIN_TRANSFER_AMOUNT = BigInt(process.env.MIN_TRANSFER_AMOUNT || '0');

// ─── Chain identifiers ────────────────────────────────────────────────────
const CHAIN_NAMES = {
  POLKADOT_HUB: 'Polkadot Hub',
  ASSET_HUB: 'Asset Hub',
};

module.exports = {
  POLKADOT_HUB_WS_RPC,
  ASSET_HUB_WS_RPC,
  ETH_RPC_URL,
  INDEXER_PRIVATE_KEY,
  REGISTRY_CONTRACT_ADDRESS,
  REGISTRY_ABI,
  MIN_TRANSFER_AMOUNT,
  CHAIN_NAMES,
};
