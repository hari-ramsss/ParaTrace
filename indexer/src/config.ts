import 'dotenv/config';

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}. ` +
        `Copy .env.example to .env and fill in all values.`,
    );
  }
  return value;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config = {
  // ── Substrate RPC ──────────────────────────────────────────────────────────
  polkadotHubWs: optional('POLKADOT_HUB_WS', 'wss://paseo.dotters.network'),
  assetHubWs: optional(
    'ASSET_HUB_WS',
    'wss://asset-hub-paseo-rpc.dwellir.com',
  ),

  // ── ETH JSON-RPC (for pallet-revive / PVM contract calls) ─────────────────
  ethRpcUrl: optional('ETH_RPC_URL', 'http://127.0.0.1:8545'),

  // ── Contract ──────────────────────────────────────────────────────────────
  registryContractAddress: optional(
    'REGISTRY_CONTRACT_ADDRESS',
    '0x0000000000000000000000000000000000000000',
  ),

  // ── Signer ────────────────────────────────────────────────────────────────
  signerPrivateKey: optional(
    'SIGNER_PRIVATE_KEY',
    // Hardhat default account #0 – safe for local dev only
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  ),

  // ── Indexer behaviour ─────────────────────────────────────────────────────
  minTransferAmount: BigInt(
    optional('MIN_TRANSFER_AMOUNT', '1000000000'),
  ),
  riskScoreThreshold: Number(optional('RISK_SCORE_THRESHOLD', '75')),
  backfillBlocks: Number(optional('BACKFILL_BLOCKS', '0')),
  logLevel: optional('LOG_LEVEL', 'info'),
} as const;
