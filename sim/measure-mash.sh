#!/bin/bash
# Measure for the one-button question (owner feedback docs/feedback/2026-11-11-1841-owner.md, follow-up 18:46; report
# docs/reports/mash-2026-11-11.md): onebutton, onebutton-nopot, masher, planner (autoplay) and opener cells, classic map
# and expedition with the start camp, P0 and PALL, plus the think-fight replays (run.mjs --think) on onebutton runs.
#
#   bash sim/measure-mash.sh [OUT] [STAGES]     OUT default sim/out/mash; STAGES default "A B C D"
#   stages: A classic P0: onebutton, nopot, masher, planner (RUNS per class), planner on the slot-1 trees (diagnostic),
#             think replays (THINK per class), opener (OPENER per class)
#           B classic PALL: the same bots (nopot, slot-1 planner left out), think (THINK_PALL), opener (OPENER_PALL)
#           C expedition with the start camp, P0 and PALL: onebutton, masher, planner (XRUNS per class)
#           D expedition P0: think (XTHINK), opener (XOPENER)
# Starting tables (all bots of a cell start from the same one, so cells are paired by class and seed): classic the 11-11b
# planner warm-up tables, expedition the 11-11f node-risk observations with the v11 table pass's `ct` and `dim`.
# Env: WORKERS (2), RUNS (1000), THINK (100), OPENER (100), THINK_PALL (50), OPENER_PALL (50), XRUNS (300), XTHINK (50),
#      XOPENER (50).
set -euo pipefail
W=$(cd "$(dirname "$0")/.." && pwd)
O=$(mkdir -p "${1:-$W/sim/out/mash}" && cd "${1:-$W/sim/out/mash}" && pwd)
STAGES=" ${2:-A B C D} "
WK=${WORKERS:-2}; RUNS=${RUNS:-1000}; THINK=${THINK:-100}; OPENER=${OPENER:-100}; THINK_PALL=${THINK_PALL:-50}
OPENER_PALL=${OPENER_PALL:-50}; XRUNS=${XRUNS:-300}; XTHINK=${XTHINK:-50}; XOPENER=${XOPENER:-50}
P11B=$W/sim/out/pass-2026-11-11b; P11F=$W/sim/out/pass-v9v10; PV11=$W/sim/out/pass-v11/exp/table
R0="--risk-in $P11B/warmup-P0.json"; RA="--risk-in $P11B/warmup-PALL.json"
X0="--map expedition --prep --risk-in $P11F/obs-P0.json --tables-in $PV11/planner-P0-exp-prep/risk.json"
XA="--map expedition --prep --risk-in $P11F/obs-PALL.json --tables-in $PV11/planner-PALL-exp-prep/risk.json"
log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$O/measure.log"; }
has() { [[ "$STAGES" == *" $1 "* ]]; }
run() { local out=$1; shift; (cd "$W" && node sim/run.mjs --seed-start 1000 --warmup 0 --workers "$WK" --out "$out" "$@" 2>/dev/null | grep -E "win|wrote" | tee -a "$O/measure.log"); }
log "measure mash into $O (stages:$STAGES workers $WK, commit $(cd "$W" && git rev-parse --short HEAD))"

if has A; then
  for b in onebutton masher planner; do run "$O/classic" --bot $b --class all --runs "$RUNS" --profile fresh $R0; done
  run "$O/classic" --bot onebutton --variant nopot --class all --runs "$RUNS" --profile fresh $R0
  # Diagnostic: autoplay on the onebutton bot's trees (Bladework, Pyromancy, Marksmanship).
  for ct in rogue:0 mage:0 hunter:1; do run "$O/slot1tree" --bot planner --class "${ct%:*}" --tree "${ct#*:}" --runs "$RUNS" --profile fresh $R0; done
  run "$O/think" --bot onebutton --class all --runs "$THINK" --profile fresh $R0 --think
  run "$O/classic" --bot opener --class all --runs "$OPENER" --profile fresh $R0
fi
if has B; then
  for b in onebutton masher planner; do run "$O/classic" --bot $b --class all --runs "$RUNS" --profile all $RA; done
  run "$O/classic" --bot onebutton --variant nopot --class all --runs "$RUNS" --profile all $RA
  run "$O/think" --bot onebutton --class all --runs "$THINK_PALL" --profile all $RA --think
  run "$O/classic" --bot opener --class all --runs "$OPENER_PALL" --profile all $RA
fi
if has C; then
  for p in fresh all; do
    X=$X0; [ "$p" = all ] && X=$XA
    for b in onebutton planner masher; do run "$O/exp" --bot $b --class all --runs "$XRUNS" --profile $p $X; done
  done
fi
if has D; then
  run "$O/think" --bot onebutton --class all --runs "$XTHINK" --profile fresh $X0 --think
  run "$O/exp" --bot opener --class all --runs "$XOPENER" --profile fresh $X0
fi
log "done"
