#!/bin/bash
# Attribution arms of the level-60 oruvathLegacy measure (report docs/reports/legacy-l60-2026-11-18.md): the on arm of
# sim/measure-l60.sh (every default-on switch plus oruvathLegacy) on a scratch copy of src/ and sim/ with one piece of
# the switch taken back (sim/l60-patch.py tokens). Same seeds, tables and cells as the measure, so each arm is paired
# with on/ and off/.
#
#   bash sim/l60-arms.sh [OUT] "<arm>:<tokens> ..."     OUT default sim/out/pass-l60; arms e.g. "nonum:nonum dot:dot"
#   writes OUT/arm-<arm>/<cell>-or2/ ; scratch copies under OUT/scratch-<arm>/ (rebuilt each time)
# Resumable: a cell whose summary.json holds RUNS runs per class is skipped.
# Env: WORKERS (2), RUNS (300), CELLS ("P0 PALL"; also: noInterrupt noCleanse noAoe onebutton), CLASS (all).
set -euo pipefail
W=$(cd "$(dirname "$0")/.." && pwd)
O=$(mkdir -p "${1:-$W/sim/out/pass-l60}" && cd "${1:-$W/sim/out/pass-l60}" && pwd)
ARMS=${2:?arms}
WK=${WORKERS:-2}; RUNS=${RUNS:-300}; CELLS=${CELLS:-P0 PALL}; CLS=${CLASS:-all}
P11F=$W/sim/out/pass-v9v10
PT=$W/sim/out/pass-v12/exp/table
X0="--map expedition --prep --risk-in $P11F/obs-P0.json --tables-in $PT/planner-P0-exp-prep/risk.json"
XA="--map expedition --prep --risk-in $P11F/obs-PALL.json --tables-in $PT/planner-PALL-exp-prep/risk.json"
ON="--gates $(cd "$W" && node -e "import('./sim/lib/engine.mjs').then(m=>console.log([...Object.entries(m.GATE_DEFAULTS).filter(([,v])=>v).map(([k])=>k),'oruvathLegacy'].join(',')))")"
log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$O/arms.log"; }
done_cell() { [ -f "$1/summary.json" ] && node -e "const s=require('$1/summary.json');process.exit(s.meta&&s.meta.runs==$RUNS?0:1)"; }
T0=$(date +%s)
log "l60 arms into $O (arms: $ARMS; cells: $CELLS; class $CLS; runs $RUNS; commit $(cd "$W" && git rev-parse --short HEAD)$(cd "$W" && git diff --quiet HEAD -- sim src || echo +dirty))"
for spec in $ARMS; do
  arm=${spec%%:*}; tok=${spec#*:}
  D="$O/scratch-$arm"; A="$O/arm-$arm"
  rm -rf "$D"; mkdir -p "$D/sim"
  cp -r "$W/src" "$D/src"
  for f in "$W"/sim/*; do b=$(basename "$f"); [ "$b" = out ] && continue; cp -r "$f" "$D/sim/$b"; done
  python3 "$W/sim/l60-patch.py" "$D" "$tok" | tee -a "$O/arms.log"
  for c in $CELLS; do
    case $c in
      P0) cell=planner-P0-exp-prep-or2; a="--bot planner --profile fresh $X0";;
      PALL) cell=planner-PALL-exp-prep-or2; a="--bot planner --profile all $XA";;
      noInterrupt|noCleanse|noAoe) cell=planner-PALL-$c-exp-prep-or2; a="--bot planner --profile all --variant $c $XA";;
      onebutton) cell=onebutton-P0-exp-prep-or2; a="--bot onebutton --profile fresh $X0";;
      *) echo "unknown cell $c"; exit 1;;
    esac
    if done_cell "$A/$cell"; then log "skip $arm $cell (done)"; continue; fi
    (cd "$D" && node sim/run.mjs --seed-start 1000 --warmup 0 --workers "$WK" --runs "$RUNS" --class "$CLS" --out "$A" $a $ON 2>/dev/null | grep -E "win|wrote" | tee -a "$O/arms.log")
  done
  log "$arm done ($(( ($(date +%s) - T0) / 60 )) min)"
done
