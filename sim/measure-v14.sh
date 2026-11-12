#!/bin/bash
# Measure of the M2b v14 package (docs/specs/changes-m2b-v14.md "What the sim must run") on the engine that holds rows 1, 2
# and 4 (main 30d565a, engineer-2026-11-12: C.GATES rareHpMultZ1, firstMeetWindup, sapHold, passStealth on by default),
# with the sim's v14 gate rule: a cell without --gates plays the engine's defaults (the game as built); a cell with --gates
# plays the named switches on and every other off. Same seeds, tables and tools as the v13 measure (sim/measure-v13.sh),
# so every cell is paired by class and seed with its v13 cell (sim/out/pass-v13). Run in order; cut from the bottom.
# Report: docs/reports/balance-2026-11-12b.md (tables: node sim/v14report.mjs); hand-off docs/handoffs/sim-2026-11-12b.md.
#
#   bash sim/measure-v14.sh [OUT] [STAGES]      OUT default sim/out/pass-v14; STAGES default "H C1 C2 C3 C4"
#   stages:
#     H   hash identity: cells that name their gates end in the same state on this sim and on the sim of REF (the v13 gate
#         rule), classic and expedition; a plain cell equals the cell that names every default switch (sim/hashgates.mjs)
#     C1  cell 1, classic P0: planner as built (row 1 on); planner --gates rareHpMultZ1,firstMeetWindup (row 1 off);
#         onebutton as built; masher as built (O14's second figure; RUNS per class)       row 1, B61 per class, O14
#     C2  cell 2, expedition P0 with the start camp, as built: planner (XRUNS); onebutton --think --think-mash (XTHINK)
#                                                                                   B60 expedition, B61 Rogue Z1, B62 (b)
#     C3  cell 3, classic P0 onebutton --think (THINK per class), as built                  B60 classic, B59 unchanged
#     C4  cell 4, classic P0 planner --gates rareHpMultZ1,firstMeetWindup,sapHold (row 1 (a) only: a PASS removes
#         STEALTH; RUNS, class C4CLASS)                                                     the value of row 1 (b)
# Env: WORKERS (2), REF (30d565a: the sim before the v14 gate rule), RUNS (1000), XRUNS (300), XTHINK (50), THINK (50),
#      C4CLASS (rogue).
set -euo pipefail
W=$(cd "$(dirname "$0")/.." && pwd)
O=$(mkdir -p "${1:-$W/sim/out/pass-v14}" && cd "${1:-$W/sim/out/pass-v14}" && pwd)
STAGES=" ${2:-H C1 C2 C3 C4} "
WK=${WORKERS:-2}; REF=${REF:-30d565a}; RUNS=${RUNS:-1000}; XRUNS=${XRUNS:-300}; XTHINK=${XTHINK:-50}; THINK=${THINK:-50}
C4CLASS=${C4CLASS:-rogue}
P11B=$W/sim/out/pass-2026-11-11b                         # classic warm-up tables (as the v13 and mash cells)
P11F=$W/sim/out/pass-v9v10                               # expedition node-risk base (as the v13 cells)
PT=$W/sim/out/pass-v12/exp/table                         # expedition table pass of 11-11h (ct, dim)
R0="--risk-in $P11B/warmup-P0.json"
X0="--map expedition --prep --risk-in $P11F/obs-P0.json --tables-in $PT/planner-P0-exp-prep/risk.json"
OFF1="rareHpMultZ1,firstMeetWindup"                      # row 1 off: v13 rows 5-6 on, sapHold and passStealth off
ONLYA="rareHpMultZ1,firstMeetWindup,sapHold"             # row 1 (a) only: passStealth off
log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$O/measure.log"; }
has() { [[ "$STAGES" == *" $1 "* ]]; }
run() { local out=$1; shift; (cd "$W" && node sim/run.mjs --seed-start 1000 --warmup 0 --workers "$WK" --out "$out" "$@" 2>/dev/null | grep -E "win|wrote" | tee -a "$O/measure.log"); }
T0=$(date +%s)
log "measure v14 into $O (stages:$STAGES workers $WK, commit $(cd "$W" && git rev-parse --short HEAD)$(cd "$W" && git diff --quiet HEAD -- sim src || echo +dirty))"

if has H; then
  S=$O/scratch/ref; rm -rf "$S"; mkdir -p "$S"
  cp -r "$W/src" "$S/src"
  (cd "$W" && git archive "$REF" sim) | tar -x -C "$S"
  (cd "$W" && node sim/hashgates.mjs "$S" "$W") | tee -a "$O/measure.log"
  log "H done ($(( ($(date +%s) - T0) / 60 )) min)"
fi
if has C1; then
  run "$O/classic" --bot planner --class all --runs "$RUNS" --profile fresh $R0
  run "$O/classic" --bot planner --class all --runs "$RUNS" --profile fresh $R0 --gates "$OFF1"
  run "$O/classic" --bot onebutton --class all --runs "$RUNS" --profile fresh $R0
  run "$O/classic" --bot masher --class all --runs "$RUNS" --profile fresh $R0
  log "C1 done ($(( ($(date +%s) - T0) / 60 )) min)"
fi
if has C2; then
  run "$O/exp" --bot planner --class all --runs "$XRUNS" --profile fresh $X0
  run "$O/think" --bot onebutton --class all --runs "$XTHINK" --profile fresh $X0 --think --think-mash
  log "C2 done ($(( ($(date +%s) - T0) / 60 )) min)"
fi
if has C3; then
  run "$O/think" --bot onebutton --class all --runs "$THINK" --profile fresh $R0 --think
  log "C3 done ($(( ($(date +%s) - T0) / 60 )) min)"
fi
if has C4; then
  run "$O/classic" --bot planner --class "$C4CLASS" --runs "$RUNS" --profile fresh $R0 --gates "$ONLYA"
  log "C4 done ($(( ($(date +%s) - T0) / 60 )) min)"
fi
log "measure done in $(( ($(date +%s) - T0) / 60 )) min"
