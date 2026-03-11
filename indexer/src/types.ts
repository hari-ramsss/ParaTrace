/**
 * Shared Types for the ParaTrace XCM Event Indexer
 */

/** The two chains we monitor. */
export type ChainId = 'polkadot-hub' | 'asset-hub';

/** Represents a parsed XCM cross-chain transfer event. */
export interface XcmTransferEvent {
  /** Unique key: `${chainId}-${blockNumber}-${eventIndex}` */
  id: string;

  /** The chain on which the XCM send/receive was observed. */
  chain: ChainId;

  /** Block number the event appeared in. */
  blockNumber: number;

  /** Block hash (hex). */
  blockHash: string;

  /** Unix timestamp of the block (seconds). */
  timestamp: number;

  /** Ethereum-style (H160, 20-byte) address of the sender, if resolvable. */
  sender: string | null;

  /** Ethereum-style (H160, 20-byte) address of the receiver, if resolvable. */
  receiver: string | null;

  /** Transfer amount in the chain's base denomination (planck / lowest unit). */
  amount: bigint;

  /** Source parachain ID (e.g. 1000 for Polkadot AssetHub). */
  sourceParaId: number | null;

  /** Destination parachain ID. */
  destParaId: number | null;

  /** Raw pallet name that emitted the event. */
  pallet: string;

  /** Raw event name. */
  eventName: string;
}

/** Running aggregates persisted per wallet for the Registry call. */
export interface WalletAggregate {
  /** Ethereum H160 address. */
  address: string;

  /** Total volume transferred (summed across all indexed events). */
  totalVolume: bigint;

  /** Total number of cross-chain transfer events involving this wallet. */
  txCount: number;

  /** Whether the wallet has already been submitted to the Registry. */
  lastSubmittedAt: number | null;
}

/** Result returned from the Registry after an audit call. */
export interface RegistryAuditResult {
  wallet: string;
  riskScore: number;
  isFlagged: boolean;
  txHash: string;
}
