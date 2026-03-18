# ParaTrace Local Testing — Quick Start Guide

This guide will get you from zero to a fully running local ParaTrace network in ~10 minutes.

## 📋 Prerequisites Checklist

Before starting, make sure you have:

- [ ] **Linux/WSL** environment (required for native provider)
- [ ] **Node.js v18+** (`node --version`)
- [ ] **Git** (`git --version`)
- [ ] **Rust toolchain** (optional, only if building binaries)
- [ ] **10GB+ free disk space**

## 🚀 Step-by-Step Setup

### 1. Download Required Binaries

The fastest way is to download pre-built binaries:

```bash
cd ~/.local/bin  # Or any directory in your PATH

# Download Zombienet
wget https://github.com/paritytech/zombienet/releases/download/v1.3.106/zombienet-linux-x64
chmod +x zombienet-linux-x64
ln -s zombienet-linux-x64 zombienet

# Download Polkadot (relay chain)
wget https://github.com/paritytech/polkadot-sdk/releases/download/polkadot-stable2412-2/polkadot
chmod +x polkadot

# Download Polkadot-Parachain (Asset Hub collator)
wget https://github.com/paritytech/polkadot-sdk/releases/download/polkadot-stable2412-2/polkadot-parachain
chmod +x polkadot-parachain

# Verify all binaries are in PATH
which zombienet polkadot polkadot-parachain
```

**Alternative:** Build from source (takes 30+ minutes):
```bash
git clone https://github.com/paritytech/polkadot-sdk.git --depth 1
cd polkadot-sdk
cargo build --release --bin polkadot --bin polkadot-parachain
sudo cp target/release/{polkadot,polkadot-parachain} /usr/local/bin/
```

### 2. Install Node.js Dependencies

```bash
cd zombienet/
npm install
```

This installs:
- `@polkadot/api` — For interacting with Substrate nodes
- `@polkadot/keyring` — For managing test accounts (Alice, Bob)
- `@acala-network/chopsticks` — For XCM simulation

### 3. Start the Local Network

```bash
npm run start
# Or: bash start-local-stack.sh
```

**Expected output:**
```
╔══════════════════════════════════════════════════════════╗
║                   Stack is running!                     ║
╚══════════════════════════════════════════════════════════╝

  Relay chain RPC  (alice) : ws://127.0.0.1:9955
  Asset Hub WS             : ws://127.0.0.1:9989
  EVM / eth_* RPC          : http://127.0.0.1:8545

  Logs: zombienet/logs/
```

⏱️ **This takes ~30-60 seconds.** The script will wait for Asset Hub to be ready before starting eth-rpc.

### 4. Verify Network Health

```bash
npm run health
# Or: bash health-check.sh
```

You should see all green checkmarks ✅:
```
  ✅ Relay chain (Alice WebSocket) (port 9955)
  ✅ Relay chain (Bob WebSocket) (port 9956)
  ✅ Asset Hub (WebSocket) (port 9989)
  ✅ eth-rpc adapter (HTTP) (port 8545)
```

### 5. Run Tests

```bash
npm test
# Or: bash run-all-tests.sh
```

This runs:
1. **Smoke tests** — Network health, block production, parachain registration
2. **XCM integration test** — Cross-chain transfer that ParaTrace will monitor

**Expected result:**
```
╔══════════════════════════════════════════════════════════╗
║              All tests passed! ✅                        ║
╚══════════════════════════════════════════════════════════╝
```

### 6. Deploy ParaTrace Contracts

Now that your network is running, deploy the smart contracts:

```bash
# 6.1 Deploy Rust Risk Engine
cd ../contracts-solidity
npm install
npx hardhat run scripts/deployRiskEngine.ts --network zombienet

# Save the output address, e.g.: 0x1234...5678
```

```bash
# 6.2 Deploy Solidity Registry (replace <RISK_ENGINE_ADDR>)
npx hardhat ignition deploy ignition/modules/ParaTrace.ts \
  --network zombienet \
  --parameters '{"ParaTraceModule":{"riskEngineAddress":"0x1234...5678"}}'

# Save the registry address for the next step
```

### 7. Start the Indexer

The indexer monitors XCM events and updates the on-chain registry:

```bash
cd ../indexer
npm install

# Create .env file with your deployed addresses:
cat > .env <<EOF
RELAY_WS=ws://127.0.0.1:9955
ASSET_HUB_WS=ws://127.0.0.1:9989
ETH_RPC_URL=http://127.0.0.1:8545
REGISTRY_ADDRESS=<your_registry_address_from_step_6.2>
PRIVATE_KEY=0x5fb92d6e98884f76de468fa3f6278f8807c48bebc13595d45af5bdc4da702133
EOF

# Start the indexer
node src/index.js
```

**Expected output:**
```
🚀 ParaTrace Indexer started
📡 Listening for XCM events on ws://127.0.0.1:9955
📊 Registry contract: 0x...
```

### 8. Start the Frontend Dashboard

```bash
cd ../frontend-dashboard
npm install
npm run dev
```

Open **http://localhost:3000** in your browser to see:
- Live XCM transactions
- Wallet risk scores
- Flagged wallets
- Transaction flow visualization

### 9. Test End-to-End

Generate some XCM transactions to see ParaTrace in action:

```bash
cd ../zombienet
npm run test:xcm
```

Watch the indexer logs — you should see:
```
📨 XCM transaction detected!
   From: 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY
   To: Parachain 1000
   Amount: 1000000000000
✅ Transaction recorded to registry
```

And in the dashboard, you'll see the transaction appear with a calculated risk score!

## 🛑 Stopping Everything

When you're done testing:

```bash
cd zombienet/
npm run stop
# Or: bash stop-local-stack.sh
```

This safely stops all processes and cleans up ports.

## 🐛 Common Issues

### "Binary not found: polkadot"
```bash
# Add binaries to PATH
export PATH="$HOME/.local/bin:$PATH"

# Or specify exact paths
export POLKADOT_BIN=/path/to/polkadot
export PARACHAIN_BIN=/path/to/polkadot-parachain
export ZOMBIENET_BIN=/path/to/zombienet
```

### "Port already in use"
```bash
# Kill all polkadot processes
pkill -f polkadot

# Or manually kill processes on specific ports
lsof -ti :9955 | xargs kill -9
```

### "Asset Hub did not come up"
Check the logs:
```bash
tail -f zombienet/logs/*.log
```

Common causes:
- Insufficient disk space
- Another instance already running
- Missing chain spec files

### Tests fail with "Timed out"
Increase timeout in `paratrace.toml`:
```toml
[settings]
timeout = 2000  # Increase from 1000 to 2000
```

## 📊 What You've Built

You now have a complete local blockchain development environment:

```
┌─────────────────────────────────────────────────────────┐
│                    Your Local Setup                     │
│                                                         │
│  Relay Chain (Rococo Local)                            │
│  ├─ Alice (validator)    ws://127.0.0.1:9955          │
│  └─ Bob (validator)      ws://127.0.0.1:9956          │
│                                                         │
│  Parachain 1000 (Asset Hub)                            │
│  └─ Collator             ws://127.0.0.1:9989          │
│                                                         │
│  Smart Contracts (via eth-rpc adapter)                 │
│  ├─ Rust Risk Engine     (ink! on PolkaVM)            │
│  └─ Solidity Registry    http://127.0.0.1:8545        │
│                                                         │
│  Off-Chain Components                                   │
│  ├─ XCM Event Indexer    (monitors relay chain)       │
│  └─ React Dashboard      http://localhost:3000        │
└─────────────────────────────────────────────────────────┘
```

## 🎓 Next Steps

1. **Experiment with XCM**: Modify `xcm-test.js` to send different amounts or use different accounts
2. **Test risk scoring**: Create wallets that trigger high-risk patterns (rapid chain-hopping, large transfers)
3. **Customize thresholds**: Edit the Rust risk engine to adjust risk calculation logic
4. **Add more parachains**: Modify `paratrace.toml` to add additional parachains for multi-chain testing

## 📚 Learn More

- [Zombienet Documentation](https://paritytech.github.io/zombienet/)
- [XCM Format](https://wiki.polkadot.network/docs/learn-xcm)
- [PolkaVM (pallet-revive)](https://github.com/paritytech/polkadot-sdk/tree/master/substrate/frame/revive)
- [Chopsticks XCM Testing](https://docs.polkadot.com/parachains/testing/fork-a-parachain/)

## ✅ Success Checklist

- [ ] All binaries downloaded and in PATH
- [ ] Network starts successfully (`npm run start`)
- [ ] Health check passes (`npm run health`)
- [ ] All tests pass (`npm test`)
- [ ] Contracts deployed to local network
- [ ] Indexer running and detecting events
- [ ] Dashboard showing live data

If you checked all boxes — congratulations! 🎉 You have a fully functional local ParaTrace environment!

---

**Need help?** Check the full [README.md](./README.md) for detailed troubleshooting and advanced usage.
