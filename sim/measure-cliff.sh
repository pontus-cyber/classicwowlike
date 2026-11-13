#!/bin/bash
# Measure the zone 1 -> zone 2 difficulty step (report docs/reports/balance-2026-11-13c.md; blind testers D144): per zone
# fights, levels per fight, XP sources, HP low point per fight and deaths per fight index, for the onebutton, masher,
# greedy and planner bots on P0, the expedition map with the start camp (--map expedition --prep, D118), seeds 1000 on,
# the X0 tables. The record fields `lv` and `xz` (sim/lib/recorder.mjs) carry the per-fight levels and XP sources.
# Tables: node sim/cliffreport.mjs <OUT>.
#
#   bash sim/measure-cliff.sh [OUT] [STAGES]      OUT default sim/out/pass-cliff; STAGES default "M G"
#   stages:
#     M   main cells: onebutton, masher, greedy, planner, P0, RUNS per class, into main/
#     N   as M with C.GATES.rewardPrimary off (D144; every other default-on switch named; cell mark '-norp'), into main/
#     H   as G with rewardPrimary off ('-norp'), into guided/
#     G   guided first run (--guided, newRun tutorial: zone 1 on TUTORIAL_SEED with the overlay, as the blind testers
#         played it): planner and onebutton, GRUNS per class, into guided/
#     T   guided first run on the scratch arms GARMS (default "a4 a5"): planner and onebutton --guided, GRUNS per class,
#         into arm-<arm>-guided/ (run after S, which builds the scratch copies)
#     S   scratch arms (engine constants changed in a scratch copy of src/ under OUT/scratch-<arm>; src/ untouched):
#         ARMS (default "a1 a2 a3", sim/cliff-arms.sh) with the cells of M for planner, onebutton, masher and greedy, ARUNS per class
# Env: WORKERS (2), RUNS (500), GRUNS (300), ARUNS (300), ARMS, GARMS.
# As measured (report 2026-11-13c) on bbe83a8: bash sim/measure-cliff.sh sim/out/pass-cliff "M", then "N", "G H",
# ARMS="a6 a5" GARMS="a6" ... "S T" (one background run each, under 30 min). Arms a1-a5 also on 1ce100b (before D144):
# sim/out/pass-cliff-1ce100b, ARMS="a1 a2 a3" ... "S"; ARMS="a4 a5" GARMS="a4 a5" ... "S T".
set -euo pipefail
W=$(cd "$(dirname "$0")/.." && pwd)
O=$(mkdir -p "${1:-$W/sim/out/pass-cliff}" && cd "${1:-$W/sim/out/pass-cliff}" && pwd)
STAGES=" ${2:-M G} "
WK=${WORKERS:-2}; RUNS=${RUNS:-500}; GRUNS=${GRUNS:-300}; ARUNS=${ARUNS:-300}; ARMS=${ARMS:-a1 a2 a3}; GARMS=${GARMS:-a4 a5}
P11F=$W/sim/out/pass-v9v10
PT=$W/sim/out/pass-v12/exp/table
NORP="--gates rareHpMultZ1,firstMeetWindup,sapHold,passStealth,boardAcrossRun,autoEmberFirst"   # every default-on switch but rewardPrimary
X0="--map expedition --prep --risk-in $P11F/obs-P0.json --tables-in $PT/planner-P0-exp-prep/risk.json"
log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$O/measure.log"; }
has() { [[ "$STAGES" == *" $1 "* ]]; }
run() { local out=$1; shift; (cd "$W" && node sim/run.mjs --seed-start 1000 --warmup 0 --workers "$WK" --out "$out" "$@" 2>/dev/null | grep -E "win|wrote" | tee -a "$O/measure.log"); }
T0=$(date +%s)
log "measure cliff into $O (stages:$STAGES workers $WK, commit $(cd "$W" && git rev-parse --short HEAD)$(cd "$W" && git diff --quiet HEAD -- sim src || echo +dirty))"
if has M; then
  for b in onebutton masher greedy planner; do run "$O/main" --bot $b --class all --runs "$RUNS" --profile fresh $X0; done
  log "M done ($(( ($(date +%s) - T0) / 60 )) min)"
fi
if has N; then
  for b in onebutton masher greedy planner; do run "$O/main" --bot $b --class all --runs "$RUNS" --profile fresh $X0 $NORP; done
  log "N done ($(( ($(date +%s) - T0) / 60 )) min)"
fi
if has H; then
  for b in planner onebutton; do run "$O/guided" --bot $b --class all --runs "$GRUNS" --profile fresh $X0 --guided $NORP; done
  log "H done ($(( ($(date +%s) - T0) / 60 )) min)"
fi
if has G; then
  for b in planner onebutton; do run "$O/guided" --bot $b --class all --runs "$GRUNS" --profile fresh $X0 --guided; done
  log "G done ($(( ($(date +%s) - T0) / 60 )) min)"
fi
if has S; then
  # Each arm: a scratch copy of the tree (src/ and sim/) with one constant edit applied by sed (sim/cliff-arms.sh).
  for arm in $ARMS; do
    D="$O/scratch-$arm"
    rm -rf "$D"; mkdir -p "$D"
    cp -r "$W/src" "$D/src"
    mkdir -p "$D/sim"; for f in "$W"/sim/*; do b=$(basename "$f"); [ "$b" = out ] && continue; cp -r "$f" "$D/sim/$b"; done
    bash "$W/sim/cliff-arms.sh" "$arm" "$D/src"
    for b in planner onebutton masher greedy; do
      (cd "$D" && node sim/run.mjs --seed-start 1000 --warmup 0 --workers "$WK" --out "$O/arm-$arm" --bot $b --class all --runs "$ARUNS" --profile fresh $X0 2>/dev/null | grep -E "win|wrote" | tee -a "$O/measure.log")
    done
    log "S $arm done ($(( ($(date +%s) - T0) / 60 )) min)"
  done
fi
if has T; then
  for arm in $GARMS; do
    D="$O/scratch-$arm"
    [ -d "$D/src" ] || { log "T: no scratch copy for $arm (run stage S first)"; exit 1; }
    for b in planner onebutton; do
      (cd "$D" && node sim/run.mjs --seed-start 1000 --warmup 0 --workers "$WK" --out "$O/arm-$arm-guided" --bot $b --class all --runs "$GRUNS" --profile fresh $X0 --guided 2>/dev/null | grep -E "win|wrote" | tee -a "$O/measure.log")
    done
    log "T $arm done ($(( ($(date +%s) - T0) / 60 )) min)"
  done
fi
log "measure done in $(( ($(date +%s) - T0) / 60 )) min"
