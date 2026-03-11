import { ApiPromise, WsProvider } from '@polkadot/api';
import type { EventRecord } from '@polkadot/types/interfaces';
import { u8aToHex } from '@polkadot/util';
import type { XcmTransferEvent, ChainId } from '../types';
import { logger } from '../logger';
import { config } from '../config';

// ─────────────────────────────────────────────────────────────────────────────
// XCM events we watch on Asset Hub (system parachain, para ID 1000)
//
//  xcmpQueue.Success          – incoming XCMP message processed successfully
//  xcmpQueue.Fail             – incoming XCMP message failed (still useful data)
//  foreignAssets.Issued       – foreign asset minted to a beneficiary
//  foreignAssets.Transferred  – foreign asset transferred between accounts
//  assets.Issued              – local asset minted (teleport receipt)
//  assets.Transferred         – local asset transferred
//  balances.Transfer          – native KSM/DOT transfer
//  polkadotXcm.Sent           – outgoing XCM from Asset Hub
// ─────────────────────────────────────────────────────────────────────────────

const WATCHED_EVENTS: Array<{ pallet: string; event: string }> = [
  { pallet: 'xcmpQueue', event: 'Success' },
  { pallet: 'xcmpQueue', event: 'Fail' },
  { pallet: 'foreignAssets', event: 'Issued' },
  { pallet: 'foreignAssets', event: 'Transferred' },
  { pallet: 'assets', event: 'Issued' },
  { pallet: 'assets', event: 'Transferred' },
  { pallet: 'balances', event: 'Transfer' },
  { pallet: 'polkadotXcm', event: 'Sent' },
  { pallet: 'xcmPallet', event: 'Sent' },
];

/** Asset Hub para ID on Paseo / Polkadot networks. */
const ASSET_HUB_PARA_ID = 1000;

/** Attempt to extract an H160 (20-byte EVM) address from a decoded XCM junction. */
function extractH160(value: unknown): string | null {
  if (!value) return null;
  const str = String(value);

  const hexMatch = str.match(/0x[0-9a-fA-F]{40}/);
  if (hexMatch) return hexMatch[0].toLowerCase();

  // AccountId32 → take last 20 bytes
  const id32 = str.match(/0x([0-9a-fA-F]{64})/);
  if (id32) return ('0x' + id32[1].slice(24)).toLowerCase();

  return null;
}

/** Decode parachain ID from an XCM MultiLocation destination field. */
function extractParaId(dest: unknown): number | null {
  if (!dest) return null;
  const str = JSON.stringify(dest);
  const m =
    str.match(/"paraId"\s*:\s*(\d+)/i) ?? str.match(/"id"\s*:\s*(\d+)/i);
  return m ? Number(m[1]) : null;
}

// ─────────────────────────────────────────────────────────────────────────────

export class AssetHubListener {
  private api!: ApiPromise;
  private unsubscribe: (() => void) | null = null;
  readonly chainId: ChainId = 'asset-hub';

  constructor(
    private readonly onEvent: (event: XcmTransferEvent) => void | Promise<void>,
  ) {}

  async connect(): Promise<void> {
    logger.info(`[AssetHub] Connecting to ${config.assetHubWs} …`);
    const provider = new WsProvider(config.assetHubWs);
    this.api = await ApiPromise.create({ provider });
    await this.api.isReady;
    const chain = await this.api.rpc.system.chain();
    logger.info(`[AssetHub] Connected to chain: ${chain}`);
  }

  async startSubscription(): Promise<void> {
    logger.info(`[AssetHub] Starting block subscription …`);

    if (config.backfillBlocks > 0) {
      await this.backfill();
    }

    this.unsubscribe = (await this.api.rpc.chain.subscribeNewHeads(
      async (header) => {
        const blockNumber = header.number.toNumber();
        const blockHash = header.hash;
        try {
          const [allEvents, tsCodec] = await Promise.all([
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

          await this.processEvents(
            allEvents,
            blockNumber,
            u8aToHex(blockHash),
            timestamp,
          );
        } catch (err) {
          logger.error(
            `[AssetHub] Error processing block #${blockNumber}: ${
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
      `[AssetHub] Backfilling blocks ${startBlock} → ${latestBlock} …`,
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
          `[AssetHub] Backfill skip block #${n}: ${(err as Error).message}`,
        );
      }
    }
    logger.info(`[AssetHub] Backfill complete.`);
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
        `[AssetHub] Block #${blockNumber}  event[${eventIndex}]  ` +
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
      if (pallet === 'xcmpQueue' && (name === 'Success' || name === 'Fail')) {
        // xcmpQueue.Success / Fail – incoming XCMP message from another para
        // data[0] = messageHash (bytes32)  data[1] = weight
        // The actual sender/receiver comes from companion events in the same
        // block (e.g. foreignAssets.Issued). We mark the source as "remote".
        sourceParaId = null; // unknown without deeper decoding
        destParaId = ASSET_HUB_PARA_ID;
      } else if (
        pallet === 'foreignAssets' &&
        (name === 'Issued' || name === 'Transferred')
      ) {
        // foreignAssets.Issued(assetId, owner, amount)
        // foreignAssets.Transferred(assetId, from, to, amount)
        if (name === 'Issued') {
          receiver = extractH160(data[1]);
          amount = BigInt(String(data[2] ?? 0));
        } else {
          sender = extractH160(data[1]);
          receiver = extractH160(data[2]);
          amount = BigInt(String(data[3] ?? 0));
        }
        sourceParaId = null; // came from relay / another para
        destParaId = ASSET_HUB_PARA_ID;
      } else if (
        pallet === 'assets' &&
        (name === 'Issued' || name === 'Transferred')
      ) {
        // assets.Issued(assetId, owner, totalSupply)
        // assets.Transferred(assetId, from, to, amount)
        if (name === 'Issued') {
          receiver = extractH160(data[1]);
          amount = BigInt(String(data[2] ?? 0));
        } else {
          sender = extractH160(data[1]);
          receiver = extractH160(data[2]);
          amount = BigInt(String(data[3] ?? 0));
        }
        sourceParaId = null;
        destParaId = ASSET_HUB_PARA_ID;
      } else if (pallet === 'balances' && name === 'Transfer') {
        // balances.Transfer(from, to, value)
        sender = extractH160(data[0]);
        receiver = extractH160(data[1]);
        amount = BigInt(String(data[2] ?? 0));
        // Native transfers on Asset Hub are local by default
        sourceParaId = ASSET_HUB_PARA_ID;
        destParaId = ASSET_HUB_PARA_ID;

        // Skip if below minimum
        if (amount < config.minTransferAmount) return null;
      } else if (
        (pallet === 'polkadotXcm' || pallet === 'xcmPallet') &&
        name === 'Sent'
      ) {
        // Outgoing XCM from Asset Hub
        sender = extractH160(data[0]);
        destParaId = extractParaId(data[1]);
        sourceParaId = ASSET_HUB_PARA_ID;

        const msgStr = JSON.stringify(data[2] ?? {});
        const amountMatch = msgStr.match(
          /"fun"\s*:\s*\{\s*"fungible"\s*:\s*"?(\d+)"?/,
        );
        if (amountMatch) amount = BigInt(amountMatch[1]);

        const beneficiaryMatch = msgStr.match(
          /"accountId"\s*:\s*"(0x[0-9a-fA-F]+)"/,
        );
        if (beneficiaryMatch) receiver = extractH160(beneficiaryMatch[1]);
      }
    } catch (err) {
      logger.warn(
        `[AssetHub] Could not parse ${pallet}.${name}: ${(err as Error).message}`,
      );
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
    logger.info(`[AssetHub] Disconnected.`);
  }
}
