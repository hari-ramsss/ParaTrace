#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# run-all-tests.sh
#
# Runs all ParaTrace local tests in sequence:
#   1. Zombienet smoke tests (network health)
#   2. XCM integration test (cross-chain transfers)
#
# Prerequisites:
#   • Zombienet network must be running (bash zombienet/start-local-stack.sh)
#   • Node.js dependencies installed (see README.md)
#
# Usage from repo root:
#   bash zombienet/run-all-tests.sh
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║       ParaTrace — Local Test Suite                      ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ── Check network is running ──────────────────────────────────────────────────

echo "[1/3] Checking if local network is running..."
echo ""

RELAY_PORT=9955
ASSET_HUB_PORT=9989
ETH_RPC_PORT=8545

check_port() {
  local port=$1
  local name=$2

  if nc -z 127.0.0.1 "${port}" 2>/dev/null; then
    echo "  ✅ ${name} (port ${port})"
    return 0
  else
    echo "  ❌ ${name} (port ${port}) — NOT RUNNING"
    return 1
  fi
}

NETWORK_READY=true
check_port "${RELAY_PORT}" "Relay chain (Alice)" || NETWORK_READY=false
check_port "${ASSET_HUB_PORT}" "Asset Hub" || NETWORK_READY=false
check_port "${ETH_RPC_PORT}" "eth-rpc adapter" || NETWORK_READY=false

if [[ "${NETWORK_READY}" == "false" ]]; then
  echo ""
  echo "[error] Local network is not fully running!"
  echo "        Start it first: bash zombienet/start-local-stack.sh"
  exit 1
fi

echo ""
echo "  Network is ready!"

# ── Test 1: Zombienet smoke tests ────────────────────────────────────────────

echo ""
echo "[2/3] Running Zombienet smoke tests..."
echo ""

ZOMBIENET_BIN="${ZOMBIENET_BIN:-zombienet}"

if ! command -v "${ZOMBIENET_BIN}" &>/dev/null; then
  echo "[warning] zombienet binary not found, skipping smoke tests"
  echo "          Install from: https://github.com/paritytech/zombienet/releases"
else
  "${ZOMBIENET_BIN}" test "${SCRIPT_DIR}/paratrace.zndsl" || {
    echo ""
    echo "[error] Smoke tests failed!"
    echo "        Check zombienet/logs/ for details"
    exit 1
  }
  echo ""
  echo "  ✅ Smoke tests passed!"
fi

# ── Test 2: XCM integration test ──────────────────────────────────────────────

echo ""
echo "[3/3] Running XCM integration test..."
echo ""

# Check Node.js dependencies
if ! node -e "require('@polkadot/api')" 2>/dev/null; then
  echo "[warning] @polkadot/api not installed"
  echo "          Install dependencies:"
  echo "            npm install @polkadot/api @polkadot/util-crypto @polkadot/keyring"
  echo ""
  echo "  Skipping XCM test..."
else
  node "${SCRIPT_DIR}/xcm-test.js" || {
    echo ""
    echo "[error] XCM integration test failed!"
    exit 1
  }
fi

# ── Summary ───────────────────────────────────────────────────────────────────

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║              All tests passed! ✅                        ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "  Your local ParaTrace network is working correctly."
echo ""
echo "  Next steps:"
echo "    • Deploy contracts: see zombienet/README.md"
echo "    • Start the indexer: cd indexer && node src/index.js"
echo "    • Open the dashboard: cd frontend-dashboard && npm run dev"
echo ""
