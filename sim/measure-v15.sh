#!/bin/bash
# Measure of the M2b v15 package (docs/specs/changes-m2b-v15.md "What the sim must run") on the engine that holds it (main
# 391469b, engineer-2026-11-12c: Warden Belk hpMult 0.90; the Swift passage behind C.GATES.swiftRoad, on; Mawgrim's HP arm
# behind C.GATES.mawgrimHp, off). The sim's v14 gate rule: a cell without --gates plays the engine's defaults (the game as
# built); a cell with --gates plays the named switches on and every other off, so an arm that turns a switch off names every
# switch that stays on. Main cells --map expedition --prep (D118), seeds 1000 on, the v13 / v14 tables (X0, XA, R0 as
# sim/measure-v13.sh and -v14.sh), so every cell is paired by class and seed with pass-v14 (Belk at 1.05) and pass-v13
# (speedrunner and planner flip cells). Run in order; cut from the bottom.
# Report: docs/reports/balance-2026-11-12c.md (tables: node sim/v15report.mjs); hand-off docs/handoffs/sim-2026-11-12c.md.
#
#   bash sim/measure-v15.sh [OUT] [STAGES]      OUT default sim/out/pass-v15; STAGES default "H C1 C2 C3 C4 C3B"
#   stages:
#     H    hash identity against the sim of REF on this engine (sim/hashgates.mjs): classic cells and expedition cells with
#          the Swift passage off are identical run for run; a plain cell equals the cell naming every default-on switch
#     C1   cell 1, expedition P0 as built: onebutton --think --think-mash (XTHINK per class); onebutton full runs and
#          planner (XRUNS)                                                  row 1: B60 expedition, B59 (c)-(d), B61, Belk
#     C2   cell 2, expedition PALL: speedrunner --variant v11 with row 2 on (as built) and off (--gates OFF2) (SPEEDRUNS);
#          the v12 policy (no variant) with row 2 on (V12RUNS)                               rows 2-3: B12, B3 speed, swift
#     C3   cell 3, expedition planner PALL as built (XRUNS; P0 is cell 1's planner)               B11, criterion 2, swift
#     C4   cell 4, classic P0 planner: as built (RUNS per class) and the row 4 arm (--gates ARM4, class C4CLASS)
#                                                                Mage Mawgrim deaths and rounds, Mage reach / win; Belk
#     C3B  row 2 off arms of cell 3 (same engine): expedition planner P0 and PALL with --gates OFF2 (XRUNS)
#          planner win with and without the Swift passage, paired (row 2's "falls by no more than 2 pp")
#     F    fallback arm of row 2 (scratch engine copy: ROAD_SWIFT_XP_FRAC FRAC): speedrunner v11 PALL (SPEEDRUNS), planner
#          P0 and PALL (XRUNS)                                       only if B12 misses by <= 1 min (decision rule, row 2)
#     T    row 2 arm ROAD_SWIFT_TOLLS TOLLS (scratch engine copy): the same cells as F           only if B11 < 40
# Env: WORKERS (2), REF (391469b: the sim before this change, on the same engine), RUNS (1000), XRUNS (300), XTHINK (50),
#      SPEEDRUNS (700), V12RUNS (300), C4CLASS (mage), FRAC (1.0), TOLLS (13).
set -euo pipefail
W=$(cd "$(dirname "$0")/.." && pwd)
O=$(mkdir -p "${1:-$W/sim/out/pass-v15}" && cd "${1:-$W/sim/out/pass-v15}" && pwd)
STAGES=" ${2:-H C1 C2 C3 C4 C3B} "
WK=${WORKERS:-2}; REF=${REF:-391469b}; RUNS=${RUNS:-1000}; XRUNS=${XRUNS:-300}; XTHINK=${XTHINK:-50}
SPEEDRUNS=${SPEEDRUNS:-700}; V12RUNS=${V12RUNS:-300}; C4CLASS=${C4CLASS:-mage}; FRAC=${FRAC:-1.0}; TOLLS=${TOLLS:-13}
P11B=$W/sim/out/pass-2026-11-11b                         # classic warm-up tables (as the v13, v14 and mash cells)
P11F=$W/sim/out/pass-v9v10                               # expedition node-risk base (as the v13 and v14 cells)
PT=$W/sim/out/pass-v12/exp/table                         # expedition table pass of 11-11h (ct, dim)
R0="--risk-in $P11B/warmup-P0.json"
X0="--map expedition --prep --risk-in $P11F/obs-P0.json --tables-in $PT/planner-P0-exp-prep/risk.json"
XA="--map expedition --prep --risk-in $P11F/obs-PALL.json --tables-in $PT/planner-PALL-exp-prep/risk.json"
OFF2="rareHpMultZ1,firstMeetWindup,sapHold,passStealth"            # row 2 off: every other default-on switch named
ARM4="rareHpMultZ1,firstMeetWindup,sapHold,passStealth,swiftRoad,mawgrimHp"   # row 4 arm: the defaults + mawgrimHp
log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$O/measure.log"; }
has() { [[ "$STAGES" == *" $1 "* ]]; }
# run DIR OUT args...: one cell from the sim at DIR (the worktree, or a scratch copy for an engine arm).
runIn() { local dir=$1 out=$2; shift 2; (cd "$dir" && node sim/run.mjs --seed-start 1000 --warmup 0 --workers "$WK" --out "$out" "$@" 2>/dev/null | grep -E "win|wrote" | tee -a "$O/measure.log"); }
run() { runIn "$W" "$@"; }
# scratch NAME CONST VALUE: a copy of src/ (one engine constant changed) and sim/ (without out/) under $O/scratch/NAME.
scratch() {
  local S=$O/scratch/$1; rm -rf "$S"; mkdir -p "$S"
  cp -r "$W/src" "$S/src"
  tar --exclude=./sim/out -C "$W" -cf - ./sim | tar -x -C "$S"
  sed -i -E "s/^export const $2 = [0-9.]+;/export const $2 = $3;/" "$S/src/constants.js"
  grep -q "^export const $2 = $3;" "$S/src/constants.js" || { log "scratch $1: $2 not set"; exit 1; }
  echo "$S"
}
T0=$(date +%s)
log "measure v15 into $O (stages:$STAGES workers $WK, commit $(cd "$W" && git rev-parse --short HEAD)$(cd "$W" && git diff --quiet HEAD -- sim src || echo +dirty))"

if has H; then
  S=$O/scratch/ref; rm -rf "$S"; mkdir -p "$S"
  cp -r "$W/src" "$S/src"
  (cd "$W" && git archive "$REF" sim) | tar -x -C "$S"
  (cd "$W" && node sim/hashgates.mjs "$S" "$W") | tee -a "$O/measure.log"
  log "H done ($(( ($(date +%s) - T0) / 60 )) min)"
fi
if has C1; then
  run "$O/think" --bot onebutton --class all --runs "$XTHINK" --profile fresh $X0 --think --think-mash
  run "$O/exp" --bot onebutton --class all --runs "$XRUNS" --profile fresh $X0
  run "$O/exp" --bot planner --class all --runs "$XRUNS" --profile fresh $X0
  log "C1 done ($(( ($(date +%s) - T0) / 60 )) min)"
fi
if has C2; then
  run "$O/exp" --bot speedrunner --variant v11 --class all --runs "$SPEEDRUNS" --profile all $XA
  run "$O/exp" --bot speedrunner --variant v11 --class all --runs "$SPEEDRUNS" --profile all $XA --gates "$OFF2"
  run "$O/exp" --bot speedrunner --class all --runs "$V12RUNS" --profile all $XA
  log "C2 done ($(( ($(date +%s) - T0) / 60 )) min)"
fi
if has C3; then
  run "$O/exp" --bot planner --class all --runs "$XRUNS" --profile all $XA
  log "C3 done ($(( ($(date +%s) - T0) / 60 )) min)"
fi
if has C4; then
  run "$O/classic" --bot planner --class all --runs "$RUNS" --profile fresh $R0
  run "$O/classic" --bot planner --class "$C4CLASS" --runs "$RUNS" --profile fresh $R0 --gates "$ARM4"
  log "C4 done ($(( ($(date +%s) - T0) / 60 )) min)"
fi
if has C3B; then
  run "$O/exp" --bot planner --class all --runs "$XRUNS" --profile fresh $X0 --gates "$OFF2"
  run "$O/exp" --bot planner --class all --runs "$XRUNS" --profile all $XA --gates "$OFF2"
  log "C3B done ($(( ($(date +%s) - T0) / 60 )) min)"
fi
if has F; then
  S=$(scratch "frac$FRAC" ROAD_SWIFT_XP_FRAC "$FRAC")
  log "F: scratch engine $S (ROAD_SWIFT_XP_FRAC $FRAC)"
  runIn "$S" "$O/frac$FRAC" --bot speedrunner --variant v11 --class all --runs "$SPEEDRUNS" --profile all $XA
  runIn "$S" "$O/frac$FRAC" --bot planner --class all --runs "$XRUNS" --profile fresh $X0
  runIn "$S" "$O/frac$FRAC" --bot planner --class all --runs "$XRUNS" --profile all $XA
  log "F done ($(( ($(date +%s) - T0) / 60 )) min)"
fi
if has T; then
  S=$(scratch "tolls$TOLLS" ROAD_SWIFT_TOLLS "$TOLLS")
  log "T: scratch engine $S (ROAD_SWIFT_TOLLS $TOLLS)"
  runIn "$S" "$O/tolls$TOLLS" --bot speedrunner --variant v11 --class all --runs "$SPEEDRUNS" --profile all $XA
  runIn "$S" "$O/tolls$TOLLS" --bot planner --class all --runs "$XRUNS" --profile fresh $X0
  runIn "$S" "$O/tolls$TOLLS" --bot planner --class all --runs "$XRUNS" --profile all $XA
  log "T done ($(( ($(date +%s) - T0) / 60 )) min)"
fi
log "measure done in $(( ($(date +%s) - T0) / 60 )) min"
