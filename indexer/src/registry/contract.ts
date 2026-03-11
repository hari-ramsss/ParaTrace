import { ethers } from 'ethers';
import { config } from '../config';
import { logger } from '../logger';
import type { WalletAggregate, RegistryAuditResult } from '../types';
import REGISTRY_ABI from '../abi/ParaTraceRegistry.json';

// ─────────────────────────────────────────────────────────────────────────────
// RegistryClient
//
// Wraps the deployed ParaTraceRegistry Solidity contract (compiled via
// pallet-revive / PVM on Polkadot Hub). Exposes methods to:
//   • submit a wallet audit  → processWalletAudit()
//   • query risk data        → getRiskData()
// ─────────────────────────────────────────────────────────────────────────────

export class RegistryClient {
  private readonly provider: ethers.JsonRpcProvider;
  private readonly signer: ethers.Wallet;
  private readonly contract: ethers.Contract;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(config.ethRpcUrl);
    this.signer = new ethers.Wallet(config.signerPrivateKey, this.provider);
    this.contract = new ethers.Contract(
      config.registryContractAddress,
      REGISTRY_ABI,
      this.signer,
    );
  }

  /**
   * Calls `processWalletAudit` on the Registry contract.
   *
   * The Registry delegates risk scoring to the on-chain Rust engine, then
   * stores the result. We pass aggregated volume and tx-count gathered by
   * the indexer so the risk engine has richer signal.
   */
  async submitAudit(agg: WalletAggregate): Promise<RegistryAuditResult | null> {
    // Guard: skip the zero-address placeholder
    if (
      agg.address === '0x0000000000000000000000000000000000000000' ||
      agg.address === '0x'
    ) {
      logger.debug(`[Registry] Skipping zero-address wallet, ignoring.`);
      return null;
    }

    // Cap volume to uint128 max to avoid overflow
    const MAX_UINT128 = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF');
    const volumeCapped =
      agg.totalVolume > MAX_UINT128 ? MAX_UINT128 : agg.totalVolume;

    // Cap txCount to uint32 max
    const MAX_UINT32 = 4_294_967_295;
    const countCapped = agg.txCount > MAX_UINT32 ? MAX_UINT32 : agg.txCount;

    logger.info(
      `[Registry] Submitting audit for ${agg.address}  ` +
        `volume=${volumeCapped}  txCount=${countCapped}`,
    );

    try {
      const tx = await this.contract.processWalletAudit(
        agg.address,
        volumeCapped,
        countCapped,
      );
      const receipt = await tx.wait();
      logger.info(
        `[Registry] Audit submitted – txHash: ${receipt.hash}  ` +
          `gasUsed: ${receipt.gasUsed}`,
      );

      // Read back the stored risk data
      const [riskScore, isFlagged] = await this.contract.getRiskData(
        agg.address,
      );

      const result: RegistryAuditResult = {
        wallet: agg.address,
        riskScore: Number(riskScore),
        isFlagged: Boolean(isFlagged),
        txHash: receipt.hash,
      };

      if (result.isFlagged) {
        logger.warn(
          `[Registry] ⚠  Wallet FLAGGED  ${agg.address}  ` +
            `riskScore=${result.riskScore}`,
        );
      } else {
        logger.info(
          `[Registry] ✓  Wallet OK  ${agg.address}  ` +
            `riskScore=${result.riskScore}`,
        );
      }

      return result;
    } catch (err) {
      logger.error(
        `[Registry] Failed to submit audit for ${agg.address}: ${
          (err as Error).message
        }`,
      );
      return null;
    }
  }

  /**
   * Queries the current risk data for a wallet without writing anything.
   */
  async getRiskData(
    walletAddress: string,
  ): Promise<{ riskScore: number; isFlagged: boolean }> {
    const [riskScore, isFlagged] =
      await this.contract.getRiskData(walletAddress);
    return { riskScore: Number(riskScore), isFlagged: Boolean(isFlagged) };
  }

  /** Verifies the provider is reachable before starting the indexer. */
  async healthCheck(): Promise<boolean> {
    try {
      await this.provider.getNetwork();
      return true;
    } catch {
      return false;
    }
  }
}
