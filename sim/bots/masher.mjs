// masher bot (combat-v2.md 11): the planner for everything outside combat; in combat it "rushes in and mashes"
// [stated: docs/feedback/2026-11-10-1043-owner.md]. Engage round: the class's strike option on the default target.
// Every other turn: a healing item when HP < AUTO_POTION_HP; else the usable bar spell with the highest damage
// amount (spellInfo, kind 'damage': amount × hits; AoE × living enemies) on the default target; else the basic
// attack. It never reads intents or the track (qa/sim/combat2.test.mjs). Manual time profile.
// Reading [assumption, as the designer's scratch masher]: only direct damage counts as "damage amount" (DOT spells
// show a per-tick number); ties go to the first spell in bar order.
import { C, R } from '../lib/engine.mjs';
import { defaultTarget, engageActions, engageId, engageKind } from '../lib/view.mjs';
import { createPlannerBot } from './planner.mjs';

/** Direct damage of a spell from its tooltip (spellInfo): amount × hits for kind 'damage', else 0. */
export function directDamage(s, id) {
  const info = R.spellInfo(s, id);
  const a = info && info.amount;
  return a && a.kind === 'damage' ? a.amount * (a.hits || 1) : 0;
}

/** The first usable healing item on the item bar, or null. */
export function healItem(s) {
  for (let i = 0; i < C.ITEM_BAR_SLOTS; i++) {
    const id = s.player.itemBar[i];
    if (!id || !C.CONSUMABLE[id] || !C.CONSUMABLE[id].heal) continue;
    const a = { type: 'USE_ITEM', slot: i, target: null };
    if (R.isLegal(s, a)) return a;
  }
  return null;
}

/** The masher's engage: the strike option on the default target (the highest-damage spell when it names one). */
function mashEngage(s, tgt) {
  let best = null;
  for (const a of engageActions(s)) {
    if (engageKind(engageId(a)) !== 'strike') continue;
    if (typeof a.target === 'number' && a.target !== tgt) continue;
    const d = a.spellId ? directDamage(s, a.spellId) : 0;
    if (!best || d > best.d) best = { a, d };
  }
  return best ? best.a : null;
}

/** One combat turn of the masher. */
export function mashChoice(s) {
  const f = s.fight;
  if (f.p.skip) return { type: 'PASS' };
  const tgt = defaultTarget(s);
  const eng = mashEngage(s, tgt);
  if (eng) return eng;
  if (s.player.hp < C.AUTO_POTION_HP * s.player.d.maxHp) {
    const h = healItem(s);
    if (h) return h;
  }
  const living = f.enemies.filter((e) => e.alive).length;
  let best = null;
  for (const id of s.player.bar) {
    if (!id) continue;
    const sp = C.SPELL[id];
    const a = { type: 'CAST', spellId: id, target: sp.target === 'enemy' ? tgt : null };
    const d = directDamage(s, id) * (sp.target === 'all' ? living : 1);
    if (d <= 0 || (best && d <= best.d) || !R.isLegal(s, a)) continue;
    best = { a, d };
  }
  if (best) return best.a;
  const atk = { type: 'ATTACK', target: tgt };
  return R.isLegal(s, atk) ? atk : R.autoAction(s);
}

export function createMasherBot(opts) {
  return createPlannerBot({ ...opts, name: 'masher', combat: (s) => mashChoice(s) });
}
