'use strict';

/**
 * ParaTrace XCM Event Indexer
 * ─────────────────────────────────────────────────────────────────────────────
 * Entry point. Bootstraps the registry client and starts live subscriptions
 * on both Polkadot Hub and Asset Hub.
 *
 * Usage:
 *   cp .env.example .env      # fill in your RPC URLs, private key, contract
 *   npm install
 *   npm start
 *
 * Environment variables (see .env.example):
 *   POLKADOT_HUB_WS_RPC      Substrate WS for Polkadot Hub
 *   ASSET_HUB_WS_RPC         Substrate WS for Asset Hub
 *   ETH_RPC_URL              EVM-compatible HTTP RPC for the registry calls
 *   INDEXER_PRIVATE_KEY      Private key of the account signing registry txs
 *   REGISTRY_CONTRACT_ADDRESS  Deployed ParaTraceRegistry.sol address
 *   LOG_LEVEL                winston log level (info by default)
 */

require('dotenv').config();

const logger = require('./logger');
const registry = require('./registryClient');
const { startAllListeners, stopAllListeners } = require('./xcmListener');
const config = require('./config');

// ─── Boot sequence ─────────────────────────────────────────────────────────

async function main() {
  logger.info('═══════════════════════════════════════════════════');
  logger.info('  ParaTrace XCM Event Indexer — starting up');
  logger.info('═══════════════════════════════════════════════════');
  logger.info(`  Polkadot Hub WS : ${config.POLKADOT_HUB_WS_RPC}`);
  logger.info(`  Asset Hub WS    : ${config.ASSET_HUB_WS_RPC}`);
  logger.info(`  EVM RPC         : ${config.ETH_RPC_URL}`);
  logger.info(`  Registry        : ${config.REGISTRY_CONTRACT_ADDRESS ?? '(not set — dry-run mode)'}`);
  logger.info('═══════════════════════════════════════════════════');

  // 1. Initialise the Solidity registry client (ethers.js)
  //    If REGISTRY_CONTRACT_ADDRESS or INDEXER_PRIVATE_KEY are missing the
  //    indexer runs in dry-run mode — it logs all detected transfers but does
  //    not submit any on-chain transactions.
  await registry.init();

  // 2. Start listening on both chains
  let listeners = [];
  try {
    listeners = await startAllListeners();
  } catch (err) {
    logger.error(`Fatal: could not start listeners — ${err.message}`);
    process.exit(1);
  }

  // ─── Graceful shutdown ────────────────────────────────────────────────────
  const shutdown = async (signal) => {
    logger.info(`Received ${signal} — shutting down …`);
    await stopAllListeners(listeners);
    process.exit(0);
  };

  process.on('SIGINT',  () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Keep the process alive (the WS subscriptions are async event-driven)
  // The process exits only on SIGINT / SIGTERM or unhandled rejection.
}

// ─── Unhandled error safety net ────────────────────────────────────────────

process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled rejection: ${reason}`);
  // Don't exit — the listeners may still be functional
});

process.on('uncaughtException', (err) => {
  logger.error(`Uncaught exception: ${err.message}`);
  process.exit(1);
});

// ─── Run ───────────────────────────────────────────────────────────────────

main().catch((err) => {
  logger.error(`Startup error: ${err.message}`);
  process.exit(1);
});
