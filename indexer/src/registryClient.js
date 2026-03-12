'use strict';

/**
 * registryClient.js
 *
 * Ethers.js client for the deployed ParaTraceRegistry Solidity contract.
 *
 * Responsibilities:
 *  - Connect to the Polkadot Hub EVM RPC (ETH-compatible JSON-RPC)
 *  - Call processWalletAudit(address, volume, txCount) for each detected
 *    XCM transfer to update the on-chain registry and trigger risk scoring
 *  - Expose a read-only getRiskData(address) helper for spot-checking
 *
 * The ParaTraceRegistry.sol ABI (relevant functions):
 *   processWalletAudit(address _wallet, uint128 _volume, uint32 _count)
 *   getRiskData(address _wallet) returns (uint8 riskScore, bool isFlagged)
 */

const { ethers } = require('ethers');
const logger = require('./logger');
const {
  ETH_RPC_URL,
  INDEXER_PRIVATE_KEY,
  REGISTRY_CONTRACT_ADDRESS,
  REGISTRY_ABI,
} = require('./config');
const { toEvmAddress } = require('./addressUtils');

// ─── Module state ──────────────────────────────────────────────────────────

let _provider = null;
let _signer = null;
let _contract = null;

// Per-wallet tx counters accumulated during this indexer session
// key: evmAddress (lowercase), value: { volume: bigint, txCount: number }
const _walletStats = new Map();

// ─── Init / shutdown ───────────────────────────────────────────────────────

/**
 * Initialise the ethers.js provider, signer, and contract instance.
 * Must be called before any other function.
 */
async function init() {
  if (!REGISTRY_CONTRACT_ADDRESS) {
    logger.warn(
      'REGISTRY_CONTRACT_ADDRESS not set — registry calls will be skipped'
    );
    return false;
  }
  if (!INDEXER_PRIVATE_KEY) {
    logger.warn(
      'INDEXER_PRIVATE_KEY not set — registry calls will be skipped'
    );
    return false;
  }

  _provider = new ethers.JsonRpcProvider(ETH_RPC_URL);
  _signer = new ethers.Wallet(INDEXER_PRIVATE_KEY, _provider);
  _contract = new ethers.Contract(REGISTRY_CONTRACT_ADDRESS, REGISTRY_ABI, _signer);

  const address = await _signer.getAddress();
  const balance = await _provider.getBalance(address);
  logger.info(
    `Registry client ready | Signer: ${address} | Balance: ${ethers.formatEther(balance)} ETH`
  );
  return true;
}

/**
 * Returns true if the registry client was successfully initialised.
 */
function isReady() {
  return _contract !== null;
}

// ─── Core write call ───────────────────────────────────────────────────────

/**
 * Submit a processWalletAudit transaction to the Solidity registry.
 *
 * @param {string} evmAddress   20-byte EVM address (H160)
 * @param {bigint} volume       Cumulative transfer volume in smallest units
 * @param {number} txCount      Number of cross-chain txs recorded for this call
 * @returns {Promise<string|null>}  Transaction hash, or null on failure
 */
async function submitWalletAudit(evmAddress, volume, txCount) {
  if (!isReady()) return null;

  try {
    const tx = await _contract.processWalletAudit(
      evmAddress,
      volume,           // ethers handles bigint → uint128
      txCount           // uint32
    );

    logger.info(
      `processWalletAudit submitted | Wallet: ${evmAddress} | Volume: ${volume} | TxCount: ${txCount} | TxHash: ${tx.hash}`
    );

    // Wait for 1 confirmation
    const receipt = await tx.wait(1);
    logger.info(
      `processWalletAudit confirmed | Block: ${receipt.blockNumber} | Gas used: ${receipt.gasUsed}`
    );

    return tx.hash;
  } catch (err) {
    logger.error(`processWalletAudit failed for ${evmAddress}: ${err.message}`);
    return null;
  }
}

// ─── Batch accumulator ─────────────────────────────────────────────────────

/**
 * Record a single detected XCM transfer for a wallet in session memory,
 * then immediately push an audit to the registry.
 *
 * Each call to this function represents one cross-chain transfer event.
 *
 * @param {object} transfer   XcmTransfer object from eventParser
 */
async function recordTransfer(transfer) {
  const { sender, receiver, amount } = transfer;

  const wallets = new Set();
  if (sender) {
    try { wallets.add(toEvmAddress(sender)); } catch { /* skip unparseable */ }
  }
  if (receiver) {
    try { wallets.add(toEvmAddress(receiver)); } catch { /* skip */ }
  }

  for (const evmAddr of wallets) {
    // Accumulate stats
    if (!_walletStats.has(evmAddr)) {
      _walletStats.set(evmAddr, { volume: BigInt(0), txCount: 0 });
    }
    const stats = _walletStats.get(evmAddr);
    stats.volume += amount;
    stats.txCount += 1;

    if (!isReady()) {
      logger.debug(
        `[dry-run] Would call processWalletAudit(${evmAddr}, ${stats.volume}, ${stats.txCount})`
      );
      continue;
    }

    await submitWalletAudit(evmAddr, stats.volume, stats.txCount);
  }
}

// ─── Read helper ───────────────────────────────────────────────────────────

/**
 * Read the current risk data for a wallet from the registry (read-only).
 *
 * @param {string} walletAddress  EVM or Substrate address
 * @returns {Promise<{riskScore: number, isFlagged: boolean}|null>}
 */
async function getRiskData(walletAddress) {
  if (!_contract) return null;
  try {
    const evmAddr = toEvmAddress(walletAddress);
    const [riskScore, isFlagged] = await _contract.getRiskData(evmAddr);
    return { riskScore: Number(riskScore), isFlagged };
  } catch (err) {
    logger.error(`getRiskData failed: ${err.message}`);
    return null;
  }
}

module.exports = { init, isReady, recordTransfer, getRiskData, submitWalletAudit };
