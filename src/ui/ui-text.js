// Display text for tooltips and screens (descriptions of spells, talents, statuses, consumables,
// boons and classes). Wording follows docs/specs/rules.md; numbers that matter come from the
// engine at run time. CONTENT.texts (src/content) overrides any line when it provides one.
import { SPELLS, TALENTS, STATUS_INFO as BASE_STATUS, CONSUMABLES, BOONS, CLASSES, PETS } from './mock-data.js';

/**
 * Player-facing words for the run's time pressure (docs/specs/changes-m2b-v7.md table D, draft; owner 2026-11-11 10:12):
 * the meter is the Furnace, its states Calm, Smouldering, Burning and Infernal (engine ids clear, warm, hot, scorched),
 * time is counted in tolls, whole numbers only, no "h" and no day clock. Every heat and time text of the UI takes its
 * words from here, so a rename is one edit. The engine counts tolls itself (M2b v7: view.time, heatView.time; whole numbers).
 */
export const HEAT_WORDS = {
  name: 'the Furnace', Name: 'The Furnace', // in a sentence / as a title
  state: { clear: 'Calm', warm: 'Smouldering', hot: 'Burning', scorched: 'Infernal' },
  unit: 'toll', units: 'tolls', Units: 'Tolls',
};
/** A whole number of tolls in words: "1 toll", "3 tolls" (rounded; never a decimal, never "h"). */
export function tolls(n) { const k = Math.round(Math.abs(n || 0)); return `${k} ${k === 1 ? HEAT_WORDS.unit : HEAT_WORDS.units}`; }

export const STATUS_INFO = {
  ...BASE_STATUS,
  BRACE: { name: 'Braced', debuff: false, text: 'Takes 50 % less damage.' },
  ADRENAL: { name: 'Adrenal Surge', debuff: false, text: 'Energy regeneration doubled.' },
  CONFLAGRANT: { name: 'Conflagrant Core', debuff: false, text: 'Fire spells cost nothing and crit more often.' },
  MIRROR: { name: 'Mirrorshade', debuff: false, text: 'Attacks may strike an image instead of you.' },
  FEIGN: { name: 'Feigning', debuff: false, text: 'Enemies attack your pet instead.' },
  COMMUNION: { name: 'Wild Communion', debuff: false, text: 'Your pet deals more damage and taunts.' },
  // combat v2 (docs/specs/combat-v2.md 5, 6; engine-api.md 6). v2Debuff: shown as a debuff on an enemy (the engine's
  // DEBUFFS list only names what can land on the player).
  OFF_BALANCE: { name: 'Off-balance', debuff: true, v2Debuff: true, text: 'Its big move failed: it takes more damage, your hits crit more often, and it cannot dodge. Hit it now.' },
  SAPPED: { name: 'Sapped', debuff: true, v2Debuff: true, text: 'Skips its turns. Any damage wakes it, damage over time included.' },
  TRAP: { name: 'Trap', debuff: true, v2Debuff: true, text: 'A trap waits under it and springs on its first heavy blow or cast, else on its first turn.' },
  GATHER: { name: 'Gathered Power', debuff: false, text: 'Your next damaging spells cost no mana and crit more often.' },
  PET_LEAD: { name: 'Leading the Charge', debuff: false, text: 'Your pet engaged first: it taunts and takes less damage.' },
  // combat v2.1 (combat-v2.md 16.2, rules 7.12): the lasting result of an enemy's wind-ups, one stack per wind-up
  EMPOWERED: { name: 'Empowered', debuff: false, text: 'A wind-up landed: it deals more damage for the rest of the fight.' },
  STAGGERED: { name: 'Staggered', debuff: true, v2Debuff: true, text: 'A wind-up was answered: it deals less damage for the rest of the fight.' },
  // M2b v13 (rules 7.4, D107): a landed Deathblow MAIMS the player for the rest of the fight; dispersal does not remove it.
  MAIMED: { name: 'Maimed', debuff: true, text: 'A Deathblow landed: the healing you receive is cut for the rest of the fight. Cleansing does not remove it.' },
};

// ------------------------------------------------------------------ combat v2.1 (docs/specs/combat-v2.md 16.2)
/**
 * What answers a wind-up (rules 7.7, 7.10, 7.12, 7.13 (3)) in one sentence: every interrupt, stun or control on its turn,
 * or an engage option that covers that turn; on an enemy immune to control (a dungeon boss) a stun or control spell acts
 * as an interrupt and the engage round's control option is Disrupt; a heavy one also by a full dodge, a WARD that takes
 * it all, Mirrorshade or the pet taking it (taunt).
 */
export function windupAnswers(heavy, immune = false) {
  const how = immune
    ? 'Answer it with an interrupt, a stun or a control spell on its turn (it cannot be controlled: each interrupts it), or with Disrupt in the engage round'
    : 'Answer it with an interrupt, a stun or control on its turn, or with an engage option that covers that turn';
  return `${how}${heavy ? '; a heavy one also by a full dodge, a ward that takes it all, Mirrorshade or your pet taking it' : ''}.`;
}
/**
 * A Deathblow's stakes in words (M2b v13, rules 7.12, 7.4), from the engine's windupView item (empower, maimHeal, stagger):
 * "Answered: staggered, −30 % damage for the rest of the fight. Landed: empowered +100 %, and you are MAIMED: healing you
 * receive −50 %, potions included." No number is written here.
 */
export function deathblowStakes(w) {
  if (!w) return '';
  return `Answered: staggered, −${pct(w.stagger)} damage for the rest of the fight. Landed: empowered, +${pct(w.empower)} damage${w.maims ? `, and you are MAIMED: healing you receive −${pct(w.maimHeal)}, potions included` : ''}.`;
}
/** What answers a Deathblow of this type (the map's `type`: 'heavy' or 'cast'; rules 7.12, 7.13 (3)), without its noun. */
export function deathblowAnswers(type) {
  return type === 'heavy' ? 'stun, control or interrupt it on its turn; a full dodge, a ward or your pet taking it also answer it'
    : 'interrupt it or control the caster on its turn';
}
/** How a Deathblow can be answered, by its kind (the map's `type`): "heavy blow: ..." or "cast: ...". */
export function deathblowKind(type) {
  return `${type === 'heavy' ? 'heavy blow' : 'cast'}: ${deathblowAnswers(type)}`;
}
/** M2b v14 (UI need 2): Sap is sure if the Rogue waits (windupView answer `wait`; `stealth`: the passes keep STEALTH). */
export function sapWaitText(a) {
  return `Sure if you wait: press Pass next round${a && a.stealth ? '; you stay hidden' : ''}`;
}
/** The lasting result in words, from the engine's EMPOWER_DMG and STAGGER_DMG (data.v2.num); no number written here. */
export function windupStakes(n) {
  if (!n || n.empowerDmg == null) return 'Answered, it is staggered for the fight; landed, it is empowered.';
  return `Answered: staggered, −${pct(n.staggerDmg)} damage for the rest of the fight. Landed: empowered, +${pct(n.empowerDmg)}.`;
}

// ------------------------------------------------------------------ combat v2 (docs/specs/combat-v2.md 4, 6, 10)
/**
 * Enemy roles (rules 7.6 archetypes, combat-v2.md 4.1): the badge name, what the role does, and what its opening script
 * asks of the player (the spec's table, in words). The script itself is read from the engine (data.v2.scripts).
 */
export const ROLE_INFO = {
  brute: { name: 'Brute', text: 'Hits hard. Its Heavy Smash is a telegraphed big blow.', asks: 'Stop or absorb its Heavy Smash, then punish the opening.' },
  caster: { name: 'Caster', text: 'Fragile, but its casts hurt and curse you.', asks: 'Interrupt or control its Hex Bolt, or kill it before it casts.' },
  skulker: { name: 'Skulker', text: 'Bleeds you, and as a lookout signals for help when it is not alone.', asks: 'Kill, interrupt or control it before it signals.' },
  beast: { name: 'Beast', text: 'Bloodlust: deals more damage every turn it acts.', asks: 'Kill it early: every turn alive makes it stronger.' },
  guardian: { name: 'Guardian', text: 'Shields its ward and braces itself; tough to bring down.', asks: 'Do not spend your burst on its ward early, or control the guardian.' },
  mender: { name: 'Mender', text: 'Bolsters the weakest ally with a shield and mends the wounded.', asks: 'Kill or control it; interrupt its Mend.' },
};
/** A control status as a word on the track ("Heavy Smash cancelled: stunned"). */
export const CONTROL_WORD = { STUN: 'stunned', FROZEN: 'frozen', HEXED: 'hexed', SAPPED: 'sapped', TRAP: 'trapped', INTERRUPT: 'interrupted' };

/**
 * One-line effect of an engage option (rules 7.10, combat-v2.md 6.2) from its engine entry o (data.v2.options[id]: mult,
 * cp, turns, spells, crit, markRounds, stun, dr) and the numbers in n (data.v2.num). No number is written here.
 */
export function engageText(o, n) {
  if (!o) return '';
  switch (o.id) {
    case 'ambush': return `A strike from Stealth: ${n.shadowstep} once learned, else ${n.jab} ×${o.mult} for +${o.cp} combo points. You stay in Stealth.`;
    case 'sap': return `It skips its next ${numWord(o.turns)} turns. Any damage wakes it, damage over time included. You stay in Stealth.`;
    case 'premeditate': return `+${o.cp} combo points before the fight starts. You stay in Stealth.`;
    case 'precast': return 'Cast one spell from your bar for no mana before they notice you; its cooldown starts.';
    case 'binding_glyph': return `Frozen for its next ${numWord(o.turns)} turns; damage does not break it. Frozen counts as off-balance.`;
    case 'gather_power': return `Your next ${numWord(o.spells)} damaging spells cost no mana and get +${pct(o.crit)} critical strike chance.`;
    case 'opening_shot': return `${n.keen} ×${o.mult}, and the target is Marked (+${n.markValue != null ? pct1(n.markValue) : '?'} damage taken) for ${o.markRounds} rounds.`;
    case 'lay_trap': return `Springs on its first heavy blow or cast in its next ${numWord(n.trackLen)} turns: cancelled, stunned, off-balance. Else on its first turn.`;
    case 'send_pet': return `Your pet charges first: it taunts for ${numWord(o.turns)} turns and takes ${pct(o.dr)} less damage.`;
    default: return '';
  }
}
/**
 * One line per engage option for the first-fight hint (tracks.js): what it is for, numbers from the engine's option
 * (C.ENGAGE_OPTION through data.v2.options).
 */
export function engageHint(o, n) {
  if (!o) return '';
  switch (o.id) {
    case 'ambush': return `big opening damage and +${o.cp} combo points.`;
    case 'sap': return `one enemy skips its next ${numWord(o.turns)} turns (not bosses; damage wakes it). The answer to a pack.`;
    case 'premeditate': return `+${o.cp} combo points before the fight starts.`;
    case 'precast': return 'one bar spell for no mana before they act.';
    case 'binding_glyph': return `one enemy is frozen for its next ${numWord(o.turns)} turns and takes more damage.`;
    case 'gather_power': return `your next ${numWord(o.spells)} damaging spells cost no mana and crit more often.`;
    case 'opening_shot': return `a strong first shot that Marks the target.`;
    case 'lay_trap': return `stops its first heavy blow or cast in its next ${numWord(n.trackLen || 3)} turns.`;
    case 'send_pet': return `your pet charges in and taunts for ${numWord(o.turns)} turns.`;
    default: return '';
  }
}
/** Kind of an engage option in words (strike, control, setup). */
export const ENGAGE_KIND = { strike: 'Strike', control: 'Control', setup: 'Setup' };

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

// ------------------------------------------------------------------ talent totals (owner feedback 2026-11-11 08:14)
/** How a per-rank talent field reads (C.TALENT_PER_RANK keys; the values come from R.talentInfo). ctx: { res } of the class. */
const TALENT_FX = {
  pct: (v) => `+${pct2(v)}`, crit: (v) => `+${pct2(v)} crit chance`, dodge: (v) => `+${pct2(v)} dodge`,
  critMult: (v) => `+${Math.round(v * 100) / 100} crit multiplier`,
  cost: (v, c) => (c.res === 'mana' ? `−${pct2(v)} of base mana in cost` : `−${v} ${c.res}`),
  cd: (v) => `−${v} ${plural(v, 'round')} cooldown`, cp: (v) => `+${v} combo ${plural(v, 'point')}`,
  energyPerCp: (v) => `+${v} energy per combo point`, chance: (v) => `${pct2(v)} chance`, healPct: (v) => `heals ${pct2(v)} of max health`,
  stacks: (v) => `+${v} ${plural(v, 'stack')}`, rounds: (v) => `+${v} ${plural(v, 'round')}`, strength: (v) => `${pct2(v)} strength`,
  wardPct: (v) => `a ward of ${pct2(v)} of max health`, chill: (v) => `Chilled: a further −${pct2(v)} damage`,
  hpPct: (v) => `+${pct2(v)} max health`, manaPct: (v) => `+${pct2(v)} max mana`, powerPct: (v) => `+${pct2(v)} Power`,
  petHpPct: (v) => `+${pct2(v)} pet max health`, petDmgPct: (v) => `+${pct2(v)} pet damage`, share: (v) => `${pct2(v)} of the heal`,
  petCrit: (v) => `+${pct2(v)} pet crit chance`, focus: (v) => `+${v} focus per pet crit`, revive: (v) => `+${pct2(v)} pet revive health`,
  petDr: (v) => `pet takes −${pct2(v)} damage`, marked: (v) => `Marked +${pct2(v)}`,
  base: (v) => (v == null ? null : `${v} damage before modifiers`),
  dotCrit: (v) => (v ? 'damage over time can crit' : null), dotPct: (v) => (v ? `+${pct2(v)} damage over time` : null),
};
/** Talents whose field reads differently from TALENT_FX. */
const TALENT_FX_ID = {
  r_c1: { base: (v) => (v == null ? null : `Poison ticks ${v} per stack before modifiers`) },
  r_c4: { pct: (v) => `poisoned enemies deal −${pct2(v)} damage` },
  m_c5: { manaPct: (v) => `${pct2(v)} of max mana back per interrupt` },
  h_c3: { base: (v) => (v == null ? null : `the trap deals ${v} damage before modifiers`) },
};
/**
 * The talent tooltip's totals (rules 6: "/rank" values multiply by the ranks taken) from R.talentInfo (`info`: per, now,
 * next): { now: 'text' | '', next: 'text' | '', max }. res: the class's resource word (energy, focus, mana).
 */
export function talentTotals(info, res) {
  if (!info) return null;
  const line = (vals) => {
    if (!vals) return '';
    const out = [];
    for (const [k, v] of Object.entries(vals)) {
      const f = (TALENT_FX_ID[info.id] && TALENT_FX_ID[info.id][k]) || TALENT_FX[k];
      const t = f ? f(v, { res }) : null;
      if (t) out.push(t);
    }
    return out.join(', ');
  };
  return { now: line(info.now), next: line(info.next), max: info.rank >= info.ranks };
}
/**
 * A consumable's text. c: the engine's entry (R.C.CONSUMABLE[id]) in engine mode. A draught that heals (`heal`) states
 * the engine's share of maximum health (M2 v4: Greater Healing Draught 37.5 %); the other sentences of the text stay.
 */
export function consumableText(id, content, c = null) {
  const t = content && content.texts && content.texts.consumables && content.texts.consumables[id];
  if (t) return t;
  const base = (CONSUMABLES[id] && CONSUMABLES[id].text) || '';
  if (!c || c.heal == null) return base;
  const rest = base.replace(HEAL_SENTENCE, '').trim();
  return `Restores ${pct1(c.heal)} of your maximum health.${rest ? ` ${rest}` : ''}`;
}
const HEAL_SENTENCE = /^Restores [\d.]+ % of your maximum health\./;
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
  heat: `Fights won ${HEAT_WORDS.state.hot} or ${HEAT_WORDS.state.scorched}`, // rules 11.1 (heat): fights won in nodes entered Hot or Scorched
  contracts: 'Contracts completed', reserve: 'Reserve kept', // expedition.md 8.1, 11.1 (prep)
};
export const humanize = (id) => String(id || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// ------------------------------------------------------------------ start camp and contracts (expedition.md 2, 3, 9; prep)
// Words from content (src/content/texts.js, docs/handoffs/content-2026-11-11.md): texts.families[id] { singular, plural },
// texts.prep[id] { name, flavour, rule }, texts.contracts { cull, bounty, delve, hub } sentence templates with {n},
// {family}, {familyOne}, {region}, {zone}, {levels}, {elite}, {dungeon}, {hub}, {contract}. Without them: the id in
// words ("wild foes") and the lines below. Every price, count and reward comes from R.prepView / R.contractView; radii
// and limits from the rules table (data.rules.prep).
export const CONTRACT_KIND = { cull: 'Cull', bounty: 'Bounty', delve: 'Delve' };
const CONTRACT_KIND_TEXT = {
  cull: 'Win fights at its sites: Quest and Grind nodes, most of them in one region.',
  bounty: 'Hunt down one named elite that roams one region.',
  delve: "Clear the zone's dungeon, its boss included.",
};
const group = (content, g) => (content && content.texts && content.texts[g]) || null;
/** A family's display name (texts.families: plural, or singular with one), else its id in words: "wild foes". */
export function familyName(id, content, one = false) {
  if (!id) return one ? 'foe' : 'foes';
  const g = group(content, 'families'); const x = g && g[id];
  const t = typeof x === 'string' ? x : x && (one ? x.singular || x.plural : x.plural || x.singular);
  return t || `${String(id).replace(/_/g, ' ')} ${one ? 'foe' : 'foes'}`;
}
/** A level band in words: "levels 1-10". */
export const bandText = (band) => (band ? `levels ${band[0]}-${band[1]}` : '');
/** What a contract asks for, short: "wild beasts in Barleyreach Verge", "Grosk, roaming Harrow Lane", a dungeon's name. */
export function contractTarget(c, content) {
  if (c.kind === 'delve') return c.dungeon || "the zone's dungeon";
  if (c.kind === 'bounty') return `${c.name || 'a named elite'}${c.regionName ? `, roaming ${c.regionName}` : ''}`;
  return `${familyName(c.family, content)}${c.regionName ? ` in ${c.regionName}` : ''}`;
}
/** A contract in a few words (tracker, toasts, map marks): "Cull wild beasts in Barleyreach Verge", "Bounty: Grosk". */
export function contractTitle(c, content) {
  if (c.kind === 'cull') return `Cull ${contractTarget(c, content)}`;
  if (c.kind === 'bounty') return `Bounty: ${c.name || 'a named elite'}`;
  return `${CONTRACT_KIND[c.kind] || humanize(c.kind)}: ${contractTarget(c, content)}`;
}
const fill = (tpl, vals) => tpl.replace(/\{(\w+)\}/g, (m, k) => (vals[k] != null && vals[k] !== '' ? String(vals[k]) : m));
/**
 * A contract as a sentence (texts.contracts[kind], content): "Cull 2 wild beasts in Barleyreach Verge, Amberfold Downs,
 * levels 1-10." Without the template: the title, the zone and the band. A placeholder without a value stays as it is.
 */
export function contractSentence(c, content) {
  const g = group(content, 'contracts'); const tpl = g && typeof g[c.kind] === 'string' ? g[c.kind] : null;
  const vals = { n: c.need, family: familyName(c.family, content), familyOne: familyName(c.family, content, true), region: c.regionName, zone: c.zoneName,
    levels: bandText(c.band), elite: c.name, dungeon: c.dungeon };
  // "a {familyOne}" takes "an" before a vowel ("an outlaw")
  if (tpl) return fill(tpl.replace(/\ba \{familyOne\}/g, /^[aeiou]/i.test(vals.familyOne) ? 'an {familyOne}' : 'a {familyOne}'), vals);
  return `${contractTitle(c, content)}, ${c.zoneName}, ${bandText(c.band)}.`;
}
/** The hub's offer as a sentence (texts.contracts.hub): "Millbrook Rest has work on the board: Cull ...". */
export function hubOfferSentence(c, hubName, content) {
  const g = group(content, 'contracts'); const tpl = g && typeof g.hub === 'string' ? g.hub : null;
  const one = contractSentence(c, content);
  return tpl ? fill(tpl, { hub: hubName, contract: one }) : `${hubName} has work on the board: ${one}`;
}
/** A contract kind in one line. */
export function contractKindText(kind) { return CONTRACT_KIND_TEXT[kind] || ''; }
/**
 * Where a contract's sites are and when the map shows them (expedition.md 3.3, 5.1, 5.2). r: the rules table's prep block;
 * has: { guide, tracker } (the perk is owned or bought).
 */
export function contractSitesText(c, r, has = {}) {
  if (c.kind === 'delve') return `Its one site is ${c.dungeon || "the zone's dungeon"}. Holding this contract shows the dungeon on that zone's map.`;
  const see = `You see a site's mark on nodes in full view: within ${r.vision} ${plural(r.vision, 'hop')}${has.guide ? `, ${r.guide} more with the Local Guide` : ''}${has.tracker ? `; with Tracker's Notes within ${r.tracker} hops, hidden nodes too` : ''}.`;
  if (c.kind === 'bounty') return `The elite waits at ${numWord(r.bountyPlaced)} Elite nodes of rings 2 and 3 in ${c.regionName || 'its region'}; win either. ${see}`;
  return `Sites: Quest or Grind nodes, most of them in ${c.regionName || 'its region'}. ${see}`;
}
/** A contract's item choice in words: "choose 1 of 3: 80 % rare, 20 % epic" (the drop table's weights, R.prepView). */
export function contractItemsText(rw) {
  const w = Object.entries(rw.rarity || {}); const tot = w.reduce((a, [, x]) => a + x, 0) || 1;
  return `choose 1 of ${rw.choices}${w.length ? `: ${w.map(([k, x]) => `${Math.round((x / tot) * 100)} % ${k}`).join(', ')}` : ''}`;
}
/** Levels-worth of XP in words ("3.2 levels of XP"; xpFrac from R.prepView, XP_WEIGHT_MULT included). */
export const levelsText = (x) => `${Math.round(x * 10) / 10} ${x === 1 ? 'level' : 'levels'} of XP`;
/**
 * What a start-camp option does, in one line with the engine's numbers (expedition.md 2.3, 2.4). o: R.prepView's option
 * (qty, bell, slots, charges); r: the rules table's prep block; name(id): a consumable's name; content: texts.prep's
 * rule line for an option this table does not know.
 */
export function prepOptionEffect(o, r, name = (id) => humanize(id), content = null) {
  const many = (n, nm) => (n === 1 || /s$/.test(nm) ? nm : `${nm}s`);
  switch (o.id) {
    case 'prep_draughts': case 'prep_rations': return `${o.qty} ${many(o.qty, name(o.item))} in your bags.`;
    case 'prep_ember': return `${o.qty > 1 ? o.qty : 'One'} ${name(o.item)}: you rise again once when you would die.`;
    case 'prep_bell': return `+${o.bell} Homeward Bell charge: one more way out of a zone.`;
    case 'prep_mule': return `+${o.slots} bag slots for the whole run.`;
    case 'prep_charts': return "Every node's region and every dungeon shown on each zone map.";
    case 'prep_tracker': return `Contract sites marked within ${r.tracker} hops of you, hidden nodes too.`;
    case 'prep_guide': return `Your full view reaches ${r.guide} ${plural(r.guide, 'hop')} further on every zone map.`;
    case 'prep_spyglass': return `${o.charges} looks on the map: any node and its neighbours in full view, no tolls.`;
    default: { const g = group(content, 'prep'); const x = g && g[o.id]; return (x && x.rule) || ''; }
  }
}
/** A start-camp option's flavour line (texts.prep[id].flavour), or ''. */
export function prepFlavour(id, content) { const g = group(content, 'prep'); const x = g && g[id]; return (typeof x === 'string' ? x : x && (x.flavour || x.text)) || ''; }

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
/** A small count in words ("three"), larger ones as digits. */
export const numWord = (n) => WORDS[n] || String(n);
export const plural = (n, one, many = `${one}s`) => (n === 1 ? one : many);
const pct = (x) => `${Math.round(x * 100)} %`;
/** A share in per cent with up to one decimal ("12.5 %", "25 %"). */
export const pct1 = (x) => `${Math.round(x * 1000) / 10} %`;
/** A share in per cent with up to two decimals (talent totals: Pack Leader's 6.25 %). */
export const pct2 = (x) => `${Math.round(x * 10000) / 100} %`;
/**
 * The free potion's strength in words (rules 7.5, M2b v8): from the engine's FREE_POTION_MULT (the event's `mult`, the
 * bridge's `items[].mult` or data.meta.freePotionMult): 0.5 "half strength", another share "40 % strength"; null at full
 * strength or without a value (an engine before M2b v8, the mock).
 */
export const strengthText = (mult) => (mult == null || mult >= 1 ? null : mult === 0.5 ? 'half strength' : `${pct1(mult)} strength`);
/** "Free action (Packed Satchel)" with the strength when it is not full: "Free action, half strength (Packed Satchel)". */
export const freeActionText = (mult) => `Free action${strengthText(mult) ? `, ${strengthText(mult)}` : ''} (Packed Satchel)`;

/**
 * What a status does, in exact numbers (rules 7.4). s: a view status (engine-bridge.js `statuses`: the engine's status
 * object with tick, amount, value, stacks, rounds, full, srcName); r: the rules table (r.status: CURSE_PCT, BRAND_DMG,
 * BRAND_MAX, STEALTH_MISS_BONUS, DODGE_CAP). Returns { effect, lines, duration, source }. No number is written here.
 */
export function statusEffect(s, r, info = {}) {
  const R = (r && r.status) || {};
  const left = s.rounds && s.rounds < 90 ? s.rounds : null;
  const lines = [];
  let effect = info.text || '';
  const roundsLeft = (n) => `${n} ${plural(n, 'round')}`;
  switch (s.id) {
    case 'BLEED': case 'BURN': case 'POISON': {
      if (!s.tick) break;
      const per = s.tick * (s.stacks || 1);
      effect = `Takes ${per} ${s.id === 'BURN' ? 'fire ' : ''}damage at the end of each round.`;
      if (s.id === 'POISON' || s.stacks > 1) lines.push(`${s.tick} per stack × ${s.stacks} ${plural(s.stacks, 'stack')}${s.max ? ` (at most ${s.max})` : ''}.`);
      if (left) lines.push(`${per * left} more over the ${roundsLeft(left)} left.`);
      if (s.canCrit) lines.push('Its ticks can strike critically.');
      break;
    }
    case 'CHILLED': if (s.value) effect = `Deals ${pct(s.value)} less damage.`; break;
    case 'CURSED': if (R.cursePct != null) effect = `Deals ${pct(R.cursePct)} less damage.`; break;
    case 'EXPOSED': case 'MARKED': if (s.value) effect = `Takes ${pct1(s.value)} more damage.`; break;
    case 'BRACE': case 'SHIELDED': if (s.value) effect = `Takes ${pct(s.value)} less damage.`; break;
    case 'ENRAGED': if (s.value) effect = `Deals ${pct(s.value)} more damage.`; break;
    case 'WARD': if (s.value) effect = `Absorbs the next ${s.value} damage.`; break;
    case 'HOT': if (s.amount) effect = `Heals ${s.amount} at the end of each round.`; if (s.amount && left) lines.push(`${s.amount * left} more over the ${roundsLeft(left)} left.`); break;
    case 'EVASION': if (s.value) effect = `+${pct(s.value)} chance to dodge attacks${R.dodgeCap != null ? ` (dodge at most ${pct(R.dodgeCap)})` : ''}.`; break;
    case 'STEALTH': if (R.stealthMiss != null) effect = `Unseen: openers can be used, and enemy attacks miss ${pct(R.stealthMiss)} more often. Any other action ends it.`; break;
    case 'RAPID': if (s.value) effect = `Your attacks deal ${pct(s.value)} more damage${s.focus ? ` and focus returns ${pct(s.focus)} faster` : ''}.`; break;
    case 'ADRENAL': if (s.value) effect = `Energy returns ${s.value} times as fast.`; break;
    case 'CONFLAGRANT': if (s.value) effect = `Fire spells cost no mana and have +${pct(s.value)} critical strike chance.`; break;
    case 'MIRROR': if (s.value) effect = `Each enemy attack has a ${pct(s.value)} chance to strike an image instead of you.`; break;
    case 'COMMUNION': if (s.value) effect = `Your pet deals ${pct(s.value)} more damage.`; break;
    // combat v2 (rules 7.10, 7.13): the window's numbers from the status (value = extra damage taken) and the rules table
    case 'OFF_BALANCE':
      if (s.value) effect = `Takes ${pct(s.value)} more damage from you and your pet${R.offbalCrit != null ? `, your hits on it crit ${pct(R.offbalCrit)} more often` : ''}, and it cannot dodge.`;
      lines.push('Use it: your next action is the window.');
      break;
    case 'SAPPED': effect = 'Skips its turns while sapped. Any damage wakes it, damage over time included.'; break;
    case 'TRAP': if (s.turn != null) effect = `A trap springs on its turn ${s.turn}: that action is cancelled and it is stunned${s.stun ? ` for ${roundsLeft(s.stun)}` : ''}; a cancelled heavy blow or cast leaves it off-balance.`; break;
    case 'GATHER': if (s.value) effect = `Your next ${s.stacks > 1 ? `${numWord(s.stacks)} damaging spells` : 'damaging spell'} ${s.stacks > 1 ? 'cost' : 'costs'} no mana and ${s.stacks > 1 ? 'have' : 'has'} +${pct(s.value)} critical strike chance.`; break;
    case 'PET_LEAD': if (s.value) effect = `Your pet taunts and takes ${pct(s.value)} less damage.`; break;
    // combat v2.1 (rules 7.12): value = stacks × EMPOWER_DMG or × STAGGER_DMG (engine-api.md 6)
    case 'EMPOWERED': if (s.value) effect = `Deals ${pct(s.value)} more damage: ${s.stacks || 1} ${plural(s.stacks || 1, 'wind-up')} landed.`; break;
    case 'STAGGERED': if (s.value) effect = `Deals ${pct(s.value)} less damage: ${s.stacks || 1} ${plural(s.stacks || 1, 'wind-up')} answered.`; break;
    // M2b v13 (rules 7.4, 7.5): value = MAIM_HEAL, the share of every heal on you (potions too) that is lost
    case 'MAIMED': if (s.value) effect = `Healing you receive is ${pct(s.value)} lower, potions included, until the fight ends. Cleansing does not remove it.`; break;
    case 'BRAND':
      if (R.brandDmg != null) {
        effect = `Takes ${R.brandDmg} shadow damage per stack at the end of each round: ${R.brandDmg * (s.stacks || 1)} at ${s.stacks || 1} ${plural(s.stacks || 1, 'stack')}, before level difference and Ascendancy.`;
        lines.push(`${R.brandMax != null ? `Up to ${R.brandMax} stacks. ` : ''}Only dispersal removes it.`);
      }
      break;
    default: break;
  }
  const duration = left ? `${roundsLeft(left)} left${s.full && s.full > left ? ` (of ${s.full})` : ''}` : s.id === 'WARD' ? 'Until it breaks or the fight ends' : s.id === 'BRAND' ? 'Does not expire' : 'Until the fight ends';
  return { effect, lines, duration, source: s.srcName ? `From ${s.srcName}` : null };
}

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
 * Zone danger (rules 7.6, M2 v3; dungeons M2 v4) in words. Every number comes from the engine's zoneDanger, through the
 * bridge: the rules table's dangerStep and dangerStepDungeon (the extra damage DANGER_LEVELS levels above dangerFrom,
 * in the open world and in dungeons), zone.danger (at the zone's highest level) and node.danger (the node's enemies).
 * DANGER_LEVELS is the unit of ZONE_DANGER_STEP ("× per 10 levels above ZONE_DANGER_FROM", rules.md constants table).
 */
export const DANGER_LEVELS = 10;
/** The rule in one sentence, or null without zone danger. */
export function dangerRule(r) {
  if (r.dangerStep == null || r.dangerFrom == null) return null;
  const dungeon = r.dangerStepDungeon != null && r.dangerStepDungeon !== r.dangerStep ? ` (in dungeons +${pct1(r.dangerStepDungeon)})` : '';
  return `Enemies above level ${r.dangerFrom} hit harder: +${pct1(r.dangerStep)} damage per ${DANGER_LEVELS} levels${dungeon}.`;
}
/** Short line for the zone banner when the zone's enemies take zone danger (z.danger > 0), else null. */
export function dangerBanner(r, z) {
  return r.dangerFrom != null && z.danger > 0 ? `Enemies above level ${r.dangerFrom} hit harder` : null;
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
 * No number is written here: each comes from m or from D. mode: 'expedition' when new runs start on the expedition map
 * with the start camp (expedition.md 8.2, M2b v11: Scout's Eye is Pathfinder there, Swift Boots a Bell charge; the
 * entries with m.mapMode 'expedition' act only there), else the classic map.
 */
export function metaEffect(m, D, d, mode = 'rows') {
  const N = D.num; const NM = D.names;
  const sp = m.spell && d.spells[m.spell];
  const exp = mode === 'expedition';
  const onlyExp = 'No effect on the classic map.';
  switch (m.id) {
    case 'vigor': return { short: `+${pct1(m.hpPct)} max health per rank`, long: `Every hero starts with ${pct1(m.hpPct)} more maximum health for each rank.` };
    case 'edge': return { short: `+${pct1(m.powerPct)} Power per rank`, long: `Every hero has ${pct1(m.powerPct)} more Power for each rank: more damage from every attack and spell.` };
    case 'keen': return { short: `+${pct1(m.crit)} critical strike per rank`, long: `Every hero has +${pct1(m.crit)} chance to strike critically for each rank.` };
    case 'quick_study': return { short: `+${pct1(m.xpPct)} experience per rank`, long: `Every hero earns ${pct1(m.xpPct)} more experience for each rank: levels come sooner.` };
    case 'prospector': return { short: `+${pct1(m.goldPct)} gold per rank`, long: `Every hero finds ${pct1(m.goldPct)} more gold for each rank.` };
    case 'talent_pt': return { short: `+${m.points} talent ${plural(m.points, 'point')} at level ${N.maxLevel}`, long: `At level ${N.maxLevel} you get ${numWord(m.points)} more talent ${plural(m.points, 'point')} to spend.` };
    // M2b v6 (rules 7.5, 11.2): also the free potion, the first potion each fight costs no turn; M2b v8: at FREE_POTION_MULT
    // strength (D.freePotionMult from the engine; "half strength")
    case 'satchel': {
      const str = strengthText(D.freePotionMult);
      return { short: `Start with ${m.potions} ${plurName(m.potions, NM.potion)}; first potion each fight is free${str ? `, at ${str}` : ''}`,
        long: `Every run begins with ${numWord(m.potions)} ${plurName(m.potions, NM.potion)} in your bags, and the first potion you drink in each fight is a free action${str ? ` at ${str} (it restores ${pct1(D.freePotionMult)} of its normal amount)` : ''}: you act again in the same round.` };
    }
    case 'heirloom_blade': return { short: `${humanize(m.rarity)} starting weapon, item level ${m.ilvl}`, long: `Your starting weapon is ${m.rarity} quality, item level ${m.ilvl}, instead of a common one.` };
    case 'pockets': return { short: `+${m.slots} bag slots per rank`, long: `Your bags hold ${m.slots} more items for each rank.` };
    case 'ledger': return { short: 'First lesson at each trainer visit is free', long: 'At the trainer of every zone hub and of the camp, the first spell you learn or train costs no gold.' };
    case 'scout': {
      const x = m.expedition; const pf = x ? `the type of every node within ${numWord(x.typeRadius)} hops shows on the map (not its level, enemies or contract marks)` : null;
      const rows = `The zone map tells you which elites are rare, which chests are trapped, and which vendors sell an ${NM.ember}.`;
      if (exp && x) return { short: `${x.name}: node types within ${x.typeRadius} hops`, long: `On the expedition map Scout's Eye works as ${x.name}: ${pf}.`, more: [`Classic map: ${rows}`] };
      return { short: 'The map shows rare elites, traps and Embers', long: rows, more: pf ? [`Expedition map, as ${x.name}: ${pf}.`] : undefined };
    }
    case 'swift_boots': {
      const x = m.expedition; const bell = x ? `${numWord(x.bell)} more Homeward Bell ${plural(x.bell, 'charge')} each run (at most ${numWord(N.bellMax)})` : null;
      const rows = `You may travel on to the next zone ${numWord(m.levels)} ${plural(m.levels, 'level')} sooner than before.`;
      if (exp && x) return { short: `+${x.bell} Homeward Bell ${plural(x.bell, 'charge')} each run`, long: `On the expedition map you set out with ${bell}.`, more: [`Classic map: ${rows}`] };
      return { short: `Travel on opens ${numWord(m.levels)} ${plural(m.levels, 'level')} earlier`, long: rows, more: bell ? [`Expedition map: ${bell}.`] : undefined };
    }
    // expedition.md 8.2 (M2b v11): entries of the expedition map only (m.mapMode 'expedition'; the card shows a tag)
    case 'cartographer': return { short: `${NM.charts} every run, free`, long: `On the expedition map the start camp's ${NM.charts} are yours every run, free: every node's region and the dungeon's place show on the map. ${onlyExp}` };
    case 'old_hand': return { short: `${NM.tracker} every run, free`, long: `On the expedition map the start camp's ${NM.tracker} are yours every run, free: contract sites show within ${numWord(N.trackerRadius)} hops, hidden nodes too. ${onlyExp}` };
    case 'quartermaster': return { short: `+${m.points} preparation points per rank`, long: `On the expedition map you have ${numWord(m.points)} more preparation points to spend at the start camp for each rank. ${onlyExp}` };
    case 'alchemist': return { short: `Vendors sell ${plurName(2, NM.greater)}`, long: `Every vendor also sells ${plurName(2, NM.greater)}: each restores ${pct1(D.greaterHeal)} of your maximum health.` };
    case 'cache': {
      const u = D.uniques.rare;
      return { short: `${u.length} unique rares join elite and treasure loot`, long: 'One unique rare item for each zone can drop from elites, rares and treasure chests there.', more: u.map((x) => `${x.name} (${x.zoneName})`) };
    }
    case 'relics': {
      const u = D.uniques.epic;
      return { short: `${u.length} unique epics join dungeon boss loot`, long: 'One unique epic item for each dungeon can drop from its boss.', more: u.map((x) => `${x.name} (${x.dungeon || x.zoneName})`) };
    }
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
    case 'haste': return { short: `Par ${tolls(D.num.oathHaste)} sooner`, long: `${D.names.boss}'s par is ${tolls(D.num.oathHaste)} sooner: Ascendancy begins sooner, and the swift-victory bonus asks for a faster run.` };
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
  // expedition.md 8.2 (M2b v11): n.exp when the next run starts on the expedition map with the start camp
  const x = n.exp;
  if (m.scout) add('scout', x ? `Pathfinder: node types within ${x.typeRadius} hops` : 'Rare elites, traps and Embers on the map');
  if (m.swiftBoots) add('swift_boots', x ? `Homeward Bell: ${x.bell} ${plural(x.bell, 'charge')}` : `Travel on ${numWord(D.entries.swift_boots.levels)} ${plural(D.entries.swift_boots.levels, 'level')} earlier`);
  if (x && x.unlocks.cartographer) add('cartographer', `${D.names.charts} owned`);
  if (x && x.unlocks.old_hand) add('old_hand', `${D.names.tracker} owned`);
  if (x && x.unlocks.quartermaster) add('quartermaster', `${x.points} preparation points (+${x.points - D.num.prepPoints})`);
  if (m.alchemist) add('alchemist', `${plurName(2, D.names.greater)} at vendors`);
  if (m.cache) add('cache', 'Unique rares in elite and treasure loot');
  if (m.relics) add('relics', 'Unique epics in dungeon boss loot');
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
