# ParaTrace — Next Steps

> **Status:** Smart contracts (Rust + Solidity) are ✅ deployed and tested on both the local node and the Polkadot Hub Testnet.  
> **Last updated:** March 11, 2026

---

## What's Already Done

| Component | Status | Details |
|---|---|---|
| **Rust Risk Engine** (`contracts-rust/risk_engine/`) | ✅ Complete | 5-factor scoring algorithm (Volume, Frequency, Velocity, Chain Diversity, Flagged Contacts). Stateless, gas-optimized. Uses `abi = "sol"` for Solidity interop. |
| **Solidity Registry** (`contracts-solidity/contracts/ParaTraceRegistry.sol`) | ✅ Complete | Behavioral tracking, `recordTransaction()`, bitmap chain tracking, events, oracle view functions, admin controls. |
| **Cross-Contract Calls** | ✅ Verified | Solidity → Rust on PVM. Tested with 5 personas (Normal User, Trader, Chain Hopper, Money Launderer, Whale). All pass. |
| **Deployment Scripts** | ✅ Complete | `scripts/deployRiskEngine.ts` (deploys ink! via ethers), Hardhat Ignition module for Registry. |
| **Local Node Testing** | ✅ Complete | `scripts/testCrossCall.ts` — runs all 5 persona scenarios. |
| **Testnet Deployment** | ✅ Complete | Both contracts deployed to Polkadot Hub Testnet. Cross-contract tests passed on testnet. |

---

## Next Steps To Do

### 1. Backend Indexer (`backend-indexer/`)
**Goal:** Listen for XCM transfer events and call `recordTransaction()` on the Registry.

- [ ] Set up a Node.js/TypeScript project with `ethers.js`
- [ ] Connect to the Polkadot Hub RPC (either local or testnet)
- [ ] Subscribe to XCM transfer events (listen for `xcm.Sent`, `balances.Transfer`, etc.)
- [ ] When an XCM event is detected:
  - Extract: sender address, amount, source chain ID, destination chain ID
  - Check if the sender/receiver is already flagged via `registry.isWalletFlagged()`
  - Call `registry.recordTransaction(wallet, amount, srcChain, dstChain, counterpartyFlagged)`
- [ ] Add error handling, retry logic, and logging
- [ ] Add a `.env` file for configuration (RPC URL, private key, registry address)

### contracts-solidity = ParaTraceModule#ParaTraceRegistry  
0xbA686106E15b9b27407b94Cb51bf734705cAF80a

### contracts-rust = risk_engine#RiskEngine
Risk Engine deployed to: 0x77D5f9f09f02871B918Cb2F5430F9A91004f76c4

**Key files to create:**
```
backend-indexer/
├── package.json
├── tsconfig.json
├── .env.example
└── src/
    ├── index.ts          # Entry point — starts the event listener
    ├── listener.ts       # XCM event subscription logic
    ├── registryClient.ts # Wrapper for calling the Registry contract
    └── config.ts         # Environment configuration
```

**Important:** The wallet calling `recordTransaction()` must be the same address that deployed the Registry (it has `onlyOwner` restriction). Use the same private key.

---

### 2. Frontend Dashboard (`frontend-dashboard/`)
**Goal:** Display real-time risk data, flagged wallets, and cross-chain transaction flows.

- [ ] Set up a React + Vite project
- [ ] Connect to the Registry contract via ethers.js (read-only, using `view` functions)
- [ ] Build these pages/components:

| Page | Data Source | Description |
|---|---|---|
| **Dashboard** | `getFullProfile()`, events | Overview of monitored wallets, recent alerts |
| **Wallet Lookup** | `getFullProfile(address)` | Enter any address → see its full risk profile |
| **Flagged Wallets** | `WalletFlagged` events | List of all wallets that have been auto-flagged |
| **Transaction Feed** | `TransactionRecorded` events | Live feed of recorded XCM transactions |

- [ ] Add charts/visualizations for risk score distribution
- [ ] Make it responsive (mobile-friendly)

**Reading events from the contract:**
```typescript
// Example: Listen for WalletFlagged events
const registry = new ethers.Contract(REGISTRY_ADDRESS, abi, provider)
registry.on("WalletFlagged", (wallet, riskScore) => {
    console.log(`🚨 Wallet flagged: ${wallet} (score: ${riskScore})`)
})

// Example: Query a wallet profile
const profile = await registry.getFullProfile("0x...")
// Returns: { totalVolume, txCount, avgTimeBetweenTxs, uniqueChains, flaggedInteractions, riskScore, isFlagged }
```

---

### 3. README & Demo Prep
- [ ] Update `README.md` with the final architecture diagram
- [ ] Add deployed contract addresses (testnet)
- [ ] Record a demo video showing the full flow
- [ ] Prepare the hackathon submission

---

## Quick Reference

### Contract Addresses (Local Node — will change on redeploy)
| Contract | Address |
|---|---|
| Risk Engine (ink!) | _deployed via `deployRiskEngine.ts`_ |
| ParaTraceRegistry (Solidity) | `0xbA686106E15b9b27407b94Cb51bf734705cAF80a` |

### Key Commands
```bash
# Build Rust contract
cd contracts-rust/risk_engine && cargo contract build --release

# Deploy Rust engine via Hardhat
cd contracts-solidity && npx hardhat run scripts/deployRiskEngine.ts --network localNode

# Deploy Solidity registry
npx hardhat ignition deploy ignition/modules/ParaTrace.ts --network localNode \
  --parameters '{"ParaTraceModule": {"riskEngineAddress": "0x_ADDRESS"}}'

# Run cross-contract tests
npx hardhat run scripts/testCrossCall.ts --network localNode
```

### Architecture
```
[Backend Indexer] → recordTransaction() → [Solidity Registry] → calculate_score() → [Rust Risk Engine]
                                                ↓
                                          [Events emitted]
                                                ↓
                                        [Frontend Dashboard]
```
