// random bot (balance.md 1): uniform over legal choices (lanes, grind waves 1-3, rewards, TRAVEL_ON when legal
// at 50 %); a random legal talent each point; bar = known spells in learn order; equips higher item score;
// trains each spell with 50 % chance at a trainer; buys nothing; autoplay combat (rules 7.9); manual profile.
// All draws come from the bot stream (BotRng), so game streams are the same as for every other bot.
// Expedition map (expedition.md 10.2): uniform over the fog view's legal moves, the Road at 50 %, the Bell at 10 %.
// Start camp (prep runs): random affordable purchases until no point can be spent; the hub contract at 50 %.
import { C, R, legal } from '../lib/engine.mjs';
import { makeBot, randomTalent, learnOrderBar, desiredItemBar, foodAction } from '../lib/policy.mjs';
import { fogInput } from '../lib/view.mjs';
import { randomPrep, randomHubContract } from './shared.mjs';

export function createRandomBot({ rng }) {
  let trainerPlan = null; // spells this trainer visit will learn or train (one 50 % draw per class spell)
  let innKey = null; // hub visit the Inn draw belongs to
  let innWanted = false;
  const stop = (s) => (s.node.type === 'grind' ? { type: 'GRIND_STOP' } : { type: 'DUNGEON_LEAVE' });
  return makeBot({
    name: 'random',
    pickPet: (pets) => rng.pick(pets),
    combat: (s) => R.autoAction(s),
    talent: (s) => randomTalent(s, rng),
    bar: learnOrderBar,
    itemBar: (s) => desiredItemBar(s),
    // rules 7.9: between fights in a node, Trail Rations below AUTO_FOOD_HP (HP, or mana for the Mage)
    food: (s) => (s.phase === 'NODE' && s.node && s.node.stage === 'between' ? foodAction(s, C.AUTO_FOOD_HP) : null),
    trainer: (s) => {
      if (!trainerPlan) {
        trainerPlan = Object.values(C.SPELL).filter((sp) => sp.cls === s.player.classId && sp.source !== 'talent')
          .map((sp) => sp.id).filter(() => rng.chance(0.5));
      }
      while (trainerPlan.length) {
        const id = trainerPlan.shift();
        if (legal(s, { type: 'LEARN', spellId: id })) return { type: 'LEARN', spellId: id };
        if (legal(s, { type: 'TRAIN', spellId: id })) return { type: 'TRAIN', spellId: id };
      }
      trainerPlan = null;
      return { type: 'LEAVE' };
    },
    vendor: () => ({ type: 'LEAVE' }),
    hub: (s) => {
      if (!s.hub.used.trainer && legal(s, { type: 'SERVICE', service: 'trainer' })) return { type: 'SERVICE', service: 'trainer' };
      if (innKey !== s.zone.z) { innKey = s.zone.z; innWanted = rng.chance(0.5); }
      if (innWanted && !s.hub.used.inn && legal(s, { type: 'SERVICE', service: 'inn' })) return { type: 'SERVICE', service: 'inn' };
      return { type: 'LEAVE_HUB' };
    },
    map: (s) => {
      if (s.mapMode === 'expedition') {
        // expedition.md 10.2: uniform over legal moves; the Road when on one at 50 %; the Bell at 10 % when held.
        const view = fogInput(s);
        if (view.onRoad && rng.chance(0.5)) return { type: 'TAKE_ROAD' };
        if (view.bell.charges > 0 && rng.chance(0.1)) return { type: 'RING_BELL' };
        const opts = [];
        for (const mv of view.moves) {
          opts.push({ type: 'MOVE', nodeId: mv.nodeId });
          if (mv.passTime !== null) opts.push({ type: 'PASS_THROUGH', nodeId: mv.nodeId });
        }
        return rng.pick(opts);
      }
      const lanes = R.mapView(s).next;
      if (legal(s, { type: 'TRAVEL_ON' }) && (lanes.length === 0 || rng.chance(0.5))) return { type: 'TRAVEL_ON' };
      return { type: 'CHOOSE_NODE', lane: rng.pick(lanes) };
    },
    grindWaves: () => 1 + rng.int(C.GRIND_MAX_WAVES),
    reward: (s) => {
      const set = s.node.rewards[0];
      return { type: 'CHOOSE_REWARD', index: rng.int(set.kind === 'items' ? set.items.length : set.boons.length) };
    },
    between: (s) => (rng.chance(0.5) ? { type: 'NEXT_FIGHT' } : stop(s)),
    camp: (s) => {
      if (!s.hub.used.trainer) return { type: 'SERVICE', service: 'trainer' };
      return rng.chance(0.5) ? { type: 'FIGHT_BOSS' } : { type: 'CAMP_GRIND' };
    },
    // Start camp (expedition.md 10.2 random; prep runs): random affordable purchases until none is left; hub contract at 50 %.
    prep: (s) => randomPrep(s, rng),
    hubContract: randomHubContract(rng),
  });
}
