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

export function spellText(id, content) {
  const t = content && content.texts && content.texts.spells && content.texts.spells[id];
  return t || (SPELLS[id] && SPELLS[id].text) || '';
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
