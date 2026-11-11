#!/bin/bash
# Merged measure of the M2b v9 package (docs/specs/changes-m2b-v9.md "What the sim must run") and the M2b v10 package
# (docs/specs/changes-m2b-v10.md "What the sim must run") on the engine that holds both, about 60 minutes on 2 cores.
# Order is the cut order: run top to bottom, cut from the bottom. Plan, estimates and decisions: docs/handoffs/sim-2026-11-11f.md.
#
#   bash sim/measure-v9v10.sh [OUT] [STAGES]      OUT default sim/out/pass-v9v10; STAGES default "H V9A V10 V9B"
#   stages: H    hash identity of this sim against REF_SIM (classic map: every bot identical; expedition: random identical)
#           V9A  v9 cells 1, 2, 4, 3 (arm B), 5                                    ~16 min   (new engine)
#           V10  v10 cells 1, 2 (+8a, 10 if their rules say so), 3, 4, 5, 6, 11, 7, 8b, 9, 8c   ~35 min
#           V9B  v9 cell 6 (free potion diagnostic) and cell 7 (campaigns)          ~14 min
#           OPT  v9 cell 8, tactician P0 (50 per class; 200 per class is about 17 min)   beyond the hour
# Needs the new engine (main with v9 rows 1-4 and v10 rows A1-A3, B1-B4, C1) in this worktree's src/, except stage H
# (any engine) and cell 8c (built from SRC_1111E, the 11-11e engine, plus the A1 patch). Arms run on scratch copies of
# src/ with one constant changed; every patch checks that its line exists exactly once and stops the script otherwise.
# Env: WORKERS (2), REF_SIM (git ref of the sim before M2b v10, default 40c1ea5), SRC_1111E (git ref, default 40c1ea5),
#      V10_RUNS (300 per class), FORCE_ALL=1 runs every conditional cell.
set -euo pipefail
W=$(cd "$(dirname "$0")/.." && pwd)
O=$(mkdir -p "${1:-$W/sim/out/pass-v9v10}" && cd "${1:-$W/sim/out/pass-v9v10}" && pwd)
STAGES=" ${2:-H V9A V10 V9B} "
WK=${WORKERS:-2}; REF_SIM=${REF_SIM:-40c1ea5}; SRC_1111E=${SRC_1111E:-40c1ea5}; N=${V10_RUNS:-300}
P11B=$W/sim/out/pass-2026-11-11b                     # 11-11c warm-up tables (the v8 pass started from them)
P11C=$W/sim/out/pass-2026-11-11c                     # 11-11c observation tables
TR=rogue=2,mage=1,hunter=2; TA=rogue=1,mage=2,hunter=0  # default trees (SIM.DEFAULT_TREE, _PALL), as 11-11c and 11-11e
M=quartermaster:2,cartographer:1,old_hand:1
X=$O/exp; T=$O/tmp; S=$O/scratch
mkdir -p "$X" "$T" "$S"
log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$O/measure.log"; }
has() { [[ "$STAGES" == *" $1 "* ]]; }

# scratch NAME [SRC_GIT_REF]: a copy of this sim with src/ from the worktree (or from a git ref) in $S/NAME.
scratch() {
  rm -rf "$S/$1"; mkdir -p "$S/$1"
  if [ -n "${2:-}" ]; then (cd "$W" && git archive "$2" src) | tar -x -C "$S/$1"; else cp -r "$W/src" "$S/$1/src"; fi
  mkdir -p "$S/$1/sim"; for f in "$W"/sim/*; do b=$(basename "$f"); [ "$b" = out ] || cp -r "$f" "$S/$1/sim/$b"; done
}
# patch NAME FILE FROM TO: replace the one line containing FROM (fixed string) by TO in scratch NAME.
patch() {
  local f="$S/$1/$2" c; c=$(grep -cF -- "$3" "$f" || true)
  [ "$c" = 1 ] || { log "PATCH FAILED $1 $2: '$3' found $c times"; exit 1; }
  FROM="$3" TO="$4" perl -0pi -e 's/\Q$ENV{FROM}\E/$ENV{TO}/' "$f"
}
# cell NAME BOT PROF CLASSES TREES RUNS RISK [run.mjs args]: classic-map pass cell, one run.mjs per class (its own tree),
# merged into $O/NAME (summary.json, risk.json, runs-*.jsonl) for sim/report.mjs. ROOT (env) picks a scratch copy.
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
# xcell ARGS: an expedition cell (all classes) into $X; ROOT (env) picks a scratch copy, OUTX (env) the output folder.
xcell() { local root=${ROOT:-$W}; (cd "$root" && node sim/run.mjs --class all --warmup 0 --workers "$WK" --out "${OUTX:-$X}" --map expedition --prep "$@" 2>/dev/null | grep -E "win|wrote" | tee -a "$O/measure.log"); }
# Read cell records: node one-liner helper (prints JSON).
q() { (cd "$W" && node --input-type=module -e "
import { readJsonl } from './sim/lib/output.mjs'; import { expMetrics, runLength } from './sim/lib/metrics.mjs';
const recs = (d) => ['rogue','mage','hunter'].flatMap((c) => readJsonl(d + '/runs-' + c + '.jsonl'));
$1"); }

T0=$(date +%s)
log "measure v9+v10 into $O (stages:$STAGES workers $WK)"

# ---- H: hash identity (< 1 min): the sim at REF_SIM against this sim on the same engine (48 runs per mode). ----
if has H; then
  scratch ref; rm -rf "$S/ref/sim"; mkdir -p "$S/ref/sim"; (cd "$W" && git archive "$REF_SIM" sim) | tar -x -C "$S/ref"
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
  log "H done: expect rows 6/6 for every bot, exp random 6/6; exp planner, greedy, speedrunner differ (rows C2 and the clean-escape test)"
fi

# ---- V9A: v9 cells 1, 2, 4, 3, 5 (classic map, 11-11c warm-up and observation tables; paired with 11-11c). ----
if has V9A; then
  for t in 0 1 2; do cell planner-P0-tree$t planner fresh rogue,mage,hunter rogue=$t,mage=$t,hunter=$t 1000 "$P11B/warmup-P0.json"; done      # v9-1  6.2 min
  for t in 0 1 2; do cell planner-PALL-tree$t planner all rogue,mage,hunter rogue=$t,mage=$t,hunter=$t 1000 "$P11B/warmup-PALL.json"; done   # v9-2  3.2 min
  log "v9 cells 1-2 done"
  cell greedy-P0 greedy fresh rogue,mage,hunter $TR 1000 "$P11C/obs-P0.json"                       # v9-4  3.6 min (four cells)
  cell speedrunner-P0 speedrunner fresh rogue,mage,hunter $TR 1000 "$P11C/obs-P0.json"
  cell greedy-PALL greedy all rogue,mage,hunter $TA 1000 "$P11C/obs-PALL.json"
  cell speedrunner-PALL speedrunner all rogue,mage,hunter $TA 1000 "$P11C/obs-PALL.json"
  # v9-3 row 2 arm B (Thick Hide 0.13 alone, Ferocity back at 0.15625): hunter Beastbond P0 and PALL (1 min).
  scratch v9armB
  patch v9armB src/constants.js "petHpPct: 0.115" "petHpPct: 0.13"
  patch v9armB src/constants.js "petDmgPct: 0.18" "petDmgPct: 0.15625"
  ROOT=$S/v9armB cell planner-P0-armB planner fresh hunter hunter=0 1000 "$P11B/warmup-P0.json"
  ROOT=$S/v9armB cell planner-PALL-armB planner all hunter hunter=0 1000 "$P11B/warmup-PALL.json"
  cell planner-P10 planner meta10 rogue,mage,hunter $TR 1000 "$P11B/warmup-P10.json"              # v9-5  2.0 min
  # pass.json for sim/report.mjs: cells, trees by the switch rule (incumbents as 11-11c), observation tables.
  (cd "$W" && node --input-type=module -e "
import fs from 'node:fs'; import { treeSwitch } from './sim/lib/trees.mjs';
const O = process.argv[1]; const cells = {};
for (const d of fs.readdirSync(O)) { const f = O + '/' + d + '/summary.json'; if (fs.existsSync(f)) { const s = JSON.parse(fs.readFileSync(f, 'utf8')); cells[d] = { dir: d, runs: s.meta.runs, classes: Object.keys(s.classes), wallS: Math.round(s.meta.wallMs / 1000) }; } }
const m = (n, c) => JSON.parse(fs.readFileSync(O + '/' + n + '/summary.json', 'utf8')).classes[c].metrics;
const inc = { P0: { rogue: 2, mage: 1, hunter: 2 }, PALL: { rogue: 1, mage: 2, hunter: 0 } }; const trees = {}, treesPALL = {}, treeChoice = { P0: {}, PALL: {} };
for (const c of ['rogue', 'mage', 'hunter']) { const a = treeSwitch([0, 1, 2].map((t) => m('planner-P0-tree' + t, c)), inc.P0[c]); trees[c] = a.tree; treeChoice.P0[c] = a;
  const b = treeSwitch([0, 1, 2].map((t) => m('planner-PALL-tree' + t, c)), inc.PALL[c]); treesPALL[c] = b.tree; treeChoice.PALL[c] = b; }
const obs = (g, tr) => Object.fromEntries(['rogue', 'mage', 'hunter'].map((c) => [c, JSON.parse(fs.readFileSync(O + '/planner-' + g + '-tree' + tr[c] + '/risk.json', 'utf8'))[c]]));
fs.writeFileSync(O + '/obs-P0.json', JSON.stringify(obs('P0', trees))); fs.writeFileSync(O + '/obs-PALL.json', JSON.stringify(obs('PALL', treesPALL)));
fs.writeFileSync(O + '/pass.json', JSON.stringify({ cells, warmups: {}, trees, treesPALL, incumbents: inc, treeChoice, meta: { seedBase: 1000, workers: 2, note: 'M2b v9 cells of sim/measure-v9v10.sh' } }, null, 1));
console.log('v9 trees P0 ' + JSON.stringify(trees) + ' PALL ' + JSON.stringify(treesPALL));" "$O" | tee -a "$O/measure.log")
  log "V9A done ($(( ($(date +%s) - T0) / 60 )) min)"
fi

# ---- V10: expedition with the start camp (seeds 1000 on, paired with 11-11e; default trees as 11-11e). ----
if has V10; then
  # Node-risk base: this pass's v9 observations when stage V9A ran (same engine), else 11-11c's (the spec's choice).
  B0=$O/obs-P0.json; [ -f "$B0" ] || B0=$P11C/obs-P0.json
  BA=$O/obs-PALL.json; [ -f "$BA" ] || BA=$P11C/obs-PALL.json
  log "v10 node-risk base: $B0, $BA"
  # v10-1 table pass (1.9 min): completion `ct` and Dimmed encounter `dim` tables, P0 and PALL (full stand-in).
  OUTX=$X/table xcell --bot planner --runs 100 --profile fresh --risk-in "$B0"
  OUTX=$X/table xcell --bot planner --runs 100 --profile all --risk-in "$BA" --exp-meta $M --vision pathfinder
  C0="--risk-in $B0 --tables-in $X/table/planner-P0-exp-prep/risk.json"
  CA="--risk-in $BA --tables-in $X/table/planner-PALL-exp-prep-metaqucaol-visp/risk.json"
  # v10-2 planner P0, planned prep (2.8 min).
  xcell --bot planner --runs $N --profile fresh $C0
  C2=$X/planner-P0-exp-prep
  DEC=$(q "
const r = recs('$C2'); const e = expMetrics(r); const l = runLength(r, () => 0);
const zonesIn = [1, 2, 3, 4, 5].filter((z) => e.exitLevel[z] !== undefined && Math.abs(e.exitLevel[z] - 10 * z) <= 1).length;
const buy = (id) => r.filter((x) => x.ct && x.ct.bought.includes(id)).length / r.length;
console.log(JSON.stringify({ b11: l.manualReach.v, exits: e.exitLevel, zonesIn, c1keep: l.manualReach.v <= 48 && zonesIn >= 4,
  caught: e.caught.p, dimShare: e.dimDeathShare.p, draughts: buy('prep_draughts'), ember: buy('prep_ember') }));")
  log "v10 cell 2 decisions: $DEC"
  jget() { echo "$DEC" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d['$1'])"; }
  # v10-8a (conditional, C1 rule): XP_WEIGHT_MULT 1.5 only if cell 2 misses B11 <= 48 min or B20 in four zones (2.8 min).
  if [ "$(jget c1keep)" != true ] || [ -n "${FORCE_ALL:-}" ]; then
    scratch c15; patch c15 src/constants.js "export const XP_WEIGHT_MULT = 1.4;" "export const XP_WEIGHT_MULT = 1.5;"
    ROOT=$S/c15 OUTX=$X/arm-c15 xcell --bot planner --runs $N --profile fresh $C0
  else log "v10-8a skipped: cell 2 keeps C1 at 1.4"; fi
  # v10-10 (conditional, only if cell 2 misses B43): DIM_PACK_SIZE 3 if the Dimmed death share < 5 %; DIM_GRACE 5 if caught < 8 %.
  if node -e "process.exit($(jget dimShare) < 0.05 ? 0 : 1)" || [ -n "${FORCE_ALL:-}" ]; then
    scratch pack3; patch pack3 src/constants.js "export const DIM_PACK_SIZE = 2;" "export const DIM_PACK_SIZE = 3;"
    ROOT=$S/pack3 OUTX=$X/arm-pack3 xcell --bot planner --runs $N --profile fresh $C0
  fi
  if node -e "process.exit($(jget caught) < 0.08 ? 0 : 1)" || [ -n "${FORCE_ALL:-}" ]; then
    scratch grace5; patch grace5 src/constants.js "export const DIM_GRACE = 6;" "export const DIM_GRACE = 5;"
    ROOT=$S/grace5 OUTX=$X/arm-grace5 xcell --bot planner --runs $N --profile fresh $C0
  fi
  # v10-3 B40: prep none and random (5.5 min).
  xcell --bot planner --runs $N --profile fresh $C0 --prep-policy none
  xcell --bot planner --runs $N --profile fresh $C0 --prep-policy random
  # v10-4 PALL full stand-in (B39 PALL, B3) and Quartermaster 2 only (B42 vision value, P2: 150 per class) (4.1 min).
  xcell --bot planner --runs $N --profile all $CA --exp-meta $M --vision pathfinder
  xcell --bot planner --runs $(( N / 2 )) --profile all $CA --exp-meta quartermaster:2
  # v10-5 greedy P0 with the clean-escape test (0.6 min); v10-6 speedrunner PALL (2.0 min).
  xcell --bot greedy --runs $N --profile fresh $C0
  xcell --bot speedrunner --runs $N --profile all $CA --exp-meta $M --vision pathfinder
  # v10-11 B41 with prep: C_step and C_route, planner P0 and PALL with the vision stand-in (50 per class, about 3 min).
  xcell --bot planner --runs 50 --profile fresh $C0 --oracle --route
  xcell --bot planner --runs 50 --profile all $CA --exp-meta $M --vision pathfinder --oracle --route
  # v10-7 B44 (P2): heat-seek planner P0 Dimming on / off (100 per class); default planner P0 Dimming off (diagnostic, 50) (3.5 min).
  xcell --bot planner --runs 100 --profile fresh $C0 --variant heatSeek
  xcell --bot planner --runs 100 --profile fresh $C0 --variant heatSeek --dimming off
  xcell --bot planner --runs 50 --profile fresh $C0 --dimming off
  # v10-8b without B4 (DUNGEON_DIM_HOLD 0) (2.8 min): B4 rule (keep if Delve completion of cell 2 >= arm + 8 pp).
  scratch nohold; patch nohold src/constants.js "export const DUNGEON_DIM_HOLD = 3;" "export const DUNGEON_DIM_HOLD = 0;"
  ROOT=$S/nohold OUTX=$X/arm-nohold xcell --bot planner --runs $N --profile fresh $C0
  # v10-9 D2 calibration (5.5 min): per option the informative arm, paired with cell 2: bought in under half of cell 2's
  # runs -> forced (--prep-force); else banned (--prep-ban; a forced arm would replay cell 2).
  for o in ember draughts; do
    if node -e "process.exit($(jget $o) < 0.5 ? 0 : 1)"; then xcell --bot planner --runs $N --profile fresh $C0 --prep-force $o
    else xcell --bot planner --runs $N --profile fresh $C0 --prep-ban $o; fi
  done
  # v10-8c A1 alone on the 11-11e rules (SRC_1111E + the A1 patch; B46 is a share of XP, 100 per class) (0.9 min).
  scratch a1old "$SRC_1111E"
  patch a1old src/engine/contracts.js "gainXp(s, ev, eventXp(s, k.xpFrac * xpWeight(s), cl), 'contract');" "gainXp(s, ev, s.player.level >= A1MAX ? 0 : A1rnd(k.xpFrac * xpWeight(s) * A1xpCurve(cl) * (1 + A1xpPct(s))), 'contract');"
  printf "\nimport { xpCurve as A1xpCurve, xpPct as A1xpPct } from './progress.js';\nimport { rnd as A1rnd } from './util.js';\nimport { MAX_LEVEL as A1MAX } from '../constants.js';\n" >> "$S/a1old/src/engine/contracts.js"
  ROOT=$S/a1old OUTX=$X/arm-a1old xcell --bot planner --runs 100 --profile fresh --risk-in "$P11C/obs-P0.json" --tables-in "$X/table/planner-P0-exp-prep/risk.json"
  log "V10 done ($(( ($(date +%s) - T0) / 60 )) min)"
fi

# ---- V9B: v9 cell 6 (free potion at full strength, speedrunner PALL; diagnostic) and cell 7 (campaigns). ----
if has V9B; then
  scratch fpm1; patch fpm1 src/constants.js "export const FREE_POTION_MULT = 0.5;" "export const FREE_POTION_MULT = 1;"
  ROOT=$S/fpm1 cell speedrunner-PALL-fpm1 speedrunner all rogue,mage,hunter $TA 1000 "$P11C/obs-PALL.json"   # v9-6  1.2 min
  OBS=$O/obs-P0.json; [ -f "$OBS" ] || OBS=$P11C/obs-P0.json
  (cd "$W" && node sim/run.mjs --campaign 50 --class all --risk-in "$OBS" --workers "$WK" --out "$O" 2>&1 | tail -1 | tee -a "$O/measure.log")   # v9-7  ~13 min
  log "V9B done ($(( ($(date +%s) - T0) / 60 )) min)"
fi

# ---- OPT: v9 cell 8, tactician P0 (B1 tactician, B5): 50 per class here; 200 per class (B5 +-4.8 pp) about 17 min. ----
if has OPT; then
  OBS=$O/obs-P0.json; [ -f "$OBS" ] || OBS=$P11C/obs-P0.json
  cell tactician-P0 tactician fresh rogue,mage,hunter $TR "${TACT_RUNS:-50}" "$OBS"
fi
log "measure done in $(( ($(date +%s) - T0) / 60 )) min"
