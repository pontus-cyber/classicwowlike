#!/bin/bash
# Measure D134 (autoplay's start camp buys the Ember of Return first, C.GATES.autoEmberFirst on; engine 3420b49) against
# the old order (switch off: Field Draughts first, no Ember), stage A of report 2026-11-13: planner P0 with
# --prep-policy auto, the default --map expedition --prep, seeds 1000 on, the X0 tables. Report:
# docs/reports/balance-2026-11-13b.md (tables: node sim/d134report.mjs); hand-off docs/handoffs/sim-2026-11-13b.md.
#
#   bash sim/measure-d134.sh [OUT] [STAGES]      OUT default sim/out/pass-d134; STAGES default "E F I"
#   stages:
#     E   switch on (as built): planner P0 --prep-policy auto, ARUNS per class, into on/
#     F   switch off (cell mark '-noae': every default-on switch named but autoEmberFirst), same cell into off/; then
#         run-for-run identity against report 2026-11-13's stage A cell (D132PASS/exp, engine 70aee4d, before D133); the
#         record field `emb` (Ember use, added with this measure) is left out of the comparison
#     I   the planner's own camp does not read the switch: planner P0 (ARUNS) and PALL (IRUNS) per class on the default
#         cells into own/, run-for-run identity against D132PASS/exp
# Env: WORKERS (2), ARUNS (200), IRUNS (40), D132PASS (sim/out/pass-d132).
# As measured (report 2026-11-13b): bash sim/measure-d134.sh sim/out/pass-d134 "E F I".
set -euo pipefail
W=$(cd "$(dirname "$0")/.." && pwd)
O=$(mkdir -p "${1:-$W/sim/out/pass-d134}" && cd "${1:-$W/sim/out/pass-d134}" && pwd)
STAGES=" ${2:-E F I} "
WK=${WORKERS:-2}; ARUNS=${ARUNS:-200}; IRUNS=${IRUNS:-40}
D132PASS=${D132PASS:-$W/sim/out/pass-d132}
P11F=$W/sim/out/pass-v9v10
PT=$W/sim/out/pass-v12/exp/table
X0="--map expedition --prep --risk-in $P11F/obs-P0.json --tables-in $PT/planner-P0-exp-prep/risk.json"
XA="--map expedition --prep --risk-in $P11F/obs-PALL.json --tables-in $PT/planner-PALL-exp-prep/risk.json"
NOAE="--gates rareHpMultZ1,firstMeetWindup,sapHold,passStealth,boardAcrossRun"   # every default-on switch but autoEmberFirst
log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$O/measure.log"; }
has() { [[ "$STAGES" == *" $1 "* ]]; }
run() { local out=$1; shift; (cd "$W" && node sim/run.mjs --seed-start 1000 --warmup 0 --workers "$WK" --out "$out" "$@" 2>/dev/null | grep -E "win|wrote" | tee -a "$O/measure.log"); }
same() { (cd "$W" && node sim/samerecords.mjs "$@") | tee -a "$O/measure.log" || log "identity FAIL: $*"; }
T0=$(date +%s)
log "measure d134 into $O (stages:$STAGES workers $WK, commit $(cd "$W" && git rev-parse --short HEAD)$(cd "$W" && git diff --quiet HEAD -- sim src || echo +dirty))"
if has E; then
  run "$O/on" --bot planner --class all --runs "$ARUNS" --profile fresh $X0 --prep-policy auto
  log "E done ($(( ($(date +%s) - T0) / 60 )) min)"
fi
if has F; then
  run "$O/off" --bot planner --class all --runs "$ARUNS" --profile fresh $X0 --prep-policy auto $NOAE
  same "$O/off" "$D132PASS/exp" --strip -noae --ignore emb
  log "F done ($(( ($(date +%s) - T0) / 60 )) min)"
fi
if has I; then
  run "$O/own" --bot planner --class all --runs "$ARUNS" --profile fresh $X0
  run "$O/own" --bot planner --class all --runs "$IRUNS" --profile all $XA
  same "$O/own" "$D132PASS/exp" --ignore emb
  log "I done ($(( ($(date +%s) - T0) / 60 )) min)"
fi
log "measure done in $(( ($(date +%s) - T0) / 60 )) min"
