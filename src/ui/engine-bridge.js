// engine-bridge.js - the ONLY module of the visual client that talks to the rules engine.
//
// The UI reads a "view" (plain data) and sends actions; it never computes rules. Today the bridge
// is backed by src/ui/mock-engine.js because src/rules.js has not landed on main yet. When it can
// complete a run, an adapter for it goes here and the mock stays reachable with ?mock=1.
//
// View shape consumed by the UI (all fields plain data):
//   phase: 'CREATE' | 'ZONE_HUB' | 'MAP' | 'NODE' | 'CAMP' | 'BOSS' | 'SUMMARY'      (rules.md 1.1)
//   hours, autoplay, seed
//   create:  { classId, petId, name, seed }
//   player:  { name, classId, className, petId, level, xp, xpToNext, rested, hp, maxHp,
//              res: { kind: 'energy'|'mana'|'focus', cur, max }, cp, cpMax, gold (copper),
//              stats: { sta, agi, int, spi, power, crit, critMult, dodge, armor, wd },
//              equip: { [slot]: item|null }, bag: (item|null)[], spells: [{ id, tl, rank }],
//              bar: (spellId|null)[7], itemBar: (consumableId|null)[3], talents: { id: rank },
//              talentPoints, talentSpent: { tree: n }, statuses: [{ id, rounds, stacks, value }],
//              boons: [{ id, name, nodesLeft }], resurrect: [source], pet: { id, name, hp, maxHp, alive, statuses } | null }
//   zone:    { idx, id, name, hubName, theme, band, exitLevel, blurb, rows: node[8][3], pos: { row, lane }, path, questsDone, storyDone }
//            node = { row, lane, type, cl, visited, title?, mobs?, eliteName?, dungeon?, bossName?, ... }
//   hub:     { used: { trainer, vendor, inn } }
//   node:    current node or hub service: { type, step, cl, ... }   step: intro|combat|reward|story|between|chest|opened|rest|vendor|trainer|shrine
//   combat:  { round, enemies: [{ idx, name, level, rank, arch, hp, maxHp, statuses, alive,
//              intent: { name, target, est, cast, heavy, interrupted, channel?, label?, next? } }],
//              target, cooldowns: { spellId: n }, potionCd, kind, isBoss, boss: { phase, asc }, over, title, fightNo, fights }
//   loot:    { kind: 'loot'|'reward'|'story', title, text?, gold, xp, items?, choices? }
//   summary: run summary (rules.md 9)
//   legal:   { lanes, travelOn, mustTravel, outOfCombat, spells: { id: { ok, reason, cd } },
//              items: [{ ok, reason, count, cd }], attack, flee, fleeChance, services, talents, trainer }
//
// Events returned by dispatch() drive animation: { t: 'damage'|'heal'|'action'|'status'|'death'|
// 'interrupt'|'skip'|'xp'|'levelUp'|'victory'|'defeat'|'flee'|'resurrect'|'bossPhase'|'summon'|... }.

import * as mock from './mock-engine.js';

const params = (() => {
  try { return new URLSearchParams(globalThis.location ? globalThis.location.search : ''); } catch { return new URLSearchParams(''); }
})();

function mockBackend(seed) {
  let state = mock.createState({ seed });
  return {
    mode: 'mock',
    data: mock.data,
    get state() { return state; },
    step(action) {
      const r = mock.step(state, action);
      if (r.ok) state = r.state;
      return r;
    },
    legal() { return mock.legalInfo(state); },
    autoAction() { return mock.autoAction(state); },
    describeSpell(id) { return mock.describeSpell(state, id); },
    itemScore(item) { return mock.itemScore(item, state.player ? state.player.classId : 'rogue'); },
    canDebug: true,
  };
}

export class Bridge {
  constructor(backend) {
    this.backend = backend;
    this.mode = backend.mode;
    this.data = backend.data;
    this.listeners = new Set();
    this.history = [];
    this._view = null;
    this._refresh();
  }

  _refresh() {
    const s = this.backend.state;
    this._view = { ...s, legal: s.player ? this.backend.legal() : { lanes: [], services: {}, items: [], spells: {} }, mode: this.mode };
  }

  /** Current view (read-only by convention). */
  get view() { return this._view; }

  /** Send an action. Returns { ok, error, events, view }. */
  dispatch(action) {
    const r = this.backend.step(action);
    if (r.ok) {
      this.history.push(action);
      if (this.history.length > 5000) this.history.shift();
      this._refresh();
      for (const fn of this.listeners) fn(this._view, r.events || [], action);
    }
    return { ok: r.ok, error: r.error, events: r.events || [], view: this._view };
  }

  /** Would this action be accepted right now? (no side effects) */
  wouldAccept(action) {
    if (this.mode === 'mock') {
      const r = mock.step(this.backend.state, action);
      return r.ok;
    }
    return true;
  }

  /** The action the engine's autoplay policy (rules.md 7.9) picks for the current state. */
  autoAction() { return this.backend.autoAction(); }

  describeSpell(id) { return this.backend.describeSpell(id); }
  itemScore(item) { return this.backend.itemScore(item); }
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  get canDebug() { return !!this.backend.canDebug; }
}

/** Create the bridge. Flags: ?mock=1 forces the mock engine, ?seed=N fixes the run seed. */
export function createBridge(opts = {}) {
  const seedParam = params.get('seed');
  const seed = opts.seed ?? (seedParam !== null && seedParam !== '' ? Number(seedParam) >>> 0 : undefined);
  // The real engine (src/rules.js) is not on main yet; the mock is the only backend for now.
  return new Bridge(mockBackend(seed));
}

export const flags = {
  mock: params.get('mock') === '1',
  debug: params.get('debug') === '1',
  speed: params.get('speed'),
};
