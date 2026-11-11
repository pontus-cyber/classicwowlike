// Per-run record for the metrics (balance.md 3). Everything is read from the engine: the run summary
// (rules 9), s.stats counters and the events of each step. Compact arrays keep 2 000-run cells small.
//   fx: fights   [kindCode, rounds, outcome (1 won, 0 lost, 2 fled), HP % at the fight's end (before regen),
//                 zone (1-6; ZONE_COUNT + 1 for the Camp and the end boss), lowest HP during the fight in per mille of
//                 max HP rounded down (so "< CLOSE_FIGHT_HP × 1000" is exact; 0 on a death or resurrect), potions used]
//                 (M2 v3: zone, lowest HP and potions for B21, B24 and B38)
//   ne: entries  [riskTypeCode, CL - L, HP % at entry, died (0/1), HP % at exit] for the risk table
//       (a quest whose fight never starts keeps type 'quest' and is skipped by the table)
//   f2: combat v2 fields per fight, aligned with fx (combat-v2.md 11 "Recorder"; B50-B54):
//       [enemies at start, engage (actionLabel of the engage-round action, '' without an engage round), archetype of
//        its target ('' if none), round of the first OFF_BALANCE (0 none), windows opened, windows used (the player hit
//        that enemy with a spell, CAST or ENGAGE, while it was OFF_BALANCE), Signal resolved (0/1: a `summon` with
//        `signal`, the reinforcement joined), HP at the end of
//        round OPEN_ROUNDS in per mille (at the fight's end if earlier; 0 on a death), first target differs from the
//        default target (1 / 0; -1 with one enemy or no targeted action), archetype of the first target ('' none),
//        combat v2.1 (combat-v2.md 11 "Recorder", 16.2; B55): wind-ups answered (engine `stagger` events), wind-ups
//        landed (`empower` events), 1 if a wind-up's hit killed the player (no event: a killing wind-up adds no
//        stack, D60; counted from s.death.killer against the enemy's wind-up intent of that round), Disrupts (ENGAGE
//        `action` events with `disrupt`)]
//   wy: combat v2.1, answered wind-ups per run by fight kind and how: { '<kind>|<why>': n } (why of the `stagger`
//       event: interrupt, control, trap, disrupt, silenced, avoided)
//   fc: per fight, aligned with fx (mash report, docs/reports/mash-2026-11-11.md): [HP % at the fight's start, nodes
//       entered before it in the run (engine `node` events), enemies at the start as 'tid:k' joined by ',' (k: n normal,
//       e elite, r rare, d dungeon boss, b end boss)]
//   ht: heat (expedition.md H.6, rules 9): nodes entered per heat state [clear, warm, hot, scorched] (summary
//       heat.nodesByState; B56)
//   boss: at FIGHT_BOSS { lvl, ilvl (mean equipped), rare (share of slots rare or epic), empty, ember, gs (sum of the
//       equipped items' itemScore; heat report, balance-2026-11-11) }
//   ex: expedition runs (rules 1.9; expedition.md 11.1, MILESTONES 2b.4): the summary's expedition block (expRecord);
//       fight kind 'dim' (Dimmed encounters) is FIGHT_KINDS' last code
//   xs: expedition measures of the runner (sim/lib/runner.mjs): C_step agree / decisions, close-call zones
//   dm: Dimmed encounters (expedition runs with one; M2b v10 row C2, sim/lib/risk.mjs `dim`): [depth (engine `dim`
//       event), died (0/1), HP % at the encounter's start, HP % after it (0 on a death)]
//   ct: start camp and contracts (prep runs only; expedition.md 2-3, 11.1 B39, B40, B42, B46): { c: per contract taken
//       [zone, kind, from ('b' board, 'h' hub), state ('c' complete, 'e' expired, 'a' abandoned, 'h' held at the end),
//       progress, need], xpC (XP of contract rewards), xp (all XP gained), bought (prep options), res (Reserve left),
//       tr (1: Tracker's Notes), ch (1: Region Charts), ps (start-camp seconds in the run's minutes, PACE_PREP_S each) }
import { C, R } from './engine.mjs';
import { TYPE_CODE } from './risk.mjs';
import { C2 } from './params.mjs';
import { isEngageRound, isOffBalanceId, actionTarget, actionLabel, defaultTarget } from './view.mjs';

export const FIGHT_KINDS = ['quest', 'grind', 'elite', 'trash', 'dboss', 'treasure', 'camp', 'boss', 'dim'];
/** Enemy variant codes of the fc composition (combat.js makeEnemy `kind`). */
export const ENEMY_KIND_CODE = { normal: 'n', elite: 'e', rare: 'r', dboss: 'd', boss: 'b' };
export const FK = Object.fromEntries(FIGHT_KINDS.map((k, i) => [k, i]));
const pct = (x) => Math.max(0, Math.min(100, Math.round(x * 100)));
const permille = (x) => Math.max(0, Math.min(1000, Math.floor(x * 1000 + 1e-9)));
/** Zone code of a fight: 1-6, the Camp (and the end boss there) ZONE_COUNT + 1. */
const zoneOf = (s) => (s.zone && !s.zone.camp ? s.zone.z : C.ZONE_COUNT + 1);
const ENTRY_NODE = new Set(['quest', 'elite', 'dungeon', 'treasure']);

/** At a hub or camp trainer visit: does the gold cover TRAIN_ALL? null when nothing is trainable. */
export function trainAllCovered(s) {
  const p = s.player;
  let n = 0;
  for (const [id, k] of Object.entries(p.spells)) if (C.SPELL[id].source !== 'talent' && k.tl < p.level) n++;
  if (n === 0) return null;
  if (!R.isLegal(s, { type: 'TRAIN_ALL' })) return 0;
  const { events } = R.step(s, { type: 'TRAIN_ALL' }); // pure: the live state is not changed
  return events.filter((e) => e.t === 'train').length >= n ? 1 : 0;
}

export class Recorder {
  constructor({ trainCheck = true } = {}) {
    this.fx = [];
    this.ne = [];
    this.travelLv = [];
    this.train = [];
    this.ember = 0;
    this.boss = null;
    this.fight = null;
    this.entry = null;
    this.trainCheck = trainCheck;
    this.f2 = [];
    this.wy = {};
    this.xpC = 0;
    this.dm = [];
    this.dimAt = null;
    this.fc = [];
    this.nodeN = 0;
  }

  /** State facts before a step; with the action `a`, the combat v2 fields that need the state before it. */
  before(s, a = null) {
    const p = s.player;
    if (!p) return null;
    const fz = this.fight;
    if (fz && s.fight && a) {
      const tgt = actionTarget(a);
      if (s.fight.round === 1 && !fz.acted && isEngageRound(s)) {
        fz.engage = actionLabel(a);
        fz.engageArch = tgt !== null && s.fight.enemies[tgt] ? s.fight.enemies[tgt].arch : '';
      }
      fz.acted = true;
      if (fz.firstDiff === null && tgt !== null) {
        const n = s.fight.enemies.filter((e) => e.alive).length;
        fz.firstDiff = n >= 2 ? (tgt === defaultTarget(s) ? 0 : 1) : -1;
        fz.firstArch = s.fight.enemies[tgt] ? s.fight.enemies[tgt].arch : '';
      }
      fz.spell = a.type === 'CAST' || a.type === 'ENGAGE';
    }
    if (fz && s.fight) {
      // Combat v2.1: the wind-ups to be played this round (now-entries not stopped yet), to tell a killing wind-up.
      fz.wuNow = null;
      for (const e of s.fight.enemies) {
        const it = e.alive ? e.intent : null;
        if (it && it.windup && !it.cancelled && !it.interrupted && !it.skipped) (fz.wuNow = fz.wuNow || new Map()).set(e.idx, it.id);
      }
    }
    return { hp: p.hp, maxHp: p.d.maxHp, level: p.level, rounds: s.stats.rounds };
  }

  /** Combat v2.1: did a wind-up's hit end the run in this step (the enemy played its wind-up and is the killer)? */
  killedByWindup(s, events) {
    const fz = this.fight;
    const k = s.death && s.death.killer;
    if (!fz || !fz.wuNow || !k || typeof k.idx !== 'number' || fz.wuNow.get(k.idx) !== k.ability) return 0;
    return events.some((e) => e.t === 'enemyAction' && e.u === k.idx && e.id === k.ability) ? 1 : 0;
  }

  /** Close the fight's combat v2 fields (windows still open count as opened; used if hit). */
  closeF2(died, hpFrac) {
    const fz = this.fight;
    for (const w of fz.win.values()) if (w.used) fz.used++;
    fz.win.clear();
    if (fz.hpOpen === null) fz.hpOpen = died ? 0 : permille(hpFrac);
    this.f2.push([fz.n0, fz.engage, fz.engageArch, fz.firstOb, fz.opened, fz.used, fz.signal, fz.hpOpen, fz.firstDiff === null ? -1 : fz.firstDiff, fz.firstArch,
      fz.wuA, fz.wuL, fz.wuK, fz.dis]);
  }

  openEntry(type, dl, hpFrac) {
    this.entry = { type, dl, hp0: pct(hpFrac), hp1: null };
  }

  closeEntry(died, hpNow) {
    const e = this.entry;
    if (!e) return;
    this.entry = null;
    if (TYPE_CODE[e.type] === undefined) return;
    this.ne.push([TYPE_CODE[e.type], e.dl, e.hp0, died, died ? 0 : (e.hp1 !== null ? e.hp1 : pct(hpNow))]);
  }

  after(s, a, events, b) {
    if (!b) return;
    const p = s.player;
    let hp = b.hp;
    let lvlApplied = false;
    const hpAfter = () => p.hp / p.d.maxHp;
    for (const e of events) {
      switch (e.t) {
        case 'damage':
          if (e.dst === 'player') {
            hp -= e.amount;
            if (this.fight) this.fight.min = Math.min(this.fight.min, hp / p.d.maxHp);
          } else if (this.fight && e.src === 'player' && !e.tick && this.fight.spell && typeof e.dst === 'number') {
            const w = this.fight.win.get(e.dst);
            if (w) w.used = true;
          }
          break;
        case 'status':
          if (this.fight && typeof e.u === 'number' && isOffBalanceId(e.id)) {
            const fz = this.fight;
            if (e.on && !fz.win.has(e.u)) {
              fz.win.set(e.u, { used: false });
              fz.opened++;
              if (!fz.firstOb) fz.firstOb = fz.round;
            } else if (!e.on && fz.win.has(e.u)) {
              if (fz.win.get(e.u).used) fz.used++;
              fz.win.delete(e.u);
            }
          }
          break;
        case 'death':
          if (this.fight && typeof e.u === 'number' && this.fight.win.has(e.u)) {
            if (this.fight.win.get(e.u).used) this.fight.used++;
            this.fight.win.delete(e.u);
          }
          break;
        case 'round':
          if (this.fight) {
            this.fight.round = e.n;
            if (e.n === C2.OPEN_ROUNDS + 1 && this.fight.hpOpen === null) this.fight.hpOpen = permille(hp / p.d.maxHp);
          }
          break;
        case 'summon':
          if (this.fight && e.signal) this.fight.signal = 1;
          break;
        case 'stagger':
          if (this.fight) {
            this.fight.wuA++;
            const k = `${this.fight.kind}|${e.why}`;
            this.wy[k] = (this.wy[k] || 0) + 1;
          }
          break;
        case 'empower':
          if (this.fight) this.fight.wuL++;
          break;
        case 'action':
          if (this.fight && e.kind === 'engage' && e.disrupt) this.fight.dis++;
          break;
        case 'heal': if (e.dst === 'player') hp += e.amount; break;
        case 'levelUp': if (!lvlApplied) { hp += p.d.maxHp - b.maxHp; lvlApplied = true; } break;
        case 'resurrect': hp = Math.max(1, Math.round(C.RES_HP_PCT * p.d.maxHp)); break;
        case 'node':
          this.nodeN++;
          if (ENTRY_NODE.has(e.type)) this.openEntry(e.type, e.cl - b.level, b.hp / b.maxHp);
          break;
        case 'dim': this.dimAt = { d: e.depth, hp0: pct(hp / b.maxHp) }; break;
        case 'fight': {
          this.fight = {
            kind: e.kind, r0: b.rounds, min: hp / b.maxHp, z: zoneOf(s), pot: s.stats.potionsUsed,
            n0: e.enemies.length, engage: '', engageArch: '', acted: false, firstDiff: null, firstArch: '', spell: false,
            round: 1, firstOb: 0, opened: 0, used: 0, win: new Map(), signal: 0, hpOpen: null,
            wuA: 0, wuL: 0, wuK: 0, dis: 0, wuNow: null,
            hp0: pct(hp / b.maxHp), nodeN: this.nodeN, comp: fightComp(s, e),
          };
          const lvl = e.enemies.length ? e.enemies[0].level : b.level;
          if (e.kind === 'grind' || e.kind === 'camp') this.openEntry(e.kind, lvl - b.level, hp / b.maxHp);
          else if (this.entry && this.entry.type === 'quest' && e.kind === 'quest') this.entry.type = `quest${Math.min(3, e.enemies.length)}`;
          else if (this.entry && this.entry.type === 'elite' && e.kind === 'elite') {
            this.entry.dl = lvl - b.level;
            if (e.enemies.length > 1) this.entry.type = 'elite2';
          }
          break;
        }
        case 'victory':
        case 'fled': {
          if (this.fight) {
            const rounds = e.t === 'victory' ? e.rounds : s.stats.rounds - this.fight.r0;
            const fz = this.fight;
            this.fx.push([FK[fz.kind], rounds, e.t === 'victory' ? 1 : 2, pct(hp / p.d.maxHp), fz.z, permille(fz.min), s.stats.potionsUsed - fz.pot]);
            this.fc.push([fz.hp0, fz.nodeN, fz.comp]);
            this.closeF2(false, hp / p.d.maxHp);
            const k = this.fight.kind;
            this.fight = null;
            if (k === 'dim' && this.dimAt) { this.dm.push([this.dimAt.d, 0, this.dimAt.hp0, pct(hpAfter())]); this.dimAt = null; }
            if (this.entry) this.entry.hp1 = pct(hpAfter());
            if ((k === 'grind' || k === 'camp') && this.entry) this.closeEntry(0, hpAfter());
          }
          break;
        }
        case 'nodeDone':
          if (this.entry && this.entry.type !== 'grind') this.closeEntry(0, hpAfter());
          break;
        case 'runEnd':
          if (e.outcome === 'death') {
            if (this.fight) {
              const rounds = this.fight.kind === 'boss' ? s.stats.bossRounds : s.stats.rounds - this.fight.r0;
              this.fx.push([FK[this.fight.kind], rounds, 0, 0, this.fight.z, 0, s.stats.potionsUsed - this.fight.pot]);
              this.fc.push([this.fight.hp0, this.fight.nodeN, this.fight.comp]);
              this.fight.wuK = this.killedByWindup(s, events);
              this.closeF2(true, 0);
              this.fight = null;
            }
            if (this.dimAt) { this.dm.push([this.dimAt.d, 1, this.dimAt.hp0, 0]); this.dimAt = null; }
            this.closeEntry(1, 0);
          }
          break;
        case 'travel': this.travelLv.push(b.level); break;
        case 'xp': if (e.why === 'contract') this.xpC += e.amount; break;
        case 'service':
          if (this.trainCheck && e.service === 'trainer' && e.where !== 'node') {
            const c = trainAllCovered(s);
            if (c !== null) this.train.push(c);
          }
          break;
        case 'buy': if (e.item === 'ember_of_return') this.ember = 1; break;
        case 'bossStart': {
          const eq = C.SLOT_IDS.map((k) => p.equipped[k]).filter(Boolean);
          this.boss = {
            lvl: p.level,
            ilvl: eq.length ? eq.reduce((n, it) => n + it.ilvl, 0) / eq.length : 0,
            rare: eq.filter((it) => it.rarity === 'rare' || it.rarity === 'epic').length / C.SLOT_IDS.length,
            empty: C.SLOT_IDS.length - eq.length,
            gs: Math.round(eq.reduce((n, it) => n + R.itemScore(it, p.classId), 0)),
            ember: this.ember,
          };
          break;
        }
        default:
      }
    }
  }

  /** Final record. meta: { bot, cls, pet, seed, prof, tree, style, variant, steps, err, ms }. */
  finish(s, meta) {
    const sum = s.result ? s.result.summary : (s.player ? R.summary(s) : null);
    const st = s.stats || {};
    const lines = sum ? sum.echoes.lines : [];
    const line = (id) => { const l = lines.find((x) => x.id === id); return l ? l.echoes : 0; };
    const d = sum && sum.death;
    return {
      seed: meta.seed, bot: meta.bot, cls: meta.cls, pet: sum ? sum.petId : null, prof: meta.prof, tree: meta.tree,
      style: meta.style || null, variant: meta.variant || null,
      out: meta.err ? 'x' : (sum && sum.outcome === 'victory' ? 'v' : 'd'), err: meta.err || null,
      lvl: sum ? sum.level : 1, hours: sum ? sum.time : 0, asc: sum ? sum.ascendancy : null, hb: sum ? sum.timeAtBoss : null,
      rb: sum && sum.reachedBoss ? 1 : 0, bp: sum ? sum.bossPhase : 0, bhp: sum ? sum.bossHpPct : null, brd: sum ? sum.bossRounds : 0,
      min: sum ? [round2(sum.minutes.manual), round2(sum.minutes.autoplay)] : [0, 0],
      nodes: sum ? sum.nodes.total : 0, nt: sum ? { ...sum.nodes } : {}, fights: sum ? sum.fights : 0, rounds: sum ? sum.rounds : 0,
      camp: sum ? sum.campWaves : 0, quests: sum ? sum.quests : 0, dungeons: sum ? sum.dungeons : 0,
      kills: sum ? sum.kills : null, zone: sum ? sum.reached.zone : 1,
      death: d ? { z: d.zone, type: d.nodeType, row: d.row, round: d.round, by: d.killer ? d.killer.name : null, ab: d.killer ? d.killer.ability : null } : null,
      ech: sum ? sum.echoes.total : 0, echFirst: line('firstKill'), echSpeed: line('speed'),
      rests: st.rests || 0, potions: sum ? sum.potionsUsed : 0, res: sum ? sum.resurrectsUsed : 0,
      gold: sum ? sum.gold : null, travelLv: this.travelLv, train: this.train, ember: this.ember, boss: this.boss,
      fx: this.fx, f2: this.f2, wy: this.wy, fc: this.fc, ne: this.ne, steps: meta.steps, ms: meta.ms,
      ht: sum && sum.heat ? sum.heat.nodesByState : null,
      ...(sum && sum.expedition ? { ex: expRecord(sum.expedition) } : {}),
      ...(this.dm.length ? { dm: this.dm } : {}),
      ...(meta.xs ? { xs: meta.xs } : {}),
      ...(s.exp && s.exp.prep ? { ct: this.contractRecord(s) } : {}),
      ...(meta.rep ? { rep: meta.rep } : {}),
      ...(meta.pr ? { pr: meta.pr } : {}),
      ...(meta.tk ? { tk: meta.tk } : {}),
      ...(meta.bm ? { bm: meta.bm } : {}),
      ...(meta.log ? { log: meta.log } : {}),
      ...(meta.hash !== undefined ? { hash: meta.hash } : {}),
    };
  }
}

const round2 = (x) => Math.round(x * 100) / 100;

/** The fc composition of a `fight` event: 'tid:k' per enemy (template id from the state's enemy, else the name). */
function fightComp(s, e) {
  const live = s.fight ? s.fight.enemies : [];
  return e.enemies.map((x) => {
    const en = live.find((y) => y.idx === x.u);
    const tid = en && en.tid ? en.tid : x.kind === 'boss' ? 'boss' : String(x.name);
    return `${tid}:${ENEMY_KIND_CODE[x.kind] || '?'}`;
  }).join(',');
}

const CT_STATE = { complete: 'c', expired: 'e', abandoned: 'a', held: 'h' };
/** Contract block of a prep run's record (see the header: `ct`). */
Recorder.prototype.contractRecord = function contractRecord(s) {
  const x = s.exp;
  return {
    c: x.contracts.map((k) => [k.z, k.kind, k.from === 'hub' ? 'h' : 'b', CT_STATE[k.state] || '?', k.progress, k.need]),
    xpC: this.xpC, xp: (s.stats && s.stats.xpGained) || 0, bought: s.prep ? s.prep.bought.slice() : [], res: x.reserve || 0,
    tr: x.vision.tracker > 0 ? 1 : 0, ch: x.vision.regions ? 1 : 0,
    // Seconds of the start camp in the run's minutes (PACE_PREP_S per start camp; B12 from SET_OUT, M2b v11 row 7).
    ps: ((s.stats && s.stats.exp && s.stats.exp.preps) || 0) * C.PACE_PREP_S,
  };
};

/**
 * Expedition block of a record (engine summary `expedition`, engine-api.md 10.4): walks, passes, Dimmed fights and
 * zones, Bells rung, Roads taken, and per zone [z, tolls, nodes, walks, passes, dimFights, exit ('r' Road, 'b' Bell, '' none)].
 */
function expRecord(x) {
  return {
    walks: x.walks, passes: x.passes, dim: x.dimFights, dimZ: x.dimZones, bells: x.bellsRung, roads: x.roads,
    zones: x.zones.map((z) => [z.z, z.time, z.nodes, z.walks, z.passes, z.dimFights, z.exit === 'road' ? 'r' : z.exit === 'bell' ? 'b' : '']),
  };
}
