#!/usr/bin/env bash
# LH1 chain (docs/specs/legacy-hall-v3-draft.md 3, 5 LH2-LH4): the campaign chained on staged hero cells. Run k of the chain
# is played at its start hero level with only the hall entries bought after runs 1..k-1 (sim/lib/hall.mjs BUY_ORDER, the arm's
# prices). The plan (node sim/lh1report.mjs plan <out> <arm>) starts from the arm's whole-hall cells interpolated and is
# re-made from the cells played, until it no longer changes (at most 5 rounds). Resumable. Read the result with
#   node sim/lh1report.mjs chain <out> <arm>
#   sim/lh1-chain.sh <out dir> <arm> [runs per class, default 60]
set -euo pipefail
OUT=${1:?out dir}; ARM=${2:?arm}; RUNS=${3:-60}
HERE=$(dirname "$0")
PREV=""
for ROUND in 1 2 3 4 5; do
  PLAN=$(node "$HERE/lh1report.mjs" plan "$OUT" "$ARM")
  [ "$PLAN" = "$PREV" ] && break
  PREV="$PLAN"
  echo "$PLAN" | while read -r K H STAGE; do
    if [ "$STAGE" = none ]; then HALL=none; else HALL="$ARM:$STAGE"; fi
    node "$HERE/legacy-run.mjs" grid --native --oruvath --econ --hall "$HALL" --levels "$H" \
      --tables "$HERE/tables/legacy-hx" --out "$OUT/chain-$ARM/run$K" --runs "$RUNS" --seed 9000 --workers 2 --resume
  done
done
