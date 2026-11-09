// Bot registry (balance.md 1). A bot is a policy: choose(state) -> action. It never changes the state.
import { BotRng } from '../lib/engine.mjs';
import { priorTable } from '../lib/risk.mjs';
import { createRandomBot } from './random.mjs';
import { createGreedyBot } from './greedy.mjs';
import { createPlannerBot } from './planner.mjs';
import { createSpeedrunnerBot } from './speedrunner.mjs';
import { createTacticianBot } from './tactician.mjs';

export const BOT_NAMES = ['random', 'greedy', 'planner', 'speedrunner', 'tactician'];

/** Time profile of each bot for estSeconds (balance.md 1 table, last column). */
export const TIME_PROFILE = { random: 'manual', greedy: 'manual', planner: 'manual', speedrunner: 'autoplay', tactician: 'manual' };

/**
 * opts: { classId, seed, risk (lookup table, default RISK_PRIOR), tree (0-2), style, variant }.
 * The bot stream is hash(runSeed, "bot") (BotRng), so the game streams are identical across bots.
 */
export function createBot(name, opts) {
  const rng = new BotRng(opts.seed);
  const risk = opts.risk || priorTable();
  const o = { ...opts, rng, risk, tree: opts.tree ?? 0 };
  switch (name) {
    case 'random': return createRandomBot(o);
    case 'greedy': return createGreedyBot(o);
    case 'planner': return createPlannerBot(o);
    case 'speedrunner': return createSpeedrunnerBot(o);
    case 'tactician': return createTacticianBot(o);
    default: throw new Error(`unknown bot ${name} (known: ${BOT_NAMES.join(', ')})`);
  }
}
