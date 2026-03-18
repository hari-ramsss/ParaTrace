#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# start-local-stack.sh
#
# One-shot script to bring up the complete ParaTrace local testing stack:
#   1. Spawn Zombienet (relay chain + Asset Hub)
#   2. Wait for the Asset Hub node to be ready
#   3. Start the eth-rpc adapter (converts Substrate RPC → eth_* JSON-RPC)
#
# After this script runs you can:
#   • Deploy contracts : cd contracts-solidity && npx hardhat run scripts/deployRiskEngine.ts --network zombienet
#   • Run XCM tests    : node zombienet/xcm-test.js
#   • Start indexer    : cd indexer && node src/index.js
#
# Prerequisites (see README.md for download links):
#   zombienet          in PATH  (or ZOMBIENET_BIN env var)
#   polkadot           in PATH  (or POLKADOT_BIN env var)
#   polkadot-parachain in PATH  (or PARACHAIN_BIN env var)
#   eth-rpc            in PATH  (or ETH_RPC_BIN env var)
#      OR use the one already bundled in contracts-solidity/bin/
#
# Usage from repo root:
#   bash zombienet/start-local-stack.sh
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ── Binary resolution ─────────────────────────────────────────────────────────

ZOMBIENET_BIN="${ZOMBIENET_BIN:-zombienet}"
POLKADOT_BIN="${POLKADOT_BIN:-polkadot}"
PARACHAIN_BIN="${PARACHAIN_BIN:-polkadot-parachain}"

# Prefer the bundled eth-rpc from contracts-solidity/bin if available
if [[ -z "${ETH_RPC_BIN:-}" ]]; then
  BUNDLED_ETH_RPC="${REPO_ROOT}/contracts-solidity/bin/eth-rpc-linux-x64"
  if [[ -f "${BUNDLED_ETH_RPC}" ]]; then
    ETH_RPC_BIN="${BUNDLED_ETH_RPC}"
    echo "[info] Using bundled eth-rpc: ${ETH_RPC_BIN}"
  else
    ETH_RPC_BIN="eth-rpc"
  fi
fi

# ── Preflight checks ──────────────────────────────────────────────────────────

check_bin() {
  if ! command -v "$1" &>/dev/null && [[ ! -f "$1" ]]; then
    echo "[error] Binary not found: $1"
    echo "        Set ${2} env var or add to PATH."
    echo "        See zombienet/README.md for download instructions."
    exit 1
  fi
}

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║       ParaTrace — Local Stack Startup                   ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "[step 1/3] Checking required binaries..."

check_bin "${ZOMBIENET_BIN}"  "ZOMBIENET_BIN"
check_bin "${POLKADOT_BIN}"   "POLKADOT_BIN"
check_bin "${PARACHAIN_BIN}"  "PARACHAIN_BIN"
check_bin "${ETH_RPC_BIN}"    "ETH_RPC_BIN"

echo "  All binaries found."

# ── Ports we expect ───────────────────────────────────────────────────────────

ASSET_HUB_WS_PORT=9989    # set in paratrace.toml  [parachains.collator] ws_port
ETH_RPC_PORT=8545          # what hardhat localNode / zombienet network expects

# Kill any pre-existing processes on these ports to avoid conflicts
for PORT in 9944 9945 9955 9956 9988 9989 ${ETH_RPC_PORT}; do
  PID=$(lsof -ti tcp:${PORT} 2>/dev/null || true)
  if [[ -n "${PID}" ]]; then
    echo "[info] Killing existing process on port ${PORT} (pid ${PID})"
    kill -9 "${PID}" 2>/dev/null || true
  fi
done

# ── Spawn Zombienet ───────────────────────────────────────────────────────────

echo ""
echo "[step 2/3] Spawning Zombienet network (relay + Asset Hub)..."
echo "           Config: ${SCRIPT_DIR}/paratrace.toml"
echo ""

LOG_DIR="${REPO_ROOT}/zombienet/logs"
mkdir -p "${LOG_DIR}"

# Run zombienet in the background; redirect output to a log file
"${ZOMBIENET_BIN}" spawn \
  "${SCRIPT_DIR}/paratrace.toml" \
  --provider native \
  --dir "${LOG_DIR}" \
  &>/dev/null &

ZOMBIENET_PID=$!
echo "  Zombienet PID: ${ZOMBIENET_PID}"

# ── Wait for Asset Hub WebSocket to become available ─────────────────────────

echo ""
echo "  Waiting for Asset Hub WS on port ${ASSET_HUB_WS_PORT}..."

for i in $(seq 1 60); do
  if nc -z 127.0.0.1 "${ASSET_HUB_WS_PORT}" 2>/dev/null; then
    echo "  Asset Hub is ready (${i}s elapsed)."
    break
  fi
  if [[ ${i} -eq 60 ]]; then
    echo "[error] Asset Hub did not come up within 60 seconds."
    echo "        Check ${LOG_DIR} for Zombienet logs."
    kill "${ZOMBIENET_PID}" 2>/dev/null || true
    exit 1
  fi
  sleep 1
  printf "."
done
echo ""

# Extra wait: give the parachain runtime a moment to initialise
sleep 5

# ── Start eth-rpc adapter ─────────────────────────────────────────────────────

echo ""
echo "[step 3/3] Starting eth-rpc adapter..."
echo "           Substrate backend : ws://127.0.0.1:${ASSET_HUB_WS_PORT}"
echo "           EVM-compatible RPC: http://127.0.0.1:${ETH_RPC_PORT}"
echo ""

"${ETH_RPC_BIN}" \
  --node-rpc-url "ws://127.0.0.1:${ASSET_HUB_WS_PORT}" \
  --listen-addr "0.0.0.0:${ETH_RPC_PORT}" \
  &>"${LOG_DIR}/eth-rpc.log" &

ETH_RPC_PID=$!
echo "  eth-rpc PID: ${ETH_RPC_PID}"

# Brief wait to confirm it started
sleep 2
if ! nc -z 127.0.0.1 "${ETH_RPC_PORT}" 2>/dev/null; then
  echo "[warning] eth-rpc adapter may not be ready yet on port ${ETH_RPC_PORT}."
  echo "          Check ${LOG_DIR}/eth-rpc.log for details."
else
  echo "  eth-rpc is ready."
fi

# ── Done ──────────────────────────────────────────────────────────────────────

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                   Stack is running!                     ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "  Relay chain RPC  (alice) : ws://127.0.0.1:9955"
echo "  Asset Hub WS             : ws://127.0.0.1:9989"
echo "  EVM / eth_* RPC          : http://127.0.0.1:8545"
echo ""
echo "  Logs: ${LOG_DIR}/"
echo ""
echo "  Next steps:"
echo "    1. Deploy Rust risk engine:"
echo "       cd contracts-solidity"
echo "       npx hardhat run scripts/deployRiskEngine.ts --network zombienet"
echo ""
echo "    2. Deploy Solidity registry (replace <RISK_ENGINE_ADDR>):"
echo "       npx hardhat ignition deploy ignition/modules/ParaTrace.ts \\"
echo "         --network zombienet \\"
echo "         --parameters '{\"ParaTraceModule\":{\"riskEngineAddress\":\"<RISK_ENGINE_ADDR>\"}}'"
echo ""
echo "    3. Run the XCM integration test:"
echo "       node zombienet/xcm-test.js"
echo ""
echo "    4. Start the indexer (update indexer/.env for local RPCs first):"
echo "       cd indexer && node src/index.js"
echo ""
echo "  To stop the stack: kill ${ZOMBIENET_PID} ${ETH_RPC_PID}"
echo "  Or run: pkill -f 'polkadot\\|eth-rpc'"
echo ""

# Write PIDs to file for easy teardown
echo "${ZOMBIENET_PID}" > "${LOG_DIR}/zombienet.pid"
echo "${ETH_RPC_PID}"   > "${LOG_DIR}/eth-rpc.pid"

wait
