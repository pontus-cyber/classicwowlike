// autoAction: the autoplay combat policy (rules 7.9, exact; combat v2 rule E in the engage round) and a
// deterministic default policy for every other decision so a headless run can go from CREATE to SUMMARY. The
// simulator's bots (balance.md 1) replace the out-of-combat part with their own policies; the combat part is the
// spec's. Autoplay reads only the now-intent, except rule E, which reads turns 1..ENGAGE_AUTO_LOOK of the tracks, and
// rule E2 (M2b v13, D108), which answers a visible wind-up of an elite, rare or dungeon boss in the engage round, and
// rule H (M2b v14, D111), which waits while every living enemy is SAPPED and Sap will cancel a wind-up (the track's cancel).
// Expedition map (rules 1.9.9): the default map policy explores what it can leave cleanly and walks to the cheapest
// Road around the Dimming; it reads only what the player sees (seen nodes, the skeleton, the Dimming).
// The default talent build, bar and item bar are exported for the dev tools (debug.build, engine-api.md 12).
// Start camp and contracts (prep, expedition.md 2-3): a fixed default at PREP (the Ember of Return (D133,
// GATES.autoEmberFirst), then one contract per zone for zones 1-3 by board order while points and slots last, then Field
// Draughts if the Reserve still holds; the rest kept as Reserve) and the hub contract from Reserve.
// M3 guided run (tutorial.js): a barred node is closed to the map policy (D138); while the guided zone's Roads are closed
// (D142) it walks to Gorrak once his node is open, before exploring further, and where it would leave while his node is
// still barred, to the nearest Quest or Grind node that plays the next script.
import {
  SPELL, TALENT, CONSUMABLE, AUTO_POTION_HP, AUTO_TONIC_STACKS, AUTO_MANA_POTION, AUTO_FOOD_HP,
  ENGINE_ASSUMPTION as EA, SPELL_BAR_SLOTS, ITEM_BAR_SLOTS, MAX_LEVEL, PET, ENGAGE_OPTION, ENGAGE_OPTIONS,
  ENGAGE_AUTO_LOOK, TIME_WALK, TIME_REST, TIME_VENDOR, TIME_TRAINER, EXPED_TIME_QUEST, GATES, PREP_OPTION,
} from '../constants.js';
import { hasSt, findSt, debuffStacks, isEliteOrBoss, petAlive } from './damage.js';
import { defaultTarget, breaksOnHit, allSapped } from './combat.js';
import { isEngageRound, turnOf } from './track.js';
import { engageAct, windupTurn } from './engage.js';
import { castError, itemUsableInCombat } from './spells.js';
import { itemScore, countConsumable, sellValue, canAdd, V, bagCapacity } from './items.js';
import { talentPointsFree } from './progress.js';
import { nextLanes, dungeonLevels } from './map.js';
import { checkAction } from './actions.js';
import { canTravel, exitLevel, trainerSpells, learnCost, trainerUseful, availablePets, canEnter } from './nodes.js';
import { isExpedition, grindMaxWaves, nodeTime, zoneTime, dimmedAt, outwardStep, dimFightTime } from './expedition.js';
import { takeContractError, buyPrepError, hubContractError, prepLeft } from './contracts.js';
import { closedRoadsGoal } from './tutorial.js';

const legal = (s, a) => !checkAction(s, a);

// ---------------- Combat policy (rules 7.9) ----------------
/** ">= N enemies" counts living enemies that are not HEXED or SAPPED (combat v2: SAPPED like HEXED). */
function livingCount(s) {
  return s.fight.enemies.filter((e) => e.alive && !breaksOnHit(e)).length;
}

function intentIsCast(e) {
  return !!(e && e.alive && e.intent && e.intent.cast && !e.intent.interrupted);
}

function highestHpNonFocus(s, focus) {
  let best = null;
  for (const e of s.fight.enemies) {
    if (!e.alive || e.idx === focus || breaksOnHit(e)) continue;
    if (!best || e.hp > best.hp) best = e;
  }
  return best ? best.idx : null;
}

/**
 * Autoplay condition of a bar spell (rules 5.3-5.6; talent spells: ENGINE_ASSUMPTION). Returns the target
 * (enemy index, or null for self/AoE spells) when the condition holds, undefined when it does not.
 */
function autoTarget(s, id, foc) {
  const f = s.fight;
  const p = s.player;
  const sp = SPELL[id];
  const e = foc === null ? null : f.enemies[foc];
  const hpF = p.hp / p.d.maxHp;
  const cp = f.p.cp;
  const n = livingCount(s);
  const elite = isEliteOrBoss(e);
  const tgtHp = e ? e.hp / e.maxHp : 1;
  const stacks = debuffStacks(f.p.st);
  const self = sp.target === 'enemy' ? foc : null;
  const ok = (c, t = self) => (c ? t : undefined);
  switch (id) {
    case 'gutting_jab': case 'ember_bolt': case 'keen_shot': case 'pyre_comet': case 'starlance_barrage':
    case 'heartseeker_shot': case 'glacier_spike': case 'starfall_arrow':
      return ok(true);
    case 'severing_flourish': return ok(cp >= sp.autoCp || (cp >= sp.autoCpLow && tgtHp < sp.autoLowHp));
    case 'shadowstep_strike': return ok(hasSt(f.p.st, 'STEALTH'));
    case 'throat_jab': case 'spellsnap': case 'muzzle_shot': return ok(intentIsCast(e));
    case 'open_vein': return ok(cp >= sp.autoCp && elite && !findSt(e.st, 'BLEED', 'open_vein'));
    case 'temple_blow': return ok(cp >= sp.autoCp && !!e && !!e.intent && (intentIsCast(e) || e.intent.heavy));
    case 'smoke_veil': return ok(hpF < sp.autoHp && (n >= sp.autoEnemies || elite));
    case 'whirling_edges': case 'rime_burst': case 'ricochet_bolt':
      if (id === 'rime_burst') return ok(n >= sp.autoEnemies || hpF < sp.autoHp);
      return ok(n >= sp.autoEnemies);
    case 'expose_weakness': return ok(cp >= sp.autoCp && elite && !hasSt(e.st, 'EXPOSED'));
    case 'adrenal_surge': return ok(f.p.energy < sp.autoEnergy);
    case 'vanishing_step': case 'glacial_tomb': case 'feign_stillness': return ok(hpF < sp.autoHp || stacks >= sp.autoStacks);
    case 'final_reckoning': return ok(tgtHp < sp.executeBelow && cp >= sp.autoCp);
    case 'thousand_cuts': return ok(cp <= EA.AUTO_THOUSAND_CUTS_CP_MAX);
    case 'ghostblade_rush': return ok(cp <= sp.autoCpMax);
    case 'rupture_venom': return ok(cp >= EA.AUTO_RUPTURE_CP);
    case 'bloodprice_gambit': return ok(hpF > sp.autoHp && elite);
    case 'frost_lance': return ok(!hasSt(e.st, 'CHILLED'));
    case 'arcane_ward': return ok(!hasSt(f.p.st, 'WARD'));
    case 'living_flame': return ok(tgtHp >= sp.autoTargetHp && !findSt(e.st, 'BURN', 'living_flame'));
    case 'barbed_arrow': return ok(tgtHp >= sp.autoTargetHp && !findSt(e.st, 'BLEED', 'barbed_arrow'));
    case 'hexbind': return n >= sp.autoEnemies ? ok(true, highestHpNonFocus(s, foc)) : undefined;
    case 'cinder_storm': case 'volley_rain': return ok(n >= sp.autoEnemies);
    case 'mana_siphon': return ok(p.mana < sp.autoMana * p.d.maxMana);
    case 'hourglass_reversal': return ok(p.mana < EA.AUTO_HOURGLASS_MANA * p.d.maxMana);
    case 'conflagrant_core': case 'rapid_volley': return ok(elite);
    case 'chrono_sigil': {
      const interruptReady = p.bar.some((x) => x && SPELL[x].tags.includes('interrupt') && !castError(s, x, foc));
      return ok(!!e && !!e.intent && (e.intent.heavy || intentIsCast(e)) && !interruptReady);
    }
    case 'mirrorshade': return ok(hpF < sp.autoHp);
    case 'mark_prey': return ok(elite && !hasSt(e.st, 'MARKED'));
    case 'mend_companion': return ok(!!p.pet && (!p.pet.alive || p.pet.hp < sp.autoPetHp * p.d.petMaxHp));
    case 'snare_trap':
      if (n >= sp.autoEnemies) return ok(true, highestHpNonFocus(s, foc));
      return ok(hpF < sp.autoHp);
    case 'field_dressing': return ok(hpF < sp.autoHp);
    case 'savage_order': return ok(petAlive(s));
    case 'wild_communion': return ok(petAlive(s) && elite);
    case 'deadfall_trap': return ok(n >= EA.AUTO_DEADFALL_ENEMIES || intentIsCast(e));
    case 'beastcall_horn': return ok(hpF < sp.autoHp);
    default: return undefined;
  }
}

const PRIORITY = { mender: 0, caster: 1 };
/** Rules 7.9 default-target order between two enemies: mender > caster > others, lower HP, lower index. */
function before(a, b) {
  const ra = a.arch in PRIORITY ? PRIORITY[a.arch] : 2;
  const rb = b.arch in PRIORITY ? PRIORITY[b.arch] : 2;
  return ra !== rb ? ra < rb : a.hp !== b.hp ? a.hp < b.hp : a.idx < b.idx;
}

/**
 * Rule E (rules 7.9, combat v2), engage round only: with at least 2 enemies and the class's control option usable,
 * control the enemy whose track shows the largest estimated damage on the player over its turns
 * 1..ENGAGE_AUTO_LOOK (ties: default-target order); otherwise the strike option on the default target (Mage:
 * Pre-cast of the first bar spell whose autoplay condition holds). The Rogue never uses Sap here: Sap stays a manual
 * option (D49), so its rule E is Ambush. null: no rule E action (rules 1-6 decide).
 */
function engagePolicy(s) {
  const f = s.fight;
  const p = s.player;
  const ids = ENGAGE_OPTIONS[p.classId];
  const control = ids.find((id) => ENGAGE_OPTION[id].kind === 'control');
  const strike = ids.find((id) => ENGAGE_OPTION[id].kind === 'strike');
  if (livingCount(s) >= 2 && control !== 'sap') {
    let best = null;
    let most = -1;
    for (const e of f.enemies) {
      if (!e.alive || !legal(s, engageAct(control, e.idx))) continue;
      let dmg = 0;
      for (const x of e.track) if (x.turn >= 1 && x.turn <= ENGAGE_AUTO_LOOK && (x.target === 'player' || x.target === 'all')) dmg += x.est;
      if (dmg > most || (dmg === most && before(e, best))) { best = e; most = dmg; }
    }
    if (best) return engageAct(control, best.idx);
  }
  const foc = defaultTarget(s);
  if (ENGAGE_OPTION[strike].target === 'spell') {
    for (const id of p.bar) {
      if (!id) continue;
      const t = autoTarget(s, id, foc);
      if (t === undefined || (SPELL[id].target === 'enemy' && t === null)) continue;
      const a = engageAct(strike, SPELL[id].target === 'enemy' ? t : null, id);
      if (legal(s, a)) return a;
    }
    return null;
  }
  const a = engageAct(strike, foc);
  return legal(s, a) ? a : null;
}

/** Variants whose first wind-up is a Deathblow (rules 7.12, M2b v13): rule E2 answers them. */
const SPECIAL = ['elite', 'rare', 'dboss'];

/**
 * Rule E2 (rules 7.9, M2b v13, D108), engage round only, before rule E: for each living elite, rare or dungeon boss in
 * index order whose track shows a wind-up in turns 1..INTENT_TRACK_LEN, the class's control option on it if that ENGAGE
 * is legal (on a dungeon boss it is Disrupt). The Rogue may Sap here: E2 supersedes D49 for this case (rule E keeps
 * D49). A lone elite counts. null: no E2 action (rule E decides). Exported for the UI's engage hint (answers.js).
 */
export function engageAnswer(s) {
  const f = s.fight;
  if (!isEngageRound(f)) return null;
  const control = ENGAGE_OPTIONS[s.player.classId].find((id) => ENGAGE_OPTION[id].kind === 'control');
  for (const e of f.enemies) {
    if (!e.alive || !SPECIAL.includes(e.kind) || !windupTurn(e)) continue;
    const a = engageAct(control, e.idx);
    if (legal(s, a)) return a;
  }
  return null;
}

/** A track entry is a wind-up whose cancel the track predicts by SAPPED (rules 7.11, D52): Sap will answer it. */
const sapCancels = (x) => !!(x.windup && x.cancel && x.cancel.by === 'SAPPED' && x.cancel.stagger);

/**
 * Rule H (rules 7.9, M2b v14 row 1 (a), D111), after rules 1-2 and before rule 3, not in the engage round: wait while
 * every living enemy is SAPPED and some SAPPED enemy's track shows, after its now-entry, a wind-up whose cancel the track
 * predicts by SAPPED (rules 7.11). Any damage would break Sap; the wait lets Sap cancel the wind-up (STAGGERED, rules
 * 7.12), and the PASS keeps STEALTH (rules 7.4). Any class with SAPPED enemies (today the Rogue). Off with GATES.sapHold.
 * Exported for the UI's answers (answers.js).
 */
export function sapWait(s) {
  const f = s.fight;
  if (!GATES.sapHold || !f || isEngageRound(f) || !allSapped(s)) return false;
  return f.enemies.some((e) => e.alive && e.track && e.track.some((x) => x.turn > turnOf(f, e) && sapCancels(x)));
}

function combatPolicy(s) {
  const f = s.fight;
  const p = s.player;
  if (f.p.skip) return { type: 'PASS' };
  // E2 (M2b v13), then E (combat v2), before rule 1, in the engage round only.
  if (isEngageRound(f)) {
    const eng = engageAnswer(s) || engagePolicy(s);
    if (eng) return eng;
  }
  const hpF = p.hp / p.d.maxHp;
  // 1. Healing item
  if (hpF < AUTO_POTION_HP) {
    for (let i = 0; i < ITEM_BAR_SLOTS; i++) {
      const id = p.itemBar[i];
      if (id && CONSUMABLE[id].heal && itemUsableInCombat(s, id)) return { type: 'USE_ITEM', slot: i, target: null };
    }
  }
  // 2. Cleanse (spell first, then Purifying Tonic)
  if (debuffStacks(f.p.st) >= AUTO_TONIC_STACKS) {
    for (const id of p.bar) if (id && SPELL[id].tags.includes('cleanse') && !castError(s, id, null)) return { type: 'CAST', spellId: id, target: null };
    for (let i = 0; i < ITEM_BAR_SLOTS; i++) {
      const id = p.itemBar[i];
      if (id && CONSUMABLE[id].dispersal && itemUsableInCombat(s, id)) return { type: 'USE_ITEM', slot: i, target: null };
    }
  }
  // H (M2b v14, D111): wait in the shadows while Sap will cancel a wind-up.
  if (sapWait(s)) return { type: 'PASS' };
  // 3. Interrupt the cast with the highest estimated damage (ties: lowest index)
  const casts = f.enemies.filter(intentIsCast).sort((a, b) => b.intent.est - a.intent.est || a.idx - b.idx);
  for (const e of casts) {
    for (const id of p.bar) {
      if (!id) continue;
      const tags = SPELL[id].tags;
      if (!tags.includes('interrupt') && !tags.includes('stun')) continue;
      const t = SPELL[id].target === 'enemy' ? e.idx : null;
      if (!castError(s, id, t)) return { type: 'CAST', spellId: id, target: t };
    }
  }
  // 4. Mana Draught
  if (p.d.maxMana && p.mana < AUTO_MANA_POTION * p.d.maxMana) {
    for (let i = 0; i < ITEM_BAR_SLOTS; i++) {
      const id = p.itemBar[i];
      if (id && CONSUMABLE[id].mana && itemUsableInCombat(s, id)) return { type: 'USE_ITEM', slot: i, target: null };
    }
  }
  // 5. Bar slots in order
  const foc = defaultTarget(s);
  for (const id of p.bar) {
    if (!id) continue;
    const t = autoTarget(s, id, foc);
    if (t === undefined) continue;
    if (SPELL[id].target === 'enemy' && t === null) continue;
    if (!castError(s, id, t)) return { type: 'CAST', spellId: id, target: t };
  }
  // 6. Basic attack
  return { type: 'ATTACK', target: foc };
}

// ---------------- Default out-of-combat policy ----------------
function talentOrder(cls, tree) {
  return Object.values(TALENT).filter((t) => t.cls === cls && t.tree === tree)
    .sort((a, b) => a.tier - b.tier || b.ranks - a.ranks || (a.id < b.id ? -1 : 1)).map((t) => t.id);
}

/** Standard build (balance.md 1.3): capstone of the main tree first, then the other two trees alternately. */
function nextTalent(s) {
  const p = s.player;
  const main = EA.AUTO_TREE[p.classId];
  const others = [0, 1, 2].filter((t) => t !== main);
  const mainOrder = talentOrder(p.classId, main);
  const cap = mainOrder.find((id) => TALENT[id].tier === 5);
  const try1 = (id) => legal(s, { type: 'SPEND_TALENT', talentId: id });
  if (!p.talents[cap]) {
    if (try1(cap)) return cap;
    for (const id of mainOrder) if (try1(id)) return id;
  }
  let outside = 0;
  for (const [id, r] of Object.entries(p.talents)) if (TALENT[id].tree !== main) outside += r;
  const seq = outside % 2 === 0 ? [others[0], others[1]] : [others[1], others[0]];
  for (const tree of seq) for (const id of talentOrder(p.classId, tree)) if (try1(id)) return id;
  for (const id of mainOrder) if (try1(id)) return id;
  return null;
}

function desiredBar(s) {
  const p = s.player;
  let pick = EA.AUTO_PICK[p.classId];
  // At the Camp the boss bar puts interrupt and cleanse first (balance.md 1.2).
  if (s.phase === 'CAMP') {
    const key = pick.filter((id) => SPELL[id].tags.includes('interrupt') || SPELL[id].tags.includes('cleanse'));
    pick = [...key, ...pick.filter((id) => !key.includes(id))];
  }
  const known = pick.filter((id) => p.spells[id]).slice(0, SPELL_BAR_SLOTS);
  const ordered = EA.AUTO_BAR_ORDER[p.classId].filter((id) => known.includes(id));
  while (ordered.length < SPELL_BAR_SLOTS) ordered.push(null);
  return ordered;
}

function desiredItemBar(s) {
  const heal = countConsumable(s, 'greater_healing_draught') > 0 ? 'greater_healing_draught' : 'healing_draught';
  return s.player.classId === 'mage' ? [heal, 'mana_draught', 'purifying_tonic'] : [heal, 'purifying_tonic', 'spark_flask'];
}

function bestUpgrade(s, pool) {
  const p = s.player;
  let best = null;
  let gain = 0;
  for (const it of pool) {
    if (it.kind !== 'gear') continue;
    const g = itemScore(it, p.classId) - itemScore(p.equipped[it.slot], p.classId);
    if (g > gain) { gain = g; best = it; }
  }
  return best;
}

function oocPolicy(s) {
  const p = s.player;
  if (talentPointsFree(s) > 0) {
    const t = nextTalent(s);
    if (t) return { type: 'SPEND_TALENT', talentId: t };
  }
  const up = bestUpgrade(s, p.bag);
  if (up) return { type: 'EQUIP', itemId: up.uid };
  const bar = desiredBar(s);
  for (let i = 0; i < SPELL_BAR_SLOTS; i++) if (p.bar[i] !== bar[i]) return { type: 'SET_BAR', slot: i, spellId: bar[i] };
  const ib = desiredItemBar(s);
  for (let i = 0; i < ITEM_BAR_SLOTS; i++) if (p.itemBar[i] !== ib[i]) return { type: 'SET_ITEM_BAR', slot: i, itemId: ib[i] };
  const low = p.hp < AUTO_FOOD_HP * p.d.maxHp || (p.d.maxMana > 0 && p.mana < AUTO_FOOD_HP * p.d.maxMana);
  if (low && countConsumable(s, 'trail_rations') > 0) return { type: 'USE_ITEM', itemId: 'trail_rations' };
  if (p.hp < AUTO_POTION_HP * p.d.maxHp) {
    for (const id of ['greater_healing_draught', 'healing_draught']) if (countConsumable(s, id) > 0) return { type: 'USE_ITEM', itemId: id };
  }
  return null;
}

function lootPolicy(s) {
  const p = s.player;
  const up = bestUpgrade(s, s.loot);
  if (up) return { type: 'EQUIP', itemId: up.uid };
  for (const it of s.loot) if (canAdd(s, it)) return { type: 'LOOT_TAKE', itemId: it.uid };
  // Discard the lowest sell-value non-consumable, junk first (rules 8.7).
  const cands = [...s.loot.map((it) => ({ it, where: 'loot' })), ...p.bag.map((it) => ({ it, where: 'bag' }))]
    .filter((x) => x.it.kind !== 'cons' || x.where === 'loot');
  cands.sort((a, b) => (a.it.kind === 'junk' ? 0 : 1) - (b.it.kind === 'junk' ? 0 : 1) || sellValue(s, a.it) - sellValue(s, b.it) || (a.where === 'loot' ? -1 : 1));
  const x = cands[0];
  return x.where === 'loot' ? { type: 'LOOT_DROP', itemId: x.it.uid } : { type: 'DISCARD', itemId: x.it.uid };
}

function reserve(s) {
  return EA.AUTO_GOLD_RESERVE_V * V(s.player.level);
}

function trainerPolicy(s) {
  const learn = trainerSpells(s).filter((id) => legal(s, { type: 'LEARN', spellId: id }))
    .sort((a, b) => learnCost(s, a) - learnCost(s, b) || (a < b ? -1 : 1));
  if (learn.length) return { type: 'LEARN', spellId: learn[0] };
  if (legal(s, { type: 'TRAIN_ALL' })) return { type: 'TRAIN_ALL' };
  return { type: 'LEAVE' };
}

function vendorPolicy(s) {
  const p = s.player;
  if (p.bag.some((x) => x.kind === 'junk')) return { type: 'SELL_JUNK' };
  for (const it of p.bag) {
    if (it.kind === 'gear' && itemScore(it, p.classId) <= itemScore(p.equipped[it.slot], p.classId)) return { type: 'SELL', itemId: it.uid };
  }
  const stock = s.service.stock;
  const canBuy = (i) => legal(s, { type: 'BUY', index: i }) && p.gold - stock[i].price >= reserve(s);
  const want = [
    ['healing_draught', EA.AUTO_POTION_STOCK],
    ...(p.classId === 'mage' ? [['mana_draught', EA.AUTO_MANA_STOCK]] : []),
    ...(s.phase === 'CAMP' ? [['purifying_tonic', EA.AUTO_TONIC_STOCK]] : []),
    ['trail_rations', EA.AUTO_RATION_STOCK],
    ['ember_of_return', 1],
  ];
  for (const [id, n] of want) {
    const i = stock.findIndex((e) => e.kind === 'cons' && e.id === id);
    if (i >= 0 && countConsumable(s, id) < n && canBuy(i)) return { type: 'BUY', index: i };
  }
  for (let i = 0; i < stock.length; i++) {
    const e = stock[i];
    if (e.kind === 'gear' && !e.sold && itemScore(e.item, p.classId) > itemScore(p.equipped[e.item.slot], p.classId) && canBuy(i)) return { type: 'BUY', index: i };
  }
  return { type: 'LEAVE' };
}

/**
 * Default start camp (prep, expedition.md 2; engine default, not a bot). With GATES.autoEmberFirst on (D133): the Ember of
 * Return when affordable; then, in board order, one contract for each of zones 1..EA.AUTO_PREP_ZONES not yet covered,
 * while points last with EA.AUTO_PREP_RESERVE points kept back for a hub contract; then Field Draughts when the Reserve
 * still holds after it; then SET_OUT. Off: the order before D133, Field Draughts first, then the contracts.
 */
function prepPolicy(s) {
  const emberFirst = GATES.autoEmberFirst;
  if (emberFirst) {
    if (!buyPrepError(s, 'prep_ember')) return { type: 'BUY_PREP', id: 'prep_ember' };
  } else if (!buyPrepError(s, 'prep_draughts')) return { type: 'BUY_PREP', id: 'prep_draughts' };
  const left = prepLeft(s);
  const covered = new Set(s.prep.board.filter((o) => o.taken).map((o) => o.z));
  for (const o of s.prep.board) {
    if (o.z > EA.AUTO_PREP_ZONES || covered.has(o.z) || left - o.price < EA.AUTO_PREP_RESERVE) continue;
    if (!takeContractError(s, o.index)) return { type: 'TAKE_CONTRACT', index: o.index };
  }
  if (emberFirst && !buyPrepError(s, 'prep_draughts') && left - PREP_OPTION.prep_draughts.price >= EA.AUTO_PREP_RESERVE) {
    return { type: 'BUY_PREP', id: 'prep_draughts' };
  }
  return { type: 'SET_OUT' };
}

function hubPolicy(s, leave) {
  const p = s.player;
  const u = s.hub.used;
  // The hub contract (expedition.md 3.6): from Reserve when a slot is free.
  if (s.phase === 'ZONE_HUB' && isExpedition(s) && !hubContractError(s, { mode: 'reserve' })) return { type: 'TAKE_HUB_CONTRACT', mode: 'reserve' };
  // Expedition (rules 1.9.9): a service only when the hub stays out of the Dimming and a clean way to a Road remains.
  const ok = (h) => s.phase !== 'ZONE_HUB' || !isExpedition(s) || expSafe(s, s.zone.pos, zoneTime(s) + h);
  if (!u.trainer && trainerUseful(s) && ok(TIME_TRAINER)) return { type: 'SERVICE', service: 'trainer' };
  if (!u.vendor && (p.bag.some((x) => x.kind !== 'cons') || countConsumable(s, 'healing_draught') < EA.AUTO_POTION_STOCK) && ok(TIME_VENDOR)) return { type: 'SERVICE', service: 'vendor' };
  if (!u.inn && p.hp < EA.AUTO_INN_HP * p.d.maxHp && ok(TIME_REST)) return { type: 'SERVICE', service: 'inn' };
  return leave;
}

function nodeScore(s, node) {
  const p = s.player;
  const S = EA.AUTO_NODE_SCORE;
  const hpF = p.hp / p.d.maxHp;
  switch (node.type) {
    case 'rest': return hpF < EA.AUTO_REST_HP ? S.restLow : S.rest;
    case 'quest': return S.quest;
    case 'dungeon': return hpF >= EA.AUTO_DUNGEON_HP && p.level >= dungeonLevels(s.zone.z).trash - EA.AUTO_DUNGEON_LEVEL_SLACK ? S.dungeon : S.risky;
    case 'elite': return hpF >= EA.AUTO_ELITE_HP && p.level >= node.eliteLevel - EA.AUTO_ELITE_LEVEL_SLACK ? S.elite : S.risky;
    case 'grind': return S.grind;
    case 'shrine': return S.shrine;
    case 'treasure': return S.treasure;
    case 'vendor': return countConsumable(s, 'healing_draught') < EA.AUTO_POTION_STOCK || bagCapacity(s) - p.bag.length <= EA.AUTO_BAG_FREE_MIN ? S.vendorNeed : S.vendor;
    case 'trainer': return trainerUseful(s) ? S.trainerNeed : S.trainer;
    default: return 0;
  }
}

// ---------------- Expedition map policy (rules 1.9.9) ----------------
/**
 * Cheapest way from node `from` at zone time zt to a Road: Dijkstra over steps of TIME_WALK; a step onto a node that
 * is Dimmed on arrival also costs its Dimmed encounter and counts as a Dimmed step. Order: Dimmed steps, tolls, lower id.
 * The encounter's tolls as the engine spends them (M2b v12, D101): TIME_DIM_ESCAPE when the step is a walk (MOVE: the
 * node is resolved, the hub or Dimmed when the step starts; the policy passes through every other node) farther from
 * the Shardfall, else TIME_DIM_FIGHT. Every node dims by its hops (M2b v12: the Dungeon's hold removed), which the
 * player sees. Returns { road, path (from `from` to the Road), dims, time }. `targets` (M3 guided run, D142): other
 * nodes to reach in place of the Roads; `road` is then the target reached, and the result null when none can be.
 */
function escapeRoute(s, from, zt, targets = s.zone.roads) {
  const zone = s.zone;
  const N = zone.nodes.length;
  const lab = new Array(N).fill(null);
  const prev = new Array(N).fill(-1);
  const done = new Array(N).fill(false);
  const better = (a, b) => !b || a.dims < b.dims || (a.dims === b.dims && a.h < b.h);
  lab[from] = { dims: 0, h: 0 };
  for (;;) {
    let u = -1;
    for (let i = 0; i < N; i++) if (!done[i] && lab[i] && (u < 0 || better(lab[i], lab[u]))) u = i;
    if (u < 0) break;
    done[u] = true;
    for (const v of zone.nodes[u].nb) {
      if (done[v] || zone.nodes[v].barred) continue; // M3: a barred node (Gorrak's in a guided run, D138) is closed
      const t0 = zt + lab[u].h;
      let h = lab[u].h + TIME_WALK;
      const dim = dimmedAt(zone, v, zt + h);
      if (dim) {
        const nv = zone.nodes[v];
        const walk = nv.done || nv.ring === 0 || dimmedAt(zone, v, t0);
        h += dimFightTime(walk && outwardStep(zone, u, v));
      }
      const c = { dims: lab[u].dims + (dim ? 1 : 0), h };
      if (better(c, lab[v])) { lab[v] = c; prev[v] = u; }
    }
  }
  let road = null;
  for (const r of targets) if (lab[r] && (road === null || better(lab[r], lab[road]) || (!better(lab[road], lab[r]) && r < road))) road = r;
  if (road === null) return null;
  const path = [];
  for (let x = road; x !== -1; x = prev[x]) path.unshift(x);
  return { road, path, dims: lab[road].dims, time: lab[road].h };
}

/** Node id is out of the Dimming at zone time zt and a Road can be reached from it without a Dimmed step. */
function expSafe(s, id, zt) {
  return !dimmedAt(s.zone, id, zt) && escapeRoute(s, id, zt).dims === 0;
}

/**
 * Score of entering seen node id at zone time zt (the default node score), or null when the policy would not: resolved,
 * the hub, Dimmed, Dimmed before its content ends, risky, or no clean way to a Road afterwards.
 */
function expScore(s, id, zt) {
  const zone = s.zone;
  const n = zone.nodes[id];
  if (!zone.seen[id] || n.done || n.ring === 0 || n.barred || dimmedAt(zone, id, zt)) return null;
  const sc = nodeScore(s, n);
  if (sc <= EA.AUTO_NODE_SCORE.risky) return null;
  return expSafe(s, id, zt + nodeTime(s, n.type)) ? sc : null;
}

/** Walk (MOVE) or pass through (PASS_THROUGH) to adjacent node id: an unresolved node in transit is passed. */
const stepAction = (s, id) => (canEnter(s, id) ? { type: 'PASS_THROUGH', nodeId: id } : { type: 'MOVE', nodeId: id });

/**
 * First step towards the nearest node worth exploring: BFS over nodes out of the Dimming on arrival; a seen target
 * must score (expScore), an unseen one must leave a clean way out after a quest's tolls. null: nothing left.
 */
function exploreStep(s, zt) {
  const zone = s.zone;
  const N = zone.nodes.length;
  const dist = new Array(N).fill(-1);
  const prev = new Array(N).fill(-1);
  dist[zone.pos] = 0;
  const q = [zone.pos];
  for (let i = 0; i < q.length; i++) {
    const u = q[i];
    for (const v of zone.nodes[u].nb) {
      if (dist[v] >= 0 || zone.nodes[v].barred || dimmedAt(zone, v, zt + (dist[u] + 1) * TIME_WALK)) continue;
      dist[v] = dist[u] + 1;
      prev[v] = u;
      q.push(v);
    }
  }
  for (const t of q) {
    if (t === zone.pos) continue;
    const n = zone.nodes[t];
    const at = zt + dist[t] * TIME_WALK;
    const ok = zone.seen[t] ? expScore(s, t, at) !== null : expSafe(s, t, at + EXPED_TIME_QUEST);
    if (!ok || n.done || n.ring === 0) continue;
    let x = t;
    while (prev[x] !== zone.pos) x = prev[x];
    return x;
  }
  return null;
}

/**
 * M3 guided run (D142): one step towards the nearest of `nodes` (escapeRoute over them: fewest Dimmed steps, then tolls),
 * MOVE onto it at the end (entering it: Gorrak's fight or a scripted fight). Standing on the only one (passed through):
 * step off to a neighbour that is not barred, to come back.
 */
function goalStep(s, zt, nodes) {
  const zone = s.zone;
  const go = escapeRoute(s, zone.pos, zt, nodes.filter((id) => id !== zone.pos));
  if (!go) return stepAction(s, zone.nodes[zone.pos].nb.find((id) => !zone.nodes[id].barred));
  return go.path.length === 2 ? { type: 'MOVE', nodeId: go.path[1] } : stepAction(s, go.path[1]);
}

/**
 * Default map policy of an expedition run (rules 1.9.9). Leave when the level reaches the zone's exit level or the
 * cheapest way to a Road already crosses the Dimming; otherwise enter the best adjacent node that scores, else step
 * towards the nearest node worth exploring, else leave. Leaving: TAKE_ROAD on the Road; the Bell when the way out
 * crosses the Dimming and a charge is left; else the next step of the cheapest way. M3 guided run (D142): while the
 * guided zone's Roads are closed, Gorrak's open node comes first (goalStep, before exploring), and where the policy
 * would leave while his node is still barred it goes to the nearest node that plays the next script instead.
 */
function expMapPolicy(s) {
  const zone = s.zone;
  const p = s.player;
  if (p.hp < EA.AUTO_TOPUP_HP * p.d.maxHp && countConsumable(s, 'trail_rations') > 0) return { type: 'USE_ITEM', itemId: 'trail_rations' };
  const zt = zoneTime(s);
  const goal = closedRoadsGoal(s);
  if (goal && goal.elite) return goalStep(s, zt, goal.nodes);
  const esc = escapeRoute(s, zone.pos, zt);
  if (p.level < exitLevel(zone.z) && esc.dims === 0) {
    let best = null;
    let bs = -Infinity;
    for (const id of zone.nodes[zone.pos].nb) {
      const sc = expScore(s, id, zt);
      if (sc !== null && sc > bs) { bs = sc; best = id; }
    }
    if (best !== null) return { type: 'MOVE', nodeId: best };
    const next = exploreStep(s, zt);
    if (next !== null) return stepAction(s, next);
  }
  if (goal) return goalStep(s, zt, goal.nodes);
  if (esc.path.length === 1) return { type: 'TAKE_ROAD' };
  if (esc.dims > 0 && s.exp.bell > 0) return { type: 'RING_BELL' };
  return stepAction(s, esc.path[1]);
}

function mapPolicy(s) {
  if (isExpedition(s)) return expMapPolicy(s);
  const z = s.zone;
  const p = s.player;
  if (p.hp < EA.AUTO_TOPUP_HP * p.d.maxHp && countConsumable(s, 'trail_rations') > 0) return { type: 'USE_ITEM', itemId: 'trail_rations' };
  if (canTravel(s) && (s.player.level >= exitLevel(z.z) || z.pos.r >= z.rows.length)) return { type: 'TRAVEL_ON' };
  let best = null;
  let bs = -Infinity;
  for (const l of nextLanes(z)) {
    const sc = nodeScore(s, z.rows[z.pos.r][l]);
    if (sc > bs) { bs = sc; best = l; }
  }
  if (best === null) return { type: 'TRAVEL_ON' };
  return { type: 'CHOOSE_NODE', lane: best };
}

function rewardPolicy(s) {
  const set = s.node.rewards[0];
  if (set.kind === 'items') {
    let bi = 0;
    for (let i = 1; i < set.items.length; i++) if (itemScore(set.items[i], s.player.classId) > itemScore(set.items[bi], s.player.classId)) bi = i;
    return { type: 'CHOOSE_REWARD', index: bi };
  }
  const p = s.player;
  const order = p.hp < AUTO_FOOD_HP * p.d.maxHp ? ['mending', ...EA.AUTO_BOON_ORDER] : EA.AUTO_BOON_ORDER;
  for (const b of order) { const i = set.boons.indexOf(b); if (i >= 0) return { type: 'CHOOSE_REWARD', index: i }; }
  return { type: 'CHOOSE_REWARD', index: 0 };
}

function nodePolicy(s) {
  const n = s.node;
  const p = s.player;
  if (n.stage === 'grindSetup') return { type: 'GRIND_SET_WAVES', n: Math.min(EA.AUTO_GRIND_WAVES, grindMaxWaves(s)) };
  if (n.stage === 'reward') return rewardPolicy(s);
  if (n.stage === 'between') {
    const hpF = p.hp / p.d.maxHp;
    if (n.type === 'grind') return hpF < EA.AUTO_GRIND_STOP_HP ? { type: 'GRIND_STOP' } : { type: 'NEXT_FIGHT' };
    return hpF < EA.AUTO_LEAVE_DUNGEON_HP ? { type: 'DUNGEON_LEAVE' } : { type: 'NEXT_FIGHT' };
  }
  return null;
}

function campPolicy(s) {
  const p = s.player;
  const hub = hubPolicy(s, null);
  if (hub && hub.service !== 'inn') return hub;
  if (p.level < MAX_LEVEL) return { type: 'CAMP_GRIND' };
  if (!s.hub.used.inn && p.hp < p.d.maxHp) return { type: 'SERVICE', service: 'inn' };
  if (countConsumable(s, 'elixir_ferocity') > 0 && !p.buffs.elixir) return { type: 'USE_ITEM', itemId: 'elixir_ferocity' };
  return { type: 'FIGHT_BOSS' };
}

/** The action the autoplay policy takes in this state (deterministic). null only when the run has ended. */
export function autoAction(s) {
  if (s.phase === 'ENDED') return null;
  if (s.phase === 'SUMMARY') return { type: 'END_RUN' };
  if (s.phase === 'CREATE') {
    if (!s.create.classId) return { type: 'SELECT_CLASS', classId: 'rogue' };
    if (s.create.classId === 'hunter' && !s.create.petId) return { type: 'SELECT_PET', petId: availablePets(s.profile)[0] || Object.keys(PET)[0] };
    return { type: 'START_RUN' };
  }
  if (s.phase === 'PREP') return prepPolicy(s);
  if (s.fight) return combatPolicy(s);
  if (s.loot.length) return lootPolicy(s);
  const ooc = oocPolicy(s);
  if (ooc) return ooc;
  if (s.service) return s.service.kind === 'trainer' ? trainerPolicy(s) : vendorPolicy(s);
  if (s.phase === 'ZONE_HUB') return hubPolicy(s, { type: 'LEAVE_HUB' });
  if (s.phase === 'MAP') return mapPolicy(s);
  if (s.phase === 'NODE') return nodePolicy(s);
  if (s.phase === 'CAMP') return campPolicy(s);
  return null;
}

// The default build, bar and item bar, also used by the dev tools to equip a character they build (engine-api.md 12).
export { autoTarget, nextTalent, desiredBar, desiredItemBar };
