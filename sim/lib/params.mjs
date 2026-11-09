// Simulator parameters.
//
// BAL: the constant table of docs/specs/balance.md section 6, same names and values (bot parameters and
//      targets). qa/sim/params.test.mjs parses balance.md and compares every cell, so the two cannot drift.
// SIM: numbers the balance spec leaves open, used by the bots and the batch runner. Each is an [assumption]
//      of the Simulation & Balance Engineer, listed in docs/handoffs/sim-2026-11-09.md.

export const BAL = {
  N_RUNS_PER_CELL: 2000,
  SEED_BASE: 1000,
  N_CAMPAIGNS: 50,
  CAMPAIGN_MAX_RUNS: 80,
  TUNE_LIMIT: 0.25,
  GREEDY_STAY_THRESHOLD: 0.15,
  HEAL_STOCK_TARGET: 5,
  EMBER_RESERVE_V: 5,
  TACTICIAN_DEPTH: 3,
  TACTICIAN_SAMPLES: 8,
  TACTICIAN_HP_WEIGHT: 1.5,
  TACTICIAN_DEATH_PENALTY: 100000,
  VAL_XP: 100,
  VAL_GEAR: 1,
  VAL_GOLD: 5,
  VAL_HOUR: 6,
  VAL_DEATH: 2000,
  SIM_RISK_REFRESH: 500,
  RISK_PRIOR: { quest: 0.005, grind: 0.004, elite: 0.03, dungeon: 0.05, treasure: 0.002 },
  WR_P0_RANDOM_MAX: 0.03,
  WR_P0_GREEDY: [0.08, 0.18],
  WR_P0_PLANNER: [0.20, 0.35],
  WR_P0_SPEED: [0.10, 0.25],
  WR_P0_TACTICIAN: [0.30, 0.50],
  WR_P10_PLANNER: [0.32, 0.48],
  WR_P10_RANDOM_MAX: 0.08,
  WR_PALL_RANDOM_MAX: 0.15,
  WR_PALL_GREEDY: [0.30, 0.50],
  WR_PALL_PLANNER: [0.55, 0.75],
  WR_PALL_SPEED: [0.40, 0.60],
  WR_PALL_TACTICIAN_MAX: 0.90,
  CHOICE_GAP_MIN: 0.15,
  MANUAL_GAP: [0.08, 0.25],
  CLASS_BAND_PP: 0.05,
  CLASS_SPREAD_MAX_PP: 0.08,
  TREE_FLOOR_RATIO: 0.60,
  PET_FLOOR_RATIO: 0.70,
  META_GAP_MIN_PP: 0.20,
  META_GAP_MAX_PP: 0.45,
  DOM_MARGIN_PP: 0.10,
  MIN_NORMAL_LOW: 40,
  MIN_NORMAL_HIGH: 50,
  MIN_NORMAL_TARGET: 45,
  SPEED_RATIO_MAX: 0.70,
  MIN_SPEED_MAX: 30,
  MIN_SPEED_P10_MAX: 25,
  SPEED_MANUAL_RATIO_MAX: 0.85,
  NODES_NORMAL: [44, 54],
  NODES_SPEED: [32, 42],
  FIGHTS_NORMAL: [55, 75],
  ROUNDS_NORMAL: [4, 6],
  ROUNDS_ELITE: [6, 10],
  ROUNDS_DBOSS: [8, 13],
  ROUNDS_BOSS: [30, 45],
  HOURS_NORMAL: [135, 165],
  HOURS_SPEED: [100, 125],
  ASC_MEDIAN_MAX: 0.12,
  LVL60_SHARE_MIN: 0.90,
  LVL_SPEED_MEDIAN_MIN: 60,
  ILVL_BOSS: [55, 62],
  RARE_SHARE_MIN: 0.50,
  ZONE_LVL_SLACK: 1,
  DEATH_EARLY_MAX: 0.15,
  DEATH_MID: [0.20, 0.35],
  DEATH_LATE: [0.20, 0.35],
  DEATH_BOSS: [0.25, 0.45],
  DEATH_TYPE_MAX: 0.45,
  DEATH_DUNGEON: [0.15, 0.35],
  BOSS_P1_LOSS_MAX: 0.25,
  BOSS_LATE_LOSS_MIN: 0.40,
  CLOSE_FIGHT: [0.05, 0.15],
  REST_COUNT: [6, 12],
  POTION_COUNT: [8, 20],
  MECH_RATIO_MAX: 0.60,
  ENRAGE_LOSS: [0.05, 0.20],
  ECHO_P0: [150, 260],
  ECHO_WIN: [400, 540],
  CAMPAIGN_RUNS: [25, 40],
  CAMPAIGN_RUNS_MIN_ANY: 18,
  WR_RUNS_1_5: [0.15, 0.35],
  WR_RUNS_21_30: [0.45, 0.70],
  CURVE_DIP_PP: 0.05,
  TRAIN_AFFORD_MIN: 0.70,
  EMBER_BUY: [0.30, 0.70],
  QA_REPLAY_RUNS: 1000,
  MAX_ACTIONS_PER_RUN: 20000,
  SIM_RUNS_PER_MIN_MIN: 200,
};

export const SIM = {
  /** Risk table: CL - L range and shrinkage (pseudo-observations per hierarchy level). */
  RISK_DL_MIN: -6,
  RISK_DL_MAX: 9,
  RISK_SHRINK: 10,
  /** RISK_PRIOR plus camp waves (a camp wave is a Grind wave, rules 1.6). */
  RISK_PRIOR: { quest: 0.005, grind: 0.004, elite: 0.03, dungeon: 0.05, treasure: 0.002, camp: 0.004 },
  /** Prior mean HP-fraction change of a node (exit - entry, after post-fight regen); learned from runs. */
  HP_DELTA_PRIOR: { quest: -0.15, grind: -0.12, elite: -0.35, dungeon: -0.40, treasure: -0.04, camp: -0.12 },
  /** Consumable kit of the non-random bots (balance.md fixes only HEAL_STOCK_TARGET). */
  RATION_STOCK: 5,
  MANA_STOCK: 3,
  TONIC_STOCK_CAMP: 3,
  ELIXIR_STOCK_CAMP: 1,
  /** Vendor purchases go in two passes: every consumable of the kit up to KIT_MIN, then up to its target. */
  KIT_MIN: 2,
  /** Gold the non-random bots keep after a gear purchase, in V(L). */
  GEAR_RESERVE_V: 2,
  /** Out of combat the non-random bots eat Trail Rations below this HP (or mana, Mage) fraction. */
  FOOD_HP: 0.6,
  /** Between Grind waves / Dungeon fights: stop or leave below this HP after food and with no potion left. */
  STOP_HP: 0.45,
  /** Camp grind stops after this many waves even below MAX_LEVEL (B36 guard). */
  CAMP_MAX_WAVES: 40,
  /** Hub Inn for the speedrunner only below this HP. */
  SPEED_INN_HP: 0.5,
  /** Default Hunter pet of every bot except random (B9 varies it). */
  DEFAULT_PET: 'ridgewolf',
  /** Route styles (B8): weight on the gain terms (XP, gear, gold) of the favoured node types. */
  STYLE_WEIGHT: 2.0,
  /** Speed style: hour cost multiplier. */
  STYLE_SPEED_HOUR_MULT: 3.0,
  /** Shrine boon values in value-function points (boons are hidden on the map; the bot uses the weighted mean). */
  BOON_VALUE: { return: 150, insight: 35, fury: 25, plenty: 20, mending: 60, clarity: 30 },
  /** Trainer value (balance.md 1.1 has no spell-rank term): see model.mjs trainerGain. Power-equivalent per
   *  trained level uses p >= TRAIN_MIN_P; each spell the trainer can teach is worth LEARN_VALUE points. */
  TRAIN_MIN_P: 0.25,
  LEARN_VALUE: 15,
  TRAIN_VALUE_MULT: 1,
  /** Value-function stand-in for a spell with no direct damage (bar template step 7), x the main spell's damage. */
  UTILITY_SPELL_VALUE: 0.5,
  /** Tactician candidate pruning: potions below TACT_POTION_HP or when the best other action dies in a sample;
   *  mana draughts below TACT_MANA. */
  TACT_POTION_HP: 0.35,
  TACT_MANA: 0.25,
  /** Tactician: every live enemy is a target candidate when at most this many live. */
  TACT_ALL_TARGETS: 2,
  /** Tactician search gate (needsSearch) and sample racing: all candidates on TACT_RACE_SAMPLES streams, the
   *  best TACT_RACE_KEEP on all TACTICIAN_SAMPLES. */
  TACT_GATE_HP: 0.7,
  TACT_GATE_ENEMIES: 3,
  TACT_RACE_SAMPLES: 2,
  TACT_RACE_KEEP: 3,
  /** Risk-table warm-up before a measured cell: planner runs of the same class and profile on these seeds
   *  (discarded; only their observations seed the table). Random needs no table. */
  WARMUP_RUNS: 1000,
  WARMUP_SEED_BASE: 9000000,
  /** B35 replay check: random-bot runs on these seeds (per class). */
  REPLAY_SEED_BASE: 7000000,
  /** Campaign run seeds: CAMPAIGN_SEED_BASE + campaign × CAMPAIGN_MAX_RUNS + run. */
  CAMPAIGN_SEED_BASE: 5000000,
  /** Default talent tree per class (balance.md 1: the tree with the best planner win rate, re-chosen once per
   *  balance pass; set from the B7 result of docs/reports/balance-2026-11-09.md). */
  DEFAULT_TREE: { rogue: 2, mage: 1, hunter: 1 },
  /** Batch: runs per worker task (a block of SIM_RISK_REFRESH runs is split into tasks of this size). */
  TASK_RUNS: 25,
  /** Bootstrap resamples for median intervals and its seed. */
  BOOT_N: 1000,
  BOOT_SEED: 7,
};
