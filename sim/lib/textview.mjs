// Plain-text view of a run for sim/play.mjs: state, numbered legal actions and event lines. Display only;
// every number comes from the state, mapView, spellInfo and the events.
import { C, R, countCons } from './engine.mjs';

const money = (c) => {
  const g = Math.floor(c / 10000);
  const s = Math.floor((c % 10000) / 100);
  const cc = c % 100;
  return `${g ? `${g}g ` : ''}${g || s ? `${s}s ` : ''}${cc}c`;
};
const SPELL = C.SPELL;
const spellName = (id) => (SPELL[id] ? SPELL[id].name : id);
const consName = (id) => (C.CONSUMABLE[id] ? C.CONSUMABLE[id].name : id);
const unitName = (s, u) => {
  if (u === 'player') return 'you';
  if (u === 'pet') return s.player.pet ? C.PET[s.player.pet.id].name : 'pet';
  const e = s.fight && s.fight.enemies[u];
  return e ? `[${u}] ${e.name}` : `[${u}]`;
};
const TYPE = { quest: 'Quest', grind: 'Grind', elite: 'Elite', dungeon: 'Dungeon', rest: 'Rest', vendor: 'Vendor', trainer: 'Trainer', treasure: 'Treasure', shrine: 'Shrine' };

function itemText(s, it) {
  if (it.kind === 'cons') return `${consName(it.id)} x${it.qty}`;
  if (it.kind === 'junk') return `${it.name} (junk) x${it.qty}`;
  const sc = R.itemScore(it, s.player.classId);
  const eq = R.itemScore(s.player.equipped[it.slot], s.player.classId);
  const st = Object.entries(it.stats).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${k}`).join(', ');
  const extra = [it.wd ? `${it.wd} WD` : '', it.power ? `${it.power} power` : '', it.crit ? `${(it.crit * 100).toFixed(1)} % crit` : '', it.armor + it.bonusArmor ? `${it.armor + it.bonusArmor} armor` : '', it.effect ? `effect ${it.effect}` : ''].filter(Boolean).join(', ');
  const arrow = sc > eq ? ` [+${(sc - eq).toFixed(1)} score]` : '';
  return `${it.name} (${it.rarity} ${it.slot}, ilvl ${it.ilvl}; ${st}${extra ? `; ${extra}` : ''})${arrow}`;
}

function mapLines(s) {
  const v = R.mapView(s);
  if (!v) return [];
  const out = [`Map of ${v.name} (you are at row ${v.pos.r}${v.pos.r ? `, lane ${v.pos.l}` : ' (hub)'}; reachable lanes: ${v.next.join(', ') || 'none, travel on'})`];
  for (let r = v.rows.length; r >= 1; r--) {
    const cells = v.rows[r - 1].map((n, l) => {
      let t = `${TYPE[n.type]} ${n.type === 'elite' ? n.level : n.type === 'dungeon' ? `${n.level}/${n.bossLevel}` : n.cl}`;
      if (n.type === 'quest') t += ` x${n.archetypes.length}`;
      if (n.type === 'elite') t += `${n.archetypes.length > 1 ? '+add' : ''}${n.rare ? ' RARE' : ''}`;
      if (n.type === 'treasure' && n.guarded) t += ' guarded';
      const here = v.pos.r === r && v.pos.l === l ? '*' : n.done ? '.' : ' ';
      return `${here}${t}`.padEnd(22);
    });
    out.push(`  r${r} ${cells.join('')}`);
  }
  return out;
}

function intentText(it) {
  if (!it) return '-';
  if (it.kind === 'boss') return it.actions.map((a) => `${a.name}${a.est ? ` ~${a.est}` : ''}`).join(' + ') + (it.cast ? ' (cast)' : '');
  return `${it.name}${it.est ? ` ~${it.est}` : ''}${it.target && it.target !== 'player' ? ` -> ${it.target}` : ''}${it.cast ? ' (cast)' : ''}${it.heavy ? ' (heavy)' : ''}${it.interrupted ? ' INTERRUPTED' : ''}`;
}

const stText = (st) => st.map((x) => `${x.id}${x.stacks > 1 ? `x${x.stacks}` : ''}${x.dur ? `(${x.dur})` : ''}`).join(' ');

/** Readable state: zone, map, character, resources, bars, bag, talents, fight with intents. */
export function describeState(s, { map = true } = {}) {
  const L = [];
  if (s.phase === 'CREATE') {
    L.push(`Create a character: class ${s.create.classId || '-'}, pet ${s.create.petId || '-'}, seed ${s.create.seed}`);
    return L.join('\n');
  }
  const p = s.player;
  const zone = s.zone ? (s.zone.camp ? `Camp: ${s.content.camp.name}` : `Zone ${s.zone.z} ${s.content.zones[s.zone.z - 1].name}`) : '';
  L.push(`== ${zone} | phase ${s.phase}${s.node ? ` | node ${TYPE[s.node.type]} r${s.node.r} (stage ${s.node.stage})` : ''} | hours ${s.hours}${s.service ? ` | ${s.service.kind} open` : ''}`);
  const res = p.classId === 'mage' ? `Mana ${p.mana}/${p.d.maxMana}` : s.fight ? (p.classId === 'rogue' ? `Energy ${s.fight.p.energy} CP ${s.fight.p.cp}` : `Focus ${s.fight.p.focus}`) : '';
  L.push(`${C.CLASS[p.classId].name} L${p.level} (XP ${p.xp}/${R.xpToNext(p.level)}, rested ${p.rested}) HP ${p.hp}/${p.d.maxHp} ${res} | Gold ${money(p.gold)}${p.pet ? ` | ${C.PET[p.pet.id].name} ${p.pet.alive ? `${p.pet.hp}/${p.d.petMaxHp}` : 'dead'}` : ''}`);
  L.push(`Bar: ${p.bar.map((id, i) => `${i + 1} ${id ? `${spellName(id)} (tl ${p.spells[id].tl})` : '-'}`).join(' | ')}`);
  L.push(`Items: ${p.itemBar.map((id, i) => `${i + 1} ${id ? `${consName(id)} x${countCons(s, id)}` : '-'}`).join(' | ')} | Talent points free: ${R.talentPointsFree(s)}${Object.keys(p.talents).length ? ` | Talents: ${Object.entries(p.talents).map(([k, r]) => `${C.TALENT[k].name} ${r}`).join(', ')}` : ''}`);
  if (!s.fight) {
    L.push(`Bag (${p.bag.length}): ${p.bag.map((it) => itemText(s, it)).join('; ') || 'empty'}`);
    const res2 = [p.res.boon ? `Boon of Return x${p.res.boon}` : '', p.res.meta ? `Second Breath x${p.res.meta}` : ''].filter(Boolean).join(', ');
    if (res2) L.push(`Resurrects: ${res2}`);
    if (map && (s.phase === 'MAP' || s.phase === 'ZONE_HUB')) L.push(...mapLines(s));
    if (s.loot.length) L.push(`Loot window: ${s.loot.map((it) => itemText(s, it)).join('; ')}`);
    if (s.node && s.node.stage === 'reward' && s.node.rewards.length) {
      const set = s.node.rewards[0];
      L.push(`Choose a reward: ${set.kind === 'items' ? set.items.map((it, i) => `(${i}) ${itemText(s, it)}`).join('; ') : set.boons.map((b, i) => `(${i}) ${C.BOON[b].name}`).join('; ')}`);
    }
    if (s.service && s.service.kind === 'vendor') L.push(`Stock: ${s.service.stock.map((e, i) => `(${i}) ${e.kind === 'cons' ? consName(e.id) : itemText(s, e.item)} ${money(e.price)}${e.sold ? ' SOLD' : ''}`).join('; ')}`);
  } else {
    const f = s.fight;
    L.push(`Fight (${f.kind}) round ${f.round}${f.boss ? ` | boss phase ${f.boss.phase}, Ascendancy ${f.boss.asc}` : ''} | your statuses: ${stText(f.p.st) || 'none'}`);
    for (const e of f.enemies) {
      if (!e.alive) continue;
      L.push(`  [${e.idx}] ${e.name} (${e.kind}${e.arch ? `, ${e.arch}` : ''}) L${e.level} HP ${e.hp}/${e.maxHp}${e.shield ? ` shield ${e.shield}` : ''} | intent: ${intentText(e.intent)}${e.st.length ? ` | ${stText(e.st)}` : ''}`);
    }
    if (f.boss && f.enemies[0].intent && f.enemies[0].intent.telegraph) {
      const t = f.enemies[0].intent.telegraph;
      L.push(`  Telegraph: crush next round ${t.crushNextRound}, litany in ${t.litanyInRounds}, brand in ${t.brandInRounds}, enrage in ${t.enrageInRounds}${t.shardsInRounds !== null ? `, shards in ${t.shardsInRounds}` : ''}${t.pulseInRounds !== null ? `, pulse in ${t.pulseInRounds}` : ''}`);
    }
  }
  return L.join('\n');
}

/** One-line text of an action in the current state. */
export function describeAction(s, a) {
  const v = s.phase === 'MAP' ? R.mapView(s) : null;
  switch (a.type) {
    case 'CHOOSE_NODE': {
      const n = v.rows[v.pos.r][a.lane];
      return `Go to lane ${a.lane}: ${TYPE[n.type]} (CL ${n.type === 'elite' ? n.level : n.cl}${n.title ? `, "${n.title}"` : ''}${n.archetypes ? `, ${n.archetypes.join('/')}` : ''})`;
    }
    case 'CAST': {
      const info = R.spellInfo(s, a.spellId, a.target);
      return `Cast ${spellName(a.spellId)}${a.target !== null && a.target !== undefined ? ` on ${unitName(s, a.target)}` : ''} (cost ${info ? info.cost : '?'})`;
    }
    case 'ATTACK': return `Basic attack ${unitName(s, a.target)}`;
    case 'USE_ITEM': return a.itemId ? `Use ${consName(a.itemId)}` : `Use item slot ${a.slot + 1} (${consName(s.player.itemBar[a.slot])})`;
    case 'SERVICE': return `Open ${a.service}`;
    case 'LEARN': return `Learn ${spellName(a.spellId)}`;
    case 'TRAIN': return `Train ${spellName(a.spellId)} to L${s.player.level}`;
    case 'BUY': { const e = s.service.stock[a.index]; return `Buy ${e.kind === 'cons' ? consName(e.id) : e.item.name} for ${money(e.price)}`; }
    case 'SELL': { const it = s.player.bag.find((x) => x.uid === a.itemId); return `Sell ${it ? itemText(s, it) : a.itemId}`; }
    case 'EQUIP': { const it = s.player.bag.find((x) => x.uid === a.itemId) || s.loot.find((x) => x.uid === a.itemId); return `Equip ${it ? itemText(s, it) : a.itemId}`; }
    case 'SPEND_TALENT': return `Talent: ${C.TALENT[a.talentId].name} (${C.CLASS[s.player.classId].trees[C.TALENT[a.talentId].tree]}, tier ${C.TALENT[a.talentId].tier})`;
    case 'SET_BAR': return `Bar slot ${a.slot + 1}: ${a.spellId ? spellName(a.spellId) : 'empty'}`;
    case 'SET_ITEM_BAR': return `Item slot ${a.slot + 1}: ${a.itemId ? consName(a.itemId) : 'empty'}`;
    case 'CHOOSE_REWARD': {
      const set = s.node.rewards[0];
      return `Take ${set.kind === 'items' ? itemText(s, set.items[a.index]) : C.BOON[set.boons[a.index]].name}`;
    }
    case 'GRIND_SET_WAVES': return `Grind ${a.n} wave(s)`;
    default: return `${a.type}${Object.keys(a).length > 1 ? ` ${JSON.stringify(Object.fromEntries(Object.entries(a).filter(([k]) => k !== 'type')))}` : ''}`;
  }
}

const SECONDARY = new Set(['SET_BAR', 'SET_ITEM_BAR', 'DISCARD', 'UNEQUIP', 'SET_AUTOPLAY', 'SET_OATH', 'SELL', 'TRAIN', 'RESPEC', 'LOOT_DROP']);
/** Legal actions in a stable numbered order; `main` marks the ones shown by default. */
export function listActions(s) {
  return R.legalActions(s).map((a, i) => ({ n: i + 1, a, main: !SECONDARY.has(a.type) && !(a.type === 'SPEND_TALENT' && false) }));
}

/** Readable lines for the events of one step (fight details, rewards, progress). */
export function describeEvents(s, events) {
  const out = [];
  for (const e of events) {
    switch (e.t) {
      case 'zone': out.push(`Entered zone ${e.z}: ${e.name}`); break;
      case 'camp': out.push(`Reached the Camp: ${e.name}`); break;
      case 'node': out.push(`Entered ${TYPE[e.type]} (row ${e.r}, lane ${e.l}, CL ${e.cl})`); break;
      case 'fight': out.push(`Fight: ${e.enemies.map((x) => `[${x.u}] ${x.name} L${x.level} (${x.hp} HP)`).join(', ')}`); break;
      case 'action': if (e.kind === 'flee') out.push(`Flee ${e.success ? 'succeeded' : 'failed'}`); break;
      case 'damage': out.push(`  ${e.src === 'player' ? 'You' : e.src === 'pet' ? 'Pet' : `[${e.src}]`} -> ${e.dst === 'player' ? 'you' : e.dst === 'pet' ? 'pet' : `[${e.dst}]`}: ${e.amount}${e.absorbed ? ` (+${e.absorbed} absorbed)` : ''}${e.crit ? ' crit' : ''}${e.tick ? ' tick' : ''} (${e.spell || ''})`); break;
      case 'miss': out.push(`  ${e.src === 'player' ? 'You' : e.src === 'pet' ? 'Pet' : `[${e.src}]`} miss ${e.dst === 'player' ? 'you' : `[${e.dst}]`}${e.dodge ? ' (dodge)' : ''}`); break;
      case 'heal': out.push(`  Heal ${e.dst === 'player' ? 'you' : e.dst === 'pet' ? 'pet' : `[${e.dst}]`} +${e.amount} (${e.spell || ''})`); break;
      case 'interrupt': out.push(`  Interrupted [${e.u}]`); break;
      case 'summon': out.push(`  Summoned [${e.u}] ${e.name} (${e.hp} HP)`); break;
      case 'phaseChange': out.push(`  Boss phase ${e.phase}`); break;
      case 'death': out.push(`  ${e.u === 'player' ? 'You die' : e.u === 'pet' ? 'Your pet dies' : `[${e.u}] ${e.name} dies`}`); break;
      case 'resurrect': out.push(`  Resurrected (${e.source})`); break;
      case 'victory': out.push(`Victory (${e.kind}, ${e.rounds} rounds)`); break;
      case 'fled': out.push(`Fled the ${e.kind} fight`); break;
      case 'xp': out.push(`  +${e.amount} XP${e.rested ? ` (${e.rested} rested)` : ''} (${e.why})`); break;
      case 'levelUp': out.push(`Level up: ${e.level}${e.talentPoint ? ' (+1 talent point)' : ''}`); break;
      case 'gold': out.push(`  ${e.amount >= 0 ? '+' : '-'}${money(Math.abs(e.amount))} (${e.why})`); break;
      case 'loot': out.push(`  Loot: ${itemText(s, e.item)}${e.to === 'window' ? ' (bag full: loot window)' : ''}`); break;
      case 'questComplete': out.push('Quest complete'); break;
      case 'story': out.push('Story chain complete'); break;
      case 'dungeonClear': out.push('Dungeon cleared'); break;
      case 'rest': out.push(`Rested: HP ${e.hp}, rested pool ${e.rested}`); break;
      case 'boon': out.push(`Boon: ${e.name}`); break;
      case 'trap': out.push(`Trap: -${e.amount} HP`); break;
      case 'learn': out.push(`Learned ${spellName(e.spell)}`); break;
      case 'train': out.push(`Trained ${spellName(e.spell)} to ${e.tl}`); break;
      case 'buy': out.push(`Bought ${C.CONSUMABLE[e.item] ? consName(e.item) : e.item}`); break;
      case 'travel': out.push(`Travelled on from zone ${e.from}`); break;
      case 'bossStart': out.push(`Boss fight: Ascendancy ${e.asc} after ${e.hours} h`); break;
      case 'runEnd': out.push(`RUN OVER: ${e.outcome}`); break;
      case 'echoes': out.push(`Echoes earned: ${e.total}`); break;
      default:
    }
  }
  return out;
}

export { money };
