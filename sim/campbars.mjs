#!/usr/bin/env node
// Camp bars at hero levels (handoff sim-2026-11-18c): the planner's Camp bar (templateBar camp) of each class's hero at
// hero level H, on the native engine with C.GATES.legacy and C.GATES.oruvathLegacy on, with the raw-damage template
// (SIM.CAMP_BAR_PREVENT false, the bar before) and the prevent-value template (true). A hero is built at the Camp with
// debug.build (power level POWER_OF_LEVEL[H], every class spell trained to it, profile `later`, talents by the standard
// build of SIM.DEFAULT_TREE, gear of `--rarity` at item level + 1); the bar is the template's, not a run's.
//
//   node sim/campbars.mjs [--hero 6,10,14,18,22] [--classes rogue,mage,hunter] [--rarity rare] [--json <file>]
import { writeFileSync } from 'node:fs';
import { R, C, CONTENT, GATE_DEFAULTS } from './lib/engine.mjs';
import { SIM } from './lib/params.mjs';
import { setGates, cellProfile } from './lib/runner.mjs';
import { standardTalent, templateBar, campSpellValue, spellValue } from './lib/policy.mjs';

function parse(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i += 2) o[argv[i].replace(/^--/, '')] = argv[i + 1];
  return o;
}

/** The Camp bars of a class's hero at hero level H: { raw, prevent, values } (values: campSpellValue of every known spell). */
export function campBars(cls, H, { rarity = 'rare', seed = 1 } = {}) {
  setGates({ ...Object.fromEntries(Object.entries(GATE_DEFAULTS).filter(([, on]) => on)), legacy: true, oruvathLegacy: true });
  try {
    const profile = cellProfile({ bot: 'planner', cls, prof: 'later', hero: H });
    const level = R.legacyPowerOf ? R.legacyPowerOf(H) : C.POWER_OF_LEVEL[H - 1];
    let s = R.debug.build({ content: CONTENT, classId: cls, petId: cls === 'hunter' ? SIM.DEFAULT_PET : null, seed, profile, zone: C.ZONE_COUNT + 1, level, rarity, talents: 'unspent' }).state;
    for (let t = standardTalent(s, SIM.DEFAULT_TREE[cls]); t && R.talentPointsFree(s) > 0; t = standardTalent(s, SIM.DEFAULT_TREE[cls])) s = R.step(s, { type: 'SPEND_TALENT', talentId: t }).state;
    const was = SIM.CAMP_BAR_PREVENT;
    SIM.CAMP_BAR_PREVENT = false;
    const raw = templateBar(s, { camp: true });
    const rawValues = Object.fromEntries(s.player.spellOrder.map((id) => [id, Math.round(spellValue(s, id, true))]));
    SIM.CAMP_BAR_PREVENT = true;
    const prevent = templateBar(s, { camp: true });
    SIM.CAMP_BAR_PREVENT = was;
    const values = Object.fromEntries(s.player.spellOrder.map((id) => [id, Math.round(campSpellValue(s, id))]));
    return { H, level: s.player.level, heroLevel: s.player.heroLevel, known: [...s.player.spellOrder], raw, prevent, rawValues, values };
  } finally { setGates(null); }
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());
if (isMain) {
  const a = parse(process.argv.slice(2));
  const heroes = (a.hero || '6,10,14,18,22').split(',').map(Number);
  const classes = (a.classes || 'rogue,mage,hunter').split(',');
  const out = {};
  const name = (id) => (id ? C.SPELL[id].name : '-');
  console.log('| class | hero | power | changed | raw-damage bar (before) | prevent-value bar (after) | off / on |');
  console.log('|---|---|---|---|---|---|---|');
  for (const cls of classes) {
    out[cls] = {};
    for (const H of heroes) {
      const b = campBars(cls, H, { rarity: a.rarity || 'rare' });
      out[cls][H] = b;
      const off = b.raw.filter((x) => x && !b.prevent.includes(x)).map(name);
      const on = b.prevent.filter((x) => x && !b.raw.includes(x)).map(name);
      const same = b.raw.join() === b.prevent.join();
      const changed = same ? 'no' : off.length ? 'spells' : 'order';
      console.log(`| ${cls} | ${H} | ${b.level} | ${changed} | ${b.raw.map(name).join(', ')} | ${b.prevent.map(name).join(', ')} | ${off.length ? `${off.join(', ')} / ${on.join(', ')}` : '-'} |`);
    }
  }
  if (a.json) writeFileSync(a.json, JSON.stringify(out, null, 1));
}
