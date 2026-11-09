// Per-run record for the metrics (balance.md 3). Everything is read from the engine: the run summary
// (rules 9), s.stats counters and the events of each step. Compact arrays keep 2 000-run cells small.
//   fx: fights   [kindCode, rounds, outcome (1 won, 0 lost, 2 fled), HP % at the fight's end (before regen)]
//   ne: entries  [riskTypeCode, CL - L, HP % at entry, died (0/1), HP % at exit] for the risk table
//       (a quest whose fight never starts keeps type 'quest' and is skipped by the table)
import { C, R } from './engine.mjs';
import { TYPE_CODE } from './risk.mjs';

export const FIGHT_KINDS = ['quest', 'grind', 'elite', 'trash', 'dboss', 'treasure', 'camp', 'boss'];
export const FK = Object.fromEntries(FIGHT_KINDS.map((k, i) => [k, i]));
const pct = (x) => Math.max(0, Math.min(100, Math.round(x * 100)));
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
  }

  before(s) {
    const p = s.player;
    return p ? { hp: p.hp, maxHp: p.d.maxHp, level: p.level, rounds: s.stats.rounds } : null;
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
        case 'damage': if (e.dst === 'player') hp -= e.amount; break;
        case 'heal': if (e.dst === 'player') hp += e.amount; break;
        case 'levelUp': if (!lvlApplied) { hp += p.d.maxHp - b.maxHp; lvlApplied = true; } break;
        case 'resurrect': hp = Math.max(1, Math.round(C.RES_HP_PCT * p.d.maxHp)); break;
        case 'node':
          if (ENTRY_NODE.has(e.type)) this.openEntry(e.type, e.cl - b.level, b.hp / b.maxHp);
          break;
        case 'fight': {
          this.fight = { kind: e.kind, r0: b.rounds };
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
            this.fx.push([FK[this.fight.kind], rounds, e.t === 'victory' ? 1 : 2, pct(hp / p.d.maxHp)]);
            const k = this.fight.kind;
            this.fight = null;
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
              this.fx.push([FK[this.fight.kind], rounds, 0, 0]);
              this.fight = null;
            }
            this.closeEntry(1, 0);
          }
          break;
        case 'travel': this.travelLv.push(b.level); break;
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
      lvl: sum ? sum.level : 1, hours: sum ? sum.hours : 0, asc: sum ? sum.ascendancy : null, hb: sum ? sum.hoursAtBoss : null,
      rb: sum && sum.reachedBoss ? 1 : 0, bp: sum ? sum.bossPhase : 0, bhp: sum ? sum.bossHpPct : null, brd: sum ? sum.bossRounds : 0,
      min: sum ? [round2(sum.minutes.manual), round2(sum.minutes.autoplay)] : [0, 0],
      nodes: sum ? sum.nodes.total : 0, nt: sum ? { ...sum.nodes } : {}, fights: sum ? sum.fights : 0, rounds: sum ? sum.rounds : 0,
      camp: sum ? sum.campWaves : 0, quests: sum ? sum.quests : 0, dungeons: sum ? sum.dungeons : 0,
      kills: sum ? sum.kills : null, zone: sum ? sum.reached.zone : 1,
      death: d ? { z: d.zone, type: d.nodeType, row: d.row, round: d.round, by: d.killer ? d.killer.name : null, ab: d.killer ? d.killer.ability : null } : null,
      ech: sum ? sum.echoes.total : 0, echFirst: line('firstKill'), echSpeed: line('speed'),
      rests: st.rests || 0, potions: sum ? sum.potionsUsed : 0, res: sum ? sum.resurrectsUsed : 0,
      gold: sum ? sum.gold : null, travelLv: this.travelLv, train: this.train, ember: this.ember, boss: this.boss,
      fx: this.fx, ne: this.ne, steps: meta.steps, ms: meta.ms,
      ...(meta.log ? { log: meta.log } : {}),
      ...(meta.hash !== undefined ? { hash: meta.hash } : {}),
    };
  }
}

const round2 = (x) => Math.round(x * 100) / 100;
