#!/bin/bash
# Measure of the M2b v11 package (docs/specs/changes-m2b-v11.md "What the sim must run") on the engine that holds it,
# about 35-45 minutes on 2 cores; then, if time allows, B31 / B32 on the expedition with the 8.2 catalogue.
# Order is the spec's cut order. Report: docs/reports/balance-2026-11-11g.md; hand-off docs/handoffs/sim-2026-11-11h.md.
#
#   bash sim/measure-v11.sh [OUT] [STAGES]      OUT default sim/out/pass-v11; STAGES default "H X K"
#   stages: H  hash identity against the 11-11f build (REF, git ref with src and sim of 11-11f): classic runs identical,
#              expedition runs without prep move by design (rows 1-2 change `loot`)
#           X  expedition cells 1-10 (cell 10 only if cell 2 P0 < 20 % or cell 3 PALL < 50 %)
#           K  classic cells 11 (hunter trees, row 8 gate and attribution) and 12 (regression against 11-11f)
#           B  campaigns on the expedition with the start camp (B31, B32 on the 8.2 catalogue): CAMPAIGNS per class
# Env: WORKERS (2), REF (19df854: the 11-11f engine and sim with the D2 value), P11F (sim/out/pass-v9v10: the 11-11f
#      pass, whose v9 observations are the node-risk base), CAMPAIGNS (20).
set -euo pipefail
W=$(cd "$(dirname "$0")/.." && pwd)
O=$(mkdir -p "${1:-$W/sim/out/pass-v11}" && cd "${1:-$W/sim/out/pass-v11}" && pwd)
STAGES=" ${2:-H X K} "
WK=${WORKERS:-2}; REF=${REF:-19df854}; P11F=${P11F:-$W/sim/out/pass-v9v10}; NC=${CAMPAIGNS:-20}
P11B=$W/sim/out/pass-2026-11-11b                     # warm-up tables of the classic planner cells (as 11-11c and 11-11f)
P11C=$W/sim/out/pass-2026-11-11c                     # observation tables of the other classic cells
B0=$P11F/obs-P0.json; BA=$P11F/obs-PALL.json         # node-risk base of the expedition cells (11-11f v9 observations)
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
  local root=${ROOT:-$W}
  for c in ${cls//,/ }; do
    local t; t=$(echo "$trees" | tr ',' '\n' | grep "^$c=" | cut -d= -f2)
    rm -rf "$T/$name-$c"
    (cd "$root" && node sim/run.mjs --bot "$bot" --class "$c" --tree "$t" --runs "$runs" --seed-start 1000 --profile "$prof" --warmup 0 --risk-in "$risk" --workers "$WK" --out "$T/$name-$c" "$@" 2>/dev/null | grep win | tee -a "$O/measure.log")
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
import { readJsonl } from './sim/lib/output.mjs'; import { expMetrics, runLength } from './sim/lib/metrics.mjs';
const recs = (d) => ['rogue','mage','hunter'].flatMap((c) => readJsonl(d + '/runs-' + c + '.jsonl'));
$1"); }

T0=$(date +%s)
log "measure v11 into $O (stages:$STAGES workers $WK)"

# ---- H: hash identity against the 11-11f build (< 1 min). ----
if has H; then
  scratch ref "$REF"; rm -rf "$S/ref/sim"; mkdir -p "$S/ref/sim"; (cd "$W" && git archive "$REF" sim) | tar -x -C "$S/ref"
  cat > "$O/hash.mjs" <<'EOF'
const [A, B, OBS] = process.argv.slice(2);
const TREES = { rogue: 2, mage: 1, hunter: 2 };
async function hashes(root) {
  const { runWithBot } = await import(`${root}/sim/lib/runner.mjs`);
  const { buildTable } = await import(`${root}/sim/lib/risk.mjs`);
  const { readJson } = await import(`${root}/sim/lib/output.mjs`);
  const obs = readJson(OBS);
  const out = {};
  for (const mode of ['rows', 'exp']) for (const bot of ['planner', 'greedy', 'speedrunner', 'random']) for (const cls of ['rogue', 'mage', 'hunter']) for (const seed of [1000, 1001]) {
    const cell = { bot, cls, prof: 'fresh', tree: TREES[cls], ...(mode === 'exp' ? { map: 'expedition' } : {}) };
    const { record } = runWithBot(cell, seed, buildTable(obs[cls]), { hash: true });
    out[`${mode} ${bot}|${cls}|${seed}`] = record.err ? `ERR ${record.err}` : record.hash;
  }
  return out;
}
const a = await hashes(A); const b = await hashes(B); const t = {};
for (const k of Object.keys(a)) { const g = k.split('|')[0]; t[g] = t[g] || [0, 0]; t[g][1]++; if (a[k] === b[k] && !String(a[k]).startsWith('ERR')) t[g][0]++; }
for (const [g, [s, n]] of Object.entries(t)) console.log(`hash ${g}: ${s}/${n} identical`);
EOF
  node "$O/hash.mjs" "$S/ref" "$W" "$P11C/obs-P0.json" | tee -a "$O/measure.log"
  log "H done: classic must be identical for every bot; expedition runs move (rows 1-2 change loot, rows 3-4)"
fi

# ---- X: expedition cells (seeds 1000 on, paired with 11-11f; PALL = --profile all, the 8.2 entries in the catalogue). ----
if has X; then
  OUTX=$X/table xcell --bot planner --runs 100 --profile fresh --risk-in "$B0"                       # 1  table pass P0
  OUTX=$X/table xcell --bot planner --runs 100 --profile all --risk-in "$BA"                         #    table pass PALL
  C0="--risk-in $B0 --tables-in $X/table/planner-P0-exp-prep/risk.json"
  CA="--risk-in $BA --tables-in $X/table/planner-PALL-exp-prep/risk.json"
  xcell --bot planner --runs 300 --profile fresh $C0                                                 # 2  planner P0
  xcell --bot planner --runs 300 --profile all $CA                                                   # 3  planner PALL
  DEC=$(q "
const p0 = recs('$X/planner-P0-exp-prep'), pa = recs('$X/planner-PALL-exp-prep');
const w = (r) => r.filter((x) => x.out === 'v').length / r.length; const e = expMetrics(p0);
const ab = p0.reduce((a, r) => a + (r.ct ? r.ct.c.filter((k) => k[1] === 'delve' && k[3] === 'a').length : 0), 0) / p0.length;
console.log(JSON.stringify({ p0: w(p0), pall: w(pa), caught: e.caught.p, dimShare: e.dimDeathShare.p, delveAbandonPerRun: ab, loot19: w(p0) < 0.20 || w(pa) < 0.50 }));")
  log "v11 cells 2-3: $DEC"
  jget() { echo "$DEC" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d['$1'])"; }
  xcell --bot planner --runs 300 --profile fresh $C0 --prep-policy none                              # 4  B40
  xcell --bot planner --runs 300 --profile fresh $C0 --prep-policy random
  xcell --bot greedy --runs 300 --profile fresh $C0                                                  # 5  greedy
  xcell --bot speedrunner --runs 700 --profile all $CA                                               # 6  speedrunner PALL (B12, 200 wins)
  xcell --bot planner --runs 50 --profile fresh $C0 --oracle --route                                 # 7  B41
  xcell --bot planner --runs 50 --profile all $CA --oracle --route
  xcell --bot planner --runs 150 --profile all $CA --meta-drop scout,cartographer,old_hand --prep-ban charts,tracker,guide,spyglass   # 8  B42 (row 6)
  xcell --bot planner --runs 150 --profile all $CA --meta-drop scout,cartographer,old_hand           #    B42 old definition (report both)
  # 9 arms, planner P0 planned: (a) TIME_DIM_FIGHT 1; (b) TIME_DIM_FIGHT 1 + DIM_DMG_MULT 1.6; (c) no hold; (d) rows 1-2 off.
  scratch a_tdf1; patch a_tdf1 src/constants.js "export const TIME_DIM_FIGHT = 2;" "export const TIME_DIM_FIGHT = 1;"
  ROOT=$S/a_tdf1 OUTX=$X/arm-tdf1 xcell --bot planner --runs 300 --profile fresh $C0
  scratch b_dmg16; patch b_dmg16 src/constants.js "export const TIME_DIM_FIGHT = 2;" "export const TIME_DIM_FIGHT = 1;"
  patch b_dmg16 src/constants.js "export const DIM_DMG_MULT = 1.3;" "export const DIM_DMG_MULT = 1.6;"
  ROOT=$S/b_dmg16 OUTX=$X/arm-dmg16 xcell --bot planner --runs 300 --profile fresh $C0
  scratch c_nohold; patch c_nohold src/constants.js "export const DUNGEON_DIM_HOLD = 3;" "export const DUNGEON_DIM_HOLD = 0;"
  ROOT=$S/c_nohold OUTX=$X/arm-nohold xcell --bot planner --runs 300 --profile fresh $C0
  scratch d_noloot; patch d_noloot src/constants.js "export const EXPED_DROP_MULT = 1.6;" "export const EXPED_DROP_MULT = 1;"
  patch d_noloot src/constants.js "export const EXPED_DUNGEON_BOSS_DROPS = 3;" "export const EXPED_DUNGEON_BOSS_DROPS = 2;"
  ROOT=$S/d_noloot OUTX=$X/arm-noloot xcell --bot planner --runs 300 --profile fresh $C0
  # 10 conditional: EXPED_DROP_MULT 1.9 if cell 2 P0 < 20 % or cell 3 PALL < 50 %.
  if [ "$(jget loot19)" = true ]; then
    scratch e_loot19; patch e_loot19 src/constants.js "export const EXPED_DROP_MULT = 1.6;" "export const EXPED_DROP_MULT = 1.9;"
    ROOT=$S/e_loot19 OUTX=$X/arm-loot19 xcell --bot planner --runs 300 --profile fresh $C0
    ROOT=$S/e_loot19 OUTX=$X/arm-loot19 xcell --bot planner --runs 300 --profile all $CA
  else log "cell 10 skipped: P0 and PALL meet flip 2"; fi
  # 11 (expedition part): planner PALL hunter with row 8, paired with cell 3's hunter.
  XCLS=hunter xcell --bot planner --runs 300 --profile all $CA --beastcall-gated
  log "X done ($(( ($(date +%s) - T0) / 60 )) min)"
fi

# ---- K: classic cells (from the 11-11c warm-up tables, as 11-11f; paired by class and seed with it). ----
if has K; then
  for t in 0 1 2; do cell planner-P0-hunter-tree$t planner fresh hunter hunter=$t 3000 "$P11B/warmup-P0.json"; done   # 11 B7
  cell planner-PALL-hunter-bcg planner all hunter hunter=0 1000 "$P11B/warmup-PALL.json" --beastcall-gated            #    row 8 gate
  cell planner-PALL-hunter-nosph2 planner all hunter hunter=0 1000 "$P11B/warmup-PALL.json" --meta-drop sp_h2          #    attribution
  for t in 0 1 2; do                                                                                                  # 12 regression
    cls=$(for c in rogue mage hunter; do d=$(echo "$TR" | tr ',' '\n' | grep "^$c=" | cut -d= -f2); [ "$d" = "$t" ] && echo -n "$c,"; done); cls=${cls%,}
    [ -n "$cls" ] && cell planner-P0-tree$t planner fresh "$cls" "$TR" 1000 "$P11B/warmup-P0.json"
    cls=$(for c in rogue mage hunter; do d=$(echo "$TA" | tr ',' '\n' | grep "^$c=" | cut -d= -f2); [ "$d" = "$t" ] && echo -n "$c,"; done); cls=${cls%,}
    [ -n "$cls" ] && cell planner-PALL-tree$t planner all "$cls" "$TA" 1000 "$P11B/warmup-PALL.json"
  done
  # Run-by-run comparison with 11-11f's cells (outcome, level, minutes, fights, rounds, death per seed).
  (cd "$W" && node --input-type=module -e "
import { readJsonl } from './sim/lib/output.mjs'; import fs from 'node:fs';
const [O, F] = process.argv.slice(1); let same = 0, diff = 0;
for (const d of fs.readdirSync(O).filter((x) => /^planner-(P0|PALL)-tree\d$/.test(x))) for (const c of ['rogue', 'mage', 'hunter']) {
  const a = O + '/' + d + '/runs-' + c + '.jsonl', b = F + '/' + d + '/runs-' + c + '.jsonl'; if (!fs.existsSync(a) || !fs.existsSync(b)) continue;
  const B = new Map(readJsonl(b).map((r) => [r.seed, r])); const k = (x) => JSON.stringify([x.out, x.lvl, x.hours, x.nodes, x.fights, x.rounds, x.death, x.min]);
  for (const r of readJsonl(a)) { const o = B.get(r.seed); if (!o) continue; if (k(r) === k(o)) same++; else diff++; } }
console.log('classic regression against 11-11f: ' + same + ' runs identical, ' + diff + ' different');" "$O" "$P11F" | tee -a "$O/measure.log")
  log "K done ($(( ($(date +%s) - T0) / 60 )) min)"
fi

# ---- B: campaigns on the expedition with the start camp (8.2 catalogue): B31, B32. ----
if has B; then
  (cd "$W" && node sim/run.mjs --campaign "$NC" --class all --map expedition --prep --risk-in "$B0" --tables-in "$X/table/planner-P0-exp-prep/risk.json" --workers "$WK" --out "$O/exp-campaigns" 2>&1 | tail -1 | tee -a "$O/measure.log")
  log "B done ($(( ($(date +%s) - T0) / 60 )) min)"
fi
log "measure done in $(( ($(date +%s) - T0) / 60 )) min"
