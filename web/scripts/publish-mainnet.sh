#!/usr/bin/env bash
#
# Publish the Gauntlet Move package to Sui MAINNET and print the env lines to
# wire it up. This spends REAL SUI on gas — make sure the active wallet is
# funded.
#
# Usage:
#   web/scripts/publish-mainnet.sh
#   GAS_BUDGET=300000000 web/scripts/publish-mainnet.sh
#
set -euo pipefail

GAS_BUDGET="${GAS_BUDGET:-200000000}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACTS_DIR="$(cd "$SCRIPT_DIR/../../contracts" && pwd)"

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
red()  { printf '\033[31m%s\033[0m\n' "$1"; }
green(){ printf '\033[32m%s\033[0m\n' "$1"; }

command -v sui >/dev/null 2>&1 || { red "sui CLI not found. Install it first."; exit 1; }

# 1. Make sure we're on mainnet. Create the env if it's missing, then switch.
if ! sui client envs 2>/dev/null | grep -q "mainnet"; then
  bold "No 'mainnet' env found — creating it…"
  sui client new-env --alias mainnet --rpc https://fullnode.mainnet.sui.io:443
fi
sui client switch --env mainnet >/dev/null
ACTIVE_ENV="$(sui client active-env 2>/dev/null || echo '?')"
ACTIVE_ADDR="$(sui client active-address 2>/dev/null || echo '?')"
bold "Network: ${ACTIVE_ENV}   Signer: ${ACTIVE_ADDR}"

if [ "$ACTIVE_ENV" != "mainnet" ]; then
  red "Active env is not mainnet — aborting."; exit 1
fi

# 2. Gas check — warn if the active address looks unfunded.
GAS_JSON="$(sui client gas --json 2>/dev/null || echo '[]')"
if [ "$GAS_JSON" = "[]" ] || [ -z "$GAS_JSON" ]; then
  red "No gas coins on ${ACTIVE_ADDR}. Fund it with real SUI before publishing."
  exit 1
fi

bold "Publishing ${CONTRACTS_DIR} to mainnet (gas budget ${GAS_BUDGET})…"
read -r -p "This spends real SUI. Continue? [y/N] " confirm
[ "$confirm" = "y" ] || [ "$confirm" = "Y" ] || { echo "Aborted."; exit 0; }

OUT="$(mktemp)"
trap 'rm -f "$OUT"' EXIT
sui client publish --gas-budget "$GAS_BUDGET" --json "$CONTRACTS_DIR" >"$OUT"

# 3. Parse the package id + UpgradeCap out of the publish output.
if command -v jq >/dev/null 2>&1; then
  PKG="$(jq -r '.objectChanges[] | select(.type=="published") | .packageId' "$OUT" | head -n1)"
  CAP="$(jq -r '.objectChanges[]? | select((.objectType // "") | endswith("::package::UpgradeCap")) | .objectId' "$OUT" | head -n1)"
else
  red "jq not installed — printing raw output; copy the packageId + UpgradeCap manually."
  cat "$OUT"
  PKG=""; CAP=""
fi

if [ -z "${PKG:-}" ]; then
  red "Could not parse a package id. Full output above; wire it up manually."
  exit 1
fi

echo
green "✓ Published to mainnet"
echo
bold "Package id:  $PKG"
bold "UpgradeCap:  ${CAP:-<not found — check output>}  (save this, it authorizes future upgrades)"
echo
bold "── Paste into web/.env.local ──"
echo "NEXT_PUBLIC_GAUNTLET_PACKAGE_ID=$PKG"
echo
bold "── Run (sets the Convex poller's package id) ──"
echo "cd web && npx convex env set GAUNTLET_PACKAGE_ID $PKG"
echo
bold "── Then ──"
echo "1. Set NEXT_PUBLIC_TREASURY_ADDRESS to a dedicated treasury wallet."
echo "2. rm -rf web/.next && (cd web && pnpm dev)  # or redeploy"
echo "3. Spawn the first mainnet pool in the admin console, then set"
echo "   NEXT_PUBLIC_POOL_OBJECT_ID to its object id."
