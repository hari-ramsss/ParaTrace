'use strict';

/**
 * eventParser.js
 *
 * Parses Substrate block events to detect cross-chain (XCM) transfers.
 *
 * Strategy
 * ────────
 * 1. Fetch every event in a block and group them by their extrinsic index.
 * 2. For each extrinsic that contains a `polkadotXcm.Sent` event (meaning the
 *    user submitted a cross-chain transfer extrinsic), scan that extrinsic's
 *    sibling events for asset/balance movement events so we can extract:
 *      • sender address
 *      • receiver address (where known from sibling events)
 *      • amount
 *      • source / destination chain
 * 3. Return an array of normalised XcmTransfer objects.
 *
 * XcmTransfer shape:
 * {
 *   blockNumber: number,
 *   blockHash:   string,
 *   extrinsicIndex: number,
 *   timestamp:   Date,
 *   sourceChain: string,
 *   destChain:   string,         // parsed from destination MultiLocation
 *   sender:      string,         // SS58 or AccountId32 hex
 *   receiver:    string | null,  // extracted from DepositedAsset / Transfer event
 *   amount:      bigint,
 *   assetId:     string | null,
 *   txHash:      string,
 * }
 */

const logger = require('./logger');
const { CHAIN_NAMES } = require('./config');

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Try to extract a human-readable destination chain string from a
 * polkadotXcm.Sent event's `destination` param (a raw MultiLocation SCALE).
 * Falls back to raw JSON.
 *
 * @param {any} destination  codec type from @polkadot/api
 * @returns {string}
 */
function parseDestination(destination) {
  try {
    const dest = destination.toJSON();
    // Try: { interior: { x1: [{ parachain: NNNN }] } }
    const interior = dest?.interior;
    if (interior?.x1) {
      const junctions = Array.isArray(interior.x1) ? interior.x1 : [interior.x1];
      for (const j of junctions) {
        if (j?.parachain !== undefined) return `Parachain(${j.parachain})`;
      }
    }
    if (interior?.x2) {
      const junctions = Array.isArray(interior.x2) ? interior.x2 : [interior.x2];
      for (const j of junctions) {
        if (j?.parachain !== undefined) return `Parachain(${j.parachain})`;
      }
    }
    // Relay chain
    if (interior === 'here' || interior?.here !== undefined) return 'Relay Chain';
    return JSON.stringify(dest);
  } catch {
    return 'Unknown';
  }
}

/**
 * Attempt to read the sender address from a polkadotXcm.Sent origin field.
 *
 * @param {any} origin  codec type
 * @returns {string|null}
 */
function parseOriginAddress(origin) {
  try {
    const o = origin.toJSON();
    // system origin: { system: { signed: "address" } }
    if (o?.system?.signed) return o.system.signed;
    // xcmOrigin: { xcm: { accountId32: { id: "0x..." } } }
    if (o?.xcm?.accountId32?.id) return o.xcm.accountId32.id;
    return null;
  } catch {
    return null;
  }
}

/**
 * Try to read an AccountId from various codec representations.
 *
 * @param {any} accountCodec
 * @returns {string}
 */
function accountToString(accountCodec) {
  try {
    // toHuman() gives SS58 when possible, hex otherwise
    return accountCodec.toString();
  } catch {
    return String(accountCodec);
  }
}

// ─── Main parser ───────────────────────────────────────────────────────────

/**
 * Parse a finalised block and extract XCM transfer records.
 *
 * @param {import('@polkadot/api').ApiPromise} api
 * @param {import('@polkadot/types/interfaces').Hash} blockHash
 * @param {string} chainName  human-readable source chain label
 * @returns {Promise<XcmTransfer[]>}
 */
async function parseBlock(api, blockHash, chainName) {
  const transfers = [];

  try {
    const [{ block }, events, timestamp] = await Promise.all([
      api.rpc.chain.getBlock(blockHash),
      api.query.system.events.at(blockHash),
      api.query.timestamp.now.at(blockHash).catch(() => null),
    ]);

    const blockNumber = block.header.number.toNumber();
    const blockTime = timestamp ? new Date(timestamp.toNumber()) : new Date();
    const blockHashHex = blockHash.toHex();

    // Group events by extrinsic index
    /** @type {Map<number, Array<{section:string, method:string, data:any}>>} */
    const eventsByExtrinsic = new Map();

    for (const record of events) {
      const { event, phase } = record;
      if (!phase.isApplyExtrinsic) continue;

      const extrinsicIndex = phase.asApplyExtrinsic.toNumber();
      if (!eventsByExtrinsic.has(extrinsicIndex)) {
        eventsByExtrinsic.set(extrinsicIndex, []);
      }
      eventsByExtrinsic.get(extrinsicIndex).push({
        section: event.section,
        method: event.method,
        data: event.data,
      });
    }

    // Scan each extrinsic for XCM activity
    for (const [extrinsicIndex, extrinsicEvents] of eventsByExtrinsic) {
      // Does this extrinsic contain an XCM Sent signal?
      const xcmSentEvent = extrinsicEvents.find(
        (e) => e.section === 'polkadotXcm' && e.method === 'Sent'
      );

      if (!xcmSentEvent) continue; // Not a cross-chain extrinsic — skip

      // ── Extract destination chain from polkadotXcm.Sent ──────────────────
      // Event data layout: [origin, destination, message, messageId]
      const sentData = xcmSentEvent.data;
      const originField = sentData[0];
      const destinationField = sentData[1];

      const destChain = parseDestination(destinationField);

      // ── Find the actual sender & amount from transfer events ──────────────
      // Look for assets.Transferred, assets.Burned, balances.Transfer, etc.

      let sender = parseOriginAddress(originField) || null;
      let receiver = null;
      let amount = BigInt(0);
      let assetId = null;

      for (const e of extrinsicEvents) {
        if (e.section === 'assets' && e.method === 'Transferred') {
          // data: [assetId, from, to, amount]
          assetId = e.data[0]?.toString() ?? null;
          sender = sender ?? accountToString(e.data[1]);
          receiver = accountToString(e.data[2]);
          amount = BigInt(e.data[3]?.toString() ?? '0');
          break;
        }

        if (e.section === 'assets' && e.method === 'Burned') {
          // data: [assetId, owner, balance]
          assetId = e.data[0]?.toString() ?? null;
          sender = sender ?? accountToString(e.data[1]);
          amount = BigInt(e.data[2]?.toString() ?? '0');
          // continue looking for a Transferred event for the receiver
        }

        if (e.section === 'balances' && e.method === 'Transfer') {
          // data: [from, to, amount]
          sender = sender ?? accountToString(e.data[0]);
          receiver = accountToString(e.data[1]);
          amount = BigInt(e.data[2]?.toString() ?? '0');
          break;
        }

        if (e.section === 'foreignAssets' && e.method === 'Transferred') {
          assetId = e.data[0]?.toString() ?? null;
          sender = sender ?? accountToString(e.data[1]);
          receiver = accountToString(e.data[2]);
          amount = BigInt(e.data[3]?.toString() ?? '0');
          break;
        }
      }

      // Fallback: try to get sender from the extrinsic signer
      if (!sender) {
        try {
          const extrinsic = block.extrinsics[extrinsicIndex];
          if (extrinsic?.isSigned) {
            sender = extrinsic.signer.toString();
          }
        } catch {
          // ignore
        }
      }

      if (!sender) {
        logger.debug(
          `Block ${blockNumber} extrinsic ${extrinsicIndex}: xcmSent but no sender found — skipping`
        );
        continue;
      }

      const transfer = {
        blockNumber,
        blockHash: blockHashHex,
        extrinsicIndex,
        timestamp: blockTime,
        sourceChain: chainName,
        destChain,
        sender,
        receiver,
        amount,
        assetId,
        txHash: `${blockHashHex}-${extrinsicIndex}`,
      };

      logger.info(
        `[${chainName}] XCM transfer detected | ` +
          `Block: ${blockNumber} | ` +
          `From: ${sender} → ${destChain} | ` +
          `Amount: ${amount.toString()} | ` +
          `Asset: ${assetId ?? 'native'}`
      );

      transfers.push(transfer);
    }
  } catch (err) {
    logger.error(`parseBlock error for hash ${blockHash}: ${err.message}`);
  }

  return transfers;
}

module.exports = { parseBlock, parseDestination };
