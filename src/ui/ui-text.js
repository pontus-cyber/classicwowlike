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

// ------------------------------------------------------------------ meta progression (rules 11)
/** Catalogue groups: the kinds of rules 11.2, in catalogue order (data.meta.kinds); title and a line for the group. */
export const META_KIND = {
  stat: ['Stats', 'Lasting bonuses for every hero.'],
  'start kit': ['Starting kit', 'What every hero carries from the first step.'],
  economy: ['Economy', 'Gold and training.'],
  map: ['Map and travel', 'See more of the road, and cover it faster.'],
  items: ['Items in the drop pools', 'New items that can drop or be bought.'],
  skill: ['Skills and companions', 'New spells at the trainer and a new companion.'],
  resurrect: ['Resurrection', 'A second chance on the journey.'],
  challenge: ['Challenge', 'Harder runs for more Echoes.'],
};
const cls = (id) => ({ rogue: 'Rogue', mage: 'Mage', hunter: 'Hunter' }[id] || humanize(id));
const plurName = (n, name) => (n === 1 ? name : `${name}s`);

/**
 * What an unlock does, from its catalogue entry m (R.C.META[id]: the effect per rank) and data.meta (D), with the
 * spells and pets tables (d): { short } for the card, { long } for the tooltip, { more } extra tooltip lines.
 * No number is written here: each comes from m or from D.
 */
export function metaEffect(m, D, d) {
  const N = D.num; const NM = D.names;
  const sp = m.spell && d.spells[m.spell];
  switch (m.id) {
    case 'vigor': return { short: `+${pct1(m.hpPct)} max health per rank`, long: `Every hero starts with ${pct1(m.hpPct)} more maximum health for each rank.` };
    case 'edge': return { short: `+${pct1(m.powerPct)} Power per rank`, long: `Every hero has ${pct1(m.powerPct)} more Power for each rank: more damage from every attack and spell.` };
    case 'keen': return { short: `+${pct1(m.crit)} critical strike per rank`, long: `Every hero has +${pct1(m.crit)} chance to strike critically for each rank.` };
    case 'quick_study': return { short: `+${pct1(m.xpPct)} experience per rank`, long: `Every hero earns ${pct1(m.xpPct)} more experience for each rank: levels come sooner.` };
    case 'prospector': return { short: `+${pct1(m.goldPct)} gold per rank`, long: `Every hero finds ${pct1(m.goldPct)} more gold for each rank.` };
    case 'talent_pt': return { short: `+${m.points} talent ${plural(m.points, 'point')} at level ${N.maxLevel}`, long: `At level ${N.maxLevel} you get ${numWord(m.points)} more talent ${plural(m.points, 'point')} to spend.` };
    case 'satchel': return { short: `Start with ${m.potions} ${plurName(m.potions, NM.potion)}`, long: `Every run begins with ${numWord(m.potions)} ${plurName(m.potions, NM.potion)} in your bags.` };
    case 'heirloom_blade': return { short: `${humanize(m.rarity)} starting weapon, item level ${m.ilvl}`, long: `Your starting weapon is ${m.rarity} quality, item level ${m.ilvl}, instead of a common one.` };
    case 'pockets': return { short: `+${m.slots} bag slots per rank`, long: `Your bags hold ${m.slots} more items for each rank.` };
    case 'ledger': return { short: 'First lesson at each trainer visit is free', long: 'At the trainer of every zone hub and of the camp, the first spell you learn or train costs no gold.' };
    case 'scout': return { short: 'The map shows rare elites, traps and Embers', long: `The zone map tells you which elites are rare, which chests are trapped, and which vendors sell an ${NM.ember}.` };
    case 'wayfinder': return { short: `Travel on costs no time (was ${N.travelHours} h)`, long: `Travelling on to the next zone no longer costs ${N.travelHours} hours.` };
    case 'swift_boots': return { short: `Travel on opens ${numWord(m.levels)} ${plural(m.levels, 'level')} earlier`, long: `You may travel on to the next zone ${numWord(m.levels)} ${plural(m.levels, 'level')} sooner than before.` };
    case 'alchemist': return { short: `Vendors sell ${plurName(2, NM.greater)}`, long: `Every vendor also sells ${plurName(2, NM.greater)}: each restores ${pct(D.greaterHeal)} of your maximum health.` };
    case 'cache': {
      const u = D.uniques.rare;
      return { short: `${u.length} unique rares join elite and treasure loot`, long: 'One unique rare item for each zone can drop from elites, rares and treasure chests there.', more: u.map((x) => `${x.name} (${x.zoneName})`) };
    }
    case 'relics': {
      const u = D.uniques.epic;
      return { short: `${u.length} unique epics join dungeon boss loot`, long: 'One unique epic item for each dungeon can drop from its boss.', more: u.map((x) => `${x.name} (${x.dungeon || x.zoneName})`) };
    }
    case 'starforged': return { short: `Your class's unique weapon at the camp, ilvl ${m.ilvl}`, long: `The quartermaster at ${NM.camp} sells your class's unique epic weapon, item level ${m.ilvl}.`, more: Object.entries(D.uniques.weapon).map(([c, w]) => `${cls(c)}: ${w.name}`) };
    case 'stormhawk': { const pet = d.pets[m.pet]; return { short: `Hunters may take the ${pet ? pet.name : humanize(m.pet)}`, long: `${pet ? pet.name : humanize(m.pet)} can be chosen as the Hunter's companion.${pet && pet.text ? ` ${pet.text}` : ''}` }; }
    case 'second_breath': return { short: `${cap1(numWord(m.charges))} resurrection each run, not in the final fight`, long: `Each run you hold ${numWord(m.charges)} more ${plural(m.charges, 'resurrection')}: a death on the journey returns you to the fight. It does not work against ${NM.boss}.` };
    case 'oaths': return { short: 'Swear Oaths at creation for more Echoes', long: `At character creation you may swear Oaths: each makes the run harder and adds ${pct1(N.oathEcho)} to the Echoes it earns.`, more: D.oathIds.map((o) => `${D.oaths[o].name}: ${oathEffect(D.oaths[o], D).short}`) };
    default:
      if (sp) return { short: `The ${cls(sp.cls)} trainer teaches ${sp.name}`, long: `${sp.name} can be learned from the ${cls(sp.cls)} trainer from level ${sp.lvl}.${sp.text ? ` ${sp.text}` : ''}` };
      return { short: humanize(m.kind), long: '' };
  }
}
const cap1 = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** A requirement of an unlock in words (R.C.META req: an unlock id or a profile flag); short: for the card. */
export function metaReqText(req, D, short = false) {
  if (req === 'flag:reachedBoss') return short ? `${D.names.boss} reached once` : `Reach ${D.names.boss} once`;
  if (req === 'flag:bossKill') return short ? `a victory over ${D.names.boss}` : `Defeat ${D.names.boss} once`;
  const e = D.entries[req];
  return e ? (short ? e.name : `Own ${e.name}`) : humanize(req);
}

/** An Oath (rules 11.5, R.C.OATH) in words: { short, long }. Numbers from D.num. */
export function oathEffect(o, D) {
  switch (o.id) {
    case 'haste': return { short: `Par time ${D.num.oathHaste} h shorter`, long: `${D.names.boss}'s par time is ${D.num.oathHaste} hours shorter: Ascendancy begins sooner, and the swift-victory bonus asks for a faster run.` };
    case 'frailty': return { short: 'No resurrections', long: `Nothing brings you back: no ${D.names.boon}, no Second Breath, no ${D.names.ember}. One death ends the run.` };
    case 'thrift': return { short: `Vendor prices ×${D.num.oathThrift}`, long: `Everything vendors sell costs ×${D.num.oathThrift}: potions, gear and Embers.` };
    default: return { short: '', long: '' };
  }
}

/**
 * The next run in lines, from the engine's run modifiers (n: the bridge's dry START_RUN, state.meta) and data.meta.
 * Each line: { id: the unlock it comes from, text }. Empty when no unlock applies.
 */
export function nextRunLines(n, D, d) {
  if (!n || !n.meta) return [];
  const m = n.meta; const out = [];
  const add = (id, text) => out.push({ id, text });
  if (m.hpPct) add('vigor', `+${pct1(m.hpPct)} max health`);
  if (m.powerPct) add('edge', `+${pct1(m.powerPct)} Power`);
  if (m.crit) add('keen', `+${pct1(m.crit)} critical strike`);
  if (m.xpPct) add('quick_study', `+${pct1(m.xpPct)} experience`);
  if (m.goldPct) add('prospector', `+${pct1(m.goldPct)} gold`);
  if (m.talentPoints) add('talent_pt', `+${m.talentPoints} talent ${plural(m.talentPoints, 'point')} at level ${D.num.maxLevel}`);
  if (m.satchel) add('satchel', `${n.potions} ${plurName(n.potions, D.names.potion)} in your bags`);
  if (m.heirloom && n.weapon) add('heirloom_blade', `${n.weapon.name}: ${n.weapon.rarity} weapon, item level ${n.weapon.ilvl}`);
  if (m.bagSlots) add('pockets', `+${m.bagSlots} bag slots (${n.bagSlots} in all)`);
  if (m.ledger) add('ledger', 'First lesson at each trainer visit free');
  if (m.scout) add('scout', 'Rare elites, traps and Embers on the map');
  if (m.wayfinder) add('wayfinder', 'Travel on costs no time');
  if (m.swiftBoots) add('swift_boots', `Travel on ${numWord(D.entries.swift_boots.levels)} ${plural(D.entries.swift_boots.levels, 'level')} earlier`);
  if (m.alchemist) add('alchemist', `${plurName(2, D.names.greater)} at vendors`);
  if (m.cache) add('cache', 'Unique rares in elite and treasure loot');
  if (m.relics) add('relics', 'Unique epics in dungeon boss loot');
  if (m.starforged) add('starforged', `${(D.uniques.weapon[n.classId] || {}).name || 'Your unique weapon'} at the camp`);
  for (const id of m.spells || []) {
    const e = Object.values(D.entries).find((x) => x.spell === id); const sp = d.spells[id];
    add(e ? e.id : id, `${sp ? sp.name : humanize(id)} at the trainer${sp ? ` (level ${sp.lvl})` : ''}`);
  }
  if (m.stormhawk && n.classId === 'hunter') add('stormhawk', `${(d.pets.stormhawk || {}).name || 'Stormhawk'} can join you`);
  if (m.resCharges) add('second_breath', n.oaths.includes('frailty') ? 'Second Breath held, but your Oath of Frailty forbids it' : `Second Breath: ${numWord(m.resCharges)} ${plural(m.resCharges, 'resurrection')} (not in the final fight)`);
  if (n.oaths.length) add('oaths', `${n.oaths.map((o) => (D.oaths[o] ? D.oaths[o].name.replace(/^Oath of /, '') : humanize(o))).join(', ')} sworn: Echoes ×${Math.round(n.oathMult * 100) / 100}`);
  return out;
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
