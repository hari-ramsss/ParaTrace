#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# stop-local-stack.sh
#
# Safely stops all components of the ParaTrace local testing stack:
#   • Zombienet (polkadot relay chain + Asset Hub parachain)
#   • eth-rpc adapter
#
# Usage from repo root:
#   bash zombienet/stop-local-stack.sh
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${SCRIPT_DIR}/logs"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║       ParaTrace — Stop Local Stack                      ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ── Stop processes by PID files ───────────────────────────────────────────────

if [[ -f "${LOG_DIR}/zombienet.pid" ]]; then
  ZOMBIENET_PID=$(cat "${LOG_DIR}/zombienet.pid")
  echo "[info] Stopping Zombienet (PID: ${ZOMBIENET_PID})..."
  kill "${ZOMBIENET_PID}" 2>/dev/null || echo "  Process already stopped"
  rm -f "${LOG_DIR}/zombienet.pid"
else
  echo "[info] No Zombienet PID file found"
fi

if [[ -f "${LOG_DIR}/eth-rpc.pid" ]]; then
  ETH_RPC_PID=$(cat "${LOG_DIR}/eth-rpc.pid")
  echo "[info] Stopping eth-rpc adapter (PID: ${ETH_RPC_PID})..."
  kill "${ETH_RPC_PID}" 2>/dev/null || echo "  Process already stopped"
  rm -f "${LOG_DIR}/eth-rpc.pid"
else
  echo "[info] No eth-rpc PID file found"
fi

# ── Force kill any remaining processes on expected ports ──────────────────────

echo ""
echo "[info] Checking for leftover processes on expected ports..."

for PORT in 9944 9945 9955 9956 9988 9989 8545; do
  PID=$(lsof -ti tcp:${PORT} 2>/dev/null || true)
  if [[ -n "${PID}" ]]; then
    echo "  Killing process on port ${PORT} (PID: ${PID})"
    kill -9 "${PID}" 2>/dev/null || true
  fi
done

# ── Kill all polkadot/parachain processes ─────────────────────────────────────

echo ""
echo "[info] Killing all polkadot-related processes..."
pkill -f 'polkadot' 2>/dev/null || echo "  No polkadot processes found"
pkill -f 'eth-rpc' 2>/dev/null || echo "  No eth-rpc processes found"

# ── Clean up ──────────────────────────────────────────────────────────────────

echo ""
echo "[info] Cleaning up temporary files..."
rm -rf /tmp/zombie-* 2>/dev/null || true

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║              Stack stopped successfully!                ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "  Logs preserved in: ${LOG_DIR}/"
echo ""
echo "  To restart: bash zombienet/start-local-stack.sh"
echo ""
