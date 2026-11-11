#!/bin/bash
# Measure of the M2b v12 package (docs/specs/changes-m2b-v12.md "What the sim must run") on the engine that holds rows
# 1-2 (main, engine-2026-11-11i), with the sim rows of v12 (escape pricing, row 4 speedrunner, the gated Ricochet arm).
# Order is the spec's cut order. Report: docs/reports/balance-2026-11-11h.md; hand-off docs/handoffs/sim-2026-11-11j.md.
#
#   bash sim/measure-v12.sh [OUT] [STAGES]      OUT default sim/out/pass-v12; STAGES default "X1 X2 K H"
#   stages: X1 expedition cells 1-5, X2 cells 6-9 (X1 writes the row 5 gate's outcome that X2 reads):
#              table pass; planner P0; planner PALL with row 5 (3) and the hunter without it (3b;
#              rogue and mage never cast Ricochet Bolt, so cell 3's rogue and mage runs are 3b's); the row 5 gate decides
#              the Ricochet value of every later PALL cell; speedrunner PALL row 4 (4, extended by EXTRA seeds per class
#              when it has fewer than B12_MIN_WINS wins); greedy (5); prep none / random (6); B41 oracle (7); arm row 2 off
#              (8: TIME_DIM_ESCAPE = TIME_DIM_FIGHT in a scratch copy); arm row 4 off (9: speedrunner --variant v11, the
#              same seeds as cell 4)
#           K  classic cells 10 (planner PALL default trees with row 5) and 11 (planner P0 default trees), run by run
#              against the 11-11g cells (P11G)
#           H  hash identity against the 11-11g build (REF): classic identical, expedition without prep moves (rows 1-2)
#           B  campaigns on the expedition with the start camp (B31, B32): CAMPAIGNS per class, the gate's Ricochet value
# Env: WORKERS (2), REF (65f528a: the 11-11g engine and sim), P11F (sim/out/pass-v9v10: node-risk base of 11-11g),
#      P11G (sim/out/pass-v11: the 11-11g pass), CAMPAIGNS (20), EXTRA (0: extra speedrunner runs per class, cells 4 and 9),
#      N6 (300: runs per class of cell 6), N9 (700: runs per class of cell 9, the first seeds of cell 4).
set -euo pipefail
W=$(cd "$(dirname "$0")/.." && pwd)
O=$(mkdir -p "${1:-$W/sim/out/pass-v12}" && cd "${1:-$W/sim/out/pass-v12}" && pwd)
STAGES=" ${2:-X1 X2 K H} "
WK=${WORKERS:-2}; REF=${REF:-65f528a}; P11F=${P11F:-$W/sim/out/pass-v9v10}; P11G=${P11G:-$W/sim/out/pass-v11}
NC=${CAMPAIGNS:-20}; EXTRA=${EXTRA:-0}; N6=${N6:-300}; N9=${N9:-700}
P11B=$W/sim/out/pass-2026-11-11b                     # warm-up tables of the classic planner cells (as 11-11c to 11-11g)
P11C=$W/sim/out/pass-2026-11-11c                     # observation tables of the other classic cells (hash stage)
B0=$P11F/obs-P0.json; BA=$P11F/obs-PALL.json         # node-risk base of the expedition cells (as 11-11g)
TR=rogue=2,mage=1,hunter=2; TA=rogue=1,mage=2,hunter=0
X=$O/exp; T=$O/tmp; S=$O/scratch
mkdir -p "$X" "$T" "$S"
log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$O/measure.log"; }
has() { [[ "$STAGES" == *" $1 "* ]]; }
scratch() {
  rm -rf "$S/$1"; mkdir -p "$S/$1"
  if [ -n "${2:-}" ]; then (cd "$W" && git archive "$2" src) | tar -x -C "$S/$1"; else cp -r "$W/src" "$S/$1/src"; fi
  mkdir -p "$S/$1/sim"; for f in "$W"/sim/*; do b=$(basename "$f"); [ "$b" = out ] || cp -r "$f" "$S/$1/sim/$b"; done
}
patch() {
  local f="$S/$1/$2" c; c=$(grep -cF -- "$3" "$f" || true)
  [ "$c" = 1 ] || { log "PATCH FAILED $1 $2: '$3' found $c times"; exit 1; }
  FROM="$3" TO="$4" perl -0pi -e 's/\Q$ENV{FROM}\E/$ENV{TO}/' "$f"
}
cell() {
  local name=$1 bot=$2 prof=$3 cls=$4 trees=$5 runs=$6 risk=$7; shift 7
  for c in ${cls//,/ }; do
    local t; t=$(echo "$trees" | tr ',' '\n' | grep "^$c=" | cut -d= -f2)
    rm -rf "$T/$name-$c"
    (cd "$W" && node sim/run.mjs --bot "$bot" --class "$c" --tree "$t" --runs "$runs" --seed-start 1000 --profile "$prof" --warmup 0 --risk-in "$risk" --workers "$WK" --out "$T/$name-$c" "$@" 2>/dev/null | grep win | tee -a "$O/measure.log")
  done
  node -e "
const fs=require('fs'); const [O,T,name,cls]=process.argv.slice(1); const out=O+'/'+name; fs.mkdirSync(out,{recursive:true});
let meta=null; const classes={}, risk={}, trees={};
for (const c of cls.split(',')) { const d=fs.readdirSync(T+'/'+name+'-'+c)[0]; const dd=T+'/'+name+'-'+c+'/'+d; const s=JSON.parse(fs.readFileSync(dd+'/summary.json','utf8'));
  if (!meta) meta={...s.meta}; classes[c]=s.classes[c]; trees[c]=s.meta.trees[c]; risk[c]=JSON.parse(fs.readFileSync(dd+'/risk.json','utf8'))[c]; fs.copyFileSync(dd+'/runs-'+c+'.jsonl', out+'/runs-'+c+'.jsonl'); }
meta.trees=trees; meta.name=name; fs.writeFileSync(out+'/summary.json', JSON.stringify({meta, classes})); fs.writeFileSync(out+'/risk.json', JSON.stringify(risk));" "$O" "$T" "$name" "$cls"
}
xcell() { local root=${ROOT:-$W}; (cd "$root" && node sim/run.mjs --class "${XCLS:-all}" --warmup 0 --workers "$WK" --out "${OUTX:-$X}" --map expedition --prep "$@" 2>/dev/null | grep -E "win|wrote" | tee -a "$O/measure.log"); }
q() { (cd "$W" && node --input-type=module -e "
import { readJsonl } from './sim/lib/output.mjs';
const recs = (d, cl = ['rogue','mage','hunter']) => cl.flatMap((c) => readJsonl(d + '/runs-' + c + '.jsonl'));
const win = (r) => r.filter((x) => x.out === 'v').length / r.length;
$1"); }

T0=$(date +%s)
log "measure v12 into $O (stages:$STAGES workers $WK)"
C0="--risk-in $B0 --tables-in $X/table/planner-P0-exp-prep/risk.json"
CA="--risk-in $BA --tables-in $X/table/planner-PALL-exp-prep/risk.json"
RCG_FILE=$O/ricochet.flag                            # the row 5 gate's outcome ('--ricochet-gated' or empty)

# ---- X1: expedition cells 1-5 (seeds 1000 on, paired with 11-11g; PALL = --profile all). ----
if has X1; then
  OUTX=$X/table xcell --bot planner --runs 100 --profile fresh --risk-in "$B0"                       # 1  table pass P0
  OUTX=$X/table xcell --bot planner --runs 100 --profile all --risk-in "$BA"                         #    table pass PALL
  xcell --bot planner --runs 300 --profile fresh $C0                                                 # 2  planner P0
  xcell --bot planner --runs 300 --profile all $CA --ricochet-gated                                  # 3  PALL with row 5
  XCLS=hunter xcell --bot planner --runs 300 --profile all $CA                                       # 3b hunter without row 5
  GATE=$(q "
const a = recs('$X/planner-PALL-exp-prep-rcg'); const h = recs('$X/planner-PALL-exp-prep', ['hunter']);
const b = [...a.filter((r) => r.cls !== 'hunter'), ...h];
console.log(JSON.stringify({ pall3: win(a), pall3b: win(b), hunter3: win(a.filter((r) => r.cls === 'hunter')), hunter3b: win(h), apply: win(a) >= 0.5 }));")
  log "row 5 gate (cell 3 pooled PALL >= 50 %): $GATE"
  if echo "$GATE" | grep -q '"apply":true'; then echo "--ricochet-gated" > "$RCG_FILE"; else echo "" > "$RCG_FILE"; fi
  RCG=$(cat "$RCG_FILE")
  xcell --bot speedrunner --runs 700 --profile all $CA $RCG                                          # 4  speedrunner row 4
  NW=$(q "const fs = await import('node:fs'); const r = recs('$X/' + fs.readdirSync('$X').find((d) => /^speedrunner-PALL-exp-prep(-rcg)?$/.test(d))); console.log(r.filter((x) => x.out === 'v').length);" 2>/dev/null || echo 0)
  log "cell 4 wins: $NW (B12 needs >= 200)"
  if [ "$EXTRA" -gt 0 ]; then
    OUTX=$X/ext xcell --bot speedrunner --runs "$EXTRA" --seed-start 1700 --profile all $CA $RCG       # 4  extension
  fi
  xcell --bot greedy --runs 300 --profile fresh $C0                                                  # 5  greedy
  log "X1 done ($(( ($(date +%s) - T0) / 60 )) min)"
fi

# ---- X2: expedition cells 6-9 (the row 5 gate's Ricochet value from X1). ----
if has X2; then
  RCG=$(cat "$RCG_FILE")
  xcell --bot planner --runs "$N6" --profile fresh $C0 --prep-policy none                            # 6  B40
  xcell --bot planner --runs "$N6" --profile fresh $C0 --prep-policy random
  xcell --bot planner --runs 50 --profile fresh $C0 --oracle --route                                 # 7  B41
  xcell --bot planner --runs 50 --profile all $CA --oracle --route $RCG
  scratch a_noesc; patch a_noesc src/constants.js "export const TIME_DIM_ESCAPE = 1;" "export const TIME_DIM_ESCAPE = 2;"
  ROOT=$S/a_noesc OUTX=$X/arm-noesc xcell --bot planner --runs 300 --profile fresh $C0                # 8  row 2 off
  xcell --bot speedrunner --runs "$N9" --profile all $CA $RCG --variant v11                          # 9  row 4 off
  if [ "$EXTRA" -gt 0 ]; then
    OUTX=$X/ext xcell --bot speedrunner --runs "$EXTRA" --seed-start 1700 --profile all $CA $RCG --variant v11
  fi
  log "X2 done ($(( ($(date +%s) - T0) / 60 )) min)"
fi

# ---- K: classic cells (from the 11-11b warm-up tables, as 11-11c to 11-11g; paired by class and seed with them). ----
if has K; then
  cell planner-PALL-rcg planner all rogue,mage,hunter "$TA" 1000 "$P11B/warmup-PALL.json" --ricochet-gated     # 10
  cell planner-P0 planner fresh rogue,mage,hunter "$TR" 1000 "$P11B/warmup-P0.json"                             # 11
  (cd "$W" && node --input-type=module -e "
import { readJsonl } from './sim/lib/output.mjs'; import fs from 'node:fs';
const [O, G] = process.argv.slice(1); const k = (x) => JSON.stringify([x.out, x.lvl, x.hours, x.nodes, x.fights, x.rounds, x.death, x.min]);
const tree = { P0: { rogue: 2, mage: 1, hunter: 2 }, PALL: { rogue: 1, mage: 2, hunter: 0 } };
for (const [mine, grp] of [['planner-P0', 'P0'], ['planner-PALL-rcg', 'PALL']]) for (const c of ['rogue', 'mage', 'hunter']) {
  const a = O + '/' + mine + '/runs-' + c + '.jsonl', b = G + '/planner-' + grp + '-tree' + tree[grp][c] + '/runs-' + c + '.jsonl';
  if (!fs.existsSync(a) || !fs.existsSync(b)) { console.log(mine + ' ' + c + ': no 11-11g cell'); continue; }
  const B = new Map(readJsonl(b).map((r) => [r.seed, r])); let same = 0, diff = 0;
  for (const r of readJsonl(a)) { const o = B.get(r.seed); if (!o) continue; if (k(r) === k(o)) same++; else diff++; }
  console.log('classic ' + mine + ' ' + c + ' against 11-11g: ' + same + ' identical, ' + diff + ' different');
}" "$O" "$P11G" | tee -a "$O/measure.log")
  log "K done ($(( ($(date +%s) - T0) / 60 )) min)"
fi

# ---- H: hash identity against the 11-11g build (< 1 min). ----
if has H; then
  scratch ref "$REF"; rm -rf "$S/ref/sim"; mkdir -p "$S/ref/sim"; (cd "$W" && git archive "$REF" sim) | tar -x -C "$S/ref"
  node "$P11G/hash.mjs" "$S/ref" "$W" "$P11C/obs-P0.json" | tee -a "$O/measure.log"
  log "H done: classic must be identical for every bot; expedition runs move (v12 rows 1-2)"
fi

# ---- B: campaigns on the expedition with the start camp (B31, B32), the gate's Ricochet value. ----
if has B; then
  RCG=$(cat "$RCG_FILE" 2>/dev/null || true)
  (cd "$W" && node sim/run.mjs --campaign "$NC" --class all --map expedition --prep $RCG --risk-in "$B0" --tables-in "$X/table/planner-P0-exp-prep/risk.json" --workers "$WK" --out "$O/exp-campaigns" 2>&1 | tail -1 | tee -a "$O/measure.log")
  log "B done ($(( ($(date +%s) - T0) / 60 )) min)"
fi
log "measure done in $(( ($(date +%s) - T0) / 60 )) min"
