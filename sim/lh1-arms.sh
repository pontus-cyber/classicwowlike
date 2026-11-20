#!/usr/bin/env bash
# LH1 arm (docs/specs/legacy-hall-v3-draft.md 5, D164): the v2 hall against the v3 hall (and its fallback) on the planner,
# hero cells with Legacy, Oruvath and Economy v2 on, the whole hall bought (sim/lib/hall.mjs). Same seeds in every arm
# (paired). Cells are resumable: a finished cell is kept. Report: node sim/lh1report.mjs <out>.
#   sim/lh1-arms.sh <out dir> [arms: v2 v3 ...]   env: N25 N20 N10 N1 (runs per class per hero level), SEED
set -euo pipefail
OUT=${1:?out dir}; shift || true
ARMS=${*:-v2 v3}
SEED=${SEED:-9000}
declare -A N=([25]=${N25:-600} [20]=${N20:-450} [10]=${N10:-450} [1]=${N1:-300})
for H in 25 20 10 1; do
  for A in $ARMS; do
    node "$(dirname "$0")/legacy-run.mjs" grid --native --oruvath --econ --hall "$A" --levels "$H" \
      --tables "$(dirname "$0")/tables/legacy-hx" --out "$OUT/$A" --runs "${N[$H]}" --seed "$SEED" --workers 2 --resume
  done
done
