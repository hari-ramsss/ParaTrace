import { ApiPromise, WsProvider } from '@polkadot/api';
import type { SignedBlock, EventRecord } from '@polkadot/types/interfaces';
import { u8aToHex } from '@polkadot/util';
import type { XcmTransferEvent, ChainId } from '../types';
import { logger } from '../logger';
import { config } from '../config';

// ─────────────────────────────────────────────────────────────────────────────
// XCM events we watch on Polkadot Hub (relay-chain side)
//
//  polkadotXcm.Sent           – fired when executeXcm / limitedReserveTransfer
//                               / limitedTeleportAssets dispatches an XCM msg
//  xcmPallet.Attempted        – fired when XCM execution is attempted locally
//  balances.Transfer          – native DOT transfers (may accompany XCM)
//  xcmpQueue.XcmpMessageSent  – XCMP message queued for a sibling parachain
// ─────────────────────────────────────────────────────────────────────────────

const WATCHED_EVENTS: Array<{ pallet: string; event: string }> = [
  { pallet: 'polkadotXcm', event: 'Sent' },
  { pallet: 'xcmPallet', event: 'Sent' },
  { pallet: 'xcmpQueue', event: 'XcmpMessageSent' },
  { pallet: 'balances', event: 'Transfer' },
];

/** Attempt to extract an H160 (20-byte EVM) address from a decoded XCM junction. */
function extractH160(value: unknown): string | null {
  if (!value) return null;
  const str = String(value);

  // Direct 20-byte hex address
  const hexMatch = str.match(/0x[0-9a-fA-F]{40}/);
  if (hexMatch) return hexMatch[0].toLowerCase();

  // AccountId32 as hex (32 bytes) → take last 20 bytes as a best-effort mapping
  const id32 = str.match(/0x([0-9a-fA-F]{64})/);
  if (id32) {
    return ('0x' + id32[1].slice(24)).toLowerCase();
  }

  return null;
}

/** Decode parachain ID from an XCM MultiLocation destination field. */
function extractParaId(dest: unknown): number | null {
  if (!dest) return null;
  const str = JSON.stringify(dest);
  const m = str.match(/"paraId"\s*:\s*(\d+)/i) ?? str.match(/"id"\s*:\s*(\d+)/i);
  return m ? Number(m[1]) : null;
}

// ─────────────────────────────────────────────────────────────────────────────

export class PolkadotHubListener {
  private api!: ApiPromise;
  private unsubscribe: (() => void) | null = null;
  readonly chainId: ChainId = 'polkadot-hub';

  constructor(
    private readonly onEvent: (event: XcmTransferEvent) => void | Promise<void>,
  ) {}

  async connect(): Promise<void> {
    logger.info(`[PolkadotHub] Connecting to ${config.polkadotHubWs} …`);
    const provider = new WsProvider(config.polkadotHubWs);
    this.api = await ApiPromise.create({ provider });
    await this.api.isReady;
    const chain = await this.api.rpc.system.chain();
    logger.info(`[PolkadotHub] Connected to chain: ${chain}`);
  }

  async startSubscription(): Promise<void> {
    logger.info(`[PolkadotHub] Starting block subscription …`);

    // Backfill historical blocks if requested
    if (config.backfillBlocks > 0) {
      await this.backfill();
    }

    this.unsubscribe = (await this.api.rpc.chain.subscribeNewHeads(
      async (header) => {
        const blockNumber = header.number.toNumber();
        const blockHash = header.hash;
        try {
          const [signedBlock, allEvents, tsCodec] = await Promise.all([
            this.api.rpc.chain.getBlock(blockHash) as Promise<SignedBlock>,
            this.api.query.system.events.at(blockHash) as Promise<
              EventRecord[]
            >,
            this.api.query.timestamp?.now?.at
              ? (this.api.query.timestamp.now.at(blockHash) as Promise<unknown>)
              : Promise.resolve(null),
          ]);

          const timestamp = tsCodec
            ? Math.floor(Number(tsCodec) / 1000)
            : Math.floor(Date.now() / 1000);

          void signedBlock; // used for context only
          await this.processEvents(
            allEvents,
            blockNumber,
            u8aToHex(blockHash),
            timestamp,
          );
        } catch (err) {
          logger.error(
            `[PolkadotHub] Error processing block #${blockNumber}: ${
              (err as Error).message
            }`,
          );
        }
      },
    )) as unknown as () => void;
  }

  private async backfill(): Promise<void> {
    const latestHeader = await this.api.rpc.chain.getHeader();
    const latestBlock = latestHeader.number.toNumber();
    const startBlock = Math.max(0, latestBlock - config.backfillBlocks);

    logger.info(
      `[PolkadotHub] Backfilling blocks ${startBlock} → ${latestBlock} …`,
    );

    for (let n = startBlock; n <= latestBlock; n++) {
      try {
        const blockHash = await this.api.rpc.chain.getBlockHash(n);
        const [allEvents, tsCodec] = await Promise.all([
          this.api.query.system.events.at(blockHash) as Promise<EventRecord[]>,
          this.api.query.timestamp?.now?.at
            ? (this.api.query.timestamp.now.at(blockHash) as Promise<unknown>)
            : Promise.resolve(null),
        ]);
        const timestamp = tsCodec
          ? Math.floor(Number(tsCodec) / 1000)
          : Math.floor(Date.now() / 1000);
        await this.processEvents(allEvents, n, u8aToHex(blockHash), timestamp);
      } catch (err) {
        logger.warn(
          `[PolkadotHub] Backfill skip block #${n}: ${(err as Error).message}`,
        );
      }
    }
    logger.info(`[PolkadotHub] Backfill complete.`);
  }

  private async processEvents(
    events: EventRecord[],
    blockNumber: number,
    blockHash: string,
    timestamp: number,
  ): Promise<void> {
    let eventIndex = 0;
    for (const record of events) {
      const { event } = record;
      const palletName = event.section;
      const eventName = event.method;

      const isWatched = WATCHED_EVENTS.some(
        (w) =>
          w.pallet.toLowerCase() === palletName.toLowerCase() &&
          w.event.toLowerCase() === eventName.toLowerCase(),
      );

      if (!isWatched) {
        eventIndex++;
        continue;
      }

      logger.debug(
        `[PolkadotHub] Block #${blockNumber}  event[${eventIndex}]  ` +
          `${palletName}.${eventName}`,
      );

      const xcmEvent = this.parseEvent(
        event,
        palletName,
        eventName,
        blockNumber,
        blockHash,
        timestamp,
        eventIndex,
      );

      if (xcmEvent) {
        await Promise.resolve(this.onEvent(xcmEvent));
      }

      eventIndex++;
    }
  }

  // ── Event parsers ─────────────────────────────────────────────────────────

  private parseEvent(
    event: EventRecord['event'],
    pallet: string,
    name: string,
    blockNumber: number,
    blockHash: string,
    timestamp: number,
    idx: number,
  ): XcmTransferEvent | null {
    const data = event.data.toJSON() as unknown[];

    let sender: string | null = null;
    let receiver: string | null = null;
    let amount: bigint = BigInt(0);
    let sourceParaId: number | null = null;
    let destParaId: number | null = null;

    try {
      if (
        (pallet === 'polkadotXcm' || pallet === 'xcmPallet') &&
        name === 'Sent'
      ) {
        // polkadotXcm.Sent(origin, destination, message)
        // data[0] = origin MultiLocation
        // data[1] = destination MultiLocation
        sender = extractH160(data[0]);
        destParaId = extractParaId(data[1]);
        // Source is Polkadot Hub (relay chain), represented as para 0
        sourceParaId = 0;

        // Try to read amount from XCM message fields (best-effort)
        const msgStr = JSON.stringify(data[2] ?? {});
        const amountMatch = msgStr.match(/"fun"\s*:\s*\{\s*"fungible"\s*:\s*"?(\d+)"?/);
        if (amountMatch) amount = BigInt(amountMatch[1]);

        // Try receiver from beneficiary in XCM message
        const beneficiaryMatch = msgStr.match(
          /"accountId"\s*:\s*"(0x[0-9a-fA-F]+)"/,
        );
        if (beneficiaryMatch) receiver = extractH160(beneficiaryMatch[1]);
      } else if (pallet === 'xcmpQueue' && name === 'XcmpMessageSent') {
        // xcmpQueue.XcmpMessageSent(messageHash)
        // No direct address info, but we can record the block context
        sourceParaId = 0; // Relay chain

      } else if (pallet === 'balances' && name === 'Transfer') {
        // balances.Transfer(from, to, value)
        sender = extractH160(data[0]);
        receiver = extractH160(data[1]);
        amount = BigInt(String(data[2] ?? 0));
      }
    } catch (err) {
      logger.warn(
        `[PolkadotHub] Could not parse ${pallet}.${name}: ${(err as Error).message}`,
      );
    }

    // Skip transfers below the configured minimum threshold
    if (
      (pallet === 'balances' && name === 'Transfer') &&
      amount < config.minTransferAmount
    ) {
      return null;
    }

    return {
      id: `${this.chainId}-${blockNumber}-${idx}`,
      chain: this.chainId,
      blockNumber,
      blockHash,
      timestamp,
      sender,
      receiver,
      amount,
      sourceParaId,
      destParaId,
      pallet,
      eventName: name,
    };
  }

  async disconnect(): Promise<void> {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    await this.api?.disconnect();
    logger.info(`[PolkadotHub] Disconnected.`);
  }
}
