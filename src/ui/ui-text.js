// Display text for tooltips and screens (descriptions of spells, talents, statuses, consumables,
// boons and classes). Wording follows docs/specs/rules.md; numbers that matter come from the
// engine at run time. CONTENT.texts (src/content) overrides any line when it provides one.
import { SPELLS, TALENTS, STATUS_INFO as BASE_STATUS, CONSUMABLES, BOONS, CLASSES, PETS } from './mock-data.js';

export const STATUS_INFO = {
  ...BASE_STATUS,
  BRACE: { name: 'Braced', debuff: false, text: 'Takes 50 % less damage.' },
  ADRENAL: { name: 'Adrenal Surge', debuff: false, text: 'Energy regeneration doubled.' },
  CONFLAGRANT: { name: 'Conflagrant Core', debuff: false, text: 'Fire spells cost nothing and crit more often.' },
  MIRROR: { name: 'Mirrorshade', debuff: false, text: 'Attacks may strike an image instead of you.' },
  FEIGN: { name: 'Feigning', debuff: false, text: 'Enemies attack your pet instead.' },
  COMMUNION: { name: 'Wild Communion', debuff: false, text: 'Your pet deals more damage and taunts.' },
};

export const CLASS_UI = Object.fromEntries(Object.values(CLASSES).map((c) => [c.id, { color: c.color, role: c.role, blurb: c.blurb }]));

/**
 * Description of a spell. `sp` is the engine's spell entry (R.C.SPELL[id]); a spell with a bounce rule (Ricochet Bolt,
 * M2 v3) is described from its own numbers, never from the mock's text.
 */
export function spellText(id, content, sp = null) {
  const t = content && content.texts && content.texts.spells && content.texts.spells[id];
  if (t) return t;
  if (sp && sp.bounces) return bounceText(sp);
  return (SPELLS[id] && SPELLS[id].text) || '';
}
/** Ricochet Bolt (M2 v3): the target, then up to `bounces` other enemies for `bounceFrac` of the damage. */
export function bounceText(sp) {
  return `Hits the target, then up to ${numWord(sp.bounces)} other ${plural(sp.bounces, 'enemy', 'enemies')} for ${pct(sp.bounceFrac)} of the damage.`;
}
export function talentText(id, content) {
  const t = content && content.texts && content.texts.talents && content.texts.talents[id];
  return t || (TALENTS[id] && TALENTS[id].text) || '';
}
export function consumableText(id, content) {
  const t = content && content.texts && content.texts.consumables && content.texts.consumables[id];
  return t || (CONSUMABLES[id] && CONSUMABLES[id].text) || '';
}
export function boonText(id, content) {
  const t = content && content.texts && content.texts.boons && content.texts.boons[id];
  return t || (BOONS[id] && BOONS[id].text) || '';
}
export function petText(id, content) {
  const t = content && content.texts && content.texts.pets && content.texts.pets[id];
  return t || (PETS[id] && PETS[id].text) || '';
}
export const UNIQUE_EFFECT_TEXT = {
  proc: 'Equip: your hits sometimes release a burst of magic damage.',
  healOnKill: 'Equip: heal a little each time you kill an enemy.',
  eliteDmg: 'Equip: more damage against elites and bosses.',
  potion: 'Equip: potions heal more.',
  ward: 'Equip: begin each fight behind a small ward.',
};
export const ECHO_LINE = {
  levels: 'Levels gained', zones: 'Zones completed', dungeons: 'Dungeons cleared', elites: 'Elites slain', rares: 'Rares slain',
  quests: 'Quests completed', bossReached: 'Reached the boss', bossPhases: 'Boss phases reached', bossKill: 'Oruvath defeated',
  speed: 'Swift victory', firstKill: 'First kill with this class',
};
export const humanize = (id) => String(id || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
/** A small count in words ("three"), larger ones as digits. */
export const numWord = (n) => WORDS[n] || String(n);
export const plural = (n, one, many = `${one}s`) => (n === 1 ? one : many);
const pct = (x) => `${Math.round(x * 100)} %`;
/** A share in per cent with up to one decimal ("12.5 %", "25 %"). */
export const pct1 = (x) => `${Math.round(x * 1000) / 10} %`;

/** Resurrect sources of the view (player.resurrect): Second Breath is 'meta' (rules 9). */
export const RES_NAME = { boon: 'Boon of Return', meta: 'Second Breath', ember: 'Ember of Return' };
/**
 * Resurrect charges in words (rules 9, M2 v3). `p.resurrect` lists what a death would use now, in order (the engine's
 * resurrectCharges().now); `p.resurrectHeld` counts the charges held. In the end-boss fight Second Breath does not work:
 * it is not in the list there, and `note` says so when one is held. Returns { list, note, count }.
 */
export function resurrectText(p, bossFight) {
  const counts = new Map();
  for (const k of p.resurrect || []) counts.set(k, (counts.get(k) || 0) + 1);
  const items = [...counts].map(([k, n]) => `${RES_NAME[k] || humanize(k)}${n > 1 ? ` ×${n}` : ''}${k === 'meta' ? ' (not in the final fight)' : ''}`);
  const held = (p.resurrectHeld && p.resurrectHeld.meta) || 0;
  const note = bossFight && held > 0 && !counts.has('meta') ? 'Second Breath does not work in the final fight.' : null;
  return { list: items.length ? items.join(', ') : bossFight ? 'None in this fight' : 'None', note, count: (p.resurrect || []).length };
}

/**
 * Zone danger (rules 7.6, M2 v3) from the rules table: an enemy of level M deals
 * dangerStep × max(0, M - dangerFrom) / DANGER_LEVELS more damage. DANGER_LEVELS is the unit of ZONE_DANGER_STEP
 * ("× per 10 levels above ZONE_DANGER_FROM", rules.md constants table). 0 when the engine has no zone danger.
 */
const DANGER_LEVELS = 10;
export function dangerAt(r, level) {
  return r.dangerStep == null || r.dangerFrom == null ? 0 : (r.dangerStep * Math.max(0, level - r.dangerFrom)) / DANGER_LEVELS;
}
/** The rule in one sentence, or null without zone danger. */
export function dangerRule(r) {
  return r.dangerStep == null || r.dangerFrom == null ? null : `Enemies above level ${r.dangerFrom} hit harder: +${pct(r.dangerStep)} damage per ${DANGER_LEVELS} levels.`;
}
/** Short line for the zone banner when the zone's levels reach past ZONE_DANGER_FROM, else null. */
export function dangerBanner(r, band) {
  return dangerAt(r, band[1]) > 0 ? `Enemies above level ${r.dangerFrom} hit harder` : null;
}

/**
 * Linked (rules 10.2) in words, from the rules table (engine constants): 'banner' when phase 2 begins, 'log' when
 * the Shards link, 'tip' for the boss frame. An engine without LINK_DR_PER_SHARD has the older all-or-nothing rule.
 */
export function linkedText(r, form) {
  const per = r.linkPerShard;
  const aoe = r.shardAoeTaken ? ` Your AoE spells deal +${pct(r.shardAoeTaken)} damage to Shards.` : '';
  if (per == null) {
    if (form === 'banner') return `Shards of dead light tear free. While any Shard lives, Oruvath takes ${pct(r.linkCap)} less damage.`;
    if (form === 'log') return `The Shards link to Oruvath: it takes ${pct(r.linkCap)} less damage.`;
    return `While any Dimming Shard lives, Oruvath takes ${pct(r.linkCap)} less damage.`;
  }
  if (form === 'banner') return `Shards of dead light tear free. Each living Shard shields Oruvath: −${pct(per)} damage taken.${aoe}`;
  if (form === 'log') return `The Shards link to Oruvath: −${pct(per)} damage taken per living Shard, at most −${pct(r.linkCap)}.`;
  return `Each living Dimming Shard shields Oruvath: −${pct(per)} damage taken per Shard, at most −${pct(r.linkCap)}. Every Shard killed weakens the link.${aoe}`;
}
