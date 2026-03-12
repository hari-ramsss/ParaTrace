'use strict';

/**
 * registryClient.js
 *
 * Ethers.js client for the deployed ParaTraceRegistry Solidity contract.
 *
 * Primary call (per detected XCM transfer):
 *   recordTransaction(address wallet, uint128 amount, uint8 sourceChain, uint8 destChain, bool counterpartyFlagged)
 *   — onlyOwner. The contract accumulates volume, tx count, velocity, and
 *     chain diversity internally, then calls the Rust Risk Engine itself.
 *
 * Read helpers:
 *   getRiskScore(address)           → uint8
 *   isWalletFlagged(address)        → bool
 *   getRiskData(address)            → (uint8, bool)
 *   getFullProfile(address)         → WalletProfile struct
 *
 * Note on onlyOwner:
 *   The INDEXER_PRIVATE_KEY account **must be the contract owner** (set at
 *   deploy time) or the recordTransaction calls will revert.
 */

const { ethers } = require('ethers');
const logger = require('./logger');
const {
  ETH_RPC_URL,
  INDEXER_PRIVATE_KEY,
  REGISTRY_CONTRACT_ADDRESS,
  REGISTRY_ABI,
  parachainToSlot,
} = require('./config');
const { toEvmAddress } = require('./addressUtils');

// ─── Module state ──────────────────────────────────────────────────────────

let _provider = null;
let _signer   = null;
let _contract = null;

// ─── Init / shutdown ───────────────────────────────────────────────────────

/**
 * Initialise the ethers.js provider, signer, and contract instance.
 * Must be called before recordTransfer or any read helper.
 *
 * @returns {Promise<boolean>}  true if ready, false if running in dry-run mode
 */
async function init() {
  if (!REGISTRY_CONTRACT_ADDRESS) {
    logger.warn('REGISTRY_CONTRACT_ADDRESS not set — running in dry-run mode (no on-chain writes)');
    return false;
  }
  if (!INDEXER_PRIVATE_KEY) {
    logger.warn('INDEXER_PRIVATE_KEY not set — running in dry-run mode (no on-chain writes)');
    return false;
  }

  _provider = new ethers.JsonRpcProvider(ETH_RPC_URL);
  _signer   = new ethers.Wallet(INDEXER_PRIVATE_KEY, _provider);
  _contract = new ethers.Contract(REGISTRY_CONTRACT_ADDRESS, REGISTRY_ABI, _signer);

  const address = await _signer.getAddress();
  const balance = await _provider.getBalance(address);

  logger.info(`Registry client initialised`);
  logger.info(`  Signer  : ${address}`);
  logger.info(`  Balance : ${ethers.formatEther(balance)} (native)`);
  logger.info(`  Contract: ${REGISTRY_CONTRACT_ADDRESS}`);

  // Sanity-check: warn if the signer is not the contract owner
  try {
    const owner = await _contract.owner();
    if (owner.toLowerCase() !== address.toLowerCase()) {
      logger.warn(
        `WARNING: Signer (${address}) is NOT the contract owner (${owner}).` +
          ' recordTransaction calls will revert — transferOwnership first.'
      );
    } else {
      logger.info('  Ownership: confirmed ✓');
    }
  } catch (err) {
    logger.warn(`Could not verify contract ownership: ${err.message}`);
  }

  return true;
}

/**
 * Returns true if the client was initialised with a signer and contract.
 */
function isReady() {
  return _contract !== null;
}

// ─── Core write call ───────────────────────────────────────────────────────

/**
 * Call recordTransaction on the registry contract for a single wallet.
 *
 * The contract accumulates the data on-chain; one call per transfer event.
 *
 * @param {string}  evmAddress          EVM H160 address of the wallet
 * @param {bigint}  amount              Transfer amount in smallest units (uint128)
 * @param {number}  sourceChainSlot     uint8 slot ID of the source chain (0–15)
 * @param {number}  destChainSlot       uint8 slot ID of the dest chain (0–15)
 * @param {boolean} counterpartyFlagged Whether the counterparty is already flagged
 * @returns {Promise<string|null>}       Transaction hash, or null on failure
 */
async function _callRecordTransaction(
  evmAddress,
  amount,
  sourceChainSlot,
  destChainSlot,
  counterpartyFlagged
) {
  try {
    const tx = await _contract.recordTransaction(
      evmAddress,
      amount,              // uint128 — ethers handles bigint
      sourceChainSlot,     // uint8
      destChainSlot,       // uint8
      counterpartyFlagged  // bool
    );

    logger.info(
      `recordTransaction submitted | Wallet: ${evmAddress} | Amount: ${amount} | ` +
        `SrcSlot: ${sourceChainSlot} → DstSlot: ${destChainSlot} | ` +
        `CounterpartyFlagged: ${counterpartyFlagged} | TxHash: ${tx.hash}`
    );

    const receipt = await tx.wait(1);
    logger.info(
      `recordTransaction confirmed | Block: ${receipt.blockNumber} | Gas: ${receipt.gasUsed}`
    );

    return tx.hash;
  } catch (err) {
    logger.error(`recordTransaction failed for ${evmAddress}: ${err.message}`);
    return null;
  }
}

// ─── Public: record a detected XCM transfer ────────────────────────────────

/**
 * Handle a single detected XCM transfer from the event parser.
 *
 * For each wallet involved (sender + receiver):
 *  1. Convert their address to EVM H160
 *  2. Check if their counterparty is already flagged in the registry
 *  3. Call recordTransaction on the contract
 *
 * @param {object} transfer  XcmTransfer from eventParser.parseBlock
 */
async function recordTransfer(transfer) {
  const {
    sender,
    receiver,
    amount,
    sourceParachainId,
    destParachainId,
  } = transfer;

  const srcSlot = parachainToSlot(sourceParachainId);
  const dstSlot = parachainToSlot(destParachainId);

  // Resolve EVM addresses, skipping any that fail conversion
  let senderEvm   = null;
  let receiverEvm = null;

  if (sender) {
    try { senderEvm = toEvmAddress(sender); }
    catch (e) { logger.debug(`Cannot convert sender address "${sender}": ${e.message}`); }
  }
  if (receiver) {
    try { receiverEvm = toEvmAddress(receiver); }
    catch (e) { logger.debug(`Cannot convert receiver address "${receiver}": ${e.message}`); }
  }

  // ── Record the SENDER ────────────────────────────────────────────────────
  if (senderEvm) {
    // Is the receiver (sender's counterparty) already flagged?
    const counterpartyFlagged = receiverEvm
      ? await _checkFlagged(receiverEvm)
      : false;

    if (!isReady()) {
      logger.debug(
        `[dry-run] recordTransaction(${senderEvm}, ${amount}, ${srcSlot}, ${dstSlot}, ${counterpartyFlagged})`
      );
    } else {
      await _callRecordTransaction(senderEvm, amount, srcSlot, dstSlot, counterpartyFlagged);
    }
  }

  // ── Record the RECEIVER ──────────────────────────────────────────────────
  if (receiverEvm) {
    // The receiver's counterparty is the sender
    const counterpartyFlagged = senderEvm
      ? await _checkFlagged(senderEvm)
      : false;

    if (!isReady()) {
      logger.debug(
        `[dry-run] recordTransaction(${receiverEvm}, ${amount}, ${srcSlot}, ${dstSlot}, ${counterpartyFlagged})`
      );
    } else {
      await _callRecordTransaction(receiverEvm, amount, srcSlot, dstSlot, counterpartyFlagged);
    }
  }
}

// ─── Internal flag-check helper ────────────────────────────────────────────

/**
 * Check whether a wallet is currently flagged in the registry.
 * Returns false if the contract is unavailable (dry-run mode).
 *
 * @param {string} evmAddress
 * @returns {Promise<boolean>}
 */
async function _checkFlagged(evmAddress) {
  if (!isReady()) return false;
  try {
    return await _contract.isWalletFlagged(evmAddress);
  } catch (err) {
    logger.warn(`isWalletFlagged check failed for ${evmAddress}: ${err.message}`);
    return false;
  }
}

// ─── Read helpers ──────────────────────────────────────────────────────────

/**
 * Read the risk score (0–100) for a wallet.
 *
 * @param {string} walletAddress  EVM or Substrate address
 * @returns {Promise<number|null>}
 */
async function getRiskScore(walletAddress) {
  if (!_contract) return null;
  try {
    const score = await _contract.getRiskScore(toEvmAddress(walletAddress));
    return Number(score);
  } catch (err) {
    logger.error(`getRiskScore failed: ${err.message}`);
    return null;
  }
}

/**
 * Read the flag status for a wallet.
 *
 * @param {string} walletAddress
 * @returns {Promise<boolean|null>}
 */
async function isWalletFlagged(walletAddress) {
  if (!_contract) return null;
  try {
    return await _contract.isWalletFlagged(toEvmAddress(walletAddress));
  } catch (err) {
    logger.error(`isWalletFlagged failed: ${err.message}`);
    return null;
  }
}

/**
 * Read both risk score and flag status (legacy interface).
 *
 * @param {string} walletAddress
 * @returns {Promise<{riskScore:number, isFlagged:boolean}|null>}
 */
async function getRiskData(walletAddress) {
  if (!_contract) return null;
  try {
    const [riskScore, isFlagged] = await _contract.getRiskData(
      toEvmAddress(walletAddress)
    );
    return { riskScore: Number(riskScore), isFlagged };
  } catch (err) {
    logger.error(`getRiskData failed: ${err.message}`);
    return null;
  }
}

/**
 * Read the full WalletProfile struct for a wallet.
 *
 * @param {string} walletAddress
 * @returns {Promise<object|null>}
 */
async function getFullProfile(walletAddress) {
  if (!_contract) return null;
  try {
    const p = await _contract.getFullProfile(toEvmAddress(walletAddress));
    return {
      totalVolume:        p.totalVolume.toString(),
      txCount:            Number(p.txCount),
      lastTxTimestamp:    Number(p.lastTxTimestamp),
      avgTimeBetweenTxs:  Number(p.avgTimeBetweenTxs),
      chainBitmap:        Number(p.chainBitmap),
      uniqueChains:       Number(p.uniqueChains),
      flaggedInteractions: Number(p.flaggedInteractions),
      riskScore:          Number(p.riskScore),
      isFlagged:          p.isFlagged,
    };
  } catch (err) {
    logger.error(`getFullProfile failed: ${err.message}`);
    return null;
  }
}

module.exports = {
  init,
  isReady,
  recordTransfer,
  getRiskScore,
  isWalletFlagged,
  getRiskData,
  getFullProfile,
};

