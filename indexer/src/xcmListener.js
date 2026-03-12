'use strict';

/**
 * xcmListener.js
 *
 * Creates and manages live WebSocket subscriptions to both
 * Polkadot Hub and Asset Hub Substrate nodes.
 *
 * For every finalised block on either chain:
 *  1. Parse all events in the block for XCM transfer activity
 *     (via eventParser.parseBlock — now includes sourceParachainId & destParachainId)
 *  2. For each detected XCM transfer, record both sender and receiver
 *     wallets in the on-chain Solidity registry via registryClient.recordTransfer,
 *     which calls recordTransaction(wallet, amount, srcChainSlot, dstChainSlot, counterpartyFlagged)
 *
 * Reconnection is handled automatically by @polkadot/api's WsProvider
 * with exponential back-off.
 */

const { ApiPromise, WsProvider } = require('@polkadot/api');
const logger = require('./logger');
const config = require('./config');
const { parseBlock } = require('./eventParser');
const { recordTransfer } = require('./registryClient');

// ─── Chain definitions ─────────────────────────────────────────────────────

/**
 * The two chains ParaTrace monitors.
 * parachainId maps to a uint8 slot via config.parachainToSlot() for the registry.
 *
 *   Polkadot Hub (relay) = parachainId 0
 *   Asset Hub            = parachainId 1000 (Westend/Polkadot)
 */
const MONITORED_CHAINS = [
  {
    wsRpc:        config.POLKADOT_HUB_WS_RPC,
    name:         config.CHAIN_NAMES.POLKADOT_HUB,
    parachainId:  0,      // relay chain slot
  },
  {
    wsRpc:        config.ASSET_HUB_WS_RPC,
    name:         config.CHAIN_NAMES.ASSET_HUB,
    parachainId:  1000,   // Asset Hub parachain ID
  },
];

// ─── Single chain listener ─────────────────────────────────────────────────

/**
 * Connect to a single Substrate node and subscribe to finalised heads,
 * parsing each block for XCM transfers.
 *
 * @param {string} wsRpc        WebSocket RPC URL
 * @param {string} chainName    Human-readable label
 * @param {number} parachainId  Raw parachain ID of this chain (for chain slot resolution)
 * @returns {Promise<{api: ApiPromise, unsubscribe: Function}>}
 */
async function startChainListener(wsRpc, chainName, parachainId) {
  logger.info(`[${chainName}] Connecting to ${wsRpc} …`);

  const provider = new WsProvider(wsRpc);
  const api = await ApiPromise.create({ provider });

  await api.isReady;

  const chain   = await api.rpc.system.chain();
  const version = await api.rpc.system.version();
  logger.info(
    `[${chainName}] Connected | chain="${chain}" | version="${version}" | parachainId=${parachainId}`
  );

  let processedBlocks    = 0;
  let detectedTransfers  = 0;

  // Subscribe to FINALISED heads to avoid processing reorged blocks
  const unsubscribe = await api.rpc.chain.subscribeFinalizedHeads(
    async (header) => {
      const blockNumber = header.number.toNumber();
      const blockHash   = header.hash;

      logger.debug(
        `[${chainName}] Finalised block #${blockNumber} (${blockHash.toHex().slice(0, 10)}…)`
      );

      // Parse the block — pass parachainId so the parser stamps it on transfers
      let transfers = [];
      try {
        transfers = await parseBlock(api, blockHash, chainName, parachainId);
      } catch (err) {
        logger.error(
          `[${chainName}] Error parsing block #${blockNumber}: ${err.message}`
        );
        return;
      }

      processedBlocks++;

      if (transfers.length === 0) return;

      detectedTransfers += transfers.length;
      logger.info(
        `[${chainName}] Block #${blockNumber}: ${transfers.length} XCM transfer(s) ` +
          `(session total: ${detectedTransfers})`
      );

      // Submit each transfer to the Solidity registry
      for (const transfer of transfers) {
        logTransferSummary(transfer);
        try {
          await recordTransfer(transfer);
        } catch (err) {
          logger.error(
            `[${chainName}] Failed to record transfer from block #${blockNumber}: ${err.message}`
          );
        }
      }
    }
  );

  logger.info(`[${chainName}] Subscribed to finalised heads ✓`);

  return { api, unsubscribe };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Pretty-print the enriched transfer object (now includes chain IDs).
 */
function logTransferSummary(transfer) {
  const srcSlot = config.parachainToSlot(transfer.sourceParachainId);
  const dstSlot = config.parachainToSlot(transfer.destParachainId);

  logger.info(
    [
      `  ┌── XCM Transfer Detected ─────────────────────────────────────`,
      `  │  Source Chain    : ${transfer.sourceChain} (parachainId=${transfer.sourceParachainId ?? 'relay'}, slot=${srcSlot})`,
      `  │  Dest Chain      : ${transfer.destChain} (parachainId=${transfer.destParachainId ?? 'unknown'}, slot=${dstSlot})`,
      `  │  Block           : #${transfer.blockNumber}`,
      `  │  Timestamp       : ${transfer.timestamp.toISOString()}`,
      `  │  Sender          : ${transfer.sender}`,
      `  │  Receiver        : ${transfer.receiver ?? '(not extracted)'}`,
      `  │  Amount          : ${transfer.amount.toString()} ${transfer.assetId ? `(asset ${transfer.assetId})` : '(native)'}`,
      `  │  TxHash          : ${transfer.txHash}`,
      `  └──────────────────────────────────────────────────────────────`,
    ].join('\n')
  );
}

// ─── Multi-chain bootstrap ────────────────────────────────────────────────

/**
 * Start listeners on both Polkadot Hub and Asset Hub concurrently.
 *
 * @returns {Promise<Array<{api: ApiPromise, unsubscribe: Function}>>}
 */
async function startAllListeners() {
  const listeners = await Promise.all(
    MONITORED_CHAINS.map(({ wsRpc, name, parachainId }) =>
      startChainListener(wsRpc, name, parachainId).catch((err) => {
        logger.error(`Failed to start listener for ${name}: ${err.message}`);
        return null;
      })
    )
  );

  const active = listeners.filter(Boolean);
  if (active.length === 0) {
    throw new Error('All chain listeners failed to start');
  }

  logger.info(`XCM Indexer running | Active listeners: ${active.length}/${MONITORED_CHAINS.length}`);
  return active;
}

/**
 * Gracefully disconnect all active listeners.
 *
 * @param {Array<{api: ApiPromise, unsubscribe: Function}>} listeners
 */
async function stopAllListeners(listeners) {
  logger.info('Shutting down listeners …');
  for (const { api, unsubscribe } of listeners) {
    try {
      unsubscribe();
      await api.disconnect();
    } catch (err) {
      logger.warn(`Error during disconnect: ${err.message}`);
    }
  }
  logger.info('All listeners stopped.');
}

module.exports = { startAllListeners, stopAllListeners, startChainListener, MONITORED_CHAINS };
