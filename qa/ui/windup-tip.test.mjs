// L2 (hand-off content-2026-11-25, draft): the wind-up tooltip says "nothing can stop it" once. A Deathblow that nothing can
// answer yet (the engine's windupView `ready` false) gets "Nothing you have now can stop it. ..."; with it shown, the line
// "Nothing on your bar stops it: ..." is not added. Runs windupLines (src/ui/tracks.js) on a minimal stand-in for the DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';

class N { constructor() { this.children = []; } appendChild(c) { this.children.push(c); return c; } removeChild(c) { this.children = this.children.filter((x) => x !== c); return c; } get firstChild() { return this.children[0] || null; } }
class T extends N { constructor(t) { super(); this.t = t; } get text() { return this.t; } }
class E extends N {
  constructor(tag) { super(); this.tag = tag; this.classes = new Set(); this.dataset = {}; this.style = new Proxy({ setProperty() {} }, { set: (o, k, v) => { o[k] = v; return true; } }); this.attrs = {}; }
  get classList() { return { add: (c) => this.classes.add(c), remove: (c) => this.classes.delete(c), toggle: () => {}, contains: (c) => this.classes.has(c) }; }
  set className(v) { for (const c of String(v).split(/\s+/).filter(Boolean)) this.classes.add(c); }
  get className() { return [...this.classes].join(' '); }
  setAttribute(k, v) { this.attrs[k] = v; } addEventListener() {} set textContent(v) { this.children = [new T(String(v))]; }
  get text() { return this.children.map((c) => c.text).join(''); }
  getContext() { return new Proxy(function () {}, { get: () => () => new Proxy(function () {}, { get: () => () => {} }) }); }
  toDataURL() { return 'data:'; }
}
/** Run fn with the stand-in installed, and the page's globals put back after (qa/ui/index.js runs every file in one process). */
function withDom(fn) {
  const keys = ['Node', 'document']; const saved = keys.map((k) => Object.getOwnPropertyDescriptor(globalThis, k));
  globalThis.Node = N;
  globalThis.document = { createElement: (t) => new E(t), createTextNode: (t) => new T(t), addEventListener() {}, querySelectorAll: () => [] };
  try { return fn(); } finally { keys.forEach((k, i) => { if (saved[i]) Object.defineProperty(globalThis, k, saved[i]); else delete globalThis[k]; }); }
}
const mem = new Map();
globalThis.localStorage ??= { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => { mem.set(k, String(v)); }, removeItem: (k) => { mem.delete(k); } };
const { windupLines: windupLines0 } = await import('../../src/ui/tracks.js');
const windupLines = (...a) => withDom(() => windupLines0(...a));

const DB = 'Nothing you have now can stop it. Kill it first, or be ready to take it.';
const BAR = 'Nothing on your bar stops it: plan your engage round, or kill it first.';
const texts = (lines) => lines.filter(Boolean).map((l) => l.text);
const ctx = (w) => ({
  view: { player: { hp: 500, bar: [] }, legal: { spells: {} }, combat: { round: 1, windups: w ? [w] : [], enemies: [] } },
  data: { spells: {}, v2: { num: {} } },
});
const enemy = { idx: 0, name: 'Hobb' };

test('L2: a Deathblow nothing can answer yet says it once; the bar line is not added after it', () => {
  const w = { u: 0, turn: 1, ready: false, answers: [], est: 100, stagger: 0.3, empower: 0.2, maims: false };
  const t = texts(windupLines(enemy, { deathblow: true, windup: true, turn: 1, round: 3, now: false, heavy: true, est: 100, target: 'player', kind: 'attack' }, ctx(w), null));
  assert.equal(t.filter((x) => x === DB).length, 1);
  assert.equal(t.filter((x) => x === BAR).length, 0, t.join(' | '));
});

test('L2: without the Deathblow line, the bar line still shows (a wind-up nothing on the bar stops, not now)', () => {
  const t = texts(windupLines(enemy, { windup: true, turn: 1, round: 3, now: false, heavy: true, est: 100, target: 'player', kind: 'attack' }, ctx(null), null));
  assert.equal(t.filter((x) => x === BAR).length, 1, t.join(' | '));
  assert.equal(t.filter((x) => x === DB).length, 0);
});

test('L2: a Deathblow that can be answered gets its answer line, and no "nothing" line', () => {
  const w = { u: 0, turn: 1, ready: true, answers: [{ via: 'engage', id: 'x', name: 'Stun', now: true, sure: true }], est: 100, stagger: 0.3, empower: 0.2, maims: false };
  const t = texts(windupLines(enemy, { deathblow: true, windup: true, turn: 1, round: 3, now: false, heavy: true, est: 100, target: 'player', kind: 'attack' }, ctx(w), null));
  assert.equal(t.filter((x) => x === DB).length, 0);
  assert.equal(t.filter((x) => x === BAR).length, 1, 'nothing on the bar answers it: its own line stays');
  assert.ok(t.some((x) => /^Stop it now/.test(x)));
});
