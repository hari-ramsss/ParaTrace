# ParaTrace – XCM Event Indexer

Subscribes to XCM transfer events on both **Polkadot Hub** and **Asset Hub**, then calls the deployed **ParaTraceRegistry** Solidity contract for each detected cross-chain transfer to update on-chain risk scores.

---

## How It Works

```
┌──────────────────────────┐  subscribeNewHeads (WS)
│  Polkadot Hub (Substrate) │──────────────────────────────────────┐
└──────────────────────────┘                                       │
                                                                   ▼
┌──────────────────────────┐  onXcmEvent()         ┌──────────────────────┐
│  Asset Hub   (Substrate) │──────────────────────▶│  WalletAggregator    │
└──────────────────────────┘                       └──────────┬───────────┘
                                                              │  submitAudit()
                                                              ▼   (ethers.js)
                                                 ┌────────────────────────────┐
                                                 │  ParaTraceRegistry (PVM)   │
                                                 │  processWalletAudit(addr,  │
                                                 │    volume, txCount)        │
                                                 └────────────────────────────┘
```

### Events monitored

| Chain | Pallet | Event | Purpose |
|---|---|---|---|
| Polkadot Hub | `polkadotXcm` | `Sent` | Outgoing XCM (reserve-transfer / teleport) |
| Polkadot Hub | `xcmpQueue` | `XcmpMessageSent` | XCMP message queued for sibling para |
| Polkadot Hub | `balances` | `Transfer` | Native DOT transfer accompanying XCM |
| Asset Hub | `xcmpQueue` | `Success` / `Fail` | Incoming XCMP message processed |
| Asset Hub | `foreignAssets` | `Issued` / `Transferred` | Foreign asset minted/transferred via XCM |
| Asset Hub | `assets` | `Issued` / `Transferred` | Local asset minted/transferred |
| Asset Hub | `balances` | `Transfer` | Native transfer on Asset Hub |
| Asset Hub | `polkadotXcm` | `Sent` | Outgoing XCM from Asset Hub |

---

## Project Structure

```
indexer/
├── .env.example          # Copy to .env and fill in values
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts          # Main entry point – wires everything together
    ├── config.ts         # Reads configuration from environment variables
    ├── types.ts          # Shared TypeScript types
    ├── logger.ts         # Winston logger
    ├── abi/
    │   └── ParaTraceRegistry.json   # ABI of the deployed Solidity contract
    ├── chains/
    │   ├── polkadotHub.ts  # Polkadot Hub block/event listener
    │   └── assetHub.ts     # Asset Hub block/event listener
    └── registry/
        └── contract.ts     # Ethers.js wrapper for ParaTraceRegistry
```

---

## Setup

### 1. Install dependencies

```bash
cd indexer
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:

| Variable | Description |
|---|---|
| `POLKADOT_HUB_WS` | WebSocket RPC for Polkadot Hub (default: Paseo) |
| `ASSET_HUB_WS` | WebSocket RPC for Asset Hub (default: Paseo) |
| `ETH_RPC_URL` | Ethereum JSON-RPC for the PVM node (default: `http://127.0.0.1:8545`) |
| `REGISTRY_CONTRACT_ADDRESS` | Deployed address of `ParaTraceRegistry.sol` |
| `SIGNER_PRIVATE_KEY` | Private key of the account calling `processWalletAudit` |

### 3. Run

**Development (ts-node, hot-reload):**
```bash
npm run watch
```

**Development (single run):**
```bash
npm run dev
```

**Production:**
```bash
npm run build
npm start
```

---

## Local Development (with the bundled dev node)

1. Start the local PVM node using the binaries in `../contracts-solidity/bin/`:

```bash
# In one terminal
cd ../contracts-solidity
./bin/revive-dev-node-linux-x64

# In another terminal
./bin/eth-rpc-linux-x64
```

2. Deploy `ParaTraceRegistry.sol` via Hardhat:

```bash
cd ../contracts-solidity
npx hardhat run ignition/modules/MyToken.ts --network localhost
```

3. Set `REGISTRY_CONTRACT_ADDRESS` in `.env` to the deployed address.

4. Start the indexer:

```bash
cd ../indexer
npm run dev
```

---

## Configuration Reference

| Variable | Default | Description |
|---|---|---|
| `POLKADOT_HUB_WS` | `wss://paseo.dotters.network` | Substrate WS for Polkadot Hub |
| `ASSET_HUB_WS` | `wss://asset-hub-paseo-rpc.dwellir.com` | Substrate WS for Asset Hub |
| `ETH_RPC_URL` | `http://127.0.0.1:8545` | ETH JSON-RPC for PVM contract calls |
| `REGISTRY_CONTRACT_ADDRESS` | zero address | Deployed ParaTraceRegistry address |
| `SIGNER_PRIVATE_KEY` | Hardhat default | Private key for txn signing |
| `MIN_TRANSFER_AMOUNT` | `1000000000` | Min planck amount to log (filters dust) |
| `RISK_SCORE_THRESHOLD` | `75` | Score above which wallet is flagged |
| `BACKFILL_BLOCKS` | `0` | Historical blocks to backfill on startup |
| `LOG_LEVEL` | `info` | `error` \| `warn` \| `info` \| `debug` |
