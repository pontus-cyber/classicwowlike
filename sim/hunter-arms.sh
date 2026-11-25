#!/usr/bin/env bash
# Dungeon-route arms of report docs/reports/legacy-hunter-dungeon-2026-11-20.md (task: B6 with a bought hall, the Hunter's
# dungeon clears, D166): one change per arm, made on a SCRATCH COPY of the repository (never on src/ itself), then played
# with the repository's own driver from the copy:
#   bash sim/hunter-arms.sh <arm> <scratch dir>        (the path must contain /scratch)
#   node <scratch dir>/sim/legacy-run.mjs grid --native --oruvath --econ --hall v3d --levels 25 --tables sim/tables/legacy-hx ...
# Arms (Legacy runs; every arm also plays in a level-60 expedition run, which these reports do not read):
#   an arm name may join several with + (ksb+fer50: both patches)
#   base     the copy as it is (identity check: run for run the repository's cell)
#   drops2   Dungeon boss rolls EXPED_DUNGEON_BOSS_DROPS 3 -> 2 on every dungeon
#   dim2     rolls 3 on a run's first dungeon, 2 on each later one (stats.dungeons counts the clears so far); the planner's
#            value model reads the same rule
#   dim1     rolls 3 on the first dungeon, 1 on each later one
#   nomark   Region Charts (Cartographer) no longer mark the dungeon's node: knowledge() shows the dungeon only with a Delve
#            contract (or Pathfinder), as without Charts. The upper bound of "Charts mark the dungeon's region": a region mark
#            is worth between this and today's node mark
#   dmg      dungeon trash damage 1.1 -> 1.25 and boss damage 1.5 -> 1.75 (option 1: dungeon numbers)
#   hp       dungeon trash HP 1.2 -> 1.4 and boss HP 5.6 -> 6.6
#   rbz      (Lost Technique I) the zone bar counts Ricochet Bolt's two bounces again (the template before D166); the Camp bar
#            keeps one target. Tests the zone slot alone
#   rb133    Ricochet Bolt's damage coefficients x1.33 (b, l, p, w): one-target value 427, between Savage Order (415) and Deadfall
#            Trap (436 raw), so the zone bar takes it and the Camp's AoE step keeps Deadfall Trap
#   rb160    Ricochet Bolt x1.6 and kept off the Camp bar (a bar rule: the Camp's AoE step is Deadfall Trap's)
#   pdp      Hunter pet damage: PET_DMG_POWER 0.375 -> 0.30 (the pet's share of Power)
#   hpet     Ridgewolf HP share 0.50 -> 0.42
#   so85     Savage Order coefficients x0.85 (b, l, p)
#   hs85     Heartseeker Shot coefficients x0.85 (b, l, p, w)
#   ksb      (Lost Technique I as a passive) while Ricochet Bolt is learned, Keen Shot also hits up to two other enemies for 30 %
#            of its hit (Ricochet's bounce); Ricochet Bolt itself stays off every bar, so the change is the passive alone.
#            D169 built it (engine-2026-11-25: C.KEEN_RICOCHET; a Legacy run with both gates teaches no Ricochet Bolt), so on
#            this tree the arm is the copy as it is (base); the rb* and rbz arms act on level-60 runs only
#   fer<NN>  Legacy Ferocity (TALENT_HERO h_a2) petDmgPct 0.045 (D169; 0.10 when the report was made) -> NN / 1000 a rank (fer75: 0.075, fer50: 0.05, fer40: 0.04). The Hunter buys its Ferocity ranks only
#            at hero 24-25, so the change acts from there
#   fpm<NN>  Packed Satchel's free potion at NN / 100 of a potion (FREE_POTION_MULT 0.5 as built): fpm25 = a quarter
#   pet      a pet that falls in a dungeon's trash fight stays down until the boss fight is over (no 25 % revive between a
#            dungeon's fights); revived when the boss falls or the player leaves
set -euo pipefail
ARM=${1:?arm}; S=${2:?scratch dir}
for A in ${ARM//+/ }; do case "$A" in base|drops2|dim2|dim1|nomark|dmg|hp|pet|rbz|rb133|rb160|pdp|hpet|so85|hs85|ksb|fpm[0-9][0-9]|fer[0-9][0-9]) ;; *) echo "unknown arm $A" >&2; exit 1 ;; esac; done
[[ "$S" == */scratch* ]] || { echo "refusing: $S has no /scratch in its path" >&2; exit 1; }
W=$(cd "$(dirname "$0")/.." && pwd)
mkdir -p "$S"
[ "$(cd "$S" && pwd)" != "$W" ] || { echo "refusing to edit the repository" >&2; exit 1; }
rm -rf "$S/src" "$S/sim" "$S/package.json"
mkdir -p "$S/sim/out"
cp -r "$W/src" "$S/src"
for f in "$W"/sim/*; do [ "$(basename "$f")" = out ] || cp -r "$f" "$S/sim/"; done
[ -f "$W/package.json" ] && cp "$W/package.json" "$S/package.json"
K="$S/src/constants.js"; E="$S/src/engine/expedition.js"; M="$S/sim/lib/model.mjs"; B="$S/src/engine/combat.js"

# one checked literal replacement: rep <file> <old> <new>
rep() { python3 - "$1" "$2" "$3" <<'PY'
import sys
f, old, new = sys.argv[1:4]
t = open(f).read()
if t.count(old) != 1:
    sys.exit(f"{f}: expected exactly one match of: {old!r}, found {t.count(old)}")
open(f, 'w').write(t.replace(old, new))
PY
}

for A in ${ARM//+/ }; do
case "$A" in
  base) ;;
  drops2) rep "$K" 'export const EXPED_DUNGEON_BOSS_DROPS = 3;' 'export const EXPED_DUNGEON_BOSS_DROPS = 2;' ;;
  dim2|dim1)
    LATER=${ARM#dim}
    rep "$E" 'export const bossDropRolls = (s) => (isExpedition(s) ? EXPED_DUNGEON_BOSS_DROPS : DUNGEON_BOSS_DROPS);' \
      "export const bossDropRolls = (s) => (isExpedition(s) ? (s.stats.dungeons > 0 ? Math.min(EXPED_DUNGEON_BOSS_DROPS, $LATER) : EXPED_DUNGEON_BOSS_DROPS) : DUNGEON_BOSS_DROPS);"
    rep "$M" "exp: s.mapMode === 'expedition' ? EXP_CTX : null," \
      "exp: s.mapMode === 'expedition' ? { ...EXP_CTX, bossDrops: s.stats.dungeons > 0 ? Math.min(EXP_CTX.bossDrops, $LATER) : EXP_CTX.bossDrops } : null,"
    ;;
  nomark) rep "$E" "((s.exp.vision.regions || delveHeld(s)) && n.type === 'dungeon')" "(delveHeld(s) && n.type === 'dungeon')" ;;
  dmg) rep "$K" 'export const DUNGEON_TRASH_DMG_MULT = 1.1;' 'export const DUNGEON_TRASH_DMG_MULT = 1.25;'
       rep "$K" 'export const DUNGEON_BOSS_DMG_MULT = 1.5;' 'export const DUNGEON_BOSS_DMG_MULT = 1.75;' ;;
  hp)  rep "$K" 'export const DUNGEON_TRASH_HP_MULT = 1.2;' 'export const DUNGEON_TRASH_HP_MULT = 1.4;'
       rep "$K" 'export const DUNGEON_BOSS_HP_MULT = 5.6;' 'export const DUNGEON_BOSS_HP_MULT = 6.6;' ;;
  pet)
    rep "$B" '  if (p.pet && !p.pet.alive) {
    p.pet.alive = true;' "  if (p.pet && !p.pet.alive && !(f.kind === 'trash' && s.node && s.node.type === 'dungeon')) {
    p.pet.alive = true;"
    rep "$S/src/engine/actions.js" "apply: (s, ev) => { ev.push({ t: 'dungeonLeft' }); completeNode(s, ev); }," \
      "apply: (s, ev) => { ev.push({ t: 'dungeonLeft' }); if (s.player.pet && !s.player.pet.alive) { s.player.pet.alive = true; s.player.pet.hp = Math.max(1, Math.round(0.25 * s.player.d.petMaxHp)); } completeNode(s, ev); },"
    ;;
  rbz)
    P="$S/sim/lib/policy.mjs"
    rep "$P" 'return one * (a.hits || 1) * (sp.bounces && !legacyRules(s) ? 1 + sp.bounces * sp.bounceFrac : 1);' \
      'return one * (a.hits || 1) * (sp.bounces && !(legacyRules(s) && BAR_CAMP) ? 1 + sp.bounces * sp.bounceFrac : 1);'
    rep "$P" 'export function templateBar(s, { camp = false, exclude = null } = {}) {' \
      'let BAR_CAMP = false;
export function templateBar(s, { camp = false, exclude = null } = {}) {
  BAR_CAMP = camp;'
    ;;
  rb133|rb160)
    X=${ARM#rb}; F=$([ "$X" = 133 ] && echo 1.33 || echo 1.6)
    rep "$K" "b: 5, l: 1.1, p: 0.5, w: 0.9, bounces: 2," "b: $(python3 -c "print(round(5*$F,3))"), l: $(python3 -c "print(round(1.1*$F,3))"), p: $(python3 -c "print(round(0.5*$F,3))"), w: $(python3 -c "print(round(0.9*$F,3))"), bounces: 2,"
    if [ "$A" = rb160 ]; then
      P="$S/sim/lib/policy.mjs"
      rep "$P" 'const known = p.spellOrder.filter((id) => p.spells[id] && !(exclude && exclude.has(id)));' \
        "const known = p.spellOrder.filter((id) => p.spells[id] && !(exclude && exclude.has(id)) && !(camp && id === 'ricochet_bolt' && legacyRules(s)));"
    fi
    ;;
  pdp) rep "$K" 'export const PET_DMG_POWER = 0.375;' 'export const PET_DMG_POWER = 0.30;' ;;
  hpet) rep "$K" "ridgewolf: { id: 'ridgewolf', name: 'Ridgewolf', hpPct: 0.50," "ridgewolf: { id: 'ridgewolf', name: 'Ridgewolf', hpPct: 0.42," ;;
  so85) rep "$K" "cd: 4, school: 'phys', b: 8, l: 2.0, p: 1.0, tags: ['pet']" "cd: 4, school: 'phys', b: 6.8, l: 1.7, p: 0.85, tags: ['pet']" ;;
  hs85) rep "$K" "cd: 3, school: 'phys', b: 14, l: 3.0, p: 1.3, w: 1.5, critBelow" "cd: 3, school: 'phys', b: 11.9, l: 2.55, p: 1.105, w: 1.275, critBelow" ;;
  ksb)
    # D169: built in the engine (spells.js keenRicochet); nothing to edit
    grep -q 'KEEN_RICOCHET' "$S/src/constants.js" && continue
    rep "$S/src/engine/spells.js" "      pHit(s, ev, tgt, base(s, sp, tl), { ...phys, pct, critBonus });
      break;" "      pHit(s, ev, tgt, base(s, sp, tl), { ...phys, pct, critBonus });
      if (id === 'keen_shot' && p.spells.ricochet_bolt) {
        let nb = 0;
        for (const x of livingEnemies(s)) {
          if (nb >= 2 || f.over) break;
          if (x.idx === tgt) continue;
          pHit(s, ev, x.idx, base(s, sp, tl), { ...phys, pct, multi: 0.3 });
          nb++;
        }
      }
      break;"
    rep "$S/sim/lib/policy.mjs" 'const known = p.spellOrder.filter((id) => p.spells[id] && !(exclude && exclude.has(id)));' \
      "const known = p.spellOrder.filter((id) => p.spells[id] && id !== 'ricochet_bolt' && !(exclude && exclude.has(id)));"
    ;;
  fpm[0-9][0-9])
    V=$(python3 -c "print(int('${A#fpm}') / 100)")
    rep "$K" 'export const FREE_POTION_MULT = 0.5;' "export const FREE_POTION_MULT = $V;"
    ;;
  fer[0-9][0-9])
    V=$(python3 -c "print(int('${A#fer}') / 1000)")
    rep "$K" '  h_a2: { petDmgPct: 0.045 },' "  h_a2: { petDmgPct: $V },"
    ;;
esac
done
echo "arm $ARM applied to $S"
