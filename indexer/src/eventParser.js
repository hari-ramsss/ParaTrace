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
 *      • source / destination parachain IDs
 * 3. Return an array of normalised XcmTransfer objects.
 *
 * XcmTransfer shape:
 * {
 *   blockNumber:       number,
 *   blockHash:         string,
 *   extrinsicIndex:    number,
 *   timestamp:         Date,
 *   sourceChain:       string,       // human-readable label
 *   destChain:         string,       // human-readable destination label
 *   sourceParachainId: number|null,  // raw parachain ID of the source chain
 *   destParachainId:   number|null,  // raw parachain ID parsed from MultiLocation
 *   sender:            string,
 *   receiver:          string|null,
 *   amount:            bigint,
 *   assetId:           string|null,
 *   txHash:            string,
 * }
 */

const logger = require('./logger');

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Extract the raw parachain ID (number) and human-readable label from a
 * polkadotXcm.Sent event's `destination` MultiLocation codec value.
 *
 * Returns { label: string, parachainId: number|null }
 *
 * MultiLocation JSON shapes we handle:
 *   Relay chain:   { parents: 1, interior: "here" }
 *                  { parents: 0, interior: "here" }
 *   Parachain:     { interior: { x1: [{ parachain: N }] } }
 *                  { interior: { x1:  { parachain: N }  } }
 *                  { interior: { x2: [{ parachain: N }, ...] } }
 *
 * @param {any} destination  codec type from @polkadot/api
 * @returns {{ label: string, parachainId: number|null }}
 */
function parseDestination(destination) {
  try {
    const dest = destination.toJSON();
    const interior = dest?.interior;

    // Helper: scan a junction array/object for a parachain field
    const findParachain = (junctions) => {
      const arr = Array.isArray(junctions) ? junctions : [junctions];
      for (const j of arr) {
        if (j?.parachain !== undefined) return Number(j.parachain);
      }
      return null;
    };

    if (interior) {
      // x1 junction
      if (interior.x1 !== undefined) {
        const id = findParachain(interior.x1);
        if (id !== null) return { label: `Parachain(${id})`, parachainId: id };
      }
      // x2 junction
      if (interior.x2 !== undefined) {
        const id = findParachain(interior.x2);
        if (id !== null) return { label: `Parachain(${id})`, parachainId: id };
      }
      // x3 junction (multi-hop)
      if (interior.x3 !== undefined) {
        const id = findParachain(interior.x3);
        if (id !== null) return { label: `Parachain(${id})`, parachainId: id };
      }
      // Relay chain
      if (interior === 'here' || interior?.here !== undefined) {
        return { label: 'Relay Chain', parachainId: 0 };
      }
    }

    // Parents = 1 with no interior junction → relay chain
    if (dest?.parents === 1 && (!interior || interior === 'here')) {
      return { label: 'Relay Chain', parachainId: 0 };
    }

    return { label: JSON.stringify(dest), parachainId: null };
  } catch {
    return { label: 'Unknown', parachainId: null };
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
    if (o?.system?.signed) return o.system.signed;
    if (o?.xcm?.accountId32?.id) return o.xcm.accountId32.id;
    return null;
  } catch {
    return null;
  }
}

/**
 * Return the string representation of an account codec value.
 *
 * @param {any} accountCodec
 * @returns {string}
 */
function accountToString(accountCodec) {
  try {
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
 * @param {string}      chainName        Human-readable source chain label
 * @param {number|null} sourceParachainId Raw parachain ID of the source chain
 *                                        (0 = relay, 1000 = Asset Hub, etc.)
 * @returns {Promise<XcmTransfer[]>}
 */
async function parseBlock(api, blockHash, chainName, sourceParachainId = null) {
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
      const xcmSentEvent = extrinsicEvents.find(
        (e) => (e.section === 'polkadotXcm' || e.section === 'xcmPallet') && e.method === 'Sent'
      );

      if (!xcmSentEvent) continue;

      // ── Extract destination from polkadotXcm.Sent ─────────────────────────
      // Event data layout: [origin, destination, message, messageId]
      const sentData = xcmSentEvent.data;
      const originField = sentData[0];
      const destinationField = sentData[1];

      const { label: destChain, parachainId: destParachainId } =
        parseDestination(destinationField);

      // ── Find sender & amount from balance / asset events ──────────────────
      let sender = parseOriginAddress(originField) || null;
      let receiver = null;
      let amount = BigInt(0);
      let assetId = null;

      for (const e of extrinsicEvents) {
        if (e.section === 'assets' && e.method === 'Transferred') {
          // [assetId, from, to, amount]
          assetId = e.data[0]?.toString() ?? null;
          sender = sender ?? accountToString(e.data[1]);
          receiver = accountToString(e.data[2]);
          amount = BigInt(e.data[3]?.toString() ?? '0');
          break;
        }

        if (e.section === 'assets' && e.method === 'Burned') {
          // [assetId, owner, balance]
          assetId = e.data[0]?.toString() ?? null;
          sender = sender ?? accountToString(e.data[1]);
          amount = BigInt(e.data[2]?.toString() ?? '0');
          // keep scanning — a Transferred event may follow with the receiver
        }

        if (e.section === 'balances' && e.method === 'Transfer') {
          // [from, to, amount]
          sender = sender ?? accountToString(e.data[0]);
          receiver = accountToString(e.data[1]);
          amount = BigInt(e.data[2]?.toString() ?? '0');
          break;
        }

        if (e.section === 'balances' && e.method === 'Withdraw') {
          // [who, amount] — emitted during teleport (tokens burned on source chain)
          sender = sender ?? accountToString(e.data[0]);
          const withdrawAmt = BigInt(e.data[1]?.toString() ?? '0');
          if (withdrawAmt > amount) amount = withdrawAmt;
          // keep scanning — a Transfer or Deposit event may follow
        }

        if (e.section === 'balances' && e.method === 'Burned') {
          // [who, amount] — alternative burn event in newer runtimes
          sender = sender ?? accountToString(e.data[0]);
          const burnAmt = BigInt(e.data[1]?.toString() ?? '0');
          if (burnAmt > amount) amount = burnAmt;
          // keep scanning
        }

        if (e.section === 'foreignAssets' && e.method === 'Transferred') {
          // [assetId, from, to, amount]
          assetId = e.data[0]?.toString() ?? null;
          sender = sender ?? accountToString(e.data[1]);
          receiver = accountToString(e.data[2]);
          amount = BigInt(e.data[3]?.toString() ?? '0');
          break;
        }
      }

      // Fallback: read sender from the extrinsic signer field
      if (!sender) {
        try {
          const extrinsic = block.extrinsics[extrinsicIndex];
          if (extrinsic?.isSigned) sender = extrinsic.signer.toString();
        } catch { /* ignore */ }
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
        sourceParachainId,   // numeric, e.g. 0 (relay) or 1000 (Asset Hub)
        destParachainId,     // numeric parsed from MultiLocation, or null
        sender,
        receiver,
        amount,
        assetId,
        txHash: `${blockHashHex}-${extrinsicIndex}`,
      };

      logger.info(
        `[${chainName}] XCM transfer detected | ` +
        `Block: ${blockNumber} | ` +
        `Src parachain: ${sourceParachainId ?? 'relay'} → Dst: ${destChain} | ` +
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
