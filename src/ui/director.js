// Plays the events of one engine step as animation, then hands the new view to the HUD.
// Every wait goes through a skip token: Space / click / any action key / instant speed finishes at once.
import { wait, SkipToken, fmtNum, deepClone } from './util.js';
import { settings } from './settings.js';
import { linkedText, dangerBanner } from './ui-text.js';

const SCHOOL_PROJ = { fire: 'fire', frost: 'frost', arcane: 'arcane', shadow: 'shadow', nature: 'nature' };
const ref = (r) => (r.side === 'player' ? 'player' : r.side === 'pet' ? 'pet' : r.side === 'enemy' ? `enemy:${r.idx}` : null);
const STATUS_LABEL = { STUN: 'Stunned!', FROZEN: 'Frozen!', HEXED: 'Hexed!', SILENCED: 'Silenced', CHILLED: 'Chilled', EXPOSED: 'Exposed', MARKED: 'Marked', CURSED: 'Cursed', BRAND: 'Brand', ENRAGED: 'Enraged!', TAUNT: 'Taunt!', SHIELDED: 'Braced' };

// Waits of a combat round in ms at 1x (play() waits these; planMs() adds them up).
const T = { pass: 250, item: 260, melee: 210, cast: 200, shoot: 230, bolt: 320, aura: 200, pet: 170, enemyCast: 160, enemyBolt: 300, bossCast: 260, enemyMelee: 200,
  hit: 150, tick: 110, heal: 200, status: 110, interrupt: 320, immune: 150, skip: 120, cleanse: 200, death: 420, round: 180, flee: 600, fleeFail: 300, summon: 600, channel: 450, linked: 250 };
// Moments with their own place in the pacing model (rules 3: level-up, fight overhead, boss): outside the round budget.
const M = { levelUp: 1200, victory: 500, playerDeath: 900, resurrect: 1200, bossPhase: 1400 };
// Round time budget (rules 3, M2 v2): the planned waits are fitted into PLAN_SHARE of PACE_ROUND_ANIM_S, leaving room for
// rendering; once DEADLINE_SHARE of it has passed since the input, the rest of the round plays at once.
const PLAN_SHARE = 0.72;
const DEADLINE_SHARE = 0.85;

const selfOnlyOf = (e) => !e.dst || (e.tags && (e.tags.includes('defensive') || e.tags.includes('resource') || e.tags.includes('heal')) && !(e.tags.includes('aoe')));
/** Sum of the round's waits in ms at 1x, as play() spends them (moments excluded). */
export function planMs(events, cls) {
  let ms = 0;
  for (const e of events) {
    switch (e.t) {
      case 'action':
        if (e.src.side === 'player') {
          if (e.kind === 'pass') ms += T.pass;
          else if (e.kind === 'item') ms += T.item;
          else {
            const self = selfOnlyOf(e);
            ms += cls === 'rogue' && !self ? T.melee : cls === 'mage' ? T.cast + (!self && e.dst ? T.bolt : 0) : cls === 'hunter' ? T.shoot + (!self && e.dst ? T.bolt : 0) : T.cast;
            if (self) ms += T.aura;
          }
        } else if (e.src.side === 'pet') ms += T.pet;
        else ms += e.boss ? T.bossCast : e.kind === 'cast' ? T.enemyCast + T.enemyBolt : T.enemyMelee;
        break;
      case 'damage': ms += e.tick ? T.tick : T.hit; break;
      case 'heal': ms += T.heal; break;
      case 'status': if (e.op === 'add' && STATUS_LABEL[e.id]) ms += T.status; break;
      case 'interrupt': ms += T.interrupt; break;
      case 'immune': ms += T.immune; break;
      case 'skip': ms += T.skip; break;
      case 'cleanse': ms += T.cleanse; break;
      case 'death': if (e.dst.side !== 'player') ms += T.death; break;
      case 'round': ms += T.round; break;
      case 'flee': ms += e.ok ? T.flee : T.fleeFail; break;
      case 'summon': ms += T.summon; break;
      case 'channel': ms += T.channel; break;
      case 'linked': ms += T.linked; break;
      default: break;
    }
  }
  return ms;
}
/** A step that plays a combat round: a fight was on before it and the engine resolved a round or an action. */
const isRound = (prev, events) => !!(prev && prev.combat && !prev.combat.over && events.some((e) => e.t === 'round' || e.t === 'action'));

/** Zone banner sub-line: the level band, and the zone danger line where the zone's enemies take zone danger (z.danger, M2 v3). */
function zoneLine(z, rules) {
  const d = dangerBanner(rules, z);
  return `Levels ${z.band[0]}–${z.band[1]}${d ? ` · ${d}` : ''}`;
}
/** The death screen's second line: a Second Breath held at a death in the end-boss fight stays unused (rules 9, M2 v3). */
function deathLine(next) {
  const held = next.player && next.player.resurrectHeld ? next.player.resurrectHeld.meta : 0;
  const atBoss = next.summary && next.summary.death && next.summary.death.node === 'boss';
  return atBoss && held > 0 ? 'Second Breath does not work in the final fight. Your journey ends here.' : 'No resurrection remains. Your journey ends here.';
}

/** View shown while events play: next view, with unit values rolled back to the previous view. */
export function makeInterim(prev, next) {
  if (!prev || !next) return next;
  const v = deepClone(next);
  v.loot = prev.loot ? deepClone(prev.loot) : null;
  v.summary = prev.summary;
  v.phase = prev.phase === 'SUMMARY' ? next.phase : prev.phase;
  if (prev.node) v.node = deepClone(prev.node);
  if (prev.player && v.player) {
    const pp = prev.player;
    Object.assign(v.player, { hp: pp.hp, maxHp: pp.maxHp, cp: pp.cp, statuses: deepClone(pp.statuses), level: pp.level, xp: pp.xp, xpToNext: pp.xpToNext, rested: pp.rested, gold: pp.gold });
    // resurrect charges change when the 'resurrect' event plays
    if (pp.resurrect) Object.assign(v.player, { resurrect: deepClone(pp.resurrect), resurrectHeld: deepClone(pp.resurrectHeld), resurrectBoss: deepClone(pp.resurrectBoss) });
    v.player.res = { ...v.player.res, cur: pp.res.cur, max: pp.res.max };
    if (pp.pet && v.player.pet) Object.assign(v.player.pet, { hp: pp.pet.hp, maxHp: pp.pet.maxHp, alive: pp.pet.alive, statuses: deepClone(pp.pet.statuses) });
  }
  if (prev.combat) {
    if (!v.combat) v.combat = deepClone(prev.combat);
    else {
      v.combat.round = prev.combat.round;
      v.combat.over = prev.combat.over;
      v.combat.cooldowns = { ...prev.combat.cooldowns };
      for (const e of v.combat.enemies) {
        const pe = prev.combat.enemies.find((x) => x.idx === e.idx && x.uid === e.uid);
        if (pe) Object.assign(e, { hp: pe.hp, alive: pe.alive, statuses: deepClone(pe.statuses), intent: deepClone(pe.intent) });
        else e.hidden = true;
      }
    }
  }
  return v;
}

export class Director {
  constructor(ctx) { this.ctx = ctx; this.token = null; }
  get playing() { return !!this.token; }
  skip() { if (this.token && !this.token.skipped) { this.token.skip(); this.ctx.scene.finishAll(); } }

  /**
   * Play one step. opts.t0: when the input was taken (before the engine step), the start of the round's time budget.
   * Round time budget (rules 3, M2 v2): at the default speed a combat round is on screen for at most PACE_ROUND_ANIM_S
   * (data.rules.roundAnimMs). Its waits are compressed by one factor (tempo) to fit, and once the budget is spent the
   * rest of the round plays at once. 2x and 4x divide the round's time again; Instant has no waits.
   */
  async play(prev, next, events, action, opts = {}) {
    const ctx = this.ctx; const scene = ctx.scene; const hud = ctx.hud;
    const token = (this.token = new SkipToken());
    const budget = isRound(prev, events) ? (ctx.data.rules && ctx.data.rules.roundAnimMs) || 0 : 0; // ms at 1x
    const speed = settings.instant ? 0 : settings.get('speed') || 1;
    const plan = budget ? planMs(events, prev.player && prev.player.classId) : 0;
    const tempo = budget ? Math.max(1, plan / (budget * PLAN_SHARE)) : 1;
    const t0 = opts.t0 ?? performance.now(); let momentMs = 0;
    // ms left of the round's budget (Infinity without one); no wait or flight runs past it
    const left = () => (budget && speed ? (budget * DEADLINE_SHARE) / speed - (performance.now() - t0 - momentMs) : Infinity);
    const D = (ms) => settings.dur(ms) / tempo; // a wait or an animation of this step, at this step's tempo
    const W = (ms) => { const l = left(); return l <= 0 ? Promise.resolve() : wait(Math.min(D(ms), l), token); };
    // a moment (level-up, victory, death, resurrect, boss phase) keeps its own length and does not use up the budget
    const WM = async (ms) => { const a = performance.now(); await wait(settings.dur(ms), token); momentMs += performance.now() - a; };
    const bolt = (from, to, kind, ms) => { const l = left(); return l <= 0 ? Promise.resolve() : scene.projectile(from, to, kind, Math.min(D(ms), l)); };
    this.round = budget ? { budget, speed, plan, tempo, t0 } : null;
    const fast = () => token.skipped || settings.instant;
    const shown = makeInterim(prev, next);
    ctx.setShown(shown);
    const p = () => shown.player;
    const enemy = (idx) => shown.combat && shown.combat.enemies.find((e) => e.idx === idx);
    const name = (r) => (r.side === 'player' ? 'you' : r.side === 'pet' ? (p().pet ? p().pet.name : 'your pet') : (enemy(r.idx) || {}).name || 'enemy');
    const unit = (r) => (r.side === 'player' ? p() : r.side === 'pet' ? p().pet : enemy(r.idx));
    const push = () => ctx.setShown(shown);
    ctx.ui.overlay = false;

    try {
      // ------------------------------------------------ transitions driven by the action
      const t = action.type;
      if (t === 'SELECT_CLASS' || t === 'SELECT_PET') { ctx.syncScene(next); scene.act('player', 'cheer', D(900)); }
      if (t === 'START_RUN') {
        // the hub panel shows at once; the world fades in behind it
        scene.screenFlash('#000000', 1, 1.1);
        ctx.syncScene(next, { instant: true });
        Object.assign(shown, next); push();
        hud.clearLog();
        ctx.ui.banner(next.zone.name, zoneLine(next.zone, ctx.data.rules), 'zone', 2400);
        hud.log(`Welcome to ${next.zone.name}. Visit the trainer, then set out.`, 'lg-sys');
      }
      if (t === 'CHOOSE_NODE' && next.phase === 'NODE') await this.travel(prev, next, token);
      if (t === 'TRAVEL_ON') await this.zoneTravel(prev, next, token);
      if (t === 'LEAVE_HUB') { ctx.ui.overlay = true; push(); scene.setMode('travel'); scene.targetSpeed = 240 * scene.u; await W(900); scene.targetSpeed = 0; }
      if (t === 'FIGHT_BOSS') await this.bossIntro(next, token);
      if ((t === 'ACCEPT' || t === 'GRIND_SET_WAVES' || t === 'CONTINUE' || t === 'CAMP_GRIND') && next.combat) {
        ctx.ui.overlay = true; shown.phase = next.phase; shown.node = deepClone(next.node); shown.combat = deepClone(next.combat); push();
        ctx.syncScene(shown, { enter: true });
        if (next.combat.kind === 'elite' || next.combat.kind === 'rare' || next.combat.kind === 'dboss') ctx.ui.banner(next.combat.kind === 'dboss' ? 'Dungeon boss' : next.combat.kind === 'rare' ? 'Rare elite' : 'Elite', next.combat.title, 'phase', 1600);
        await W(750);
        ctx.ui.overlay = false;
      }

      // ------------------------------------------------ events
      let lastDamageTarget = null;
      for (const e of events) {
        this.cursor = e; // test hook: the event on screen
        switch (e.t) {
          case 'fightStart': hud.log(`Combat: ${e.enemies.join(', ')}.`, 'lg-sys'); break;
          case 'action': {
            const src = ref(e.src); const dst = e.dst ? ref(e.dst) : null;
            if (e.resAfter != null && e.src.side === 'player') { p().res.cur = e.resAfter; push(); }
            if (e.src.side === 'player') {
              if (e.kind === 'pass') { scene.float('player', 'Pass', { color: '#cfc6b0', size: 16 }); await W(T.pass); break; }
              if (e.kind === 'item') { scene.act('player', 'item', D(420)); hud.log(`You use ${e.name}.`, 'lg-you'); await W(T.item); break; }
              const cls = p().classId;
              const selfOnly = selfOnlyOf(e);
              if (cls === 'rogue' && !selfOnly) { { const hero = scene.actors.get('player'); const ta = scene.anchor(dst); const pa = scene.anchor('player'); if (hero) hero.lungeDist = Math.max(60, ta && pa ? ta.x - pa.x - 70 * scene.u : 120); } scene.act('player', 'melee', D(460)); await W(T.melee); }
              else if (cls === 'mage') { scene.act('player', 'cast', D(520)); await W(T.cast); if (!selfOnly && dst) await this.projectiles(e, src, bolt); }
              else if (cls === 'hunter') { scene.act('player', 'shoot', D(480)); await W(T.shoot); if (!selfOnly && dst) await this.projectiles(e, src, bolt, 'arrow'); }
              else { scene.act('player', 'cast', D(400)); await W(T.cast); }
              if (selfOnly) { scene.aura('player', e.tags && e.tags.includes('defensive') ? '#9fc4ff' : '#ffe08a'); await W(T.aura); }
            } else if (e.src.side === 'pet') {
              scene.act('pet', 'melee', D(360)); await W(T.pet);
            } else if (e.src.side === 'enemy') {
              const en = enemy(e.src.idx); const actor = scene.actors.get(src);
              if (e.kind === 'cast' || (actor && actor.kind === 'boss')) {
                scene.act(src, 'cast', D(480)); hud.log(`${en ? en.name : 'Enemy'} uses ${e.name}.`, 'lg-warn');
                if (dst && dst !== src && !(actor && actor.kind === 'boss')) { await W(T.enemyCast); await bolt(src, dst, SCHOOL_PROJ[e.school] || 'shadow', T.enemyBolt); }
                else await W(T.bossCast);
              } else { scene.act(src, 'melee', D(420)); await W(T.enemyMelee); }
            }
            break;
          }
          case 'damage': {
            const dst = ref(e.dst); const u = unit(e.dst);
            if (u && e.hpAfter != null) { u.hp = e.hpAfter; if (e.dst.side === 'pet' && e.hpAfter <= 0) u.alive = false; }
            push();
            const toPlayerSide = e.dst.side === 'player' || e.dst.side === 'pet';
            if (dst) {
              if (e.immune) scene.float(dst, 'Immune', { color: '#cfe4ff', size: 18 });
              else if (e.miss) { scene.float(dst, e.dodge ? 'Dodge' : 'Miss', { color: '#c8c0b0', size: 18 }); }
              else {
                const col = toPlayerSide ? '#ff5a4a' : e.tick ? { fire: '#ffb05a', nature: '#a8f070', phys: '#ff9a8a', shadow: '#c8a0ff' }[e.school] || '#ffe0c0' : e.src.side === 'pet' ? '#f0e0c0' : { fire: '#ffb05a', frost: '#a8e4ff', arcane: '#e0b8ff', shadow: '#c8a0ff', nature: '#b0f080' }[e.school] || '#ffffff';
                const txt = (toPlayerSide ? '-' : '') + fmtNum(e.amount) + (e.crit ? '!' : '');
                scene.float(dst, txt, { color: col, size: e.crit ? 34 : e.tick ? 18 : 24, crit: e.crit, small: e.tick });
                if (e.absorbed) scene.float(dst, `(${fmtNum(e.absorbed)} absorbed)`, { color: '#9fc4ff', size: 14, dy: 22 * scene.u, small: true });
                if (!e.tick) scene.impact(dst, e.school, e.crit);
                else scene.hitFlash(dst);
                if (e.dst.side === 'player' && e.amount > p().maxHp * 0.18) { scene.shake(10); scene.screenFlash('#ff2a1a', 0.18, 0.4); }
              }
            }
            hud.log(logDamage(e, name), e.miss ? 'lg-miss' : e.dst.side === 'player' ? 'lg-taken' : e.crit ? 'lg-crit' : 'lg-hit');
            lastDamageTarget = dst;
            await W(e.tick ? T.tick : T.hit);
            break;
          }
          case 'heal': {
            const u = unit(e.dst); if (u) { u.hp = e.hpAfter; if (e.dst.side === 'pet') u.alive = true; } push();
            const dst = ref(e.dst);
            if (e.dst.side === 'pet' && e.name === 'Revive') scene.revive('pet');
            scene.heal(dst); scene.float(dst, `+${fmtNum(e.amount)}`, { color: '#7dff8a', size: 22 });
            hud.log(e.dst.side === 'enemy' ? `${name(e.dst)} is healed for ${fmtNum(e.amount)} (${e.name}).` : `${e.name} heals ${e.dst.side === 'player' ? 'you' : name(e.dst)} for ${fmtNum(e.amount)}.`, e.dst.side === 'enemy' ? 'lg-warn' : 'lg-heal');
            await W(T.heal);
            break;
          }
          case 'status': {
            const u = unit(e.dst); const nu = statusSource(next, e.dst);
            if (u && nu) { u.statuses = deepClone(nu.statuses || []); push(); }
            const dst = ref(e.dst);
            const label = e.id === 'BRAND' ? `Brand ×${e.stacks || 1}` : STATUS_LABEL[e.id];
            if (e.op === 'add' && label) scene.float(dst, label, { color: ['BRAND', 'CURSED', 'ENRAGED'].includes(e.id) ? '#ff9a8a' : '#ffe08a', size: 17, dy: -16 * scene.u, small: true });
            if (e.op === 'add' && e.id === 'WARD') scene.aura(dst, '#9fc4ff');
            if (e.op === 'add' && e.id === 'STEALTH') scene.aura(dst, '#7a6aa0');
            if (e.op === 'add' && label) await W(T.status);
            break;
          }
          case 'interrupt': scene.float(ref(e.dst), 'Interrupted!', { color: '#d0b0ff', size: 24, crit: true }); scene.impact(ref(e.dst), 'arcane', true); { const en = enemy(e.dst.idx); if (en && en.intent) en.intent.interrupted = true; } push(); hud.log(`You interrupt ${name(e.dst)}: ${e.name} is cancelled.`, 'lg-you'); await W(T.interrupt); break;
          case 'immune': scene.float(ref(e.dst), 'Immune', { color: '#cfe4ff', size: 18 }); await W(T.immune); break;
          case 'skip': if (e.reason && e.reason !== 'Unaware') scene.float(ref(e.src), e.reason, { color: '#c8c0b0', size: 16, small: true }); await W(T.skip); break;
          case 'cleanse': scene.aura(ref(e.dst), '#ffffff'); scene.float(ref(e.dst), 'Cleansed', { color: '#ffffff', size: 18 }); { const u = unit(e.dst); const nu = statusSource(next, e.dst); if (u && nu) u.statuses = deepClone(nu.statuses); push(); } await W(T.cleanse); break;
          case 'resource': p().res.cur = e.after; push(); scene.float('player', `+${fmtNum(e.amount)} ${p().res.kind}`, { color: '#8fc4ff', size: 16, small: true }); break;
          case 'cp': p().cp = e.after; push(); break;
          case 'death': {
            const dst = ref(e.dst); const u = unit(e.dst);
            if (u) { u.alive = false; u.hp = 0; }
            push();
            scene.kill(dst);
            if (e.dst.side === 'enemy') { hud.log(`${e.name} dies.`, 'lg-death'); const an = scene.anchor(dst); if (!e.despawn && an) scene.burst(an.x, an.cy, '#ffe8c0', 10, 90); if (ctx.ui.target === e.dst.idx) ctx.ui.retarget(shown); }
            else if (e.dst.side === 'pet') hud.log(`${e.name} has fallen.`, 'lg-death');
            else hud.log('You die.', 'lg-death');
            if (e.dst.side === 'player') await WM(M.playerDeath); else await W(T.death);
            break;
          }
          case 'resurrect': scene.revive('player'); scene.aura('player', '#ffd36a', 1.4); scene.levelUp('player'); p().hp = e.hpAfter;
            if (next.player) Object.assign(p(), { resurrect: deepClone(next.player.resurrect), resurrectHeld: deepClone(next.player.resurrectHeld), resurrectBoss: deepClone(next.player.resurrectBoss) });
            push(); ctx.ui.banner('Resurrected', `${e.source} returns you to the fight`, 'phase', 1800); hud.log(`${e.source} flares: you return to the fight!`, 'lg-loot'); await WM(M.resurrect); break;
          case 'round': {
            if (!shown.combat) break;
            shown.combat.round = e.round;
            const nc = next.combat;
            if (nc) for (const en of shown.combat.enemies) { const ne = nc.enemies.find((x) => x.idx === en.idx && x.uid === en.uid); if (ne) { en.intent = deepClone(ne.intent); en.statuses = deepClone(ne.statuses); } }
            if (nc) shown.combat.cooldowns = { ...nc.cooldowns };
            if (next.player) { p().statuses = deepClone(next.player.statuses); p().res.cur = next.player.res.cur; }
            push();
            await W(T.round);
            break;
          }
          case 'xp': if (e.amount > 0) { scene.float('player', `+${fmtNum(e.amount)} XP`, { color: '#d0a8ff', size: 17, dy: -30 * scene.u, small: true }); p().xp = Math.min(p().xpToNext, p().xp + e.amount); p().rested = Math.max(0, (p().rested || 0) - (e.rested || 0)); push(); hud.log(`You gain ${fmtNum(e.amount)} experience${e.rested ? ` (${fmtNum(e.rested)} rested bonus)` : ''}.`, 'lg-xp'); } break;
          case 'levelUp': {
            Object.assign(p(), { level: e.level, maxHp: e.maxHp, hp: e.hp, xp: 0, xpToNext: (next.player && next.player.level === e.level) ? next.player.xpToNext : p().xpToNext });
            push();
            scene.levelUp('player');
            const extra = [e.talentPoint ? '+1 talent point' : null, e.newSpells && e.newSpells.length ? `New at the trainer: ${e.newSpells.join(', ')}` : null].filter(Boolean).join('  ·  ');
            ctx.ui.banner(`Level ${e.level}`, extra || 'You feel stronger.', 'level', 2200);
            hud.log(`You have reached level ${e.level}!`, 'lg-loot');
            if (!fast()) await WM(M.levelUp);
            break;
          }
          case 'victory': hud.log('Victory!', 'lg-sys'); scene.act('player', 'cheer', settings.dur(900)); await WM(M.victory); break;
          case 'defeat': break;
          case 'flee': if (e.ok) { scene.float('player', 'Escaped!', { color: '#ffe08a', size: 22 }); hud.log('You flee from the fight.', 'lg-warn'); scene.setMode('map'); scene.clearEnemies(); await W(T.flee); } else { scene.float('player', 'Flee failed', { color: '#ff9a8a', size: 20 }); hud.log('You fail to escape!', 'lg-warn'); await W(T.fleeFail); } break;
          case 'bossPhase': scene.bossPhase = e.phase; scene.screenFlash(e.phase === 3 ? '#ff5a2a' : '#8a6aff', 0.35, 0.8); scene.shake(14); ctx.ui.banner(`Phase ${e.phase}: ${e.name}`, e.text, 'phase', 2400); hud.log(`${e.name}: ${e.text}`, 'lg-warn'); await WM(M.bossPhase); break;
          case 'summon': if (!shown.combat) break; for (const idx of e.idxs) { const en = shown.combat.enemies.find((x) => x.idx === idx); if (en) en.hidden = false; } ctx.syncScene(shown, { enter: true }); push(); hud.log(`${e.names.length} ${e.names[0]}s appear!`, 'lg-warn'); await W(T.summon); break;
          case 'gotItem': hud.log(`You receive loot: ${e.name}${e.to === 'window' ? ' (waiting in the loot window)' : ''}.`, 'lg-loot'); break;
          case 'channel': scene.float(ref(e.src), `${e.name} ${e.step}/2`, { color: '#d0b0ff', size: 22, crit: e.step === 2 }); if (e.step === 2) scene.screenFlash('#6a4aff', 0.3, 0.6); hud.log(`${e.name}: ${e.step === 1 ? 'the channel begins' : 'the channel resolves'}.`, 'lg-warn'); await W(T.channel); break;
          case 'linked': {
            // n: living Shards when the wave came (engine event); the strength from the rules table
            const R = ctx.data.rules; const dr = e.on && e.n ? R.linkDr[Math.min(e.n, R.linkDr.length - 1)] : 0;
            const b = shown.combat && shown.combat.enemies.find((x) => x.rank === 'boss');
            if (b) scene.float(`enemy:${b.idx}`, e.on ? (dr ? `Linked −${Math.round(dr * 100)} %` : 'Linked') : 'Link broken', { color: e.on ? '#c8a8ff' : '#ffe08a', size: 20 });
            hud.log(e.on ? linkedText(R, 'log') : 'The link is broken.', 'lg-warn'); await W(T.linked); break;
          }
          case 'gold': hud.log(`You receive ${fmtNum(e.amount)} copper.`, 'lg-loot'); break;
          case 'msg': ctx.ui.toast(e.text, e.kind === 'warn' ? 'err' : e.kind || 'info'); hud.log(e.text, e.kind === 'warn' ? 'lg-warn' : 'lg-sys'); break;
          case 'rest': scene.aura('player', '#ffd8a0', 1.4); scene.float('player', 'Rested', { color: '#9fb8ff', size: 22 }); hud.log('You rest. Health and mana restored; you feel rested.', 'lg-sys'); await W(500); break;
          case 'chest': ctx.ui.chestOpen = true; ctx.syncScene(next); scene.burst(scene.W * 0.62, scene.groundY - 40 * scene.u, '#ffe08a', 30, 160, { up: 80 }); await W(500); break;
          case 'trap': break;
          case 'buy': hud.log(`You buy ${e.name}.`, 'lg-loot'); break;
          case 'sell': hud.log(`You sell ${e.name} for ${fmtNum(e.gold)} copper.`, 'lg-loot'); break;
          case 'learn': scene.aura('player', '#c8a8ff'); ctx.ui.toast(`Learned ${e.name}`, 'good'); hud.log(`You learn ${e.name}.`, 'lg-sys'); break;
          case 'train': hud.log(`${e.name} trained to rank ${e.rank}.`, 'lg-sys'); break;
          case 'equip': hud.log(`Equipped ${e.name}.`, 'lg-sys'); break;
          case 'talent': scene.aura('player', '#ffd36a'); hud.log(`Talent learned: ${e.name} (rank ${e.rank}).`, 'lg-sys'); break;
          case 'used': hud.log(`You use ${e.name}.`, 'lg-sys'); break;
          case 'boon': scene.aura('player', '#9fe0b0', 1.2); ctx.ui.toast(e.name, 'good'); hud.log(`The shrine grants ${e.name}.`, 'lg-sys'); break;
          case 'zone': break;
          default: break;
        }
      }
      if (next.phase === 'SUMMARY' && prev.phase !== 'SUMMARY' && next.summary && next.summary.outcome === 'death') await this.deathScreen(token, deathLine(next));
      if (next.phase === 'SUMMARY' && next.summary && next.summary.outcome === 'victory' && prev.phase !== 'SUMMARY') { ctx.ui.banner('Victory', 'Oruvath, the Unlit Star, is no more.', 'boss', 3000); await WM(2200); }
    } finally {
      ctx.ui.overlay = false;
      this.token = null; this.cursor = null;
      // the run summary must be readable as soon as it appears: no banner over it
      if (next.phase === 'SUMMARY' && prev.phase !== 'SUMMARY') ctx.ui.hideBanner();
      ctx.setShown(next);
    }
  }

  /** The player's projectiles; bolt(from, to, kind, ms at 1x) fires one at the step's tempo. */
  async projectiles(e, src, bolt, forceKind) {
    const scene = this.ctx.scene;
    const kind = forceKind || SCHOOL_PROJ[e.school] || (e.school === 'phys' ? 'arrow' : 'arcane');
    if (e.aoe) {
      const ids = [...scene.actors.keys()].filter((k) => k.startsWith('enemy:') && scene.actors.get(k).alive !== false && !scene.actors.get(k).deadT0);
      await Promise.all(ids.map((id, i) => bolt(src, id, kind, T.bolt - 20 + i * 40)));
    } else await bolt(src, ref(e.dst), e.name === 'Pyre Comet' ? 'comet' : kind, T.bolt);
  }

  async travel(prev, next, token) {
    const ctx = this.ctx; const scene = ctx.scene;
    ctx.ui.overlay = true; ctx.setShown(Object.assign(makeInterim(prev, next), { phase: 'MAP' }));
    if (settings.get('skipTravel') || settings.instant) { ctx.syncScene(next, { instant: true }); return; }
    scene.setMode('travel', { props: [] });
    scene.targetSpeed = 260 * scene.u;
    await wait(settings.dur(1500), token);
    // the destination slides in with the ground
    ctx.syncScene(next, { arrive: true });
    await wait(settings.dur(900), token);
    scene.targetSpeed = 0;
    await wait(settings.dur(400), token);
  }

  async zoneTravel(prev, next, token) {
    const ctx = this.ctx; const scene = ctx.scene;
    ctx.ui.overlay = true; ctx.setShown(Object.assign(makeInterim(prev, next), { phase: 'MAP', zone: prev.zone }));
    if (!(settings.get('skipTravel') || settings.instant)) {
      scene.setMode('travel', { props: [] });
      scene.targetSpeed = 300 * scene.u;
      await wait(settings.dur(1300), token);
      ctx.syncScene(next);
      scene.setMode('travel', { props: [] });
      await wait(settings.dur(1500), token);
      scene.targetSpeed = 0;
    } else ctx.syncScene(next, { instant: true });
    const z = next.zone;
    ctx.ui.banner(z.name, z.camp || z.idx > ctx.data.rules.zoneCount ? 'The last camp before the Sunken Observatory' : zoneLine(z, ctx.data.rules), 'zone', 2600);
    ctx.hud.log(`You arrive in ${z.name}.`, 'lg-sys');
    await wait(settings.dur(900), token);
  }

  async bossIntro(next, token) {
    const ctx = this.ctx; const scene = ctx.scene;
    ctx.ui.overlay = true;
    scene.targetDim = 0.55;
    ctx.syncScene(next, { enter: true });
    ctx.ui.banner('Oruvath, the Unlit Star', ctx.data.boss.intro || 'The dead star turns its eye on you.', 'boss', 3400);
    scene.shake(8);
    await wait(settings.dur(2600), token);
    scene.targetDim = 0;
  }

  async deathScreen(token, text) {
    const ctx = this.ctx;
    ctx.scene.desat = 1;
    ctx.ui.showDeath(true, text);
    await wait(settings.dur(2600) || 400, token);
    ctx.ui.showDeath(false);
    ctx.scene.desat = 0;
  }
}

function statusSource(next, r) {
  if (!next) return null;
  if (r.side === 'player') return next.player;
  if (r.side === 'pet') return next.player && next.player.pet;
  return next.combat && next.combat.enemies.find((e) => e.idx === r.idx);
}

function logDamage(e, name) {
  const src = e.src; const dst = e.dst;
  if (dst.side === 'player' && src.side === 'player') return `${e.name} costs you ${fmtNum(e.amount)} health.`;
  if (e.tick) return `${dst.side === 'player' ? 'You suffer' : name(dst) + ' suffers'} ${fmtNum(e.amount)} from ${e.name}.`;
  if (src.side === 'player') {
    if (e.miss) return e.dodge ? `${cap(name(dst))} dodges your ${e.name}.` : `Your ${e.name} misses ${name(dst)}.`;
    return `Your ${e.name} ${e.crit ? 'crits' : 'hits'} ${name(dst)} for ${fmtNum(e.amount)}${e.crit ? '!' : '.'}${e.absorbed ? ` (${fmtNum(e.absorbed)} absorbed)` : ''}`;
  }
  if (src.side === 'pet') return e.miss ? `${e.name} misses ${name(dst)}.` : `${e.name} ${e.crit ? 'crits' : 'hits'} ${name(dst)} for ${fmtNum(e.amount)}.`;
  const who = src.side === 'env' ? e.name : `${cap(name(src))}'s ${e.name}`;
  if (e.immune) return `${who}: you are immune.`;
  if (e.miss) return `${who} ${e.dodge ? 'is dodged by' : 'misses'} ${dst.side === 'player' ? 'you' : name(dst)}.`;
  return `${who} ${e.crit ? 'crits' : 'hits'} ${dst.side === 'player' ? 'you' : name(dst)} for ${fmtNum(e.amount)}${e.crit ? '!' : '.'}${e.absorbed ? ` (${fmtNum(e.absorbed)} absorbed)` : ''}`;
}
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
