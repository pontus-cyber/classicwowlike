#!/usr/bin/env python3
"""Legacy (D154, legacy.md 6.1) scratch patch: a run at a fixed hero power level with zones scaled to it.
Applied to a scratch copy of src/ and sim/ (never the repository's src/): python3 sim/legacy-patch.py <scratch dir>.
The designer's patch of legacy.md 6.1 (sim/out/design-legacy/patch.py on main 19719ed), kept as he ran it, plus
`learn` (sim, 2026-11-17): per-spell learn levels, for the class-spread arms of report legacy-calibration-2026-11-17.
Read from env LEG (JSON) at load; no LEG = the engine as built.
  P: power level at run start (the engine's 1-60 level; hero level H -> P = 1 + (H - 1) * 59 / 24)
  tier: [6] power levels added to each zone's band (zone level = player level at zone entry + tier[z-1])
  ring: [4] RING_CL_BASE; spread: RING_CL_SPREAD; dun: dungeon trash offset over the band (boss +2 more)
  ctr: contract level offset over P + tier; boss: boss level over the player's level at FIGHT_BOSS
  k: level cost multiplier (a level needs k x xpToNext); kit: 'all' (common ilvl P in every slot) | 'two' (weapon, chest)
  gold: starting gold in V(P) units
  tdmg / thp: [6] x damage / HP of template enemies in zones 1-6 (the Camp uses zone 6's)
  bhp: [25] Oruvath's HP factor by hero level (legacy.md 2.4)
  bdmg: [25] x every damage of Oruvath's fight by hero level (sim, 2026-11-17 arm; none = 1)
  camp / campLvl / campXp: Camp waves per run, the Camp's level over the hero, x XP of a wave
  pdmg: { classId: x } x the player's and pet's damage in Oruvath's fight (sensitivity arm)
  learn: { spellId: power level } replaces SPELL[id].lvl (the learn level; run start and trainers read it)
Designer arms (2026-11-18, report legacy-oruvath-2026-11-18; every array is indexed by the hero level of the power
level at FIGHT_BOSS, round((P - 1) x 24 / 59), as bhp and bdmg):
  shp: [25] x the Shards' HP by hero level, on top of bhp (Oruvath's Shards only)
  fd: [25] Final Dark's round (BOSS_ENRAGE_ROUND) by hero level
  link / scnt / sevr: LINK_DR_PER_SHARD / SHARD_COUNT / SHARD_EVERY
  spell / talent / pet: { id: { field: value } } over SPELL / TALENT / PET entries (class numbers)
  dotfix: true = autoplay (rules 7.9) casts Living Flame and Barbed Arrow on the end boss at any HP and never on a Shard
  barfix: true = the sim's Camp bar (balance.md 1.2) keeps the Hunter's Mend Companion (a pet step after the defensive)
  bsmooth: true = Oruvath's damage scale without zone danger's early factors (EARLY_DMG_MULT, Z1_DMG_MULT): smooth in level
Env BOSSDUMP=<dir> (designer, 2026-11-18): the runner writes the state before each FIGHT_BOSS to
<dir>/P<power at start>-<class>-<seed>.json (R.serialize), for replays of Oruvath's fight under other boss settings.
"""
import sys, os
root = sys.argv[1]
assert '/scratch' in root, root

def sub(path, old, new, count=1):
    p = os.path.join(root, path); t = open(p).read(); n = t.count(old)
    assert n == count, f'{path}: expected {count} of {old[:80]!r}, found {n}'
    open(p, 'w').write(t.replace(old, new))

def prepend_import(path, line):
    p = os.path.join(root, path); t = open(p).read(); i = t.index('import ')
    open(p, 'w').write(t[:i] + line + '\n' + t[i:])

# constants: LEG first (module order), the ring offsets, the dungeon offset, ratio helpers
C = 'src/constants.js'
t = open(os.path.join(root, C)).read()
open(os.path.join(root, C), 'w').write(
    "const __LJ = (globalThis.process && globalThis.process.env && globalThis.process.env.LEG) || '';\n"
    "export const LEG = __LJ ? Object.assign({ tier: [0, 0, 0, 0, 0, 0], ring: [0, 0, 1, 2], spread: 2, dun: 2, ctr: 2, boss: 4, k: 10, kit: 'all', gold: 3 }, JSON.parse(__LJ)) : null;\n"
    + t)
sub(C, 'export const RING_CL_BASE = [0, 1, 4, 7];', 'export const RING_CL_BASE = LEG ? LEG.ring : [0, 1, 4, 7];')
sub(C, 'export const RING_CL_SPREAD = 3;', 'export const RING_CL_SPREAD = LEG ? LEG.spread : 3;')
sub(C, 'export const DUNGEON_LEVEL_OFFSET = 4;', 'export const DUNGEON_LEVEL_OFFSET = LEG ? LEG.dun : 4;')
open(os.path.join(root, C), 'a').write(
    "\n// Legacy scratch: Oruvath scaled from level 62 by the normal enemy curve (HP; damage with zone danger)\n"
    "export const legHpRatio = (M) => (20 + 12 * M) / (20 + 12 * 62);\n"
    "export const legZd = (M) => (M <= 20 ? 0.8 * (M <= 10 ? 1.25 : 1) : 1) * (1 + 0.45 * Math.max(0, M - 20) / 10);\n"
    "export const legDmgRatio = (M) => ((4 + 2.6 * M) * legZd(M)) / ((4 + 2.6 * 62) * legZd(62));\n")

# learn levels (sim, 2026-11-17): LEG.learn = { spellId: power level }
open(os.path.join(root, C), 'a').write(
    "\n// Legacy scratch: per-spell learn levels (power levels) from LEG.learn\n"
    "if (LEG && LEG.learn) for (const [id, l] of Object.entries(LEG.learn)) { if (!SPELL[id]) throw new Error('LEG.learn: unknown spell ' + id); SPELL[id].lvl = l; }\n")

# zone bands at entry (the player's level then + tier), dungeon levels from the band, the map view's band
E = 'src/engine/expedition.js'
prepend_import(E, "import { LEG, MAX_LEVEL as __MAXL } from '../constants.js';")
sub(E, "  const band = ZONE_LEVELS * (z - 1) + 1;\n  if (n.ring === 0) {",
       "  const band = LEG ? Math.max(1, Math.min(__MAXL, s.player.level + LEG.tier[z - 1])) : ZONE_LEVELS * (z - 1) + 1;\n  if (n.ring === 0) {")
sub(E, "    const lv = dungeonLevels(z);",
       "    const lv = LEG ? { trash: clampCl(band + DUNGEON_LEVEL_OFFSET), boss: clampCl(band + DUNGEON_LEVEL_OFFSET + 2) } : dungeonLevels(z);")
t = open(os.path.join(root, E)).read()
if 'DUNGEON_LEVEL_OFFSET' not in t.split('export function')[0]:
    prepend_import(E, "import { DUNGEON_LEVEL_OFFSET } from '../constants.js';")
sub(E, "  const band = ZONE_LEVELS * (z - 1) + 1;\n  const nodes = zone.nodes.map(",
       "  const band = LEG ? zone.nodes[0].cl : ZONE_LEVELS * (z - 1) + 1;\n  const nodes = zone.nodes.map(")

# contract level
K = 'src/engine/contracts.js'
prepend_import(K, "import { LEG } from '../constants.js';")
sub(K, "export const contractLevel = (z) => ZONE_LEVELS * (z - 1) + CONTRACT_CL_OFFSET;",
       "export const contractLevel = (z) => (LEG ? Math.max(1, Math.min(60, LEG.P + LEG.tier[z - 1] + LEG.ctr)) : ZONE_LEVELS * (z - 1) + CONTRACT_CL_OFFSET);")

# run start: level P, spells learned and trained to P, the kit, gold; hub and Camp vendors; boss scaling; exit level
N = 'src/engine/nodes.js'
prepend_import(N, "import { LEG, legHpRatio, legDmgRatio } from '../constants.js';\nimport { V as __V } from './items.js';")
sub(N, "  cls.startSpells.forEach((id, i) => { p.spells[id] = { tl: 1, rank: 1 }; p.spellOrder.push(id); p.bar[i] = id; });\n",
       "  cls.startSpells.forEach((id, i) => { p.spells[id] = { tl: 1, rank: 1 }; p.spellOrder.push(id); p.bar[i] = id; });\n"
       "  if (LEG) {\n"
       "    p.level = LEG.P;\n"
       "    for (const sp of Object.values(SPELL)) if (sp.cls === c.classId && sp.source === 'class' && sp.lvl <= LEG.P && !p.spells[sp.id]) { p.spells[sp.id] = { tl: LEG.P, rank: 1 }; p.spellOrder.push(sp.id); }\n"
       "    for (const id of Object.keys(p.spells)) p.spells[id].tl = LEG.P;\n"
       "    p.gold = Math.round(LEG.gold * __V(LEG.P));\n"
       "  }\n")
sub(N, "  p.equipped.chest = makeFixedGear(s, 'chest', 'common', 1, txt.startChest);\n",
       "  p.equipped.chest = makeFixedGear(s, 'chest', 'common', 1, txt.startChest);\n"
       "  if (LEG) {\n"
       "    p.equipped.weapon = makeFixedGear(s, 'weapon', 'common', LEG.P, txt.startWeapon);\n"
       "    p.equipped.chest = makeFixedGear(s, 'chest', 'common', LEG.P, txt.startChest);\n"
       "    if (LEG.kit === 'all') for (const slot of SLOT_IDS) if (!p.equipped[slot]) p.equipped[slot] = makeFixedGear(s, slot, 'common', LEG.P, null);\n"
       "  }\n")
sub(N, "export const exitLevel = (z) => ZONE_LEVELS * z;", "export const exitLevel = (z) => (LEG ? 999 : ZONE_LEVELS * z);")
sub(N, "    const cl = camp ? MAX_LEVEL : contentLevel(z, 0);",
       "    const cl = camp ? (LEG ? Math.min(MAX_LEVEL, s.player.level + LEG.boss - 2) : MAX_LEVEL) : (LEG && s.zone.nodes ? s.zone.nodes[0].cl : contentLevel(z, 0));")
sub(N, "  ev.push({ t: 'bossStart', asc, time: s.time, level: BOSS_LEVEL });\n  startFight(s, ev, {\n    kind: 'boss', k: 0, z: CAMP_Z, rng: STREAM.boss(s.seed), enemies: [], bossEnemy: makeBoss(asc),\n    addLevel: BOSS_LEVEL,",
       "  const be = makeBoss(asc);\n"
       "  if (LEG) { const L = s.player.level + LEG.boss; be.level = L; be.hp = be.maxHp = Math.round(be.hp * legHpRatio(L)); be.armor = Math.round(be.armor * L / 62); s.legBoss = { L, hp: legHpRatio(L), dmg: legDmgRatio(L) }; }\n"
       "  ev.push({ t: 'bossStart', asc, time: s.time, level: be.level });\n  startFight(s, ev, {\n    kind: 'boss', k: 0, z: CAMP_Z, rng: STREAM.boss(s.seed), enemies: [], bossEnemy: be,\n    addLevel: be.level,")

# boss damage, the Brand, estimates, Shards
D = 'src/engine/damage.js'
sub(D, "  return s.fight && s.fight.kind === 'boss' ? BOSS_DMG_MULT * (1 + (asc || 0)) : 1 + (asc || 0);",
       "  return s.fight && s.fight.kind === 'boss' ? BOSS_DMG_MULT * (1 + (asc || 0)) * (s.legBoss ? s.legBoss.dmg : 1) : 1 + (asc || 0);")
# sensitivity arm (sim, 2026-11-17): LEG.pdmg = { classId: x } on the player's and the pet's damage in Oruvath's fight
prepend_import(D, "import { LEG } from '../constants.js';")
sub(D, "  if (p.buffs.elixir && p.buffs.elixir.active) pct += ELIXIR_DMG_PCT;\n  if (typeof tgt === 'number'",
       "  if (p.buffs.elixir && p.buffs.elixir.active) pct += ELIXIR_DMG_PCT;\n  if (LEG && LEG.pdmg && f && f.kind === 'boss' && LEG.pdmg[p.classId]) pct += LEG.pdmg[p.classId] - 1;\n  if (typeof tgt === 'number'")
sub(D, "  const wc = findSt(s.fight.p.st, 'COMMUNION');",
       "  if (LEG && LEG.pdmg && s.fight.kind === 'boss' && LEG.pdmg[p.classId]) pct += LEG.pdmg[p.classId] - 1;\n  const wc = findSt(s.fight.p.st, 'COMMUNION');")
B = 'src/engine/boss.js'
sub(B, "  if (school === 'phys') x *= 1 - mitigation(tgt === 'pet' ? s.player.d.petArmor : s.player.d.armor, BOSS_LEVEL);",
       "  if (school === 'phys') x *= 1 - mitigation(tgt === 'pet' ? s.player.d.petArmor : s.player.d.armor, s.legBoss ? s.legBoss.L : BOSS_LEVEL);")
sub(B, "    const sh = makeShard(f.enemies.length, f.boss.asc, turn0);\n",
       "    const sh = makeShard(f.enemies.length, f.boss.asc, turn0);\n"
       "    if (s.legBoss) { sh.hp = sh.maxHp = Math.round(sh.hp * s.legBoss.hp); sh.level = s.legBoss.L - 2; sh.armor = 15 * sh.level; }\n")
Cb = 'src/engine/combat.js'
sub(Cb, "levelMod(BOSS_LEVEL, s.player.level)", "levelMod(s.legBoss ? s.legBoss.L : BOSS_LEVEL, s.player.level)")

# zone tier multipliers on template enemies (dmg, hp by zone; the Camp uses zone 6's), and Oruvath's HP by the hero's level
sub(Cb, "  const hp = Math.max(1, rnd((ENEMY_HP_BASE + ENEMY_HP_PER_LEVEL * level) * a.hp * vHp * t.hpMult));",
        "  const __tz = LEG && s.zone ? Math.min(6, s.zone.camp ? 6 : s.zone.z) - 1 : -1;\n"
        "  const hp = Math.max(1, rnd((ENEMY_HP_BASE + ENEMY_HP_PER_LEVEL * level) * a.hp * vHp * t.hpMult * (__tz >= 0 && LEG.thp ? LEG.thp[__tz] : 1)));")
sub(Cb, "zoneDanger(level, variant) * engageComp(s),", "zoneDanger(level, variant) * engageComp(s) * (__tz >= 0 && LEG.tdmg ? LEG.tdmg[__tz] : 1),")
t0 = open(os.path.join(root, Cb)).read()
if "import { LEG }" not in t0:
    prepend_import(Cb, "import { LEG } from '../constants.js';")
sub(N, "be.hp = be.maxHp = Math.round(be.hp * legHpRatio(L));", "const __bm = LEG.bhp ? LEG.bhp[Math.min(LEG.bhp.length - 1, Math.max(0, Math.round((s.player.level - 1) * 24 / 59)))] : 1; be.hp = be.maxHp = Math.round(be.hp * legHpRatio(L) * __bm);")
sub(N, "s.legBoss = { L, hp: legHpRatio(L), dmg: legDmgRatio(L) };", "s.legBoss = { L, hp: legHpRatio(L) * __bm, dmg: legDmgRatio(L) * (LEG.bdmg ? LEG.bdmg[Math.min(LEG.bdmg.length - 1, Math.max(0, Math.round((s.player.level - 1) * 24 / 59)))] : 1) };")

# Camp waves at the Camp's level (hero level + campLvl) and a wave cap from LEG.camp (the levelling route's farm)
t0 = open(os.path.join(root, N)).read()
assert t0.count('CAMP_GRIND_LEVEL') == 4, t0.count('CAMP_GRIND_LEVEL')
t0 = t0.replace("eventXp(s, GRIND_WAVE_XP_FRAC * xpWeight(s), CAMP_GRIND_LEVEL)", "eventXp(s, GRIND_WAVE_XP_FRAC * xpWeight(s), (LEG ? Math.min(66, s.player.level + (LEG.campLvl ?? 3)) : CAMP_GRIND_LEVEL))")
t0 = t0.replace("({ tid, level: CAMP_GRIND_LEVEL, variant: 'normal' })", "({ tid, level: (LEG ? Math.min(66, s.player.level + (LEG.campLvl ?? 3)) : CAMP_GRIND_LEVEL), variant: 'normal' })")
t0 = t0.replace("addLevel: CAMP_GRIND_LEVEL,", "addLevel: (LEG ? Math.min(66, s.player.level + (LEG.campLvl ?? 3)) : CAMP_GRIND_LEVEL),")
open(os.path.join(root, N), 'w').write(t0)

# Camp wave XP multiplier (LEG.campXp): kills and the wave bonus at the Camp
sub("src/engine/progress.js", "  const base = amount + rested;", "  if (LEG && LEG.campXp && s.zone && s.zone.camp && (why === 'wave' || why === 'kill')) { amount = Math.round(amount * LEG.campXp); rested = Math.round(rested * LEG.campXp); }\n  const base = amount + rested;")

# levels cost k x xpToNext (the hero's slower curve); awards unchanged
P = 'src/engine/progress.js'
prepend_import(P, "import { LEG } from '../constants.js';")
sub(P, "  while (p.level < MAX_LEVEL && p.xp >= xpToNext(p.level)) {\n    p.xp -= xpToNext(p.level);",
       "  while (p.level < MAX_LEVEL && p.xp >= xpToNext(p.level) * (LEG ? LEG.k : 1)) {\n    p.xp -= xpToNext(p.level) * (LEG ? LEG.k : 1);")

# sim: no zone exit level (the zone scales), no Camp grind, a 'later' profile (runs 2, no unlocks)
sub('sim/bots/planner.mjs', "export const expExitLevel = (z) => C.ZONE_LEVELS * z;", "export const expExitLevel = (z) => (C.LEG ? 0 : C.ZONE_LEVELS * z);")
sub('sim/lib/params.mjs', "  CAMP_MAX_WAVES: 40,", "  CAMP_MAX_WAVES: (globalThis.process.env.LEG ? (JSON.parse(globalThis.process.env.LEG).camp ?? 0) : 40),")
sub('sim/lib/profiles.mjs', "  p.runs = FIXED_PROFILE_RUNS;\n  if (n === 'all'", "  p.runs = FIXED_PROFILE_RUNS;\n  if (n === 'later') return p;\n  if (n === 'all'")
# content above level 60 for heroes near the top (CL up to 66)
Mp = 'src/engine/map.js'
prepend_import(Mp, "import { LEG } from '../constants.js';")
sub(Mp, "export const clampCl = (x) => Math.max(1, Math.min(MAX_LEVEL, x));", "export const clampCl = (x) => Math.max(1, Math.min(LEG ? 66 : MAX_LEVEL, x));")
sub(E, "Math.max(1, Math.min(__MAXL, s.player.level + LEG.tier[z - 1]))", "Math.max(1, Math.min(66, s.player.level + LEG.tier[z - 1]))")
# designer arms (2026-11-18): the Shards' HP, Final Dark's round, Linked, the Shard waves, class numbers
sub(C, 'export const SHARD_COUNT = 2;', 'export const SHARD_COUNT = LEG && LEG.scnt ? LEG.scnt : 2;')
sub(C, 'export const SHARD_EVERY = 8;', 'export const SHARD_EVERY = LEG && LEG.sevr ? LEG.sevr : 8;')
sub(C, 'export const LINK_DR_PER_SHARD = 0.15;', 'export const LINK_DR_PER_SHARD = LEG && LEG.link !== undefined ? LEG.link : 0.15;')
open(os.path.join(root, C), 'a').write(
    "\n// Legacy scratch (designer arms 2026-11-18): hero-level index of a power level, a per-hero-level table's value\n"
    "export const legH = (P) => Math.min(24, Math.max(0, Math.round((P - 1) * 24 / 59)));\n"
    "export const legAt = (arr, P, d = 1) => (arr ? arr[Math.min(arr.length - 1, legH(P))] : d);\n"
    "if (LEG) for (const [tab, name] of [[SPELL, 'spell'], [TALENT, 'talent'], [PET, 'pet']]) for (const [id, o] of Object.entries(LEG[name] || {})) { if (!tab[id]) throw new Error('LEG.' + name + ': unknown ' + id); Object.assign(tab[id], o); }\n")
sub(B, "const isLitanyRound = (r) =>",
       "let __fd = BOSS_ENRAGE_ROUND;\nexport const __setFd = (x) => { __fd = x; };\nconst isLitanyRound = (r) =>")
sub(B, "  if (r >= BOSS_ENRAGE_ROUND) acts.push(", "  if (r >= __fd) acts.push(")
sub(B, "      enrageInRounds: Math.max(0, BOSS_ENRAGE_ROUND - r),", "      enrageInRounds: Math.max(0, __fd - r),")
sub(B, "sh.hp = sh.maxHp = Math.round(sh.hp * s.legBoss.hp);", "sh.hp = sh.maxHp = Math.round(sh.hp * s.legBoss.hp * (s.legBoss.shp || 1));")
sub(N, "import { makeBoss } from './boss.js';", "import { makeBoss, __setFd } from './boss.js';")
prepend_import(N, "import { legAt } from '../constants.js';")
open(os.path.join(root, C), 'a').write(
    "\n// Legacy scratch (designer 2026-11-18): Oruvath's damage scale without the early factors (LEG.bsmooth)\n"
    "export const legDmgRatio0 = (M) => ((4 + 2.6 * M) * (1 + 0.45 * Math.max(0, M - 20) / 10)) / ((4 + 2.6 * 62) * (1 + 0.45 * 4.2));\n")
sub(N, "import { LEG, legHpRatio, legDmgRatio } from '../constants.js';", "import { LEG, legHpRatio, legDmgRatio, legDmgRatio0 } from '../constants.js';")
sub(N, "dmg: legDmgRatio(L) * (LEG.bdmg", "dmg: (LEG.bsmooth ? legDmgRatio0(L) : legDmgRatio(L)) * (LEG.bdmg")
sub(N, "s.legBoss = { L, hp: legHpRatio(L) * __bm,", "__setFd(legAt(LEG.fd, s.player.level, 57)); s.legBoss = { L, shp: legAt(LEG.shp, s.player.level), fd: legAt(LEG.fd, s.player.level, 57), hp: legHpRatio(L) * __bm,")
A = 'src/engine/autoplay.js'
prepend_import(A, "import { LEG as __LEGA } from '../constants.js';")
sub(A, "    case 'living_flame': return ok(tgtHp >= sp.autoTargetHp && !findSt(e.st, 'BURN', 'living_flame'));",
       "    case 'living_flame': return ok((__LEGA && __LEGA.dotfix ? (e.boss || (tgtHp >= sp.autoTargetHp && e.kind !== 'shard')) : tgtHp >= sp.autoTargetHp) && !findSt(e.st, 'BURN', 'living_flame'));")
sub(A, "    case 'barbed_arrow': return ok(tgtHp >= sp.autoTargetHp && !findSt(e.st, 'BLEED', 'barbed_arrow'));",
       "    case 'barbed_arrow': return ok((__LEGA && __LEGA.dotfix ? (e.boss || (tgtHp >= sp.autoTargetHp && e.kind !== 'shard')) : tgtHp >= sp.autoTargetHp) && !findSt(e.st, 'BLEED', 'barbed_arrow'));")
sub('sim/lib/runner.mjs', "    const b = rec.before(s, a);\n    let events;",
       "    if (globalThis.process.env.BOSSDUMP && a.type === 'FIGHT_BOSS') writeFileSync(`${globalThis.process.env.BOSSDUMP}/P${C.LEG ? C.LEG.P : 0}-${s.player.classId}-${seed}.json`, R.serialize(s));\n    const b = rec.before(s, a);\n    let events;")
prepend_import('sim/lib/runner.mjs', "import { writeFileSync } from 'node:fs';")
sub('sim/lib/policy.mjs', "  const steps = camp ? ['interrupt', 'cleanse', 'main', 'second', 'defensive', 'aoe'] : ['interrupt', 'main', 'second', 'defensive', 'cleanse', 'aoe'];",
       "  const steps = camp ? ['interrupt', 'cleanse', 'main', 'second', 'defensive', ...(C.LEG && C.LEG.barfix ? ['pet'] : []), 'aoe'] : ['interrupt', 'main', 'second', 'defensive', 'cleanse', 'aoe'];")
sub('sim/lib/policy.mjs', "    else if (st === 'aoe') take(best((id) => hasTag(id, 'aoe')));",
       "    else if (st === 'aoe') take(best((id) => hasTag(id, 'aoe')));\n    else if (st === 'pet') take(known.includes('mend_companion') ? 'mend_companion' : null);")

# measure: XP in level-equivalents at the level of each award (s.stats.le), into the record
sub(P, "  p.xp += total;\n  s.stats.xpGained += total;", "  p.xp += total;\n  s.stats.xpGained += total;\n  s.stats.le = (s.stats.le || 0) + total / xpToNext(p.level);")
sub('sim/lib/recorder.mjs', "      lvl: sum ? sum.level : 1,", "      le: Math.round(((s.stats && s.stats.le) || 0) * 100) / 100, lvl: sum ? sum.level : 1,")
print('patched', root)
