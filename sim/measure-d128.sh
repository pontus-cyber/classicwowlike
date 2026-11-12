#!/bin/bash
# Re-measure after D128 / D130 (the lean start camp: 3 contract offers for zones 1-3, no reroll, the camp sells Field
# Draughts, Ember of Return, Region Charts, Tracker's Notes; engine 79be9af, unchanged to 9c0bf77). Main cells on the
# game's default, --map expedition --prep (D118), seeds 1000 on, the v13-v15 tables (X0, XA), so every cell pairs by class
# and seed with report 2026-11-12c (sim/out/pass-v15, its -noswift cells = the D126 engine with Mawgrim at 1.0) and with
# the reference arm R (the same cells on the engine just before D128, 61052ac = D126: board of 8, every option, reroll
# legal; this sim). Report: docs/reports/balance-2026-11-12d.md (tables: node sim/d128report.mjs); hand-off
# docs/handoffs/sim-2026-11-12e.md.
#
#   bash sim/measure-d128.sh [OUT] [STAGES]      OUT default sim/out/pass-d128; STAGES default "H M R"
#   stages:
#     H   hash identity of this sim against the sim of REF on this engine (sim/hashgates.mjs): the prep policies' camp
#         filter changes no run on the engine as built
#     M   the engine as built (lean camp), XRUNS per class: planner P0 and PALL, greedy P0, speedrunner v11 PALL
#         (SPEEDRUNS), planner P0 with --prep-policy none and random (B40), planner PALL without the vision entries and the
#         camp's two sight perks (B42, EXP.B42_VISION_PERKS)
#     R   reference arm: planner P0 and PALL, speedrunner v11 PALL on a scratch copy of the engine at RENG (the camp before
#         D128) with this sim (D128 alone, paired)
#     RX  reference arm, the rest: greedy P0, planner P0 none and random on RENG (B40 and B39 greedy, D128 alone)
#     S   speedrunner v11 PALL at SPEEDRUNS on the engine as built and on RENG, into exp/ and ref/ (run with SPEEDRUNS=700
#         as report 12c, so B12 has >= EXP.B12_MIN_WINS wins; it replaces the M / R speedrunner cells with a superset of
#         their seeds, each run being the same for the same seed)
# Env: WORKERS (2), REF (9c0bf77: the sim before this change), RENG (61052ac), XRUNS (300), SPEEDRUNS (300).
# As measured (report 2026-11-12d): bash sim/measure-d128.sh sim/out/pass-d128 "H M R", then
# SPEEDRUNS=700 bash sim/measure-d128.sh sim/out/pass-d128 "RX S".
set -euo pipefail
W=$(cd "$(dirname "$0")/.." && pwd)
O=$(mkdir -p "${1:-$W/sim/out/pass-d128}" && cd "${1:-$W/sim/out/pass-d128}" && pwd)
STAGES=" ${2:-H M R} "
WK=${WORKERS:-2}; REF=${REF:-9c0bf77}; RENG=${RENG:-61052ac}; XRUNS=${XRUNS:-300}; SPEEDRUNS=${SPEEDRUNS:-300}
P11F=$W/sim/out/pass-v9v10                               # expedition node-risk base (as the v13-v15 cells)
PT=$W/sim/out/pass-v12/exp/table                         # expedition table pass of 11-11h (ct, dim)
X0="--map expedition --prep --risk-in $P11F/obs-P0.json --tables-in $PT/planner-P0-exp-prep/risk.json"
XA="--map expedition --prep --risk-in $P11F/obs-PALL.json --tables-in $PT/planner-PALL-exp-prep/risk.json"
NOVIS="--meta-drop scout,cartographer,old_hand --prep-ban charts,tracker"   # B42 no-vision cell (EXP.B42_VISION_*)
log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$O/measure.log"; }
has() { [[ "$STAGES" == *" $1 "* ]]; }
runIn() { local dir=$1 out=$2; shift 2; (cd "$dir" && node sim/run.mjs --seed-start 1000 --warmup 0 --workers "$WK" --out "$out" "$@" 2>/dev/null | grep -E "win|wrote" | tee -a "$O/measure.log"); }
run() { runIn "$W" "$@"; }
# refEngine: src/ of RENG (git archive) and this sim (without out/) under $O/scratch/ref-engine.
refEngine() {
  local S=$O/scratch/ref-engine; rm -rf "$S"; mkdir -p "$S"
  (cd "$W" && git archive "$RENG" src) | tar -x -C "$S"
  tar --exclude=./sim/out -C "$W" -cf - ./sim | tar -x -C "$S"
  grep -q "PREP_CAMP_OPTIONS" "$S/src/constants.js" && { log "ref engine $RENG already holds D128"; exit 1; }
  echo "$S"
}
T0=$(date +%s)
log "measure d128 into $O (stages:$STAGES workers $WK, commit $(cd "$W" && git rev-parse --short HEAD)$(cd "$W" && git diff --quiet HEAD -- sim src || echo +dirty))"

if has H; then
  S=$O/scratch/ref-sim; rm -rf "$S"; mkdir -p "$S"
  cp -r "$W/src" "$S/src"
  (cd "$W" && git archive "$REF" sim) | tar -x -C "$S"
  (cd "$W" && node sim/hashgates.mjs "$S" "$W") | tee -a "$O/measure.log"
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
if has R; then
  S=$(refEngine); log "R: reference engine $RENG at $S"
  runIn "$S" "$O/ref" --bot planner --class all --runs "$XRUNS" --profile fresh $X0
  runIn "$S" "$O/ref" --bot planner --class all --runs "$XRUNS" --profile all $XA
  runIn "$S" "$O/ref" --bot speedrunner --variant v11 --class all --runs "$SPEEDRUNS" --profile all $XA
  log "R done ($(( ($(date +%s) - T0) / 60 )) min)"
fi
if has RX; then
  S=$O/scratch/ref-engine; [ -d "$S/src" ] || S=$(refEngine)
  runIn "$S" "$O/ref" --bot planner --class all --runs "$XRUNS" --profile fresh $X0 --prep-policy none
  runIn "$S" "$O/ref" --bot planner --class all --runs "$XRUNS" --profile fresh $X0 --prep-policy random
  runIn "$S" "$O/ref" --bot greedy --class all --runs "$XRUNS" --profile fresh $X0
  log "RX done ($(( ($(date +%s) - T0) / 60 )) min)"
fi
if has S; then
  run "$O/exp" --bot speedrunner --variant v11 --class all --runs "$SPEEDRUNS" --profile all $XA
  S=$O/scratch/ref-engine; [ -d "$S/src" ] || S=$(refEngine)
  runIn "$S" "$O/ref" --bot speedrunner --variant v11 --class all --runs "$SPEEDRUNS" --profile all $XA
  log "S done ($(( ($(date +%s) - T0) / 60 )) min)"
fi
log "measure done in $(( ($(date +%s) - T0) / 60 )) min"
