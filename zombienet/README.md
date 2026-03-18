# ParaTrace Local Testing with Zombienet

This directory contains everything you need to run and test ParaTrace locally using Zombienet, simulating a complete Polkadot relay chain + Asset Hub parachain environment.

## 📁 What's in This Directory

- **`paratrace.toml`** — Zombienet network configuration (relay chain + Asset Hub)
- **`start-local-stack.sh`** — One-command script to start the entire local stack
- **`xcm-test.js`** — XCM integration test (verifies cross-chain transfers work)
- **`paratrace.zndsl`** — Zombienet smoke tests (network health checks)
- **`chopsticks.yml`** — Chopsticks config for forking live chains (XCM simulation)

## 🎯 Quick Start

### Prerequisites

You need these binaries installed and in your PATH:

1. **Zombienet** (v0.3.4+)
   ```bash
   # Download from: https://github.com/paritytech/zombienet/releases
   # Linux/WSL:
   wget https://github.com/paritytech/zombienet/releases/latest/download/zombienet-linux-x64
   chmod +x zombienet-linux-x64
   sudo mv zombienet-linux-x64 /usr/local/bin/zombienet
   ```

2. **Polkadot** (relay chain node, v1.15+)
   ```bash
   # Download from: https://github.com/paritytech/polkadot-sdk/releases
   # Or build from source:
   git clone https://github.com/paritytech/polkadot-sdk.git
   cd polkadot-sdk/polkadot
   cargo build --release
   sudo cp target/release/polkadot /usr/local/bin/
   ```

3. **Polkadot-Parachain** (cumulus collator, v1.15+)
   ```bash
   # Same polkadot-sdk repo:
   cd polkadot-sdk/cumulus
   cargo build --release --bin polkadot-parachain
   sudo cp target/release/polkadot-parachain /usr/local/bin/
   ```

4. **eth-rpc** (Substrate → EVM adapter for Solidity contracts)
   ```bash
   # Bundled in contracts-solidity/bin/ for convenience
   # Or download: https://github.com/koute/eth-rpc/releases
   ```

5. **Node.js** (v18+) for running tests
   ```bash
   # Install dependencies for XCM test:
   npm install @polkadot/api @polkadot/util-crypto @polkadot/keyring
   ```

### Option 1: All-in-One Script (Recommended)

The easiest way to get started:

```bash
# From the repo root:
bash zombienet/start-local-stack.sh
```

This script will:
1. ✅ Check all required binaries are available
2. ✅ Kill any processes on conflicting ports
3. ✅ Spawn the Zombienet network (relay + Asset Hub)
4. ✅ Wait for Asset Hub to be ready
5. ✅ Start the eth-rpc adapter on `http://127.0.0.1:8545`

**Output:**
```
╔══════════════════════════════════════════════════════════╗
║                   Stack is running!                     ║
╚══════════════════════════════════════════════════════════╝

  Relay chain RPC  (alice) : ws://127.0.0.1:9955
  Asset Hub WS             : ws://127.0.0.1:9989
  EVM / eth_* RPC          : http://127.0.0.1:8545

  Logs: zombienet/logs/
```

### Option 2: Manual Start (Step-by-Step)

If you prefer to run components separately:

```bash
# 1. Start Zombienet
zombienet spawn zombienet/paratrace.toml --provider native

# 2. Wait for Asset Hub to be ready (check ws://127.0.0.1:9989)

# 3. Start eth-rpc adapter (in a new terminal)
eth-rpc \
  --node-rpc-url ws://127.0.0.1:9989 \
  --listen-addr 0.0.0.0:8545
```

## 🧪 Running Tests

### Test 1: Zombienet Smoke Tests

Verify the network is healthy:

```bash
zombienet test zombienet/paratrace.zndsl
```

**What this tests:**
- ✅ Relay chain validators (Alice, Bob) are running
- ✅ Both validators are producing blocks
- ✅ Parachain 1000 (Asset Hub) is registered
- ✅ Asset Hub collator is producing blocks

### Test 2: XCM Integration Test

Verify cross-chain transfers work (this is what ParaTrace monitors!):

```bash
# Make sure the network is running first
node zombienet/xcm-test.js
```

**What this tests:**
- ✅ Connects to relay chain and Asset Hub
- ✅ Submits a `limitedReserveTransferAssets` XCM transaction
- ✅ Verifies `polkadotXcm.Sent` event (what the indexer listens for)
- ✅ Confirms deposit on Asset Hub

**Expected output:**
```
╔══════════════════════════════════════════════════════════╗
║     ParaTrace — Zombienet XCM Integration Test          ║
╚══════════════════════════════════════════════════════════╝

  RESULT: All checks passed

  What this proves for ParaTrace:
  • Zombienet local network is producing blocks on both chains
  • An XCM transfer from relay → Asset Hub emits polkadotXcm.Sent
  • The ParaTrace indexer will detect this event
  • registryClient will call recordTransaction() on the Solidity registry
```

## 📦 Deploying Contracts to Zombienet

Once your local network is running, deploy the ParaTrace contracts:

### 1. Deploy Rust Risk Engine

```bash
cd contracts-solidity
npx hardhat run scripts/deployRiskEngine.ts --network zombienet
```

This deploys the `ink!` contract to the PolkaVM and outputs an address like:
```
Risk Engine deployed to: 0x1234...5678
```

### 2. Deploy Solidity Registry

```bash
# Replace <RISK_ENGINE_ADDR> with the address from step 1
npx hardhat ignition deploy ignition/modules/ParaTrace.ts \
  --network zombienet \
  --parameters '{"ParaTraceModule":{"riskEngineAddress":"<RISK_ENGINE_ADDR>"}}'
```

### 3. Verify Deployment

```bash
# Check the registry contract on http://127.0.0.1:8545
npx hardhat verify --network zombienet <REGISTRY_ADDRESS>
```

## 🔍 Running the ParaTrace Indexer

After contracts are deployed, start the indexer to monitor XCM events:

```bash
cd indexer

# Update .env with local endpoints:
# RELAY_WS=ws://127.0.0.1:9955
# ASSET_HUB_WS=ws://127.0.0.1:9989
# ETH_RPC_URL=http://127.0.0.1:8545
# REGISTRY_ADDRESS=<your_deployed_registry_address>

node src/index.js
```

**What the indexer does:**
1. Listens for `polkadotXcm.Sent` events on the relay chain
2. Parses sender, receiver, amount, and destination chain
3. Calls `recordTransaction()` on the Solidity registry
4. Registry queries the Rust risk engine for risk scoring
5. Updates wallet risk scores on-chain

## 🌐 Frontend Dashboard

Start the React dashboard to visualize transactions:

```bash
cd frontend-dashboard
npm install
npm run dev

# Open http://localhost:3000
```

The dashboard will connect to `http://127.0.0.1:8545` and display:
- Live XCM transactions
- Wallet risk scores
- Flagged wallets
- Cross-chain transaction flows

## 🥢 Advanced: XCM Simulation with Chopsticks

For testing XCM without running a full network, use Chopsticks to fork live chains:

```bash
# Option 1: Use the config file
npx @acala-network/chopsticks xcm --config zombienet/chopsticks.yml

# Option 2: One-liner
npx @acala-network/chopsticks xcm \
  --parachain=wss://asset-hub-paseo-rpc.polkadot.io \
  --relaychain=wss://paseo-rpc.polkadot.io
```

**Benefits:**
- No need to wait for block production
- Instant XCM message replay
- Fork at any block height
- Test with real chain state

**Endpoints:**
- Relay chain fork: `http://127.0.0.1:8001`
- Asset Hub fork: `http://127.0.0.1:8002`

## 🛑 Stopping the Network

```bash
# If using start-local-stack.sh, check the PIDs:
cat zombienet/logs/zombienet.pid
cat zombienet/logs/eth-rpc.pid

kill <ZOMBIENET_PID> <ETH_RPC_PID>

# Or kill all related processes:
pkill -f 'polkadot|eth-rpc'
```

## 📊 Network Endpoints

When the stack is running, you can connect to:

| Component | Endpoint | Purpose |
|-----------|----------|---------|
| Relay (Alice) | `ws://127.0.0.1:9955` | Relay chain RPC |
| Relay (Bob) | `ws://127.0.0.1:9956` | Relay chain RPC |
| Asset Hub | `ws://127.0.0.1:9989` | Parachain WebSocket |
| eth-rpc | `http://127.0.0.1:8545` | EVM-compatible JSON-RPC |

## 🐛 Troubleshooting

### "Binary not found: polkadot"
- Download binaries from releases or build from source
- Add to PATH or set `POLKADOT_BIN`, `PARACHAIN_BIN`, `ZOMBIENET_BIN` env vars

### "Asset Hub did not come up within 60 seconds"
- Check `zombienet/logs/` for error messages
- Ensure no other processes are using ports 9944, 9955, 9956, 9988, 9989
- Try increasing timeout in `paratrace.toml`

### "eth-rpc adapter not ready"
- Check `zombienet/logs/eth-rpc.log`
- Verify Asset Hub is running on port 9989
- Try restarting eth-rpc manually

### XCM test fails with "Extrinsic failed"
- Check Alice has balance: `alice: is up` in smoke test
- Verify parachain is registered: `alice: parachain 1000 is registered`
- Check both chains are producing blocks

## 📚 References

- [Zombienet Documentation](https://paritytech.github.io/zombienet/)
- [Polkadot XCM Docs](https://docs.polkadot.com/parachains/testing/run-a-parachain-network/)
- [Chopsticks Documentation](https://docs.polkadot.com/parachains/testing/fork-a-parachain/)
- [PolkaVM (pallet-revive) Docs](https://github.com/paritytech/polkadot-sdk/tree/master/substrate/frame/revive)

## 🎯 Next Steps

1. ✅ Start the local network: `bash zombienet/start-local-stack.sh`
2. ✅ Run smoke tests: `zombienet test zombienet/paratrace.zndsl`
3. ✅ Run XCM test: `node zombienet/xcm-test.js`
4. 📝 Deploy contracts (see above)
5. 🚀 Start the indexer
6. 🌐 Open the frontend dashboard

Happy testing! 🎉
