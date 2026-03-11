/**
 * ParaTrace XCM Event Indexer – Main Entry Point
 *
 * Subscribes to XCM transfer events on both Polkadot Hub and Asset Hub,
 * aggregates cross-chain wallet activity, and calls the Solidity
 * ParaTraceRegistry contract for each wallet that crosses the
 * MIN_TRANSFER_AMOUNT threshold.
 *
 * Architecture:
 *
 *   ┌──────────────────────────┐    subscribeNewHeads
 *   │  Polkadot Hub (Substrate) │──────────────────────────────────────┐
 *   └──────────────────────────┘                                       │
 *                                                                      ▼
 *   ┌──────────────────────────┐    onXcmEvent()          ┌───────────────────┐
 *   │  Asset Hub   (Substrate) │─────────────────────────▶│  WalletAggregator │
 *   └──────────────────────────┘                          └────────┬──────────┘
 *                                                                  │
 *                                                    submitAudit() │  ethers.js
 *                                                                  ▼
 *                                                  ┌──────────────────────────┐
 *                                                  │  ParaTraceRegistry (PVM) │
 *                                                  │  processWalletAudit()    │
 *                                                  └──────────────────────────┘
 */

import 'dotenv/config';
import { PolkadotHubListener } from './chains/polkadotHub';
import { AssetHubListener } from './chains/assetHub';
import { RegistryClient } from './registry/contract';
import { logger } from './logger';
import { config } from './config';
import type { XcmTransferEvent, WalletAggregate } from './types';
import { setInterval } from 'timers';

// ─────────────────────────────────────────────────────────────────────────────
// WalletAggregator
//
// Keeps in-memory running totals of volume and tx-count per wallet address.
// When a wallet's aggregate data is "ready" (i.e. we've seen at least one
// qualifying event), it queues an audit to the Registry contract.
// ─────────────────────────────────────────────────────────────────────────────

class WalletAggregator {
  private readonly store = new Map<string, WalletAggregate>();

  /**
   * Record a new transfer event and update the wallet's running total.
   * Returns the updated aggregate for both sender and receiver.
   */
  ingest(event: XcmTransferEvent): Array<WalletAggregate> {
    const updated: Array<WalletAggregate> = [];

    for (const addr of [event.sender, event.receiver]) {
      if (!addr || addr === '0x0000000000000000000000000000000000000000') {
        continue;
      }

      const existing = this.store.get(addr) ?? {
        address: addr,
        totalVolume: BigInt(0),
        txCount: 0,
        lastSubmittedAt: null,
      };

      existing.totalVolume += event.amount;
      existing.txCount += 1;
      this.store.set(addr, existing);
      updated.push(existing);
    }

    return updated;
  }

  markSubmitted(address: string, blockNumber: number): void {
    const agg = this.store.get(address);
    if (agg) {
      agg.lastSubmittedAt = blockNumber;
    }
  }

  getAll(): WalletAggregate[] {
    return Array.from(this.store.values());
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Submission throttle
//
// To avoid flooding the Registry with transactions, we only re-submit a
// wallet audit if it hasn't been submitted in the last RESUBMIT_COOLDOWN
// blocks. Adjust as needed.
// ─────────────────────────────────────────────────────────────────────────────
const RESUBMIT_COOLDOWN_BLOCKS = 10;

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  logger.info('');
  logger.info('╔══════════════════════════════════════════════════╗');
  logger.info('║         ParaTrace XCM Event Indexer              ║');
  logger.info('╚══════════════════════════════════════════════════╝');
  logger.info('');
  logger.info(`Polkadot Hub WS : ${config.polkadotHubWs}`);
  logger.info(`Asset Hub WS    : ${config.assetHubWs}`);
  logger.info(`ETH RPC         : ${config.ethRpcUrl}`);
  logger.info(`Registry        : ${config.registryContractAddress}`);
  logger.info(`Min Transfer    : ${config.minTransferAmount} planck`);
  logger.info('');

  // ── Registry health check ────────────────────────────────────────────────
  const registry = new RegistryClient();
  const registryAlive = await registry.healthCheck();

  if (!registryAlive) {
    logger.warn(
      '[Main] ETH RPC is not reachable. Registry calls will fail. ' +
        'The indexer will still capture events – start the local dev node ' +
        'or set ETH_RPC_URL to continue with Registry submissions.',
    );
  } else {
    logger.info('[Main] Registry ETH RPC reachable ✓');
  }

  // ── Aggregator ───────────────────────────────────────────────────────────
  const aggregator = new WalletAggregator();

  /**
   * Central handler – called by both chain listeners for every qualifying event.
   */
  async function onXcmEvent(event: XcmTransferEvent): Promise<void> {
    logger.info(
      `[Event] ${event.chain}  #${event.blockNumber}  ` +
        `${event.pallet}.${event.eventName}  ` +
        `amount=${event.amount}  ` +
        `sender=${event.sender ?? '?'}  ` +
        `receiver=${event.receiver ?? '?'}  ` +
        `src=${event.sourceParaId ?? '?'} → dst=${event.destParaId ?? '?'}`,
    );

    const updatedWallets = aggregator.ingest(event);

    if (!registryAlive) return;

    // Submit audit for each involved wallet
    for (const agg of updatedWallets) {
      // Throttle: skip re-submission if submitted recently
      if (
        agg.lastSubmittedAt !== null &&
        event.blockNumber - agg.lastSubmittedAt < RESUBMIT_COOLDOWN_BLOCKS
      ) {
        logger.debug(
          `[Main] Throttled re-submission for ${agg.address} ` +
            `(last submitted at block ${agg.lastSubmittedAt})`,
        );
        continue;
      }

      const result = await registry.submitAudit(agg);
      if (result) {
        aggregator.markSubmitted(agg.address, event.blockNumber);
      }
    }
  }

  // ── Chain listeners ──────────────────────────────────────────────────────
  const hubListener = new PolkadotHubListener(onXcmEvent);
  const assetHubListener = new AssetHubListener(onXcmEvent);

  // Connect and start in parallel
  await Promise.all([hubListener.connect(), assetHubListener.connect()]);
  await Promise.all([
    hubListener.startSubscription(),
    assetHubListener.startSubscription(),
  ]);

  logger.info('[Main] Indexer running. Listening for XCM events …');
  logger.info('[Main] Press Ctrl+C to stop.');
  logger.info('');

  // ── Periodic summary log ─────────────────────────────────────────────────
  const SUMMARY_INTERVAL_MS = 60_000; // every 60 seconds
  const summaryTimer = setInterval(() => {
    const wallets = aggregator.getAll();
    logger.info(
      `[Summary] Tracking ${wallets.length} wallet(s). ` +
        `Flagged: ${wallets.filter((w) => w.txCount > 0).length} active this session.`,
    );
    for (const w of wallets) {
      logger.debug(
        `  ${w.address}  volume=${w.totalVolume}  txCount=${w.txCount}  ` +
          `lastSubmit=${w.lastSubmittedAt ?? 'never'}`,
      );
    }
  }, SUMMARY_INTERVAL_MS);

  // ── Graceful shutdown ────────────────────────────────────────────────────
  async function shutdown(signal: string): Promise<void> {
    logger.info(`\n[Main] Received ${signal}. Shutting down …`);
    clearInterval(summaryTimer);

    await Promise.allSettled([
      hubListener.disconnect(),
      assetHubListener.disconnect(),
    ]);

    const finalWallets = aggregator.getAll();
    logger.info(
      `[Main] Session summary: ${finalWallets.length} unique wallet(s) indexed.`,
    );
    logger.info('[Main] Goodbye.');
    process.exit(0);
  }

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err: unknown) => {
  logger.error(`[Main] Fatal error: ${(err as Error).message}`);
  logger.error((err as Error).stack ?? '');
  process.exit(1);
});
