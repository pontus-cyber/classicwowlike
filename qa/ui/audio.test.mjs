// Sound (docs/specs/audio.md; src/ui/audio.js): the pure event-to-cue table, the decision view's cues (Deathblow telegraph
// once, its first show, the Furnace, the Dimming spreading near the player), the Instant rule, and the player's rules on a recording fake AudioContext: nothing is
// built before the first trusted gesture, every cue renders, the voice limit and priority, the Deathblow never dropped.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cuesFor, viewCues, newMemo, keepOfStep, actionCues, createAudio, dimmingNear, RANK, META, PROTECTED, CUE_NAMES, MAX_VOICES, DIM_NEAR, GLASS } from '../../src/ui/audio.js';

const names = (list) => list.map((c) => c.cue);
const P = { side: 'player' }; const E = { side: 'enemy', idx: 0 }; const PET = { side: 'pet' };

test('cuesFor: damage by kind (miss, immune, tick, crit, heavy, light, pet), taken hits marked', () => {
  const d = (o) => names(cuesFor({ t: 'damage', src: P, dst: E, amount: 10, maxHp: 1000, ...o }, o.info || {}));
  assert.deepEqual(d({ miss: true }), ['dodge']);
  assert.deepEqual(d({ immune: true }), []);
  assert.deepEqual(d({ tick: true }), ['tick']);
  assert.deepEqual(d({ crit: true }), ['crit']);
  assert.deepEqual(d({}), ['hitLight']);
  assert.deepEqual(d({ amount: 200 }), ['hitHeavy']); // 20 % of maximum health
  assert.deepEqual(d({ info: { power: 0.7 } }), ['hitHeavy']);
  assert.deepEqual(d({ src: E, dst: P, info: { heavy: true } }), ['hitHeavy']);
  assert.deepEqual(d({ src: PET, amount: 400 }), ['hitLight']); // pet hits stay light
  assert.equal(cuesFor({ t: 'damage', src: E, dst: P, amount: 5, maxHp: 100 })[0].taken, true);
});

test('cuesFor: kills, the player\'s death, level up, wind-ups and the Deathblow, MAIMED', () => {
  assert.deepEqual(cuesFor({ t: 'death', dst: E }, { rank: 'normal' }), [{ cue: 'kill', big: false }]);
  assert.deepEqual(cuesFor({ t: 'death', dst: E }, { rank: 'elite' }), [{ cue: 'kill', big: true }]);
  assert.deepEqual(names(cuesFor({ t: 'death', dst: P })), ['playerDeath']);
  assert.deepEqual(names(cuesFor({ t: 'death', dst: PET })), []);
  assert.deepEqual(names(cuesFor({ t: 'levelUp', level: 2 })), ['levelUp']);
  assert.deepEqual(names(cuesFor({ t: 'windup', result: 'answered', deathblow: true })), ['deathblowAnswered']);
  assert.deepEqual(names(cuesFor({ t: 'windup', result: 'landed', deathblow: true, maimed: true })), ['deathblowLanded', 'maimed']);
  assert.deepEqual(names(cuesFor({ t: 'windup', result: 'landed', deathblow: true })), ['deathblowLanded']);
  assert.deepEqual(names(cuesFor({ t: 'windup', result: 'answered' })), ['windupAnswered']);
  assert.deepEqual(names(cuesFor({ t: 'windup', result: 'landed' })), ['windupLanded']);
});

test('cuesFor: the should cues (heal, interrupt, trap, potion, loot) and silent events', () => {
  assert.deepEqual(cuesFor({ t: 'heal', dst: P, amount: 30, maimed: true }), [{ cue: 'heal', enemy: false, maimed: true }]);
  assert.deepEqual(cuesFor({ t: 'heal', dst: E, amount: 30 }), [{ cue: 'heal', enemy: true, maimed: false }]);
  assert.deepEqual(names(cuesFor({ t: 'interrupt', dst: E })), ['interrupt']);
  assert.deepEqual(names(cuesFor({ t: 'trapSprung', dst: E })), ['interrupt']);
  assert.deepEqual(names(cuesFor({ t: 'action', src: P, kind: 'item' })), ['potion']);
  assert.deepEqual(names(cuesFor({ t: 'action', src: P, kind: 'spell' })), []);
  assert.deepEqual(cuesFor({ t: 'gotItem', rarity: 'rare', heatUp: 'hot' }), [{ cue: 'loot', rarity: 'rare', heatUp: true }]);
  for (const t of ['round', 'xp', 'gold', 'status', 'victory', 'msg', 'fightStart']) assert.deepEqual(cuesFor({ t }), [], t);
  assert.deepEqual(names(actionCues('RING_BELL')), ['homewardBell']);
  assert.deepEqual(actionCues('MOVE'), []);
});

const fight = (track, o = {}) => ({ combat: { over: null, engage: o.engage || null, enemies: [{ uid: 'f1:0', idx: 0, alive: true, track }] }, player: {}, seed: 1 });
test('viewCues: the Deathblow telegraph once per Deathblow; not when answered; a breakable Sap still warns; first show in the engage round', () => {
  const m = newMemo();
  const later = [{ turn: 1 }, { turn: 3, deathblow: true }];
  assert.deepEqual(names(viewCues(null, fight(later, { engage: { options: [] } }), m)), ['deathblowFirstShow']);
  assert.deepEqual(names(viewCues(null, fight(later, { engage: { options: [] } }), m)), [], 'first show once per enemy');
  const now = [{ turn: 3, now: true, deathblow: true }];
  assert.deepEqual(names(viewCues(null, fight(now), m)), ['deathblowTelegraph']);
  assert.deepEqual(names(viewCues(null, fight(now), m)), [], 'a free action (same round) does not repeat it');
  assert.deepEqual(names(viewCues(null, fight([{ turn: 3, now: true, deathblow: true, cancel: { by: 'STUN' } }]), newMemo())), []);
  assert.deepEqual(names(viewCues(null, fight([{ turn: 3, now: true, deathblow: true, cancel: { by: 'SAPPED', breaks: true } }]), newMemo())), ['deathblowTelegraph']);
});

test('viewCues: the Furnace up a state (ticks by state) or back to Calm, nothing for other drops or a new run', () => {
  const v = (state, seed = 1) => ({ heat: { state }, player: {}, seed });
  assert.deepEqual(viewCues(v('clear'), v('hot'), newMemo()), [{ cue: 'furnaceUp', level: 2 }]);
  assert.deepEqual(names(viewCues(v('warm'), v('clear'), newMemo())), ['furnaceCalm']);
  assert.deepEqual(viewCues(v('scorched'), v('hot'), newMemo()), []);
  assert.deepEqual(viewCues(v('clear'), v('hot', 2), newMemo()), []);
});

// a map view: a line of nodes 0-1-2-3-4-5 (the player on `pos`), each { dimmed, dimsIn }; z the zone, seed the run
const mapV = (pos, dim, o = {}) => ({ seed: o.seed ?? 1, player: {}, zone: { idx: o.z ?? 1, exp: { z: o.z ?? 1, pos, edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]],
  nodes: dim.map((d, i) => ({ id: i, dimmed: d === 'D', dimsIn: d === 'D' ? null : d })) } } });
test('viewCues: the Dimming (cue 10) when the front reached new nodes and stands near the player; silent far away, on no spread, across zones', () => {
  const v = (prev, next) => names(viewCues(prev, next, newMemo()));
  // the front moves from node 0 to node 1; the player on node 4
  assert.deepEqual(v(mapV(4, ['D', 3, 6, 9, 12, 15]), mapV(4, ['D', 'D', 2, 5, DIM_NEAR, 11])), ['dimmingSpread'], 'his node dims in DIM_NEAR');
  assert.deepEqual(v(mapV(4, ['D', 3, 6, 9, 12, 15]), mapV(4, ['D', 'D', 2, 5, DIM_NEAR + 1, 11])), [], 'a spread far from him');
  assert.deepEqual(v(mapV(2, ['D', 3, 6, 9, 12, 15]), mapV(2, ['D', 'D', 5, 8, 11, 14])), ['dimmingSpread'], 'a node next to his was just Dimmed');
  assert.deepEqual(v(mapV(1, ['D', 3, 6, 9, 12, 15]), mapV(1, ['D', 'D', 5, 8, 11, 14])), ['dimmingSpread'], 'his own node was Dimmed');
  assert.deepEqual(v(mapV(4, ['D', 'D', 2, 5, 1, 11]), mapV(4, ['D', 'D', 2, 5, 1, 11])), [], 'no new Dimmed node: no cue, however close');
  assert.deepEqual(v(mapV(4, ['D', 3, 6, 9, 12, 15]), mapV(4, ['D', 'D', 2, 5, 1, 11], { z: 2 })), [], 'another zone');
  assert.deepEqual(v(mapV(4, ['D', 3, 6, 9, 12, 15]), mapV(4, ['D', 'D', 2, 5, 1, 11], { seed: 2 })), [], 'another run');
  assert.deepEqual(v(null, mapV(4, ['D', 'D', 2, 5, 1, 11])), [], 'no view before');
  assert.equal(dimmingNear({ zone: { exp: null } }, mapV(4, ['D', 'D', 2, 5, 1, 11])), false, 'not on the expedition map before');
  assert.ok(RANK.dimmingSpread < RANK.levelUp && RANK.dimmingSpread > RANK.kill && RANK.dimmingSpread > RANK.furnaceUp, 'ranks under level-up, over kills, hits and the Furnace');
});

test('keepOfStep: Instant keeps the top-ranked cue and every protected one', () => {
  const k = (list) => [...keepOfStep(list.map((cue) => ({ cue })))].map((i) => list[i]).sort();
  assert.deepEqual(k(['hitLight', 'hitHeavy', 'kill', 'tick']), ['kill']);
  assert.deepEqual(k(['hitHeavy', 'deathblowLanded', 'maimed', 'levelUp']), ['deathblowLanded', 'maimed']);
  assert.deepEqual(k(['crit', 'playerDeath', 'deathblowLanded']), ['deathblowLanded', 'playerDeath']);
  assert.deepEqual(k([]), []);
});

test('the tables: every cue has a rank and a length; the reserved voices are protected and rank above the rest', () => {
  assert.deepEqual(Object.keys(META).sort(), [...CUE_NAMES].sort());
  for (const n of PROTECTED) for (const o of CUE_NAMES.filter((x) => !PROTECTED.has(x))) assert.ok(RANK[n] > RANK[o], `${n} over ${o}`);
});

// ---- a recording fake of the Web Audio API (enough for the cues: params, gains, oscillators, buffers, filters)
function fakeAudio() {
  const made = { contexts: 0, nodes: 0, oscFreqs: [] };
  const param = (v = 0) => ({ value: v, setValueAtTime() {}, exponentialRampToValueAtTime(x) { assert.ok(x > 0, 'exponential ramp to a positive value'); }, linearRampToValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime() {} });
  const node = (extra = {}) => { made.nodes++; return { connect() {}, disconnect() {}, ...extra }; };
  class AC {
    constructor() { made.contexts++; this.sampleRate = 8000; this.currentTime = 0; this.state = 'running'; this.destination = node(); }
    createGain() { return node({ gain: param(1) }); }
    createOscillator() { const o = node({ type: 'sine', frequency: param(440), detune: param(0), start() {}, stop() {} }); const f = o.frequency; const set = f.setValueAtTime; f.setValueAtTime = (v) => { made.oscFreqs.push(v); set(v); }; return o; }
    createBiquadFilter() { return node({ type: 'lowpass', frequency: param(350), Q: param(1) }); }
    createBufferSource() { return node({ buffer: null, loop: false, start() {}, stop() {} }); }
    createConvolver() { return node({ buffer: null }); }
    createDynamicsCompressor() { return node({ threshold: param(), ratio: param(), attack: param(), release: param() }); }
    createBuffer(ch, n) { const d = Array.from({ length: ch }, () => new Float32Array(n)); return { getChannelData: (c) => d[c] }; }
    resume() { return Promise.resolve(); } suspend() { return Promise.resolve(); }
  }
  return { AC, made };
}
const stub = (o = {}) => { const s = { speed: 1, soundMaster: 0.7, soundSfx: 1, soundUi: 0.6, soundMuted: false, ...o }; return { get: (k) => s[k], get instant() { return s.speed === 0; }, set: (k, v) => { s[k] = v; } }; };
async function withFake(fn) {
  const { AC, made } = fakeAudio(); const prev = globalThis.AudioContext; globalThis.AudioContext = AC;
  try { await fn(made); } finally { globalThis.AudioContext = prev; }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('player: nothing is built before the first trusted gesture; the log is written anyway; then every cue renders', () => withFake(async (made) => {
  const a = createAudio(stub());
  a.event({ t: 'levelUp' }, {});
  a.unlock({ isTrusted: false });
  let info = a.info();
  assert.equal(made.contexts, 0); assert.equal(info.unlocked, false);
  assert.deepEqual(info.log.map((x) => [x.cue, x.kept, x.sound]), [['levelUp', true, false]]);
  a.unlock({ isTrusted: true });
  assert.equal(made.contexts, 1); assert.equal(a.info().unlocked, true);
  assert.equal(a.cue('kill').sound, true);
  for (const n of CUE_NAMES) { const b = createAudio(stub()); b.unlock(); assert.equal(b.cue(n, { level: 2, rarity: 'epic', heatUp: true, big: true, maimed: true, w: 1.2 }).sound, true, n); }
}));

test('player: the reserved gong (×1.414 partial on D2 or the tritone below) sounds only in the Deathblow cues', () => withFake(async (made) => {
  const a = createAudio(stub()); a.unlock();
  // the gong's partial set (×1.414, ×2.83, ×4.07 over one base; one cue shares one pitch variation)
  const gongs = (fs) => fs.some((b) => [1.414, 2.83, 4.07].every((r) => fs.some((f) => Math.abs(f / (b * r) - 1) < 0.002)));
  for (const n of CUE_NAMES) {
    made.oscFreqs.length = 0; const b = createAudio(stub()); b.unlock(); b.cue(n, { level: 3, rarity: 'epic', big: true });
    assert.equal(gongs(made.oscFreqs), ['deathblowTelegraph', 'deathblowFirstShow', 'deathblowLanded'].includes(n), n);
  }
}));

test('player: the reserved glass voice (two sines GLASS Hz apart, beating) sounds only in the Dimming cue', () => withFake(async (made) => {
  const glass = (fs) => fs.some((f) => fs.some((g) => g !== f && Math.abs(g / f - GLASS[1] / GLASS[0]) < 1e-6) && f > 1000);
  for (const n of CUE_NAMES) {
    made.oscFreqs.length = 0; const b = createAudio(stub()); b.unlock(); b.cue(n, { level: 3, rarity: 'epic', big: true, heatUp: true, maimed: true });
    assert.equal(glass(made.oscFreqs), n === 'dimmingSpread', n);
  }
}));

test('player: at most MAX_VOICES at once, two of a cue, no retrigger within 50 ms; the Deathblow and death never dropped', () => withFake(async () => {
  const a = createAudio(stub()); a.unlock();
  const k = (n) => a.cue(n).kept;
  assert.equal(k('hitHeavy'), true); assert.equal(k('hitHeavy'), false, 'retrigger within 50 ms');
  const longs = ['levelUp', 'kill', 'windupLanded', 'windupAnswered', 'loot', 'homewardBell', 'arrive'];
  for (const n of longs) assert.equal(k(n), true, n);
  assert.equal(k('tick'), false, 'a ninth cue ranked below every voice is dropped');
  assert.equal(k('furnaceCalm'), true, 'a ninth ranked above the lowest voice (the hit) takes its place');
  for (const n of ['deathblowTelegraph', 'deathblowLanded', 'maimed', 'deathblowAnswered', 'playerDeath', 'deathblowFirstShow']) assert.equal(k(n), true, n);
  await sleep(60); assert.equal(k('hitHeavy'), false, 'all eight voices protected or ranked above: a hit is dropped');
  assert.ok(MAX_VOICES === 8);
}));

test('player: Instant keeps one cue per step (plus protected); a skipped step likewise; 1x plays them all', () => withFake(async () => {
  const s = stub({ speed: 0 }); const a = createAudio(s); a.unlock();
  const ev = [{ t: 'damage', src: P, dst: E, amount: 10, maxHp: 1000 }, { t: 'damage', src: P, dst: E, amount: 300, maxHp: 1000 }, { t: 'death', dst: E }, { t: 'levelUp' }];
  a.beginStep('ATTACK'); for (const e of ev) a.event(e, { fast: true }); a.endStep();
  let log = a.info().log; assert.deepEqual(log.filter((x) => x.kept).map((x) => x.cue), ['levelUp']);
  s.set('speed', 1); await sleep(60);
  a.beginStep('ATTACK'); a.event(ev[0], {}); a.event(ev[1], { fast: true }); a.event({ t: 'windup', result: 'landed', deathblow: true, maimed: true }, { fast: true }); a.event(ev[2], { fast: true }); a.endStep();
  log = a.info().log.filter((x) => x.step === 2);
  assert.deepEqual(log.filter((x) => x.kept).map((x) => x.cue), ['hitLight', 'deathblowLanded', 'maimed'], 'played before the skip, then the protected');
  await sleep(60);
  a.beginStep('ATTACK'); for (const e of ev) { a.event(e, {}); await sleep(55); } a.endStep();
  assert.deepEqual(a.info().log.filter((x) => x.step === 3 && x.kept).map((x) => x.cue), ['hitLight', 'hitHeavy', 'kill', 'levelUp']);
}));

test('player: muted or at zero volume nothing renders, but the log keeps the cues', () => withFake(async () => {
  const s = stub({ soundMuted: true }); const a = createAudio(s); a.unlock();
  assert.equal(a.cue('levelUp').sound, false);
  s.set('soundMuted', false); s.set('soundUi', 0); await sleep(60);
  assert.equal(a.cue('uiClick').sound, false); assert.equal(a.cue('kill').sound, true);
}));
