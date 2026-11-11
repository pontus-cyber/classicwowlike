#!/bin/bash
# Measure of the M2b v13 package (docs/specs/changes-m2b-v13.md "What the sim must run") on the engine that holds rows
# 1-4 (main, engine-2026-11-11j; rows 5-6 behind C.GATES, off by default), plus the flip cells of changes-m2b-v10.md
# "Criteria to flip" and the two sim fixes of this pass (speedrunner level price, planner Dimmed clock).
# Report: docs/reports/balance-2026-11-12.md; hand-off docs/handoffs/sim-2026-11-12.md.
#
#   bash sim/measure-v13.sh [OUT] [STAGES]      OUT default sim/out/pass-v13; STAGES default "S C1 C2 C3 C5 C6 C7 X4 X8 F K"
#   stages (the spec's cell numbers; classic cells from the 11-11b warm-up tables, paired by class and seed with the
#   mash cells sim/out/mash; expedition cells from the v12 pass's table pass (sim/out/pass-v12/exp/table), paired by
#   class and seed with the v12 flip cells):
#     S   speedrunner calibration (expedition PALL, SN per class): the level price SIM.SPEED_LEVEL_TOLLS at each value of
#         SVALS (scratch arms through SIM_OVERRIDE) and the v11 policy (--variant v11), seeds 1000 on
#     C1  classic P0: onebutton, masher, planner (RUNS per class)                                  B59 full runs, B61, B62a
#     C2  classic P0: onebutton --think --think-mash (THINK per class)                              B59 replays, B60, B62b
#     C3  classic PALL: onebutton, planner (RUNS); onebutton --think (THINK_PALL)                   B59-B61 PALL (O11)
#     C5  opener full runs, classic P0 (OPENER per class)                                           B60 check, B48, B55
#     C6  row 5 gate: if the opener line's Z1 rare deaths in C2 exceed 25 %, onebutton --think (THINK) and planner (RUNS)
#         with --gates rareHpMultZ1
#     C7  row 6 arm: --gates firstMeetWindup: onebutton (RUNS), onebutton --think (THINK7), planner (RUNS)   B62a gate
#     X4  expedition P0 with the start camp: onebutton, masher, planner (XRUNS); onebutton --think --think-mash (XTHINK)
#     X8  expedition PALL: onebutton (X8RUNS), planner (XRUNS; the flip's PALL cell)
#     F   flip cells: speedrunner PALL (SPEEDRUNS; the level price of SIM.SPEED_LEVEL_TOLLS) and the v11 policy (--variant
#         v11, SPEEDRUNS: B12 on >= 200 wins), greedy P0 (XRUNS), prep none / random (N6), oracle P0 and PALL (50)
#     K   planner Dimmed clock off (SIM.PLANNER_DIM_CLOCK 0, a scratch arm through SIM_OVERRIDE): planner P0 and PALL
#         expedition (XRUNS), paired with X4 / X8's planner
# Env: WORKERS (2), RUNS (1000), THINK (100), THINK_PALL (50), THINK7 (50), OPENER (50), XRUNS (300), XTHINK (50),
#      X8RUNS (200), SPEEDRUNS (700), N6 (100), SN (100), SVALS ("4.6 8"), KPALL (1: run K's PALL arm).
set -euo pipefail
W=$(cd "$(dirname "$0")/.." && pwd)
O=$(mkdir -p "${1:-$W/sim/out/pass-v13}" && cd "${1:-$W/sim/out/pass-v13}" && pwd)
STAGES=" ${2:-S C1 C2 C3 C5 C6 C7 X4 X8 F K} "
WK=${WORKERS:-2}; RUNS=${RUNS:-1000}; THINK=${THINK:-100}; THINK_PALL=${THINK_PALL:-50}; THINK7=${THINK7:-50}
OPENER=${OPENER:-50}; XRUNS=${XRUNS:-300}; XTHINK=${XTHINK:-50}; X8RUNS=${X8RUNS:-200}; SPEEDRUNS=${SPEEDRUNS:-700}
N6=${N6:-100}; SN=${SN:-100}; SVALS=${SVALS:-"4.6 8"}; KPALL=${KPALL:-1}
P11B=$W/sim/out/pass-2026-11-11b                         # classic warm-up tables (as the mash cells)
P11F=$W/sim/out/pass-v9v10                               # expedition node-risk base (as 11-11g and 11-11h)
PT=$W/sim/out/pass-v12/exp/table                         # expedition table pass of 11-11h (ct, dim)
R0="--risk-in $P11B/warmup-P0.json"; RA="--risk-in $P11B/warmup-PALL.json"
X0="--map expedition --prep --risk-in $P11F/obs-P0.json --tables-in $PT/planner-P0-exp-prep/risk.json"
XA="--map expedition --prep --risk-in $P11F/obs-PALL.json --tables-in $PT/planner-PALL-exp-prep/risk.json"
log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$O/measure.log"; }
has() { [[ "$STAGES" == *" $1 "* ]]; }
run() { local out=$1; shift; (cd "$W" && node sim/run.mjs --seed-start 1000 --warmup 0 --workers "$WK" --out "$out" "$@" 2>/dev/null | grep -E "win|wrote" | tee -a "$O/measure.log"); }
T0=$(date +%s)
log "measure v13 into $O (stages:$STAGES workers $WK, commit $(cd "$W" && git rev-parse --short HEAD)$(cd "$W" && git diff --quiet HEAD -- sim src || echo +dirty))"

if has S; then
  for v in $SVALS; do SIM_OVERRIDE="{\"SPEED_LEVEL_TOLLS\":$v}" run "$O/cal/lt$v" --bot speedrunner --class all --runs "$SN" --profile all $XA; done
  SIM_OVERRIDE='{"SPEED_LEVEL_TOLLS":null}' run "$O/cal/v12" --bot speedrunner --class all --runs "$SN" --profile all $XA
  run "$O/cal/v11" --bot speedrunner --variant v11 --class all --runs "$SN" --profile all $XA
  log "S done ($(( ($(date +%s) - T0) / 60 )) min)"
fi
if has C1; then
  for b in onebutton masher planner; do run "$O/classic" --bot $b --class all --runs "$RUNS" --profile fresh $R0; done
  log "C1 done ($(( ($(date +%s) - T0) / 60 )) min)"
fi
if has C2; then
  run "$O/think" --bot onebutton --class all --runs "$THINK" --profile fresh $R0 --think --think-mash
  log "C2 done ($(( ($(date +%s) - T0) / 60 )) min)"
fi
if has C3; then
  for b in onebutton planner; do run "$O/classic" --bot $b --class all --runs "$RUNS" --profile all $RA; done
  run "$O/think" --bot onebutton --class all --runs "$THINK_PALL" --profile all $RA --think
  log "C3 done ($(( ($(date +%s) - T0) / 60 )) min)"
fi
if has C5; then
  run "$O/classic" --bot opener --class all --runs "$OPENER" --profile fresh $R0
  log "C5 done ($(( ($(date +%s) - T0) / 60 )) min)"
fi
if has C6; then
  # Row 5 gate: the opener line's deaths in zone 1 rare fights of cell 2's paired replays.
  G=$(cd "$W" && node --input-type=module -e "
import { readJsonl } from './sim/lib/output.mjs';
let n = 0, d = 0;
for (const c of ['rogue', 'mage', 'hunter']) for (const r of readJsonl('$O/think/onebutton-P0/runs-' + c + '.jsonl')) for (const t of (r.tk || [])) {
  const i = t[0]; const comp = r.fc && r.fc[i] ? r.fc[i][2] : '';
  if (r.fx[i][4] !== 1 || !/:r(,|\$)/.test(comp)) continue;
  n++; if (t[7] === 0 || t[10] > 0) d++;
}
console.log(JSON.stringify({ n, d, p: n ? d / n : null, apply: n > 0 && d / n > 0.25 }));")
  log "row 5 gate (opener line Z1 rare deaths > 25 %): $G"
  if echo "$G" | grep -q '"apply":true'; then
    run "$O/g5think" --bot onebutton --class all --runs "$THINK" --profile fresh $R0 --think --gates rareHpMultZ1
    run "$O/g5" --bot planner --class all --runs "$RUNS" --profile fresh $R0 --gates rareHpMultZ1
  fi
  log "C6 done ($(( ($(date +%s) - T0) / 60 )) min)"
fi
if has C7; then
  run "$O/g6" --bot onebutton --class all --runs "$RUNS" --profile fresh $R0 --gates firstMeetWindup
  run "$O/g6" --bot planner --class all --runs "$RUNS" --profile fresh $R0 --gates firstMeetWindup
  run "$O/g6think" --bot onebutton --class all --runs "$THINK7" --profile fresh $R0 --think --gates firstMeetWindup
  log "C7 done ($(( ($(date +%s) - T0) / 60 )) min)"
fi
if has X4; then
  for b in onebutton masher planner; do run "$O/exp" --bot $b --class all --runs "$XRUNS" --profile fresh $X0; done
  run "$O/think" --bot onebutton --class all --runs "$XTHINK" --profile fresh $X0 --think --think-mash
  log "X4 done ($(( ($(date +%s) - T0) / 60 )) min)"
fi
if has X8; then
  run "$O/exp" --bot onebutton --class all --runs "$X8RUNS" --profile all $XA
  run "$O/exp" --bot planner --class all --runs "$XRUNS" --profile all $XA
  log "X8 done ($(( ($(date +%s) - T0) / 60 )) min)"
fi
if has F; then
  run "$O/exp" --bot speedrunner --class all --runs "$SPEEDRUNS" --profile all $XA
  run "$O/exp" --bot speedrunner --variant v11 --class all --runs "$SPEEDRUNS" --profile all $XA
  run "$O/exp" --bot greedy --class all --runs "$XRUNS" --profile fresh $X0
  run "$O/exp" --bot planner --class all --runs "$N6" --profile fresh $X0 --prep-policy none
  run "$O/exp" --bot planner --class all --runs "$N6" --profile fresh $X0 --prep-policy random
  run "$O/exp" --bot planner --class all --runs 50 --profile fresh $X0 --oracle --route
  run "$O/exp" --bot planner --class all --runs 50 --profile all $XA --oracle --route
  log "F done ($(( ($(date +%s) - T0) / 60 )) min)"
fi
if has K; then
  SIM_OVERRIDE='{"PLANNER_DIM_CLOCK":0}' run "$O/clock0" --bot planner --class all --runs "$XRUNS" --profile fresh $X0
  if [ "$KPALL" = 1 ]; then SIM_OVERRIDE='{"PLANNER_DIM_CLOCK":0}' run "$O/clock0" --bot planner --class all --runs "$XRUNS" --profile all $XA; fi
  log "K done ($(( ($(date +%s) - T0) / 60 )) min)"
fi
log "measure done in $(( ($(date +%s) - T0) / 60 )) min"
