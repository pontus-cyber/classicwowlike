#!/usr/bin/env node
// Text play of one run (M1 1.2). The engine (src/rules.js) runs the game; this file only shows the state and
// sends the chosen action.
//
// Interactive (reads stdin):  node sim/play.mjs --class mage --seed 42 [--pet ridgewolf] [--profile fresh]
//   Each turn shows the state and the numbered legal actions. Type a number, or:
//     auto [N]       let the autoplay policy (rules 7.9 + default policy) take N steps (default 1)
//     fight          autoplay until the current fight ends
//     bot NAME [N]   let a bot (random, greedy, planner, speedrunner, tactician) take N steps (default: to the end)
//     all            list every legal action (bar and item-bar edits are hidden by default)
//     map | state    print the map / the full state
//     {"type":...}   send a raw action (e.g. {"type":"SET_NAME","name":"Ash"})
//     quit
//
// Scripted (QA, agents):  node sim/play.mjs --class mage --seed 42 --script run.txt [--transcript out.md]
//   run.txt holds one command per line in the same syntax (numbers refer to the list shown at that point;
//   lines starting with # are comments). The transcript shows the state, each action and its events.
//   --finish auto|bot:NAME plays on after the script until the run ends.
import { readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { R, newRunFor } from './lib/engine.mjs';
import { describeState, describeAction, describeEvents, listActions } from './lib/textview.mjs';
import { createBot, BOT_NAMES } from './bots/index.mjs';
import { buildProfile } from './lib/profiles.mjs';
import { SIM } from './lib/params.mjs';
import { defaultTrees, profileGroup } from './lib/trees.mjs';

function parse(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i].replace(/^--/, '');
    o[k] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  }
  return o;
}

const args = parse(process.argv.slice(2));
const classId = args.class || 'rogue';
const seed = Number(args.seed ?? 1);
const profile = buildProfile(args.profile || 'fresh', classId);
const state = newRunFor({ classId, petId: classId === 'hunter' ? (args.pet || SIM.DEFAULT_PET) : null, seed, profile });
const out = [];
const emit = (line) => { if (args.script) out.push(line); else process.stdout.write(`${line}\n`); };
const bots = {};
// Bots play the recorded default tree of the class and profile group (balance.md 1.3, M2 v5).
const botTree = defaultTrees(profileGroup(args.profile || 'fresh'))[classId];
const botFor = (name) => bots[name] || (bots[name] = createBot(name, { classId, seed, tree: botTree }));

emit(`# Run: ${classId}, seed ${seed}, profile ${args.profile || 'fresh'}`);

function show(full = false) {
  emit('');
  emit(describeState(state, { map: true }));
  const list = listActions(state);
  const shown = full ? list : list.filter((x) => x.main);
  emit(`Actions:${shown.map((x) => `\n  ${x.n}. ${describeAction(state, x.a)}`).join('')}${shown.length < list.length ? `\n  (+${list.length - shown.length} more: type "all")` : ''}`);
}

function apply(a, who = '') {
  const text = describeAction(state, a);
  let events;
  try { events = R.stepInPlace(state, a); } catch (e) { emit(`! ${e.message}`); return false; }
  emit(`> ${who}${text}`);
  for (const l of describeEvents(state, events)) emit(l);
  return true;
}

/** Run one command line. Returns false to stop. */
function command(line) {
  const t = line.trim();
  if (!t || t.startsWith('#')) return true;
  if (state.phase === 'ENDED') return false;
  if (t === 'quit' || t === 'q') return false;
  if (t === 'all') { show(true); return true; }
  if (t === 'map' || t === 'state') { emit(describeState(state, { map: true })); return true; }
  if (t.startsWith('{')) { apply(JSON.parse(t)); return true; }
  const [cmd, a1, a2] = t.split(/\s+/);
  if (cmd === 'auto') { for (let i = 0; i < Number(a1 || 1) && state.phase !== 'ENDED'; i++) apply(R.autoAction(state), '(auto) '); return true; }
  if (cmd === 'fight') { while (state.fight && state.phase !== 'ENDED') apply(R.autoAction(state), '(auto) '); return true; }
  if (cmd === 'bot') {
    if (!BOT_NAMES.includes(a1)) { emit(`! unknown bot ${a1}`); return true; }
    const n = a2 ? Number(a2) : Infinity;
    for (let i = 0; i < n && state.phase !== 'ENDED'; i++) apply(botFor(a1).choose(state), `(${a1}) `);
    return true;
  }
  if (/^\d+$/.test(cmd)) {
    const x = listActions(state).find((y) => y.n === Number(cmd));
    if (!x) { emit(`! no action ${cmd}`); return true; }
    apply(x.a);
    return true;
  }
  emit(`! unknown command "${t}"`);
  return true;
}

function finish() {
  if (state.result) {
    const s = state.result.summary;
    emit('');
    emit(`Result: ${s.outcome} at level ${s.level}, zone ${s.reached.zone}, ${s.time} tolls, ${s.minutes.manual.toFixed(1)} min (manual estimate), Echoes ${s.echoes.total}${s.death ? `; died in ${s.death.nodeType} (zone ${s.death.zone}) to ${s.death.killer.name} (${s.death.killer.ability})` : ''}`);
  }
}

if (args.script) {
  const lines = readFileSync(args.script, 'utf8').split('\n');
  show();
  for (const l of lines) {
    if (!command(l)) break;
    if (l.trim() && !l.trim().startsWith('#') && state.phase !== 'ENDED') show();
  }
  if (args.finish && state.phase !== 'ENDED') {
    const who = String(args.finish);
    while (state.phase !== 'ENDED') apply(who.startsWith('bot:') ? botFor(who.slice(4)).choose(state) : R.autoAction(state), `(${who}) `);
  }
  finish();
  const text = `${out.join('\n')}\n`;
  if (args.transcript) writeFileSync(args.transcript, text); else process.stdout.write(text);
} else {
  show();
  const rl = createInterface({ input: process.stdin, terminal: false });
  for await (const line of rl) {
    if (!command(line) || state.phase === 'ENDED') break;
    show();
  }
  finish();
  rl.close();
}
