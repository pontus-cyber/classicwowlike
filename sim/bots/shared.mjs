// Shared parts of the greedy, planner, speedrunner and tactician bots (balance.md 1): standard build (1.3),
// bar template (1.2), consumable kit, trainer and vendor, rewards, node stages, camp. Each bot file adds its map
// decision, grind waves, hub rule and (tactician) combat search.
import { C, R, SPELL, countCons, hpFrac, manaFrac, legal } from '../lib/engine.mjs';
import { BAL, SIM } from '../lib/params.mjs';
import { vAt } from '../lib/model.mjs';
import {
  makeBot, standardTalent, templateBar, desiredItemBar, foodAction, trainAllAction, vendorAction, rewardAction,
  betweenAction, campAction, trainerUseful,
} from '../lib/policy.mjs';

/** Spells kept off the bar by the B26-B28 variants. */
export function excludedSpells(classId, variant) {
  const ex = new Set();
  if (!variant) return ex;
  for (const sp of Object.values(SPELL)) {
    if (sp.cls !== classId) continue;
    if (variant === 'noInterrupt' && sp.tags.includes('interrupt')) ex.add(sp.id);
    if (variant === 'noCleanse' && sp.tags.includes('cleanse')) ex.add(sp.id);
    if (variant === 'noAoe' && sp.tags.includes('aoe')) ex.add(sp.id);
  }
  return ex;
}

/**
 * cfg: { tree, variant, style, campBar (bool), kit: {potions, rations, mana, tonics, elixir, ember, gear},
 *        hub(s, base) -> action, map(s) -> action, grindWaves(s) -> n, combat(s) -> action, trainerNodes (bool) }
 */
export function createValueBot(name, cfg) {
  const exclude = excludedSpells(cfg.classId, cfg.variant);
  const noTonic = cfg.variant === 'noCleanse';
  const kitAt = (s) => ({
    potions: cfg.kit.potions, rations: cfg.kit.rations, mana: cfg.kit.mana,
    tonics: s.phase === 'CAMP' && !noTonic ? cfg.kit.tonics : 0,
    elixir: s.phase === 'CAMP' ? cfg.kit.elixir : 0,
    ember: cfg.kit.ember, gear: cfg.kit.gear,
  });
  return makeBot({
    name,
    combat: cfg.combat || ((s) => R.autoAction(s)),
    talent: (s) => standardTalent(s, cfg.tree),
    bar: (s) => templateBar(s, { camp: cfg.campBar && s.phase === 'CAMP', exclude }),
    itemBar: (s) => desiredItemBar(s, { noTonic }),
    food: (s) => foodAction(s, SIM.FOOD_HP),
    trainer: (s) => trainAllAction(s),
    vendor: (s) => vendorAction(s, kitAt(s), vAt),
    hub: (s) => cfg.hub(s),
    map: (s) => cfg.map(s),
    grindWaves: (s) => cfg.grindWaves(s),
    reward: rewardAction,
    between: betweenAction,
    camp: (s) => campAction(s),
  });
}

/** Hub for greedy, planner and tactician: trainer when useful, vendor, then the Inn when `inn(s)` says so. */
export function hubFull(s, inn) {
  const u = s.hub.used;
  if (!u.trainer && trainerUseful(s)) return { type: 'SERVICE', service: 'trainer' };
  if (!u.vendor) return { type: 'SERVICE', service: 'vendor' };
  if (!u.inn && inn(s)) return { type: 'SERVICE', service: 'inn' };
  return { type: 'LEAVE_HUB' };
}

export const FULL_KIT = { potions: BAL.HEAL_STOCK_TARGET, rations: SIM.RATION_STOCK, mana: SIM.MANA_STOCK, tonics: SIM.TONIC_STOCK_CAMP, elixir: SIM.ELIXIR_STOCK_CAMP, ember: false, gear: true };

export { countCons, hpFrac, manaFrac, legal };
