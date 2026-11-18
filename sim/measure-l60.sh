#!/bin/bash
# Level-60 cells with C.GATES.oruvathLegacy off and on (C.GATES.legacy off in both): D156 rules 5-6 and the D157 class
# numbers also apply to level-60 runs under the switch (handoff engine-2026-11-18b, 4). Standard cells (D118): planner
# P0 and PALL, the B26-B28 PALL variants (noInterrupt, noCleanse, noAoe; paired seeds), onebutton P0; --map expedition
# --prep, seeds 1000 on, the X0 / XA tables, default trees. Report: docs/reports/legacy-l60-2026-11-18.md (tables:
# node sim/l60report.mjs <OUT>).
#
#   bash sim/measure-l60.sh [OUT] [ARMS]      OUT default sim/out/pass-l60; ARMS default "off on"
#   arms: off = the engine's default switches (the game as built) into off/; on = every default-on switch plus
#         oruvathLegacy (cell mark 'or2') into on/
# Resumable: a cell whose summary.json already holds RUNS runs per class is skipped.
# Env: WORKERS (2), RUNS (300).
set -euo pipefail
W=$(cd "$(dirname "$0")/.." && pwd)
O=$(mkdir -p "${1:-$W/sim/out/pass-l60}" && cd "${1:-$W/sim/out/pass-l60}" && pwd)
ARMS=" ${2:-off on} "
WK=${WORKERS:-2}; RUNS=${RUNS:-300}
P11F=$W/sim/out/pass-v9v10
PT=$W/sim/out/pass-v12/exp/table
X0="--map expedition --prep --risk-in $P11F/obs-P0.json --tables-in $PT/planner-P0-exp-prep/risk.json"
XA="--map expedition --prep --risk-in $P11F/obs-PALL.json --tables-in $PT/planner-PALL-exp-prep/risk.json"
ON="--gates $(cd "$W" && node -e "import('./sim/lib/engine.mjs').then(m=>console.log([...Object.entries(m.GATE_DEFAULTS).filter(([,v])=>v).map(([k])=>k),'oruvathLegacy'].join(',')))")"
log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$O/measure.log"; }
done_cell() { [ -f "$1/summary.json" ] && node -e "const s=require('$1/summary.json');const r=s.meta&&s.meta.runs;process.exit(r==$RUNS?0:1)"; }
run() {
  local out=$1 cell=$2; shift 2
  if done_cell "$out/$cell"; then log "skip $cell (done)"; return; fi
  (cd "$W" && node sim/run.mjs --seed-start 1000 --warmup 0 --workers "$WK" --runs "$RUNS" --class all --out "$out" "$@" 2>/dev/null | grep -E "win|wrote" | tee -a "$O/measure.log")
}
T0=$(date +%s)
log "measure l60 into $O (arms:$ARMS workers $WK, runs $RUNS, commit $(cd "$W" && git rev-parse --short HEAD)$(cd "$W" && git diff --quiet HEAD -- sim src || echo +dirty))"
for arm in off on; do
  [[ "$ARMS" == *" $arm "* ]] || continue
  G=""; M=""; [ "$arm" = on ] && { G="$ON"; M="-or2"; }
  D="$O/$arm"
  run "$D" "planner-P0-exp-prep$M" --bot planner --profile fresh $X0 $G
  run "$D" "planner-PALL-exp-prep$M" --bot planner --profile all $XA $G
  for v in noInterrupt noCleanse noAoe; do run "$D" "planner-PALL-$v-exp-prep$M" --bot planner --profile all --variant $v $XA $G; done
  run "$D" "onebutton-P0-exp-prep$M" --bot onebutton --profile fresh $X0 $G
  log "$arm done ($(( ($(date +%s) - T0) / 60 )) min)"
done
log "measure done in $(( ($(date +%s) - T0) / 60 )) min"
