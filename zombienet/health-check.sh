#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# health-check.sh
#
# Quick health check for the local ParaTrace Zombienet network.
# Verifies all components are running and responsive.
#
# Usage from repo root:
#   bash zombienet/health-check.sh
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║       ParaTrace — Network Health Check                 ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ── Port checks ───────────────────────────────────────────────────────────────

echo "Checking network components..."
echo ""

RELAY_ALICE_WS=9955
RELAY_BOB_WS=9956
ASSET_HUB_WS=9989
ETH_RPC_PORT=8545

ALL_OK=true

check_port() {
  local port=$1
  local name=$2

  if nc -z 127.0.0.1 "${port}" 2>/dev/null; then
    echo "  ✅ ${name} (port ${port})"
    return 0
  else
    echo "  ❌ ${name} (port ${port}) — NOT RUNNING"
    ALL_OK=false
    return 1
  fi
}

check_port "${RELAY_ALICE_WS}" "Relay chain (Alice WebSocket)"
check_port "${RELAY_BOB_WS}" "Relay chain (Bob WebSocket)"
check_port "${ASSET_HUB_WS}" "Asset Hub (WebSocket)"
check_port "${ETH_RPC_PORT}" "eth-rpc adapter (HTTP)"

# ── API connectivity tests ────────────────────────────────────────────────────

if command -v wscat &>/dev/null; then
  echo ""
  echo "Testing RPC connectivity..."
  echo ""

  # Test relay chain
  if timeout 5 wscat -c "ws://127.0.0.1:${RELAY_ALICE_WS}" -x '{"id":1,"jsonrpc":"2.0","method":"system_health"}' &>/dev/null; then
    echo "  ✅ Relay chain RPC responding"
  else
    echo "  ❌ Relay chain RPC not responding"
    ALL_OK=false
  fi

  # Test Asset Hub
  if timeout 5 wscat -c "ws://127.0.0.1:${ASSET_HUB_WS}" -x '{"id":1,"jsonrpc":"2.0","method":"system_health"}' &>/dev/null; then
    echo "  ✅ Asset Hub RPC responding"
  else
    echo "  ❌ Asset Hub RPC not responding"
    ALL_OK=false
  fi
else
  echo ""
  echo "[info] Install wscat for more detailed connectivity tests:"
  echo "       npm install -g wscat"
fi

# ── eth-rpc connectivity ──────────────────────────────────────────────────────

echo ""
echo "Testing eth-rpc adapter..."
echo ""

if command -v curl &>/dev/null; then
  ETH_CHAIN_ID=$(curl -s -X POST http://127.0.0.1:${ETH_RPC_PORT} \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' 2>/dev/null | grep -o '"result":"[^"]*"' || echo "")

  if [[ -n "${ETH_CHAIN_ID}" ]]; then
    echo "  ✅ eth-rpc adapter responding"
    echo "     ${ETH_CHAIN_ID}"
  else
    echo "  ❌ eth-rpc adapter not responding"
    ALL_OK=false
  fi
else
  echo "  [info] Install curl for eth-rpc connectivity test"
fi

# ── Process checks ────────────────────────────────────────────────────────────

echo ""
echo "Checking running processes..."
echo ""

POLKADOT_COUNT=$(pgrep -f 'polkadot' | wc -l || echo "0")
ETH_RPC_COUNT=$(pgrep -f 'eth-rpc' | wc -l || echo "0")

if [[ "${POLKADOT_COUNT}" -gt 0 ]]; then
  echo "  ✅ Polkadot processes: ${POLKADOT_COUNT}"
else
  echo "  ❌ No polkadot processes found"
  ALL_OK=false
fi

if [[ "${ETH_RPC_COUNT}" -gt 0 ]]; then
  echo "  ✅ eth-rpc processes: ${ETH_RPC_COUNT}"
else
  echo "  ⚠️  No eth-rpc processes (may not be started yet)"
fi

# ── Summary ───────────────────────────────────────────────────────────────────

echo ""
if [[ "${ALL_OK}" == "true" ]]; then
  echo "╔══════════════════════════════════════════════════════════╗"
  echo "║              Network is healthy! ✅                      ║"
  echo "╚══════════════════════════════════════════════════════════╝"
  echo ""
  echo "  All components are running and responsive."
  echo ""
  echo "  Endpoints:"
  echo "    • Relay chain : ws://127.0.0.1:${RELAY_ALICE_WS}"
  echo "    • Asset Hub   : ws://127.0.0.1:${ASSET_HUB_WS}"
  echo "    • eth-rpc     : http://127.0.0.1:${ETH_RPC_PORT}"
  echo ""
  echo "  Ready for:"
  echo "    • Contract deployment"
  echo "    • XCM testing"
  echo "    • Indexer operation"
  echo ""
  exit 0
else
  echo "╔══════════════════════════════════════════════════════════╗"
  echo "║            Network has issues! ❌                       ║"
  echo "╚══════════════════════════════════════════════════════════╝"
  echo ""
  echo "  Some components are not running or not responsive."
  echo ""
  echo "  Try:"
  echo "    1. Stop: bash zombienet/stop-local-stack.sh"
  echo "    2. Start: bash zombienet/start-local-stack.sh"
  echo "    3. Check logs: ls -la zombienet/logs/"
  echo ""
  exit 1
fi
