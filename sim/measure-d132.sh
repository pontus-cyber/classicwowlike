#!/bin/bash
# Re-measure after D132 (the camp board across the run: the start camp's 3 offers drawn one each from zones 1-2, 3-4,
# 5-6, C.GATES.boardAcrossRun on; engine 1a3af69, unchanged to 70aee4d). Cells and seeds of report 2026-11-12d
# (sim/measure-d128.sh): the game's default --map expedition --prep (D118), seeds 1000 on, the v13-v15 tables (X0, XA),
# so every cell pairs by class and seed with the board-off arm (the D128 board on the same engine: a cell naming every
# default-on switch except boardAcrossRun, cell mark '-noba'). Report: docs/reports/balance-2026-11-13.md (tables:
# node sim/d132report.mjs); hand-off docs/handoffs/sim-2026-11-13.md.
#
#   bash sim/measure-d132.sh [OUT] [STAGES]      OUT default sim/out/pass-d132; STAGES default "H M A"
#   stages:
#     H   the board-off arm on this engine (-noba) for the first HRUNS seeds per class of each 12d cell (planner P0, PALL,
#         speedrunner v11 PALL, planner P0 prep random, greedy P0) into off/, then run-for-run identity against the 12d
#         cells (D128PASS/exp, the D128 engine, same sim but GATE_TAG; sim/samerecords.mjs). On a pass the 12d cells are
#         the board-off arm of every pairing (by construction: boardBand off returns zone i + 1 without a draw)
#     M   the engine as built (board across the run), XRUNS per class: planner P0 and PALL, speedrunner v11 PALL
#         (SPEEDRUNS), planner P0 with --prep-policy none and random (B40), greedy P0, planner PALL without the vision
#         entries and the camp's two sight perks (B42)
#     A   autoplay's camp (--prep-policy auto: the engine's R.autoAction at the camp, the planner elsewhere), planner P0,
#         ARUNS per class: AUTO_PREP_ZONES 3 as built into exp/, and 6 (all zones; a scratch copy of src/ with the
#         constant changed) into apz6/
#     O   the full board-off arm (only when H fails): the H cells at XRUNS (speedrunner SPEEDRUNS) into off/
# Env: WORKERS (2), XRUNS (300), SPEEDRUNS (700), HRUNS (40), ARUNS (200), D128PASS (sim/out/pass-d128).
# As measured (report 2026-11-13): bash sim/measure-d132.sh sim/out/pass-d132 "H M A".
set -euo pipefail
W=$(cd "$(dirname "$0")/.." && pwd)
O=$(mkdir -p "${1:-$W/sim/out/pass-d132}" && cd "${1:-$W/sim/out/pass-d132}" && pwd)
STAGES=" ${2:-H M A} "
WK=${WORKERS:-2}; XRUNS=${XRUNS:-300}; SPEEDRUNS=${SPEEDRUNS:-700}; HRUNS=${HRUNS:-40}; ARUNS=${ARUNS:-200}
D128PASS=${D128PASS:-$W/sim/out/pass-d128}
P11F=$W/sim/out/pass-v9v10                               # expedition node-risk base (as the v13-v15 cells)
PT=$W/sim/out/pass-v12/exp/table                         # expedition table pass of 11-11h (ct, dim)
X0="--map expedition --prep --risk-in $P11F/obs-P0.json --tables-in $PT/planner-P0-exp-prep/risk.json"
XA="--map expedition --prep --risk-in $P11F/obs-PALL.json --tables-in $PT/planner-PALL-exp-prep/risk.json"
NOVIS="--meta-drop scout,cartographer,old_hand --prep-ban charts,tracker"   # B42 no-vision cell (EXP.B42_VISION_*)
NOBA="--gates rareHpMultZ1,firstMeetWindup,sapHold,passStealth"            # every default-on switch but boardAcrossRun
log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$O/measure.log"; }
has() { [[ "$STAGES" == *" $1 "* ]]; }
runIn() { local dir=$1 out=$2; shift 2; (cd "$dir" && node sim/run.mjs --seed-start 1000 --warmup 0 --workers "$WK" --out "$out" "$@" 2>/dev/null | grep -E "win|wrote" | tee -a "$O/measure.log"); }
run() { runIn "$W" "$@"; }
offArm() { # $1 runs per class, $2 speedrunner runs per class
  run "$O/off" --bot planner --class all --runs "$1" --profile fresh $X0 $NOBA
  run "$O/off" --bot planner --class all --runs "$1" --profile all $XA $NOBA
  run "$O/off" --bot speedrunner --variant v11 --class all --runs "$2" --profile all $XA $NOBA
  run "$O/off" --bot planner --class all --runs "$1" --profile fresh $X0 --prep-policy random $NOBA
  run "$O/off" --bot greedy --class all --runs "$1" --profile fresh $X0 $NOBA
}
T0=$(date +%s)
log "measure d132 into $O (stages:$STAGES workers $WK, commit $(cd "$W" && git rev-parse --short HEAD)$(cd "$W" && git diff --quiet HEAD -- sim src || echo +dirty))"

if has H; then
  offArm "$HRUNS" "$HRUNS"
  (cd "$W" && node sim/samerecords.mjs "$O/off" "$D128PASS/exp" --strip -noba) | tee -a "$O/measure.log" || log "H: identity FAIL: run stage O"
  log "H done ($(( ($(date +%s) - T0) / 60 )) min)"
fi
if has M; then
  run "$O/exp" --bot planner --class all --runs "$XRUNS" --profile fresh $X0
  run "$O/exp" --bot planner --class all --runs "$XRUNS" --profile all $XA
  run "$O/exp" --bot speedrunner --variant v11 --class all --runs "$SPEEDRUNS" --profile all $XA
  run "$O/exp" --bot planner --class all --runs "$XRUNS" --profile fresh $X0 --prep-policy none
  run "$O/exp" --bot planner --class all --runs "$XRUNS" --profile fresh $X0 --prep-policy random
  run "$O/exp" --bot greedy --class all --runs "$XRUNS" --profile fresh $X0
  run "$O/exp" --bot planner --class all --runs "$XRUNS" --profile all $XA $NOVIS
  log "M done ($(( ($(date +%s) - T0) / 60 )) min)"
fi
if has A; then
  run "$O/exp" --bot planner --class all --runs "$ARUNS" --profile fresh $X0 --prep-policy auto
  S=$O/scratch/apz6; rm -rf "$S"; mkdir -p "$S"
  cp -r "$W/src" "$S/src"
  tar --exclude=./sim/out -C "$W" -cf - ./sim | tar -x -C "$S"
  sed -i 's/^  AUTO_PREP_ZONES: 3,$/  AUTO_PREP_ZONES: 6,/' "$S/src/constants.js"
  grep -q "^  AUTO_PREP_ZONES: 6,$" "$S/src/constants.js" || { log "A: AUTO_PREP_ZONES not found in the scratch constants"; exit 1; }
  runIn "$S" "$O/apz6" --bot planner --class all --runs "$ARUNS" --profile fresh $X0 --prep-policy auto
  log "A done ($(( ($(date +%s) - T0) / 60 )) min)"
fi
if has O; then
  offArm "$XRUNS" "$SPEEDRUNS"
  log "O done ($(( ($(date +%s) - T0) / 60 )) min)"
fi
log "measure done in $(( ($(date +%s) - T0) / 60 )) min"
