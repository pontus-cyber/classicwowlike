// Simulator parameters.
//
// BAL: the constant table of docs/specs/balance.md section 6, same names and values (bot parameters and
//      targets). qa/sim/params.test.mjs parses balance.md and compares every cell, so the two cannot drift.
//      A report-only cell ("- (report only)") is null. META_TIME_BUDGET (B17 time budget, M2 v4) is a rules
//      constant (rules.md 13), so the report reads it from the engine (C.META_TIME_BUDGET), not from BAL.
// SIM: numbers the balance spec leaves open, used by the bots and the batch runner. Each is an [assumption]
//      of the Simulation & Balance Engineer, listed in docs/handoffs/sim-2026-11-09.md.
// C2:  the simulator's constants of docs/specs/combat-v2.md section 15 (bots and balance targets B48-B55, the
//      changed B5/B15/B16; combat v2.1: OPENER_ROOT_KEEP and the B50/B52/B55 targets of D58), same names and values
//      as written there (pp as pp). qa/sim/combat2.test.mjs parses the spec and compares every C2 key that is in its
//      table. Rules constants of that table (OFFBAL_TAKEN, ENGAGE_DMG_COMP, EMPOWER_DMG, ...) are read from the engine
//      (C), never copied here.

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
  TACTICIAN_ADD_WEIGHT: 0.3,
  TACTICIAN_SAFE_HP: 0.25,
  VAL_XP: 100,
  VAL_GEAR: 1,
  VAL_GOLD: 5,
  VAL_TIME: 6,
  VAL_DEATH: 2000,
  PLANNER_TIME_MULT: 3,
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
  WR_PALL_GREEDY: [0.35, 0.55],
  WR_PALL_PLANNER: [0.55, 0.75],
  WR_PALL_SPEED: [0.30, 0.50],
  WR_PALL_TACTICIAN_MAX: 0.90,
  CHOICE_GAP_MIN: 0.15,
  MANUAL_GAP: [0.08, 0.25],
  CLASS_BAND_PP: 0.05,
  CLASS_SPREAD_MAX_PP: 0.08,
  TREE_FLOOR_RATIO: 0.60,
  TREE_SWITCH_Z: 1.96,
  PET_FLOOR_RATIO: 0.70,
  META_GAP_MIN_PP: 0.20,
  META_GAP_MAX_PP: 0.45,
  DOM_MARGIN_PP: 0.10,
  MIN_NORMAL_LOW: 40,
  MIN_NORMAL_HIGH: 50,
  MIN_NORMAL_TARGET: 45,
  SPEED_RATIO_MAX: 0.70,
  MIN_SPEED_MAX: 30,
  MIN_SPEED_P10_MAX: null,
  SPEED_MANUAL_RATIO_MAX: 0.85,
  NODES_NORMAL: [38, 47],
  NODES_SPEED: [28, 37],
  FIGHTS_NORMAL: [48, 66],
  ROUNDS_NORMAL: [4, 6],
  ROUNDS_ELITE: [6, 10],
  ROUNDS_DBOSS: [8, 13],
  ROUNDS_BOSS: [30, 45],
  TIME_NORMAL: [125, 155],
  TIME_SPEED: [80, 110],
  ASC_MEDIAN_MAX: 0.12,
  LVL60_SHARE_MIN: 0.90,
  LVL_SPEED_MEDIAN_MIN: 60,
  ILVL_BOSS: [55, 62],
  RARE_SHARE_MIN: 0.50,
  ZONE_LVL_SLACK: 1,
  DEATH_EARLY_MAX: 0.12,
  DEATH_MID: [0.03, 0.10],
  DEATH_LATE: [0.02, 0.08],
  DEATH_BOSS: [0.55, 0.80],
  DEATH_TYPE_MAX: 0.45,
  DEATH_DUNGEON: [0.15, 0.35],
  BOSS_P1_LOSS_MAX: 0.25,
  BOSS_LATE_LOSS_MIN: 0.40,
  CLOSE_FIGHT: [0.04, 0.12],
  CLOSE_FIGHT_HP: 0.35,
  TENSION_SPREAD_MAX: 0.10,
  TENSION_Z6_MAX: 0.85,
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
  CURVE_BLOCK_MIN_RUNS: 50,
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
  STYLE_SPEED_TIME_MULT: 3.0,
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
  /** Default talent tree per class and profile group (balance.md 1.3, M2 v5, D43): the incumbents of the switch rule
   *  (sim/lib/trees.mjs). A pass keeps the incumbent unless another tree's planner win rate beats it by more than
   *  TREE_SWITCH_Z standard errors of the difference; a switch is recorded here in the same commit as the report.
   *  P0 group (P0 and P10 cells, campaigns, P0 route styles and pets, the B5 tactician): Venomcraft, Rimecraft,
   *  Wildcraft since the 2026-11-11c measure on the M2b v8 engine (rogue Venomcraft 36.3 % against Shadowcraft 28.5 %, mage
   *  Rimecraft 33.5 % against Arcanism 27.0 %, 1 000 runs each; docs/reports/balance-2026-11-11c.md); Shadowcraft, Arcanism,
   *  Wildcraft from the 2026-11-11b pass (switch rule: rogue Shadowcraft 43.5 % against Venomcraft 37.6 %, hunter
   *  Wildcraft 44.6 % against Marksmanship 36.6 %, 2 000 runs each; docs/reports/balance-2026-11-11b.md); before:
   *  Venomcraft, Arcanism, Marksmanship. PALL group (every PALL cell): Shadowcraft, Arcanism, Beastbond (kept in
   *  2026-11-11b) [source: changes-m2-v5.md row 1]. */
  DEFAULT_TREE: { rogue: 2, mage: 1, hunter: 2 },
  DEFAULT_TREE_PALL: { rogue: 1, mage: 2, hunter: 0 },
  /** Batch: runs per worker task (a block of SIM_RISK_REFRESH runs is split into tasks of this size). */
  TASK_RUNS: 25,
  /** Bootstrap resamples for median intervals and its seed. */
  BOOT_N: 1000,
  BOOT_SEED: 7,
  /**
   * Mash report (docs/reports/mash-2026-11-11.md, sim/mashreport.mjs): a "think fight" is a non-boss fight in which, replayed
   * on the same state and fight stream, onebutton dies where the opener's line survives, or ends at least this share of
   * max HP lower [assumption: "clearly more HP", owner follow-up 2026-11-11 18:46; the report shows 0.10 and 0.30 too].
   */
  THINK_HP_GAP: 0.20,
};

export const C2 = {
  OPEN_ROUNDS: 5,
  OPENER_BEAM: 12,
  OPENER_SAMPLES: 8,
  OPENER_TAIL: 3,
  /** combat v2.1 (D59): first actions whose best sequence is scored on the held-out samples (opener bot). */
  OPENER_ROOT_KEEP: 6,
  OPEN_DEATH_RATIO_MAX: 0.70,
  OPEN_REACH_GAIN_MIN: 5,
  MASH_REACH_MIN: 0.50,
  MASH_GAP_MIN: 8,
  OPEN_DECIDES_MIN: 0.50,
  /** combat v2.1 (D58): B50 gap, opener opening minus autoplay opening, pp. */
  OPEN_DECIDES_GAP_MIN: 8,
  ENGAGE_SHARE_MIN: 0.15,
  ENGAGE_SHARE_MAX: 0.60,
  /** combat v2.1 (D58): B52 windows used per 100 non-boss fights, opener, and opener - masher (replace WINDOW_USE_MIN
   *  0.60 and WINDOW_GAP_MIN 20 pp). */
  WINDOW_PER100_MIN: 20,
  WINDOW_GAP100_MIN: 15,
  FIRST_TARGET_DIFF_MIN: 0.25,
  /** combat v2.1 (D58): B55 share of wind-ups answered in elite and dungeon-boss fights, opener min and masher max. */
  WINDUP_ANSWER_MIN: 0.70,
  WINDUP_ANSWER_MASH_MAX: 0.20,
  MANUAL_GAP_V2: [15, 30],
  OPEN_SHARE_MIN: 0.60,
  COMBAT_MIN_MAX: 21,
  FIGHTS_V2: [34, 42],
  ROUNDS_BOSS_V2: [30, 40],
  /** v2 pacing (section 9), used for B53 only when the engine does not define the term yet. */
  PACE_ROUND_ANIM_S: 2.1,
  PACE_ROUND_DECIDE_S: 1.0,
  PACE_ENGAGE_S: 6,
  /** B16 bands of the changed B16 row (section 12 text, not the constant table): rounds incl. the engage round. */
  ROUNDS_V2: { normal: [4, 6], elite: [6, 9], dboss: [8, 12] },
};

/**
 * HEAT: the simulator's constants of docs/specs/expedition.md section 13, block "Heat" (bots and targets of H.6:
 * heat-seek / heat-avoid hour weights, B58 (was B55 of section H, D61), B56, B57), same names and values (pp as pp). Rules constants of
 * that block (HEAT_GAIN, HEAT_RARITY_UP, ...) are read from the engine (C). qa/sim/heat.test.mjs compares them.
 * M2b v6 (D63): HEAT_POLICY_GAP_MAX is also B56 (a)'s floor (heat-seek - planner), HEAT_WIN_SHARE the band of B56 (b)
 * (heat-seek's wins with a Hot node).
 */
export const HEAT = {
  HEAT_SEEK_TIME_MULT: 0.5,
  HEAT_AVOID_TIME_MULT: 4,
  HEAT_POLICY_GAP_MAX: 5,
  HEAT_WIN_SHARE: [0.30, 0.85],
  HEAT_POWER_MAX: 4,
};

/**
 * Expedition map bots and targets (expedition.md 10, 11.1, 13; MILESTONES 2b.4): the bot constants of section 13
 * (PLANNER_FOG_DEPTH, BELL_KEEP_VALUE) and the B41-B47 bands; the contract and prep block (B39, B40, B42, B46) below.
 */
export const EXP = {
  PLANNER_FOG_DEPTH: 4,
  BELL_KEEP_VALUE: 80,
  C_STEP_P0: [0.60, 0.80],
  C_STEP_PALL: [0.80, 0.92],
  C_ROUTE_P0_MAX: 0.15,
  C_ROUTE_PALL_MAX: 0.50,
  /** M2b v12 row 3 (D102, owner O9 default): 0.08-0.25; the old band is kept for the report's second reading. */
  CAUGHT_ZONES: [0.08, 0.25],
  CAUGHT_ZONES_OLD: [0.08, 0.18],
  DIM_DEATH_SHARE: [0.05, 0.20],
  CLOSE_CALL_GREEDY: [0.40, 0.75],
  THREAT_BOUND_MIN: 1.5,
  WALKS_PER_ZONE_MAX: 2.5,
  BELL_USE: [0.4, 0.9],
};

/**
 * Start camp and contracts (expedition.md 10.2, 10.3, 11.1, 13; MILESTONES 2b.5): the bot constants of section 13
 * (SITE_PARTIAL_MULT, EST_COMPLETE) and the B39, B40, B42, B46 bands, same names and values (pp as shares).
 */
Object.assign(EXP, {
  SITE_PARTIAL_MULT: 0.8,
  /** M2b v10 (changes-m2b-v10.md, simulator assumptions): 0.55 / 0.45 / 0.35 (was 0.55 / 0.50 / 0.90). */
  EST_COMPLETE: { cull: 0.55, bounty: 0.45, delve: 0.35 },
  /** M2b v10 D2: completion-gain priors of Region Charts, the Local Guide and the Spyglass on the held contracts' value. */
  EST_CHARTS_GAIN: 0.05,
  EST_GUIDE_GAIN: 0.05,
  EST_SPYGLASS_GAIN: 0.03,
  PLAN_GAIN_MIN: 0.03,
  PLAN_VS_RANDOM_MIN: 0.02,
  COMPLETION_P0: [0.45, 0.65],
  COMPLETION_PALL: [0.65, 0.85],
  COMPLETION_GREEDY_GAP: 0.08,
  VISION_COMPLETION_MIN: 0.10,
  CONTRACT_XP_SHARE: [0.08, 0.20],
});

/**
 * M2b v11 target rows 5-7 (changes-m2b-v11.md; D95-D97, pending the Lead's acceptance, so reports show the old and the
 * new reading side by side). Row 5: B41 C_step PALL band C_STEP_PALL_V11 and at least C_step P0 + C_STEP_PALL_OVER_P0
 * (old: C_STEP_PALL). Row 6: B42's no-vision cell removes B42_VISION_ENTRIES from the profile and makes the start camp's
 * B42_VISION_PERKS unavailable (the planner never buys them; old: entries removed only). Row 7: on expedition runs B12's
 * MIN_SPEED_MAX counts from SET_OUT (the start camp's minute left out; the ratio clause keeps the whole run), on at
 * least B12_MIN_WINS speedrunner wins.
 */
Object.assign(EXP, {
  C_STEP_PALL_V11: [0.70, 0.92],
  C_STEP_PALL_OVER_P0: 0.05,
  B42_VISION_ENTRIES: ['scout', 'cartographer', 'old_hand'],
  B42_VISION_PERKS: ['prep_charts', 'prep_tracker', 'prep_guide', 'prep_spyglass'],
  B12_MIN_WINS: 200,
});

/** Start camp and contracts: numbers the spec leaves open [assumption: starting values, sim 2026-11-11e]. */
Object.assign(SIM, {
  /** Prior completion gain of Tracker's Notes for Cull and Bounty contracts (prototype, expedition.md 12.2: 56 -> 77 %),
   *  until the planner's completion table has observations of both vision profiles. */
  EST_TRACKER_GAIN: 0.20,
  /** Expected best of n item choices as a multiple of one roll's expected gain (index n; the quest choice of 3 is 1.5 in
   *  sim/lib/model.mjs evalNode). */
  CONTRACT_CHOICE_GEAR: [0, 1, 1.3, 1.5, 1.65],
  /** Value units of a preparation point kept as Reserve (it pays hub contracts later): the planner buys at the start camp
   *  only what is worth more per point, and takes a hub contract from Reserve only above it. */
  PREP_POINT_VALUE: 60,
  /** Planner hub contract by swap: the offer must beat the held contract it gives up by this many value units. */
  HUB_SWAP_MARGIN: 50,
  /** Shrinkage of the planner's completion table towards its prior (pseudo-contracts per key). */
  COMPLETION_SHRINK: 20,
});

/**
 * Planner start camp by value per point (M2b v10 rows D1, D2; changes-m2b-v10.md): bot values of the supplies (value units
 * per option bought; draughts = qty × POTION_VALUE, ember = EMBER_VALUE, rations and mule from PREP_VALUE) and the
 * value of a second contract of a zone that already has one held. [assumption: designer starting values, calibrated by
 * cell 9.] POTION_VALUE 45 -> 30 by the D2 rule (balance-2026-11-11f): planner P0 without Field Draughts won +3.7 pp
 * (0.8 - 6.5, paired, 900 runs) against the start camp that bought them in every run; at 30 a pair is worth 60 per point,
 * never above PREP_POINT_VALUE, which is the measured arm. The Ember's forced arm stayed inside its interval (keep 320).
 * SPYGLASS_USED 0: no bot has a USE_SPYGLASS policy, so the planner does not value the
 * Spyglass (EST_SPYGLASS_GAIN applies once a policy uses it).
 */
Object.assign(SIM, {
  POTION_VALUE: 30,
  EMBER_VALUE: 320,
  PREP_VALUE: { rations: 45, mule: 20 },
  PREP_SAME_ZONE_MULT: 0.6,
  SPYGLASS_USED: 0,
  /** Contract XP in the bots' model (expedition.md 3.1): 0 = no level-difference modifier (M2b v10 row A1, the engine
   *  package being built); 1 = × diffMod(CL_c - L) as the engine before A1 (set it to reproduce an earlier measure). */
  CONTRACT_XP_DIFFMOD: 0,
});

/** Expedition map bots: numbers the spec leaves open [assumption: starting values, sim 2026-11-11d]. */
Object.assign(SIM, {
  /** Value units per level under the zone's exit level (10z) when the planner leaves a zone (expedition.md 10.2:
   *  "leaving valued with an under-level penalty"): 1.5 × VAL_XP. */
  EXP_UNDER_LEVEL_VALUE: 150,
  /** Death chance of a Dimmed encounter at depth d in the bots' model (expedition.md 12.1 SI): learned by depth bucket
   *  0, 1, 2+ (sim/lib/risk.mjs `dim`, M2b v10 row C2), prior EXP_DIM_DEATH × (1 + d), shrunk with RISK_SHRINK (was a
   *  fixed 0.08 × (1 + d)). */
  EXP_DIM_DEATH: 0.02,
  /** Deepest depth bucket of the `dim` table (2 = "2+"). */
  DIM_DEPTH_MAX: 2,
  /** HP fraction a Dimmed encounter costs in the bots' model: the prior of the learned HP change (survivors, after the
   *  fight) when DIM_LEARN_HP is 1, else fixed (C2: "learned the same way" once the recorder gives it). */
  EXP_DIM_HP: 0.30,
  DIM_LEARN_HP: 1,
  /** Greedy threat rule (expedition.md 10.2): tolls of margin before a node dims. */
  EXP_GREEDY_DIM_MARGIN: 2,
});

/** Heat in the planner's value function (expedition.md H.6 leaves the exchange rates open) [assumption]. */
Object.assign(SIM, {
  /** Boss term (sim/lib/model.mjs): value units per 1.0 of projected boss Ascendancy (320 per ASC_PER_STEP step, 32 per
   *  hour past the line). VAL_DEATH (a run lost) × 3.9, the win probability a planner P0 run that reaches the boss loses
   *  per 1.0 of Ascendancy (paired measure ASC_CAP 0.40 vs 0, docs/reports/balance-2026-11-11.md), rounded. */
  VAL_ASC: 8000,
  /** 1 = the boss term uses the meter's stepped ascIfPar; 0 = without the floor (expected steps; the bots' default). */
  HEAT_ASC_FLOOR: 0,
});

/** Opener and replay harness numbers the combat v2 spec leaves open [assumption: compute budget]. */
Object.assign(SIM, {
  /** Opener (sim/bots/opener.mjs): samples a sequence is expanded on (the beam's score), and the best complete
   *  sequences (OPENER_FINAL_KEEP, picked on those samples plus the tail) re-scored on the other samples. With 1 the
   *  anchor comparison on the held-out samples is unbiased (a best-of-3 pick on them inflates the plan's score). */
  OPENER_RACE_SAMPLES: 1,
  OPENER_FINAL_KEEP: 1,
  /** Opener: healing items are search candidates below this HP fraction (rules 1-2 of autoplay always stand). */
  OPENER_POTION_HP: 0.5,
  /** Opener: a fight is played by autoplay while it is routine (one normal enemy, no heavy or cast in sight) and HP
   *  is at least this fraction. */
  OPENER_GATE_HP: 0.7,
  /** Opener: 1 = potion heals credit their amount (combat-v2.md 11); 0 = as the tactician (no credit). */
  OPENER_POTION_CREDIT: 1,
  /** Opener: the plan is followed only when its mean score beats autoplay's (played on the same OPENER_SAMPLES
   *  samples to the same horizon) by more than OPENER_MARGIN × max HP; else autoplay plays until the next surprise.
   *  OPENER_ANCHOR 0 switches the comparison off. */
  OPENER_ANCHOR: 1,
  OPENER_MARGIN: 0.06,
  /** Opener: 1 = re-plan every round of the opening while following a plan (closed loop); 0 = only on surprises. */
  OPENER_REPLAN_EVERY: 0,
  /** Opener (combat-v2.md 11, combat v2.1, D59): 1 = root-diverse beam (the best sequence of every first action stays
   *  in the beam, and up to C2.OPENER_ROOT_KEEP first actions are scored on the held-out samples) and stun/control
   *  candidates on a CC-immune enemy's cast; 0 = the opener of combat v2 (top OPENER_BEAM only, OPENER_FINAL_KEEP
   *  held-out, no such candidates). A diagnostic switch: reports use 1. */
  OPENER_ROOT_DIVERSE: 1,
});

// Tuning hook for scratch experiments only: SIM_OVERRIDE='{"KEY":value}' changes SIM numbers in every thread. The
// batch summaries record it (sim/lib/session.mjs); a report must be made without it.
if (typeof process !== 'undefined' && process.env && process.env.SIM_OVERRIDE) Object.assign(SIM, JSON.parse(process.env.SIM_OVERRIDE));
