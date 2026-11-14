// D152 (docs/specs/changes-m3-v2.md; docs/handoffs/engine-2026-11-14f.md section 6) and the blind round 2 leftovers
// (docs/handoffs/ui-2026-11-14f.md): the UI's pure parts in Node. The Furnace label and tooltip line by heatView `by`
// (section 4), the lean first run through the bridge (no contracts, "You set out.", the unspent line, the summary's Echo
// label), the contract hints off on a first run, the hub Vendor card's line, the bags' stable layout. The browser checks
// are ui-regress parts T (camp), M, R, S, U and V.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage ??= { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => { mem.set(k, String(v)); }, removeItem: (k) => { mem.delete(k); } };
const C = await import('../../src/constants.js');
const { CONTENT } = await import('../../src/content/index.js');
const { meterText, dimTipLine, heatToast } = await import('../../src/ui/heat.js');
const { vendorMeta } = await import('../../src/ui/screens.js');
const { leanFirst } = await import('../../src/ui/onboarding.js');
const { unspentLine } = await import('../../src/ui/prep.js');
const { stableBag } = await import('../../src/ui/windows.js');
const { createBridge } = await import('../../src/ui/engine-bridge.js');

test('section 4: the Furnace line and tooltip by heatView `by`', () => {
  assert.equal(meterText({ by: 'run', heat: -4, dimIn: 6 }), '4 tolls to spare');
  assert.equal(meterText({ by: 'dim', heat: -4, dimIn: 3 }), 'Your node dims in 3 tolls');
  assert.equal(meterText({ by: 'dim', heat: -4, dimIn: 1 }), 'Your node dims in 1 toll');
  assert.equal(meterText({ by: 'dim', heat: -1, dimIn: 0 }), 'You stand in the Dimming');
  assert.equal(heatToast({ state: 'scorched', heat: -1, by: 'dim', dimIn: 0 }), 'The Furnace: Infernal · You stand in the Dimming.');
  assert.equal(dimTipLine({ heat: -4 }), 'Tolls: 4 to spare. The Dimming near you sets the Furnace now.');
  assert.equal(dimTipLine({ heat: 2 }), 'Tolls: 2 overspent. The Dimming near you sets the Furnace now.');
});

test('a lean first run through the bridge: no contracts, "You set out.", the camp\'s unspent line, contract hints off', () => {
  mem.clear();
  const b = createBridge({});
  assert.equal(b.view.phase, 'CREATE');
  b.dispatch({ type: 'START_RUN' });
  const pv = b.view.prep;
  assert.equal(pv.first, true);
  assert.equal(pv.board.length, 0);
  assert.equal(pv.reserve, undefined, 'no Reserve on a first run: the camp\'s tooltips must not read it');
  assert.equal(b.view.contracts, null);
  assert.equal(leanFirst(b.view), true);
  const line = unspentLine(pv, { data: b.data });
  assert.equal(line, CONTENT.tutorial.prep.unspentFirst.replace('{echoes}', String(pv.left * C.PREP_ECHO_PER_POINT)));
  const r = b.dispatch({ type: 'SET_OUT' });
  assert.deepEqual(r.events.filter((e) => e.t === 'msg').map((e) => e.text), ['You set out.']);
  assert.equal(b.view.contracts, null);
  assert.equal(leanFirst(b.view), true);
  assert.equal(leanFirst({ phase: 'MAP', contracts: { contracts: [] }, prep: null }), false, 'a later run keeps its contract hints');
});

test('the hub Vendor card says what the hub vendor sells', () => {
  assert.equal(vendorMeta({ hub: { gearLeft: null } }), 'Potions, rations and gear');
  assert.equal(vendorMeta({ hub: { gearLeft: 2 } }), 'Potions, rations and gear');
  assert.equal(vendorMeta({ hub: { gearLeft: 0 } }), 'Potions and rations (gear sold out)');
});

test('bags: slots stay put while open (a gap after an equip); a null layout (bags closed) is compact', () => {
  const bag = (ids) => [...ids.map((u) => ({ uid: u })), ...Array(6 - ids.length).fill(null)];
  const a = stableBag(null, bag(['a', 'b', 'c', 'd']));
  const b = stableBag(a, bag(['a', 'c', 'd']));
  assert.deepEqual(b.uids, ['a', null, 'c', 'd', null, null], 'open: the gap stays');
  const c = stableBag(null, bag(['a', 'c', 'd']));
  assert.deepEqual(c.uids, ['a', 'c', 'd', null, null, null], 'opened again: compact');
});
