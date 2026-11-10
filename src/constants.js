// Rules constants (docs/specs/rules.md). Single source of every number the engine uses.
//
// Part 1: the global constant table, rules.md section 13, same names and values.
// Part 2: the data tables (CLASS, SPELL, PET, TALENT, ARCHETYPE, OPENING_SCRIPT, SCRIPT_ACTION, ENGAGE_OPTION,
//         SLOT, RARITY, DROP_TABLE, ITEM_SCORE, CONSUMABLE, BOON, META, ABILITY_TEMPLATE, CONTENT_RANGE), rules.md
//         sections 2.9, 5, 6, 7.6, 7.10, 8, 11, 12. A cell is addressed TABLE.id.field, as in the spec.
// Part 3: ENGINE_ASSUMPTION: numbers the spec leaves open. Each one is listed under "Spec questions" in
//         docs/handoffs/engineer-2026-11-09.md. Tune them like any other constant.
//
// The Simulation & Balance Engineer tunes values here (balance.md 2, TUNE_LIMIT). Names never change.

// ---------------------------------------------------------------------------------------------
// Part 1. rules.md section 13
// ---------------------------------------------------------------------------------------------
export const MAX_LEVEL = 60;
export const ZONE_COUNT = 6;
export const ZONE_LEVELS = 10;
export const ZONE_CHOICE_ROWS = 7;
export const LANES = 3;
export const DUNGEON_ROW_MIN = 4;
export const DUNGEON_ROW_MAX = 6;
export const REST_ROW_MIN = 3;
export const REST_ROW_MAX = 5;
export const TRAINER_ROW_MIN = 3;
export const TRAINER_ROW_MAX = 5;
export const MAX_SAME_TYPE_PER_ROW = 2;
export const W_QUEST = 38;
export const W_GRIND = 14;
export const W_ELITE = 14;
export const W_REST = 12;
export const W_VENDOR = 6;
export const W_TRAINER = 4;
export const W_TREASURE = 6;
export const W_SHRINE = 6;
export const QUEST_LEVEL_OFFSETS = [-1, 0, 0, 1];
export const ELITE_LEVEL_OFFSET = 1;
export const DUNGEON_LEVEL_OFFSET = 4;
export const DUNGEON_BOSS_LEVEL_OFFSET = 2;
export const RARE_CHANCE = 0.20;
export const CAMP_GRIND_LEVEL = 58;
export const HOURS_QUEST = 2;
export const HOURS_GRIND_WAVE = 1;
export const HOURS_ELITE = 2;
export const HOURS_DUNGEON = 5;
export const HOURS_REST = 4;
export const HOURS_VENDOR = 1;
export const HOURS_TRAINER = 1;
export const HOURS_TREASURE = 1;
export const HOURS_SHRINE = 1;
export const HOURS_TRAVEL = 2;
export const TRAVEL_EARLY_LEVELS = 1;
export const BOSS_TIME_PAR = 120;
export const ASC_STEP_HOURS = 10;
export const ASC_PER_STEP = 0.04;
export const ASC_CAP = 0.40;
/** rules 11.2 (M2 v4): hours the full catalogue's time entries may save on the planner's median route (measured by the sim, balance.md B17). */
export const META_TIME_BUDGET_H = 5;
export const QUEST_SIZE_W1 = 25;
export const QUEST_SIZE_W2 = 50;
export const QUEST_SIZE_W3 = 25;
export const QUEST_MAX_SIZE_Z1 = 2;
export const QUEST_TURNIN_XP_FRAC = 1.15;
export const QUEST_GOLD_V = 2;
export const QUEST_REWARD_CHOICES = 2;
export const STORY_QUESTS = 3;
export const STORY_XP_FRAC = 0.90;
export const STORY_REWARD_CHOICES = 3;
export const GRIND_MAX_WAVES = 3;
export const GRIND_WAVE_SIZE = 2;
export const GRIND_WAVE_XP_FRAC = 0.115;
export const GRIND_DROP_MULT = 1.5;
export const ELITE_ADD_CHANCE = 0.30;
export const ELITE_GOLD_V = 2;
export const DUNGEON_TRASH_FIGHTS = 3;
export const DUNGEON_SIZE_W2 = 50;
export const DUNGEON_SIZE_W3 = 50;
export const DUNGEON_CLEAR_XP_FRAC = 0.70;
export const DUNGEON_GOLD_V = 6;
export const DUNGEON_BOSS_DROPS = 2;
export const TREASURE_GUARD_CHANCE = 0.50;
export const TREASURE_GOLD_V = 3;
export const TREASURE_TRAP_CHANCE = 0.10;
export const TREASURE_TRAP_PCT = 0.15;
export const BOON_W_RETURN = 10;
export const BOON_W_INSIGHT = 20;
export const BOON_W_FURY = 20;
export const BOON_W_PLENTY = 20;
export const BOON_W_MENDING = 20;
export const BOON_W_CLARITY = 10;
export const BOON_XP_PCT = 0.20;
export const BOON_DMG_PCT = 0.15;
export const BOON_NODES = 3;
export const BOON_GOLD_V = 4;
export const MOB_XP_FRAC = 0.285;
export const DUNGEON_MOB_XP_MULT = 1.0;
export const ELITE_XP_MULT = 6;
export const RARE_XP_MULT = 8;
export const DUNGEON_BOSS_XP_MULT = 8;
export const XP_A = 20;
export const XP_B = 180;
export const XP_C = 200;
export const XP_DIFF_STEP = 0.05;
export const XP_DIFF_MAX = 1.25;
export const XP_DIFF_SOFT_FLOOR = -2;
export const XP_DIFF_FALL = 0.20;
export const XP_GREY_DIFF = -6;
export const XP_GREY_MOD = 0.10;
export const REST_RESTED_FRAC = 0.60;
export const RESTED_CAP_FRAC = 1.50;
export const RESTED_MULT = 2;
export const TALENT_FIRST_LEVEL = 10;
export const TALENT_LEVEL_STEP = 2;
export const TALENT_TIER_GATE = 4;
export const START_GOLD = 50;
export const START_RATIONS = 2;
export const HP_PER_STA = 10;
export const POWER_PER_PRIMARY = 1;
export const RATING_K = 4;
export const RATING_C = 20;
export const CRIT_BASE = 0.05;
export const CRIT_FROM_PRIMARY = 0.12;
export const CRIT_CAP = 0.50;
export const CRIT_MULT = 1.5;
export const DODGE_CAP = 0.75;
export const ARMOR_K = 40;
export const ARMOR_C = 100;
export const ARMOR_MIT_CAP = 0.75;
export const MANA_BASE = 50;
export const MANA_PER_LEVEL = 12;
export const MANA_PER_INT = 6;
export const MANA_REGEN_ROUND_PCT = 0.025;
export const ENERGY_MAX = 100;
export const ENERGY_REGEN = 25;
export const FOCUS_MAX = 100;
export const FOCUS_REGEN = 25;
export const CP_MAX = 5;
export const POST_FIGHT_REGEN_BASE = 0.10;
export const POST_FIGHT_REGEN_SPI = 0.12;
export const REGEN_SPI_K = 2;
export const REGEN_SPI_C = 10;
export const SPELL_BAR_SLOTS = 7;
export const ITEM_BAR_SLOTS = 3;
export const PET_DMG_BASE = 2;
export const PET_DMG_PER_LEVEL = 0.65;
export const PET_DMG_POWER = 0.375;
export const PET_REVIVE_PCT = 0.25;
export const MISS_BASE = 0.05;
export const MISS_PER_LEVEL = 0.02;
export const MISS_CAP = 0.35;
export const LVL_DMG_STEP = 0.04;
export const LVL_DMG_MIN = 0.70;
export const LVL_DMG_MAX = 1.30;
export const DMG_VARIANCE = 0.10;
export const ENEMY_CRIT = 0.05;
export const ENEMY_DODGE = 0.05;
export const CHILL_PCT = 0.20;
export const CURSE_PCT = 0.15;
export const STEALTH_MISS_BONUS = 0.50;
export const POTION_CD = 4;
export const FLEE_BASE = 0.60;
export const FLEE_PER_EXTRA_ENEMY = 0.05;
export const FIGHT_SOFT_ENRAGE_ROUND = 20;
export const FIGHT_SOFT_ENRAGE_STEP = 0.25;
export const ENEMY_HP_BASE = 20;
export const ENEMY_HP_PER_LEVEL = 12;
export const ENEMY_DMG_BASE = 4;
export const ENEMY_DMG_PER_LEVEL = 2.6;
export const ZONE_DANGER_FROM = 20;
export const ZONE_DANGER_STEP = 0.25;
export const DUNGEON_DANGER_FRAC = 0.5;
export const ENEMY_ARMOR_PER_LEVEL = 15;
export const DUNGEON_TRASH_HP_MULT = 1.2;
export const DUNGEON_TRASH_DMG_MULT = 1.1;
export const ELITE_HP_MULT = 2.8;
export const ELITE_DMG_MULT = 1.5;
export const RARE_HP_MULT = 4.5;
export const RARE_DMG_MULT = 1.6;
export const DUNGEON_BOSS_HP_MULT = 5.6;
export const DUNGEON_BOSS_DMG_MULT = 1.5;
export const AUTO_POTION_HP = 0.35;
export const AUTO_MANA_POTION = 0.20;
export const AUTO_TONIC_STACKS = 3;
export const AUTO_FOOD_HP = 0.50;
export const BUDGET_PER_ILVL = 0.6;
export const ILVL_MAX = 63;
export const MIN_HIT_DAMAGE = 1;
export const RARITY_ILVL_BONUS = { common: 0, uncommon: 0, rare: 1, epic: 3 };
export const AFFIX_SHARE = 0.25;
export const AFFIX_CRIT_PCT = 0.015;
export const AFFIX_EPIC_MULT = 1.4;
export const AFFIX_POWER_PER_PT = 1;
export const AFFIX_ARMOR_PER_PT = 10;
export const SPLIT2_MAIN = 0.60;
export const SPLIT3_MAIN = 0.45;
export const SPLIT3_SECOND = 0.35;
export const DROP_CLASS_BIAS = 0.70;
export const WEAPON_DMG_BASE = 4;
export const WEAPON_DMG_PER_ILVL = 1.8;
export const ARMOR_PER_ILVL = 5;
export const MOB_ITEM_CHANCE = 0.15;
export const DUNGEON_ITEM_CHANCE = 0.25;
export const MOB_JUNK_CHANCE = 0.30;
export const EMBER_ELITE_DROP_CHANCE = 0.04;
export const UNIQUE_DROP_CHANCE = 0.15;
export const VALUE_BASE = 10;
export const VALUE_COEF = 3;
export const VALUE_EXP = 1.5;
export const MOB_COIN_V = 0.5;
export const JUNK_V = 0.6;
export const BUY_MULT = 4;
export const TRAIN_NEW_V = 2;
export const TRAIN_RANK_V = 0.5;
export const RESPEC_V = 10;
export const VENDOR_CONSUMABLES = 6;
export const VENDOR_GEAR_STOCK = 3;
export const EMBER_STOCK_CHANCE = 0.15;
export const EMBER_V = 30;
export const EMBER_MAX_CARRIED = 1;
export const HEAL_DRAUGHT_PCT = 0.35;
export const MANA_DRAUGHT_PCT = 0.35;
export const RATION_PCT = 0.40;
export const GREATER_HEAL_PCT = 0.375;
export const SPARK_BASE = 6;
export const SPARK_PER_LEVEL = 2.2;
export const ELIXIR_DMG_PCT = 0.10;
export const ELIXIR_NODES = 3;
export const PRICE_HEAL_V = 1.5;
export const PRICE_MANA_V = 1.5;
export const PRICE_RATION_V = 0.5;
export const PRICE_TONIC_V = 2;
export const PRICE_SPARK_V = 1;
export const PRICE_ELIXIR_V = 3;
export const PRICE_GHEAL_V = 2.5;
export const STACK_POTION = 5;
export const STACK_FOOD = 10;
export const STACK_ELIXIR = 3;
export const STACK_JUNK = 10;
export const BAG_SLOTS = 16;
export const RES_HP_PCT = 0.40;
export const RES_MANA_PCT = 0.40;
export const RES_META_CHARGES = 1;
export const BOSS_LEVEL = 62;
export const BOSS_HP = 13900;
export const BOSS_ARMOR = 1200;
export const BOSS_MELEE = 260;
export const BOSS_CRUSH = 380;
export const BOSS_CRUSH_EVERY = 6;
export const BOSS_LITANY_DMG = 850;
export const LITANY_FIRST = 3;
export const LITANY_EVERY = 5;
export const BRAND_EVERY = 4;
export const BRAND_DMG = 35;
export const BRAND_MAX = 10;
export const P2_AT = 0.70;
export const P3_AT = 0.40;
export const SHARD_HP = 1000;
export const SHARD_DMG = 110;
export const SHARD_COUNT = 2;
export const SHARD_EVERY = 8;
export const SHARD_MAX = 4;
export const LINK_DR = 0.60;
export const LINK_DR_PER_SHARD = 0.15;
export const SHARD_AOE_TAKEN = 1.00;
export const ECLIPSE_STEP = 0.05;
export const PULSE_DMG = 280;
export const PULSE_EVERY = 3;
export const BOSS_ENRAGE_ROUND = 57;
export const FINAL_DARK_DMG = 99999;
export const ECHO_PER_LEVEL = 1.5;
export const ECHO_PER_ZONE = 7.5;
export const ECHO_PER_DUNGEON = 8;
export const ECHO_PER_ELITE = 3;
export const ECHO_PER_RARE = 6;
export const ECHO_PER_QUEST = 1;
export const ECHO_BOSS_REACHED = 20;
export const ECHO_BOSS_PHASE = 12;
export const ECHO_BOSS_KILL = 120;
export const ECHO_SPEED_BONUS = 40;
export const ECHO_FIRST_KILL_CLASS = 100;
export const OATH_ECHO_BONUS = 0.25;
export const OATH_HASTE_HOURS = 20;
export const OATH_THRIFT_MULT = 1.5;
export const UNIQUE_PROC_CHANCE = 0.15;
export const UNIQUE_PROC_BASE = 5;
export const UNIQUE_PROC_PER_LEVEL = 2;
export const UNIQUE_HEAL_ON_KILL = 0.08;
export const UNIQUE_ELITE_DMG = 0.08;
export const UNIQUE_POTION_PCT = 0.25;
export const UNIQUE_WARD_PCT = 0.08;
export const PACE_CREATE_S = 40;
export const PACE_DECIDE_S = 5;
export const PACE_TRAVEL_NODE_S = 3.5;
export const PACE_ZONE_TRAVEL_S = 8;
export const PACE_QUEST_TEXT_S = 5;
export const PACE_FIGHT_OVERHEAD_S = 3;
/** rules 3 (combat v2: 1.5 -> 2.1, the animation +40 %). */
export const PACE_ROUND_ANIM_S = 2.1;
export const PACE_ROUND_DECIDE_S = 1.0;
/** rules 3: manual round = UI animation budget + decision time. */
export const PACE_MANUAL_ROUND_S = PACE_ROUND_ANIM_S + PACE_ROUND_DECIDE_S;
/** rules 3 (combat v2: 0.8 -> 1.1). */
export const PACE_AUTO_ROUND_S = 1.1;
/** rules 3 (combat v2): reading the tracks and choosing the engage, manual profile, every fight with an engage round. */
export const PACE_ENGAGE_S = 6;
export const PACE_LOOT_S = 3;
export const PACE_LEVELUP_S = 2;
export const PACE_TALENT_S = 6;
export const PACE_REST_S = 5;
export const PACE_SHRINE_S = 6;
export const PACE_TREASURE_S = 4;
export const PACE_VENDOR_S = 20;
export const PACE_VENDOR_TX_S = 3;
export const PACE_TRAINER_S = 6;
export const PACE_TRAINER_TX_S = 2;
export const PACE_BOSS_INTRO_S = 20;
// Combat v2 (rules 7, marked "(combat v2)"; docs/specs/combat-v2.md 15).
/** rules 7.11: entries of an enemy's intent track (now + 2). */
export const INTENT_TRACK_LEN = 3;
/** rules 7.12: enemy turns with a scripted opening action. */
export const OPENING_TURNS = 3;
/** rules 7.12: enemy turn of the signature ability (elite, rare, dungeon boss). */
export const SIGNATURE_TURN = 2;
/** rules 7.12: enemy turn of a dungeon boss's second template ability. */
export const SIGNATURE_TURN_2 = 5;
/** rules 7.12: × the pct of a heavy action on a scripted turn (tuning lever). */
export const HEAVY_SCRIPT_MULT = 1.0;
/** rules 7.12: × the pct of a cast action on a scripted turn (tuning lever). */
export const CAST_SCRIPT_MULT = 1.0;
/** rules 7.6, 7.11: Mend needs an ally below this fraction of max HP (ARCHETYPE.mender Mend `below`). */
export const MEND_BELOW = 0.70;
/** rules 7.12: enemies a skulker's Signal brings. */
export const SIGNAL_ADDS = 1;
/** rules 7.12: Bolster shield, fraction of the ally's max HP. */
export const BOLSTER_PCT = 0.20;
/** rules 7.12: Bolster cooldown in turns. */
export const BOLSTER_CD = 4;
/** rules 7.12: a beast's damage per turn it has acted (Bloodlust). */
export const BLOODLUST_STEP = 0.10;
/** rules 7.12: Bloodlust cap. */
export const BLOODLUST_MAX = 0.50;
/** rules 7.13: OFF_BALANCE, damage taken from the player and pet. */
export const OFFBAL_TAKEN = 0.30;
/** rules 7.13, 10: OFF_BALANCE on the end boss, damage taken. */
export const OFFBAL_BOSS_TAKEN = 0.15;
/** rules 7.13: OFF_BALANCE, the player's crit chance against it. */
export const OFFBAL_CRIT = 0.20;
/** rules 7.13: OFF_BALANCE status duration (one player action). */
export const OFFBAL_DURATION = 2;
/** rules 7.6, 7.10: enemy damage × this for every template enemy (the price of the engage round; not the end boss). */
export const ENGAGE_DMG_COMP = 1.15;
/** rules 7.10: Ambush = Gutting Jab × this before Shadowstep Strike is learned. */
export const AMBUSH_MULT = 1.5;
/** rules 7.10: Sap, enemy turns SAPPED. */
export const SAP_TURNS = 3;
/** rules 7.10: Premeditate, combo points. */
export const PREMED_CP = 3;
/** rules 7.10: Binding Glyph, enemy turns FROZEN. */
export const GLYPH_TURNS = 2;
/** rules 7.10: Gathered Power, damaging spells that cost 0 mana. */
export const GATHER_SPELLS = 2;
/** rules 7.10: Gathered Power, crit chance on those spells. */
export const GATHER_CRIT = 0.50;
/** rules 7.10: Opening Shot = Keen Shot × this. */
export const OPENING_SHOT_MULT = 1.5;
/** rules 7.10: Opening Shot, MARKED status duration in rounds. */
export const OPENING_MARK_ROUNDS = 4;
/** rules 7.10: Lay Trap, STUN rounds when it springs. */
export const TRAP_STUN = 1;
/** rules 7.10: Send the Pet, enemy turns of pet TAUNT. */
export const PET_LEAD_TURNS = 2;
/** rules 7.10: Send the Pet, damage the pet takes less during them. */
export const PET_LEAD_DR = 0.30;
/** rules 7.9 rule E: enemy turns autoplay reads when it picks the control target. */
export const ENGAGE_AUTO_LOOK = 2;

// ---------------------------------------------------------------------------------------------
// Part 2. Data tables
// ---------------------------------------------------------------------------------------------

/** Node types (rules 2.0) with map weight and hours. Dungeon has no weight: placed once by map step 1. */
export const NODE_TYPE = {
  quest: { id: 'quest', name: 'Quest', weight: W_QUEST, hours: HOURS_QUEST },
  grind: { id: 'grind', name: 'Grind', weight: W_GRIND, hours: HOURS_GRIND_WAVE },
  elite: { id: 'elite', name: 'Elite', weight: W_ELITE, hours: HOURS_ELITE },
  rest: { id: 'rest', name: 'Rest', weight: W_REST, hours: HOURS_REST },
  vendor: { id: 'vendor', name: 'Vendor', weight: W_VENDOR, hours: HOURS_VENDOR },
  trainer: { id: 'trainer', name: 'Trainer', weight: W_TRAINER, hours: HOURS_TRAINER },
  treasure: { id: 'treasure', name: 'Treasure', weight: W_TREASURE, hours: HOURS_TREASURE },
  shrine: { id: 'shrine', name: 'Shrine', weight: W_SHRINE, hours: HOURS_SHRINE },
  dungeon: { id: 'dungeon', name: 'Dungeon', weight: 0, hours: HOURS_DUNGEON },
};
/** Map step 3 draw order (row 1 forbids elite, rest, vendor, trainer). */
export const NODE_DRAW_ORDER = ['quest', 'grind', 'elite', 'rest', 'vendor', 'trainer', 'treasure', 'shrine'];
export const ROW1_FORBIDDEN = ['elite', 'rest', 'vendor', 'trainer'];
export const MAP_REDRAW_TRIES = 10;

/** Classes (rules 5.1). stats: [base, growth per level]. basic: free basic attack, b + l×L + p×P + w×WD. */
export const CLASS = {
  rogue: {
    id: 'rogue', name: 'Rogue', primary: 'AGI', resource: 'energy',
    hpBase: 70, hpPerLevel: 20,
    stats: { STA: [10, 1.4], AGI: [20, 2.0], INT: [6, 0.3], SPI: [8, 0.6] },
    armorBase: 20, armorPerLevel: 6, armorMult: 1.0, dodgeBase: 0.05, dodgeFromAgi: 0.10,
    basic: { id: 'strike', name: 'Strike', school: 'phys', b: 0, l: 0, p: 0.30, w: 1.0 },
    startSpells: ['gutting_jab', 'severing_flourish'],
    trees: ['Bladework', 'Shadowcraft', 'Venomcraft'],
  },
  mage: {
    id: 'mage', name: 'Mage', primary: 'INT', resource: 'mana',
    hpBase: 50, hpPerLevel: 19.5,
    stats: { STA: [8, 1.25], AGI: [8, 0.5], INT: [22, 2.2], SPI: [12, 1.0] },
    armorBase: 10, armorPerLevel: 3, armorMult: 0.5, dodgeBase: 0.03, dodgeFromAgi: 0,
    basic: { id: 'spark', name: 'Spark', school: 'arcane', b: 2, l: 0.6, p: 0.35, w: 0 },
    startSpells: ['ember_bolt', 'frost_lance'],
    trees: ['Pyromancy', 'Rimecraft', 'Arcanism'],
  },
  hunter: {
    id: 'hunter', name: 'Hunter', primary: 'AGI', resource: 'focus',
    hpBase: 60, hpPerLevel: 15.5,
    stats: { STA: [9, 1.2], AGI: [18, 1.8], INT: [10, 0.8], SPI: [9, 0.8] },
    armorBase: 25, armorPerLevel: 7, armorMult: 1.3, dodgeBase: 0.04, dodgeFromAgi: 0.06,
    basic: { id: 'auto_shot', name: 'Auto Shot', school: 'phys', b: 0, l: 0, p: 0.35, w: 1.0 },
    startSpells: ['keen_shot', 'barbed_arrow'],
    trees: ['Beastbond', 'Marksmanship', 'Wildcraft'],
  },
};
export const CLASS_IDS = ['rogue', 'mage', 'hunter'];

/**
 * Spells (rules 5.3-5.6, talent spells 6.x).
 * cost: energy/focus points, or fraction of base mana for the Mage (rules 7.3).
 * Damage = b + l×tl + p×P + w×WD (talent spells use tl = L). perCp: the b/l/p part is × CP.
 * source: 'class' (trainer), 'talent' (granted by a talent, tl = L) or 'meta' (trainer after unlock).
 * target: 'enemy' (single target), 'all' (every enemy), 'self', 'pet'.
 */
export const SPELL = {
  // Rogue (5.3)
  gutting_jab: { id: 'gutting_jab', cls: 'rogue', name: 'Gutting Jab', lvl: 1, cost: 40, cd: 0, school: 'phys', b: 6, l: 1.3, p: 0.55, w: 1.0, cp: 1, tags: ['builder'], target: 'enemy', source: 'class' },
  severing_flourish: { id: 'severing_flourish', cls: 'rogue', name: 'Severing Flourish', lvl: 1, cost: 35, cd: 0, school: 'phys', b: 4, l: 1.0, p: 0.30, perCp: true, wFlat: 0.5, tags: ['finisher'], target: 'enemy', source: 'class', autoCp: 4, autoCpLow: 2, autoLowHp: 0.25 },
  shadowstep_strike: { id: 'shadowstep_strike', cls: 'rogue', name: 'Shadowstep Strike', lvl: 4, cost: 50, cd: 0, school: 'phys', b: 10, l: 2.0, p: 0.9, w: 1.5, cp: 2, tags: ['opener'], target: 'enemy', source: 'class' },
  throat_jab: { id: 'throat_jab', cls: 'rogue', name: 'Throat Jab', lvl: 6, cost: 20, cd: 4, school: 'phys', b: 2, l: 0.4, p: 0.2, w: 0, silence: 1, tags: ['interrupt'], target: 'enemy', source: 'class' },
  open_vein: { id: 'open_vein', cls: 'rogue', name: 'Open Vein', lvl: 10, cost: 30, cd: 0, dot: { status: 'BLEED', rounds: 4, b: 2, l: 0.45, p: 0.10, perCp: true }, tags: ['finisher', 'dot'], target: 'enemy', source: 'class', autoCp: 4 },
  temple_blow: { id: 'temple_blow', cls: 'rogue', name: 'Temple Blow', lvl: 12, cost: 25, cd: 5, stunBase: 1, stunMax: 3, tags: ['finisher', 'stun'], target: 'enemy', source: 'class', autoCp: 1 },
  smoke_veil: { id: 'smoke_veil', cls: 'rogue', name: 'Smoke Veil', lvl: 16, cost: 25, cd: 8, dodge: 0.45, rounds: 3, tags: ['defensive'], target: 'self', source: 'class', autoHp: 0.50, autoEnemies: 2 },
  whirling_edges: { id: 'whirling_edges', cls: 'rogue', name: 'Whirling Edges', lvl: 20, cost: 50, cd: 0, school: 'phys', b: 3, l: 0.6, p: 0.3, w: 0.6, cp: 1, tags: ['aoe', 'builder'], target: 'all', source: 'class', autoEnemies: 2 },
  expose_weakness: { id: 'expose_weakness', cls: 'rogue', name: 'Expose Weakness', lvl: 24, cost: 25, cd: 0, exposedPerCp: 0.04, rounds: 5, tags: ['finisher'], target: 'enemy', source: 'class', autoCp: 4 },
  adrenal_surge: { id: 'adrenal_surge', cls: 'rogue', name: 'Adrenal Surge', lvl: 30, cost: 0, cd: 10, energy: 60, regenMult: 2, rounds: 3, tags: ['resource'], target: 'self', source: 'class', autoEnergy: 40 },
  vanishing_step: { id: 'vanishing_step', cls: 'rogue', name: 'Vanishing Step', lvl: 36, cost: 0, cd: 12, tags: ['defensive', 'cleanse'], target: 'self', source: 'class', autoHp: 0.30, autoStacks: 3 },
  final_reckoning: { id: 'final_reckoning', cls: 'rogue', name: 'Final Reckoning', lvl: 44, cost: 40, cd: 0, school: 'phys', b: 6, l: 1.3, p: 0.35, perCp: true, executeBelow: 0.35, executeMult: 2, tags: ['finisher', 'execute'], target: 'enemy', source: 'class', autoCp: 3 },
  thousand_cuts: { id: 'thousand_cuts', cls: 'rogue', name: 'Thousand Cuts', lvl: 1, cost: 30, cd: 6, school: 'phys', hits: 4, gjFrac: 0.6, cp: 2, tags: ['builder'], target: 'enemy', source: 'talent' },
  rupture_venom: { id: 'rupture_venom', cls: 'rogue', name: 'Rupture Venom', lvl: 1, cost: 30, cd: 0, school: 'phys', b: 4, l: 0.9, p: 0.3, perCp: true, perPoison: 0.15, tags: ['finisher'], target: 'enemy', source: 'talent' },
  ghostblade_rush: { id: 'ghostblade_rush', cls: 'rogue', name: 'Ghostblade Rush', lvl: 20, cost: 45, cd: 5, school: 'phys', hits: 2, gjFrac: 0.8, cp: 2, tags: ['builder'], target: 'enemy', source: 'meta', meta: 'sp_r1', autoCpMax: 3 },
  bloodprice_gambit: { id: 'bloodprice_gambit', cls: 'rogue', name: 'Bloodprice Gambit', lvl: 40, cost: 0, cd: 12, hpCost: 0.10, cpGain: 5, energy: 50, tags: ['resource'], target: 'self', source: 'meta', meta: 'sp_r2', autoHp: 0.60 },
  // Mage (5.4)
  ember_bolt: { id: 'ember_bolt', cls: 'mage', name: 'Ember Bolt', lvl: 1, cost: 0.09, cd: 0, school: 'fire', b: 6, l: 2.1, p: 1.12, tags: ['nuke'], target: 'enemy', source: 'class' },
  frost_lance: { id: 'frost_lance', cls: 'mage', name: 'Frost Lance', lvl: 1, cost: 0.08, cd: 0, school: 'frost', b: 4, l: 1.54, p: 0.84, chill: 2, tags: ['control'], target: 'enemy', source: 'class' },
  arcane_ward: { id: 'arcane_ward', cls: 'mage', name: 'Arcane Ward', lvl: 4, cost: 0.12, cd: 5, ward: { b: 10, l: 3.0, p: 1.0 }, rounds: 4, tags: ['defensive'], target: 'self', source: 'class' },
  rime_burst: { id: 'rime_burst', cls: 'mage', name: 'Rime Burst', lvl: 10, cost: 0.12, cd: 6, school: 'frost', b: 2, l: 0.5, p: 0.25, freeze: 1, tags: ['aoe', 'stun'], target: 'all', source: 'class', autoEnemies: 2, autoHp: 0.50 },
  living_flame: { id: 'living_flame', cls: 'mage', name: 'Living Flame', lvl: 12, cost: 0.10, cd: 0, school: 'fire', dot: { status: 'BURN', rounds: 5, b: 2, l: 0.5, p: 0.22 }, tags: ['dot'], target: 'enemy', source: 'class', autoTargetHp: 0.60 },
  spellsnap: { id: 'spellsnap', cls: 'mage', name: 'Spellsnap', lvl: 14, cost: 0.06, cd: 5, school: 'arcane', b: 2, l: 0.3, p: 0.2, silence: 2, tags: ['interrupt'], target: 'enemy', source: 'class' },
  hexbind: { id: 'hexbind', cls: 'mage', name: 'Hexbind', lvl: 18, cost: 0.10, cd: 6, hex: 3, tags: ['control'], target: 'enemy', source: 'class', autoEnemies: 2 },
  cinder_storm: { id: 'cinder_storm', cls: 'mage', name: 'Cinder Storm', lvl: 22, cost: 0.22, cd: 0, school: 'fire', b: 5, l: 1.4, p: 0.63, tags: ['aoe'], target: 'all', source: 'class', autoEnemies: 3 },
  mana_siphon: { id: 'mana_siphon', cls: 'mage', name: 'Mana Siphon', lvl: 26, cost: 0, cd: 12, manaPct: 0.30, tags: ['resource'], target: 'self', source: 'class', autoMana: 0.30 },
  glacial_tomb: { id: 'glacial_tomb', cls: 'mage', name: 'Glacial Tomb', lvl: 30, cost: 0, cd: 15, healPct: 0.10, rounds: 2, tags: ['defensive', 'cleanse'], target: 'self', source: 'class', autoHp: 0.25, autoStacks: 3 },
  pyre_comet: { id: 'pyre_comet', cls: 'mage', name: 'Pyre Comet', lvl: 38, cost: 0.20, cd: 3, school: 'fire', b: 12, l: 4.2, p: 2.1, critVsBurn: 0.25, tags: ['nuke'], target: 'enemy', source: 'class' },
  starlance_barrage: { id: 'starlance_barrage', cls: 'mage', name: 'Starlance Barrage', lvl: 46, cost: 0.25, cd: 4, school: 'arcane', hits: 3, b: 4, l: 1.2, p: 0.6, tags: ['nuke'], target: 'enemy', source: 'class' },
  conflagrant_core: { id: 'conflagrant_core', cls: 'mage', name: 'Conflagrant Core', lvl: 1, cost: 0, cd: 12, rounds: 3, critBonus: 0.50, tags: ['burst'], target: 'self', source: 'talent' },
  glacier_spike: { id: 'glacier_spike', cls: 'mage', name: 'Glacier Spike', lvl: 1, cost: 0.15, cd: 3, school: 'frost', b: 10, l: 3.9, p: 2.1, vsChillMult: 1.5, tags: ['nuke'], target: 'enemy', source: 'talent' },
  hourglass_reversal: { id: 'hourglass_reversal', cls: 'mage', name: 'Hourglass Reversal', lvl: 1, cost: 0, cd: 15, manaPct: 0.20, tags: ['resource'], target: 'self', source: 'talent' },
  chrono_sigil: { id: 'chrono_sigil', cls: 'mage', name: 'Chrono Sigil', lvl: 20, cost: 0.10, cd: 8, tags: ['control'], target: 'enemy', source: 'meta', meta: 'sp_m1' },
  mirrorshade: { id: 'mirrorshade', cls: 'mage', name: 'Mirrorshade', lvl: 40, cost: 0.15, cd: 10, rounds: 3, chance: 0.5, tags: ['defensive'], target: 'self', source: 'meta', meta: 'sp_m2', autoHp: 0.60 },
  // Hunter (5.5)
  keen_shot: { id: 'keen_shot', cls: 'hunter', name: 'Keen Shot', lvl: 1, cost: 30, cd: 0, school: 'phys', b: 5, l: 1.1, p: 0.5, w: 0.9, tags: ['nuke'], target: 'enemy', source: 'class' },
  barbed_arrow: { id: 'barbed_arrow', cls: 'hunter', name: 'Barbed Arrow', lvl: 1, cost: 20, cd: 0, school: 'phys', dot: { status: 'BLEED', rounds: 4, b: 2, l: 0.45, p: 0.18 }, tags: ['dot'], target: 'enemy', source: 'class', autoTargetHp: 0.60 },
  mark_prey: { id: 'mark_prey', cls: 'hunter', name: 'Mark Prey', lvl: 4, cost: 10, cd: 0, marked: 0.08, rounds: 6, tags: ['debuff'], target: 'enemy', source: 'class' },
  mend_companion: { id: 'mend_companion', cls: 'hunter', name: 'Mend Companion', lvl: 6, cost: 25, cd: 3, heal: { b: 15, l: 4.0, p: 0.8 }, revivePct: 0.30, tags: ['pet'], target: 'pet', source: 'class', autoPetHp: 0.45 },
  muzzle_shot: { id: 'muzzle_shot', cls: 'hunter', name: 'Muzzle Shot', lvl: 12, cost: 20, cd: 5, school: 'phys', b: 2, l: 0.4, p: 0.25, w: 0.3, silence: 2, tags: ['interrupt'], target: 'enemy', source: 'class' },
  snare_trap: { id: 'snare_trap', cls: 'hunter', name: 'Snare Trap', lvl: 14, cost: 20, cd: 6, stun: 2, tags: ['stun'], target: 'enemy', source: 'class', autoEnemies: 2, autoHp: 0.40 },
  field_dressing: { id: 'field_dressing', cls: 'hunter', name: 'Field Dressing', lvl: 18, cost: 25, cd: 6, healPct: 0.12, hotPct: 0.04, rounds: 3, tags: ['heal'], target: 'self', source: 'class', autoHp: 0.50 },
  volley_rain: { id: 'volley_rain', cls: 'hunter', name: 'Volley Rain', lvl: 22, cost: 45, cd: 0, school: 'phys', b: 3, l: 0.7, p: 0.3, w: 0.4, tags: ['aoe'], target: 'all', source: 'class', autoEnemies: 3 },
  feign_stillness: { id: 'feign_stillness', cls: 'hunter', name: 'Feign Stillness', lvl: 28, cost: 10, cd: 10, rounds: 2, tags: ['defensive', 'cleanse'], target: 'self', source: 'class', autoHp: 0.35, autoStacks: 3 },
  savage_order: { id: 'savage_order', cls: 'hunter', name: 'Savage Order', lvl: 34, cost: 30, cd: 4, school: 'phys', b: 8, l: 2.0, p: 1.0, tags: ['pet'], target: 'enemy', source: 'class' },
  rapid_volley: { id: 'rapid_volley', cls: 'hunter', name: 'Rapid Volley', lvl: 40, cost: 0, cd: 10, rounds: 3, dmgPct: 0.40, focusRegenPct: 0.50, tags: ['burst'], target: 'self', source: 'class' },
  heartseeker_shot: { id: 'heartseeker_shot', cls: 'hunter', name: 'Heartseeker Shot', lvl: 46, cost: 40, cd: 3, school: 'phys', b: 14, l: 3.0, p: 1.3, w: 1.5, critBelow: 0.30, critBonus: 0.5, tags: ['nuke'], target: 'enemy', source: 'class' },
  wild_communion: { id: 'wild_communion', cls: 'hunter', name: 'Wild Communion', lvl: 1, cost: 30, cd: 10, rounds: 4, petDmgPct: 0.50, tags: ['pet'], target: 'self', source: 'talent' },
  starfall_arrow: { id: 'starfall_arrow', cls: 'hunter', name: 'Starfall Arrow', lvl: 1, cost: 50, cd: 5, school: 'phys', b: 20, l: 4.0, p: 1.8, w: 2.0, refundOnKill: 50, tags: ['nuke'], target: 'enemy', source: 'talent' },
  deadfall_trap: { id: 'deadfall_trap', cls: 'hunter', name: 'Deadfall Trap', lvl: 1, cost: 30, cd: 8, school: 'phys', b: 10, l: 2.4, p: 1.0, stun: 1, tags: ['aoe', 'stun'], target: 'all', source: 'talent' },
  ricochet_bolt: { id: 'ricochet_bolt', cls: 'hunter', name: 'Ricochet Bolt', lvl: 20, cost: 35, cd: 0, school: 'phys', b: 5, l: 1.1, p: 0.5, w: 0.9, bounces: 2, bounceFrac: 0.4, tags: ['aoe'], target: 'enemy', source: 'meta', meta: 'sp_h1', autoEnemies: 2 },
  beastcall_horn: { id: 'beastcall_horn', cls: 'hunter', name: 'Beastcall Horn', lvl: 40, cost: 0, cd: 12, taunt: 2, tags: ['pet', 'defensive'], target: 'self', source: 'meta', meta: 'sp_h2', autoHp: 0.40 },
};

/** Pets (rules 5.5). Specials: doubleEvery (every Nth pet action hits twice), tauntEvery (TAUNT in round 1 and every N rounds after, tauntRounds long), cleave (attack also hits a second enemy). */
export const PET = {
  ridgewolf: { id: 'ridgewolf', name: 'Ridgewolf', hpPct: 0.50, armorMult: 1.0, dmgMult: 1.0, critBonus: 0, aggro: 0.30, doubleEvery: 3 },
  thornback: { id: 'thornback', name: 'Thornback Boar', hpPct: 0.80, armorMult: 1.4, dmgMult: 1.1, critBonus: 0, aggro: 0.60, tauntEvery: 4, tauntRounds: 1 },
  duskcat: { id: 'duskcat', name: 'Duskcat', hpPct: 0.40, armorMult: 0.8, dmgMult: 1.3, critBonus: 0.10, aggro: 0.20 },
  stormhawk: { id: 'stormhawk', name: 'Stormhawk', hpPct: 0.35, armorMult: 0.7, dmgMult: 0.8, critBonus: 0, aggro: 0.15, cleave: true, meta: 'stormhawk' },
};

/**
 * Talents (rules 6). tree: 0..2 (index into CLASS.trees), tier 1..5. Values are per rank unless noted.
 * spell: talent that adds a spell (tl = L).
 */
export const TALENT = {
  // Rogue: Bladework
  r_a1: { id: 'r_a1', cls: 'rogue', tree: 0, tier: 1, name: 'Honed Edges', ranks: 3, crit: 0.03 },
  r_a2: { id: 'r_a2', cls: 'rogue', tree: 0, tier: 1, name: 'Swift Hands', ranks: 3, cost: 3 },
  r_a3: { id: 'r_a3', cls: 'rogue', tree: 0, tier: 2, name: 'Serrated Finish', ranks: 3, pct: 0.08 },
  r_a4: { id: 'r_a4', cls: 'rogue', tree: 0, tier: 2, name: 'Riposte Stance', ranks: 2, pct: 0.25 },
  r_a5: { id: 'r_a5', cls: 'rogue', tree: 0, tier: 3, name: 'Keen Calculus', ranks: 2, critMult: 0.20 },
  r_a6: { id: 'r_a6', cls: 'rogue', tree: 0, tier: 3, name: 'Ruthless Momentum', ranks: 2, energyPerCp: 5 },
  r_a7: { id: 'r_a7', cls: 'rogue', tree: 0, tier: 4, name: 'Twin Fangs', ranks: 3, chance: 0.10, frac: 0.5 },
  r_a8: { id: 'r_a8', cls: 'rogue', tree: 0, tier: 4, name: 'Whetted Whirl', ranks: 2, pct: 0.15, cp: 1 },
  r_a9: { id: 'r_a9', cls: 'rogue', tree: 0, tier: 5, name: 'Thousand Cuts', ranks: 1, spell: 'thousand_cuts' },
  // Rogue: Shadowcraft
  r_b1: { id: 'r_b1', cls: 'rogue', tree: 1, tier: 1, name: 'Silent Footing', ranks: 3, pct: 0.10 },
  r_b2: { id: 'r_b2', cls: 'rogue', tree: 1, tier: 1, name: 'Slippery', ranks: 3, dodge: 0.02 },
  r_b3: { id: 'r_b3', cls: 'rogue', tree: 1, tier: 2, name: 'Lingering Shade', ranks: 2, cp: 1 },
  r_b4: { id: 'r_b4', cls: 'rogue', tree: 1, tier: 2, name: 'Veiled Recovery', ranks: 2, healPct: 0.03 },
  r_b5: { id: 'r_b5', cls: 'rogue', tree: 1, tier: 3, name: 'Cheap Trick', ranks: 2, cost: 10, cd: 1 },
  r_b6: { id: 'r_b6', cls: 'rogue', tree: 1, tier: 3, name: "Ambusher's Patience", ranks: 2, pct: 0.20 },
  r_b7: { id: 'r_b7', cls: 'rogue', tree: 1, tier: 4, name: 'Shroudwalk', ranks: 2, cd: 3, healPct: 0.10 },
  r_b8: { id: 'r_b8', cls: 'rogue', tree: 1, tier: 4, name: 'Night Instinct', ranks: 3, pct: 0.05 },
  r_b9: { id: 'r_b9', cls: 'rogue', tree: 1, tier: 5, name: "Death's Sidestep", ranks: 1, below: 0.20, healPct: 0.20 },
  // Rogue: Venomcraft
  r_c1: { id: 'r_c1', cls: 'rogue', tree: 2, tier: 1, name: 'Toxic Coating', ranks: 3, rounds: 4, maxStacks: 5, b: 0.5, l: 0.15, p: 0.04, spells: ['strike', 'gutting_jab', 'shadowstep_strike', 'whirling_edges'] },
  r_c2: { id: 'r_c2', cls: 'rogue', tree: 2, tier: 1, name: 'Deep Wounds', ranks: 3, pct: 0.09 },
  r_c3: { id: 'r_c3', cls: 'rogue', tree: 2, tier: 2, name: 'Lethal Mixture', ranks: 2, stacks: 2 },
  r_c4: { id: 'r_c4', cls: 'rogue', tree: 2, tier: 2, name: 'Crippling Toxin', ranks: 2, pct: 0.05 },
  r_c5: { id: 'r_c5', cls: 'rogue', tree: 2, tier: 3, name: 'Hemorrhage Mastery', ranks: 2, rank2DotPct: 0.10 },
  r_c6: { id: 'r_c6', cls: 'rogue', tree: 2, tier: 3, name: 'Septic Edge', ranks: 2, pct: 0.04 },
  r_c7: { id: 'r_c7', cls: 'rogue', tree: 2, tier: 4, name: 'Rupture Venom', ranks: 1, spell: 'rupture_venom' },
  r_c8: { id: 'r_c8', cls: 'rogue', tree: 2, tier: 4, name: 'Fester', ranks: 3, pct: 0.03 },
  r_c9: { id: 'r_c9', cls: 'rogue', tree: 2, tier: 5, name: 'Plague Heart', ranks: 1 },
  // Mage: Pyromancy
  m_a1: { id: 'm_a1', cls: 'mage', tree: 0, tier: 1, name: 'Kindling', ranks: 3, pct: 0.04 },
  m_a2: { id: 'm_a2', cls: 'mage', tree: 0, tier: 1, name: 'Searing Focus', ranks: 3, crit: 0.02 },
  m_a3: { id: 'm_a3', cls: 'mage', tree: 0, tier: 2, name: 'Smoldering', ranks: 2, rounds: 1, pct: 0.10 },
  m_a4: { id: 'm_a4', cls: 'mage', tree: 0, tier: 2, name: 'Fire Economy', ranks: 2, cost: 0.01 },
  m_a5: { id: 'm_a5', cls: 'mage', tree: 0, tier: 3, name: 'Combustive Crits', ranks: 2, rounds: 2, pct: 0.20 },
  m_a6: { id: 'm_a6', cls: 'mage', tree: 0, tier: 3, name: 'Flashpoint', ranks: 2, cd: 1 },
  m_a7: { id: 'm_a7', cls: 'mage', tree: 0, tier: 4, name: 'Wildfire', ranks: 2, strength: 0.50 },
  m_a8: { id: 'm_a8', cls: 'mage', tree: 0, tier: 4, name: 'Heat Haze', ranks: 3, wardPct: 0.03 },
  m_a9: { id: 'm_a9', cls: 'mage', tree: 0, tier: 5, name: 'Conflagrant Core', ranks: 1, spell: 'conflagrant_core' },
  // Mage: Rimecraft
  m_b1: { id: 'm_b1', cls: 'mage', tree: 1, tier: 1, name: 'Biting Cold', ranks: 3, pct: 0.12 },
  m_b2: { id: 'm_b2', cls: 'mage', tree: 1, tier: 1, name: 'Hoarfrost Skin', ranks: 3, hpPct: 0.03 },
  m_b3: { id: 'm_b3', cls: 'mage', tree: 1, tier: 2, name: 'Deep Chill', ranks: 2, chill: 0.05 },
  m_b4: { id: 'm_b4', cls: 'mage', tree: 1, tier: 2, name: 'Brittle', ranks: 2, pct: 0.06 },
  m_b5: { id: 'm_b5', cls: 'mage', tree: 1, tier: 3, name: 'Permafrost', ranks: 2, cd: 1 },
  m_b6: { id: 'm_b6', cls: 'mage', tree: 1, tier: 3, name: 'Shatter', ranks: 2, crit: 0.25 },
  m_b7: { id: 'm_b7', cls: 'mage', tree: 1, tier: 4, name: 'Lattice Ward', ranks: 2, pct: 0.15, chill: 2 },
  m_b8: { id: 'm_b8', cls: 'mage', tree: 1, tier: 4, name: 'Deep Tomb', ranks: 1, cd: 5, healPct: 0.25 },
  m_b9: { id: 'm_b9', cls: 'mage', tree: 1, tier: 5, name: "Winter's Crown", ranks: 1, spell: 'glacier_spike' },
  // Mage: Arcanism
  m_c1: { id: 'm_c1', cls: 'mage', tree: 2, tier: 1, name: 'Deep Reserves', ranks: 3, manaPct: 0.05 },
  m_c2: { id: 'm_c2', cls: 'mage', tree: 2, tier: 1, name: 'Arcane Acuity', ranks: 3, powerPct: 0.03 },
  m_c3: { id: 'm_c3', cls: 'mage', tree: 2, tier: 2, name: 'Lucid Flow', ranks: 2, chance: 0.05 },
  m_c4: { id: 'm_c4', cls: 'mage', tree: 2, tier: 2, name: 'Ward Weaving', ranks: 2, pct: 0.10 },
  m_c5: { id: 'm_c5', cls: 'mage', tree: 2, tier: 3, name: 'Spell Rebound', ranks: 2, cd: 1, manaPct: 0.03 },
  m_c6: { id: 'm_c6', cls: 'mage', tree: 2, tier: 3, name: 'Barrage Mastery', ranks: 2, pct: 0.15 },
  m_c7: { id: 'm_c7', cls: 'mage', tree: 2, tier: 4, name: 'Mindguard', ranks: 1, share: 0.20, manaPerDmg: 2 },
  m_c8: { id: 'm_c8', cls: 'mage', tree: 2, tier: 4, name: 'Arcane Momentum', ranks: 3, pct: 0.01, maxStacks: 5 },
  m_c9: { id: 'm_c9', cls: 'mage', tree: 2, tier: 5, name: 'Hourglass Reversal', ranks: 1, spell: 'hourglass_reversal' },
  // Hunter: Beastbond
  h_a1: { id: 'h_a1', cls: 'hunter', tree: 0, tier: 1, name: 'Thick Hide', ranks: 3, petHpPct: 0.08 },
  h_a2: { id: 'h_a2', cls: 'hunter', tree: 0, tier: 1, name: 'Ferocity', ranks: 3, petDmgPct: 0.125 },
  h_a3: { id: 'h_a3', cls: 'hunter', tree: 0, tier: 2, name: 'Bonded Spirit', ranks: 2, share: 0.30 },
  h_a4: { id: 'h_a4', cls: 'hunter', tree: 0, tier: 2, name: 'Frenzy Link', ranks: 2, petCrit: 0.05, focus: 5 },
  h_a5: { id: 'h_a5', cls: 'hunter', tree: 0, tier: 3, name: 'Unbreakable Bond', ranks: 2, revive: 0.25, petDr: 0.05 },
  h_a6: { id: 'h_a6', cls: 'hunter', tree: 0, tier: 3, name: 'Pack Leader', ranks: 2, pct: 0.0625 },
  h_a7: { id: 'h_a7', cls: 'hunter', tree: 0, tier: 4, name: 'Savage Mastery', ranks: 2, cd: 1, pct: 0.125 },
  h_a8: { id: 'h_a8', cls: 'hunter', tree: 0, tier: 4, name: 'Shared Wounds', ranks: 1, share: 0.20 },
  h_a9: { id: 'h_a9', cls: 'hunter', tree: 0, tier: 5, name: 'Primal Unity', ranks: 1, spell: 'wild_communion' },
  // Hunter: Marksmanship
  h_b1: { id: 'h_b1', cls: 'hunter', tree: 1, tier: 1, name: 'Steady Aim', ranks: 3, pct: 0.04 },
  h_b2: { id: 'h_b2', cls: 'hunter', tree: 1, tier: 1, name: 'Lethal Shots', ranks: 3, crit: 0.02 },
  h_b3: { id: 'h_b3', cls: 'hunter', tree: 1, tier: 2, name: 'Efficiency', ranks: 2, cost: 5 },
  h_b4: { id: 'h_b4', cls: 'hunter', tree: 1, tier: 2, name: 'Mortal Shots', ranks: 2, critMult: 0.15 },
  h_b5: { id: 'h_b5', cls: 'hunter', tree: 1, tier: 3, name: 'Deep Mark', ranks: 2, marked: 0.04 },
  h_b6: { id: 'h_b6', cls: 'hunter', tree: 1, tier: 3, name: 'Piercing Volley', ranks: 2, pct: 0.20 },
  h_b7: { id: 'h_b7', cls: 'hunter', tree: 1, tier: 4, name: 'Trueshot Focus', ranks: 2, cd: 2, pct: 0.10 },
  h_b8: { id: 'h_b8', cls: 'hunter', tree: 1, tier: 4, name: 'Concussive Precision', ranks: 1, stun: 1 },
  h_b9: { id: 'h_b9', cls: 'hunter', tree: 1, tier: 5, name: 'Starfall Arrow', ranks: 1, spell: 'starfall_arrow' },
  // Hunter: Wildcraft
  h_c1: { id: 'h_c1', cls: 'hunter', tree: 2, tier: 1, name: 'Hardy', ranks: 3, hpPct: 0.04 },
  h_c2: { id: 'h_c2', cls: 'hunter', tree: 2, tier: 1, name: 'Barbed Mastery', ranks: 3, pct: 0.20 },
  h_c3: { id: 'h_c3', cls: 'hunter', tree: 2, tier: 2, name: 'Trapper', ranks: 2, cd: 1, b: 4, l: 1.0, p: 0.4 },
  h_c4: { id: 'h_c4', cls: 'hunter', tree: 2, tier: 2, name: 'Field Medic', ranks: 2, pct: 0.20 },
  h_c5: { id: 'h_c5', cls: 'hunter', tree: 2, tier: 3, name: 'Survivalist', ranks: 2, dodge: 0.03 },
  h_c6: { id: 'h_c6', cls: 'hunter', tree: 2, tier: 3, name: 'Venom Barbs', ranks: 2, stacks: 1 },
  h_c7: { id: 'h_c7', cls: 'hunter', tree: 2, tier: 4, name: 'Fire Snare', ranks: 1, rounds: 3, b: 3, l: 0.6, p: 0.25 },
  h_c8: { id: 'h_c8', cls: 'hunter', tree: 2, tier: 4, name: 'Cornered Beast', ranks: 3, pct: 0.08, below: 0.50 },
  h_c9: { id: 'h_c9', cls: 'hunter', tree: 2, tier: 5, name: 'Deadfall Mastery', ranks: 1, spell: 'deadfall_trap' },
};

/**
 * Enemy archetypes (rules 7.6). Action kinds: hit (pct of 100 % damage, hits times), rend (hit + BLEED),
 * curse (CURSED on the player), brace (self takes less), shieldAlly (lowest-HP other ally takes less),
 * heal (lowest-HP ally incl. self, only if some ally is below `below`). The first action is the basic attack.
 */
export const ARCHETYPE = {
  brute: { id: 'brute', hp: 1.2, dmg: 1.0, armor: 1.0, dodge: 0, actions: [
    { id: 'strike', name: 'Strike', kind: 'hit', pct: 1.0, school: 'phys', w: 70 },
    { id: 'heavy_smash', name: 'Heavy Smash', kind: 'hit', pct: 1.8, school: 'phys', heavy: true, cd: 3, w: 30 },
  ] },
  skulker: { id: 'skulker', hp: 0.9, dmg: 1.0, armor: 0.8, dodge: 0.10, actions: [
    { id: 'strike', name: 'Strike', kind: 'hit', pct: 1.0, school: 'phys', w: 60 },
    { id: 'rend', name: 'Rend', kind: 'rend', pct: 0.6, tickPct: 0.20, rounds: 3, school: 'phys', cd: 3, w: 40 },
  ] },
  caster: { id: 'caster', hp: 0.8, dmg: 1.1, armor: 0.5, dodge: 0, actions: [
    { id: 'bolt', name: 'Bolt', kind: 'hit', pct: 1.1, school: 'magic', w: 60 },
    { id: 'hex_bolt', name: 'Hex Bolt', kind: 'hit', pct: 2.0, school: 'magic', cast: true, cd: 3, w: 25 },
    { id: 'wither', name: 'Wither', kind: 'curse', rounds: 3, cast: true, cd: 5, w: 15 },
  ] },
  beast: { id: 'beast', hp: 1.0, dmg: 0.9, armor: 0.8, dodge: 0.05, actions: [
    { id: 'bite', name: 'Bite', kind: 'hit', pct: 1.0, school: 'phys', w: 60 },
    { id: 'frenzy', name: 'Frenzy', kind: 'hit', pct: 0.7, hits: 2, school: 'phys', cd: 2, w: 40 },
  ] },
  guardian: { id: 'guardian', hp: 1.5, dmg: 0.8, armor: 2.0, dodge: 0, actions: [
    { id: 'strike', name: 'Strike', kind: 'hit', pct: 1.0, school: 'phys', w: 60 },
    { id: 'brace', name: 'Brace', kind: 'brace', reduce: 0.5, rounds: 2, cd: 4, w: 20 },
    { id: 'shield_ally', name: 'Shield Ally', kind: 'shieldAlly', reduce: 0.5, rounds: 2, cd: 4, w: 20 },
  ] },
  mender: { id: 'mender', hp: 0.9, dmg: 0.6, armor: 0.8, dodge: 0, actions: [
    { id: 'strike', name: 'Strike', kind: 'hit', pct: 1.0, school: 'phys', w: 50 },
    { id: 'mend', name: 'Mend', kind: 'heal', pct: 0.25, below: MEND_BELOW, cast: true, cd: 3, w: 50 },
  ] },
};

/**
 * Opening scripts (rules 7.12, combat v2): the action ids an enemy that is present at fight start plays on its turns
 * 1..OPENING_TURNS. 'signal' and 'bolster' are SCRIPT_ACTION entries; every other id is an ARCHETYPE action. A skulker
 * plays Signal only if the fight started with at least 2 enemies (else its basic attack). Elites, rares and dungeon
 * bosses play their signature ability on SIGNATURE_TURN (and a dungeon boss its other ability on SIGNATURE_TURN_2).
 */
export const OPENING_SCRIPT = {
  brute: ['strike', 'heavy_smash', 'strike'],
  caster: ['bolt', 'hex_bolt', 'wither'],
  skulker: ['rend', 'strike', 'signal'],
  beast: ['frenzy', 'bite', 'frenzy'],
  guardian: ['shield_ally', 'strike', 'brace'],
  mender: ['bolster', 'strike', 'mend'],
};

/**
 * Script-only archetype actions (rules 7.12, combat v2). They are played from OPENING_SCRIPT and never drawn by weight.
 * signal (skulker, cast, once per fight): at the end of the round SIGNAL_ADDS normal enemy joins from the add pool.
 * bolster (mender): the lowest-HP ally (self included) gains an enemy shield of BOLSTER_PCT × its max HP.
 */
export const SCRIPT_ACTION = {
  signal: { id: 'signal', name: 'Signal', kind: 'signal', cast: true, adds: SIGNAL_ADDS, once: true },
  bolster: { id: 'bolster', name: 'Bolster', kind: 'bolster', pct: BOLSTER_PCT, cd: BOLSTER_CD },
};

/**
 * Engage options (rules 7.10, combat v2): one strike, one control and one setup option per class, usable only in the
 * engage round, no bar slot, no training, no resource; strength uses L (tl = L). target: 'enemy' (a living enemy),
 * 'control' (a living enemy that is not immune to control), 'none', 'spell' (a bar spell and that spell's target).
 */
export const ENGAGE_OPTION = {
  ambush: { id: 'ambush', cls: 'rogue', kind: 'strike', name: 'Ambush', target: 'enemy', mult: AMBUSH_MULT, cp: 2 },
  sap: { id: 'sap', cls: 'rogue', kind: 'control', name: 'Sap', target: 'control', turns: SAP_TURNS },
  premeditate: { id: 'premeditate', cls: 'rogue', kind: 'setup', name: 'Premeditate', target: 'none', cp: PREMED_CP },
  precast: { id: 'precast', cls: 'mage', kind: 'strike', name: 'Pre-cast', target: 'spell' },
  binding_glyph: { id: 'binding_glyph', cls: 'mage', kind: 'control', name: 'Binding Glyph', target: 'control', turns: GLYPH_TURNS },
  gather_power: { id: 'gather_power', cls: 'mage', kind: 'setup', name: 'Gathered Power', target: 'none', spells: GATHER_SPELLS, crit: GATHER_CRIT },
  opening_shot: { id: 'opening_shot', cls: 'hunter', kind: 'strike', name: 'Opening Shot', target: 'enemy', mult: OPENING_SHOT_MULT, markRounds: OPENING_MARK_ROUNDS },
  lay_trap: { id: 'lay_trap', cls: 'hunter', kind: 'control', name: 'Lay Trap', target: 'control', stun: TRAP_STUN },
  send_pet: { id: 'send_pet', cls: 'hunter', kind: 'setup', name: 'Send the Pet', target: 'enemy', turns: PET_LEAD_TURNS, dr: PET_LEAD_DR },
};
/** Engage options of each class in display order: strike, control, setup. */
export const ENGAGE_OPTIONS = {
  rogue: ['ambush', 'sap', 'premeditate'],
  mage: ['precast', 'binding_glyph', 'gather_power'],
  hunter: ['opening_shot', 'lay_trap', 'send_pet'],
};

/** Enemy variants (rules 7.6): HP and damage multipliers on top of the archetype. */
export const VARIANT = {
  normal: { hp: 1, dmg: 1 },
  trash: { hp: DUNGEON_TRASH_HP_MULT, dmg: DUNGEON_TRASH_DMG_MULT },
  elite: { hp: ELITE_HP_MULT, dmg: ELITE_DMG_MULT },
  rare: { hp: RARE_HP_MULT, dmg: RARE_DMG_MULT },
  dboss: { hp: DUNGEON_BOSS_HP_MULT, dmg: DUNGEON_BOSS_DMG_MULT },
};

/** Equipment slots (rules 8.1). */
export const SLOT = {
  head: { id: 'head', name: 'Head', slotW: 1.00, armor: true },
  chest: { id: 'chest', name: 'Chest', slotW: 1.00, armor: true },
  legs: { id: 'legs', name: 'Legs', slotW: 1.00, armor: true },
  hands: { id: 'hands', name: 'Hands', slotW: 0.75, armor: true },
  feet: { id: 'feet', name: 'Feet', slotW: 0.75, armor: true },
  neck: { id: 'neck', name: 'Neck', slotW: 0.56, armor: false },
  ring: { id: 'ring', name: 'Ring', slotW: 0.56, armor: false },
  trinket: { id: 'trinket', name: 'Trinket', slotW: 0.56, armor: false },
  weapon: { id: 'weapon', name: 'Weapon', slotW: 1.00, armor: false },
  offhand: { id: 'offhand', name: 'Off-hand', slotW: 0.56, armor: false },
};
export const SLOT_IDS = ['head', 'chest', 'legs', 'hands', 'feet', 'neck', 'ring', 'trinket', 'weapon', 'offhand'];

/** Rarity (rules 8.2). Junk has no stats; its value is JUNK_V × V(level). */
export const RARITY = {
  junk: { id: 'junk', mult: 0, ilvlBonus: 0, stats: 0, affix: 0, sellMult: 0 },
  common: { id: 'common', mult: 0.60, ilvlBonus: RARITY_ILVL_BONUS.common, stats: 1, affix: 0, sellMult: 0.5 },
  uncommon: { id: 'uncommon', mult: 1.00, ilvlBonus: RARITY_ILVL_BONUS.uncommon, stats: 2, affix: 0, sellMult: 1.0 },
  rare: { id: 'rare', mult: 1.30, ilvlBonus: RARITY_ILVL_BONUS.rare, stats: 2, affix: 1, sellMult: 2.5 },
  epic: { id: 'epic', mult: 1.65, ilvlBonus: RARITY_ILVL_BONUS.epic, stats: 3, affix: 1, sellMult: 6.0 },
};
/** Rarity order of DROP_TABLE weights. */
export const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic'];
/** Stat split choices (rules 8.3). */
export const STAT1_PRIMARY_CHANCE = 0.5; // 1 stat: primary or STA (50/50)
export const STAT2_STA_CHANCE = 0.7; // 2 stats: second is STA or SPI (70/30)
export const AFFIX_KINDS = ['crit', 'power', 'armor']; // uniform

/** Drop tables (rules 8.4). item/junk: chances; weights: C / U / R / E. */
export const DROP_TABLE = {
  mob: { item: MOB_ITEM_CHANCE, junk: MOB_JUNK_CHANCE, weights: [60, 35, 5, 0] },
  trash: { item: DUNGEON_ITEM_CHANCE, junk: MOB_JUNK_CHANCE, weights: [30, 50, 18, 2] },
  elite: { item: 1, junk: 1, weights: [0, 40, 55, 5] },
  rare: { item: 1, junk: 1, weights: [0, 0, 75, 25] },
  dboss: { item: 1, junk: 0, weights: [0, 0, 85, 15] },
  quest: { item: 1, junk: 0, weights: [0, 80, 20, 0] },
  story: { item: 1, junk: 0, weights: [0, 0, 100, 0] },
  treasure: { item: 1, junk: 0, weights: [0, 70, 27, 3] },
  vendor: { item: 1, junk: 0, weights: [0, 60, 40, 0] },
};

/** Item score weights (rules 8.3). crit is per CRIT unit (0.01). Wrong primary scores 0; Mage scores WD 0. */
export const ITEM_SCORE = { primary: 1.0, STA: 0.6, SPI: 0.3, power: 1.1, crit: 1.5, armor: 0.02, wd: 2.0 };
export const ITEM_SCORE_CRIT_UNIT = 0.01;

/** Consumables (rules 8.6). use: 'any' (combat or out), 'combat', 'out', 'passive'. */
export const CONSUMABLE = {
  healing_draught: { id: 'healing_draught', name: 'Healing Draught', use: 'any', heal: HEAL_DRAUGHT_PCT, potion: true, priceV: PRICE_HEAL_V, stack: STACK_POTION },
  mana_draught: { id: 'mana_draught', name: 'Mana Draught', use: 'any', mana: MANA_DRAUGHT_PCT, potion: true, priceV: PRICE_MANA_V, stack: STACK_POTION },
  trail_rations: { id: 'trail_rations', name: 'Trail Rations', use: 'out', restore: RATION_PCT, priceV: PRICE_RATION_V, stack: STACK_FOOD },
  purifying_tonic: { id: 'purifying_tonic', name: 'Purifying Tonic', use: 'combat', dispersal: true, priceV: PRICE_TONIC_V, stack: STACK_POTION },
  spark_flask: { id: 'spark_flask', name: 'Spark Flask', use: 'combat', sparkBase: SPARK_BASE, sparkPerLevel: SPARK_PER_LEVEL, priceV: PRICE_SPARK_V, stack: STACK_POTION },
  elixir_ferocity: { id: 'elixir_ferocity', name: 'Elixir of Ferocity', use: 'out', dmgPct: ELIXIR_DMG_PCT, nodes: ELIXIR_NODES, priceV: PRICE_ELIXIR_V, stack: STACK_ELIXIR },
  ember_of_return: { id: 'ember_of_return', name: 'Ember of Return', use: 'passive', priceV: EMBER_V, stack: 1, max: EMBER_MAX_CARRIED },
  greater_healing_draught: { id: 'greater_healing_draught', name: 'Greater Healing Draught', use: 'any', heal: GREATER_HEAL_PCT, potion: true, priceV: PRICE_GHEAL_V, stack: STACK_POTION, meta: 'alchemist' },
};
/** The VENDOR_CONSUMABLES types every vendor sells (rules 2.6). */
export const VENDOR_STOCK_CONSUMABLES = ['healing_draught', 'mana_draught', 'trail_rations', 'purifying_tonic', 'spark_flask', 'elixir_ferocity'];

/** Shrine boons (rules 2.9). */
export const BOON = {
  return: { id: 'return', name: 'Boon of Return', weight: BOON_W_RETURN },
  insight: { id: 'insight', name: 'Boon of Insight', weight: BOON_W_INSIGHT, xpPct: BOON_XP_PCT, nodes: BOON_NODES },
  fury: { id: 'fury', name: 'Boon of Fury', weight: BOON_W_FURY, dmgPct: BOON_DMG_PCT, nodes: BOON_NODES },
  plenty: { id: 'plenty', name: 'Boon of Plenty', weight: BOON_W_PLENTY, goldV: BOON_GOLD_V },
  mending: { id: 'mending', name: 'Boon of Mending', weight: BOON_W_MENDING, restedFrac: REST_RESTED_FRAC },
  clarity: { id: 'clarity', name: 'Boon of Clarity', weight: BOON_W_CLARITY },
};
export const BOON_IDS = ['return', 'insight', 'fury', 'plenty', 'mending', 'clarity'];
export const SHRINE_BOON_COUNT = 2;

/**
 * Meta catalogue (rules 11.2). costs: per rank. req: list of requirement ids (unlock ids or profile flags).
 * Meta power budget (M2 v4): at all ranks the catalogue adds at most max HP +0.04, Power +0.04, crit +0.015, potion
 * healing +0.025 of max HP per potion (Greater Healing Draught against the Healing Draught) and +1 talent point; its
 * time entries (Quick Study, Swift Boots) save at most META_TIME_BUDGET_H on the planner's route (qa/engine s11 checks
 * the engine side, balance.md B17 the hours). Second Breath does not work in the end-boss fight.
 * Removed (M2 v4): wayfinder (TRAVEL_ON 0 h). Removed (M2 v5, D45): starforged (the class's unique epic weapon,
 * ilvl 62, at the Camp vendor; the three class weapons stay in content). A saved profile that owns a removed id
 * keeps it stored; it has no effect and no refund (D42).
 */
export const META = {
  vigor: { id: 'vigor', name: 'Vigor of the Line', kind: 'stat', ranks: 4, costs: [80, 120, 170, 230], hpPct: 0.01, req: [] },
  edge: { id: 'edge', name: 'Edge of the Line', kind: 'stat', ranks: 4, costs: [80, 120, 170, 230], powerPct: 0.01, req: [] },
  keen: { id: 'keen', name: 'Keen Lineage', kind: 'stat', ranks: 2, costs: [150, 250], crit: 0.0075, req: [] },
  quick_study: { id: 'quick_study', name: 'Quick Study', kind: 'stat', ranks: 3, costs: [100, 180, 280], xpPct: 0.0375, req: [] },
  prospector: { id: 'prospector', name: 'Prospector', kind: 'stat', ranks: 3, costs: [60, 110, 170], goldPct: 0.06, req: [] },
  satchel: { id: 'satchel', name: 'Packed Satchel', kind: 'start kit', ranks: 1, costs: [60], potions: 3, req: [] },
  heirloom_blade: { id: 'heirloom_blade', name: 'Heirloom Blade', kind: 'start kit', ranks: 1, costs: [80], rarity: 'uncommon', ilvl: 3, req: [] },
  pockets: { id: 'pockets', name: 'Deeper Pockets', kind: 'start kit', ranks: 2, costs: [50, 100], slots: 4, req: [] },
  ledger: { id: 'ledger', name: "Trainer's Ledger", kind: 'economy', ranks: 1, costs: [120], req: [] },
  scout: { id: 'scout', name: "Scout's Eye", kind: 'map', ranks: 1, costs: [100], req: [] },
  swift_boots: { id: 'swift_boots', name: 'Swift Boots', kind: 'map', ranks: 1, costs: [200], levels: 1, req: [] },
  alchemist: { id: 'alchemist', name: "Alchemist's Notes", kind: 'items', ranks: 1, costs: [150], req: ['satchel'] },
  cache: { id: 'cache', name: 'Cache of the Wanderer', kind: 'items', ranks: 1, costs: [200], req: [] },
  relics: { id: 'relics', name: 'Relics of the Deep', kind: 'items', ranks: 1, costs: [400], req: ['cache'] },
  sp_r1: { id: 'sp_r1', name: 'Lost Technique I (Rogue)', kind: 'skill', ranks: 1, costs: [150], spell: 'ghostblade_rush', req: [] },
  sp_m1: { id: 'sp_m1', name: 'Lost Technique I (Mage)', kind: 'skill', ranks: 1, costs: [150], spell: 'chrono_sigil', req: [] },
  sp_h1: { id: 'sp_h1', name: 'Lost Technique I (Hunter)', kind: 'skill', ranks: 1, costs: [150], spell: 'ricochet_bolt', req: [] },
  sp_r2: { id: 'sp_r2', name: 'Lost Technique II (Rogue)', kind: 'skill', ranks: 1, costs: [300], spell: 'bloodprice_gambit', req: ['sp_r1'] },
  sp_m2: { id: 'sp_m2', name: 'Lost Technique II (Mage)', kind: 'skill', ranks: 1, costs: [300], spell: 'mirrorshade', req: ['sp_m1'] },
  sp_h2: { id: 'sp_h2', name: 'Lost Technique II (Hunter)', kind: 'skill', ranks: 1, costs: [300], spell: 'beastcall_horn', req: ['sp_h1'] },
  stormhawk: { id: 'stormhawk', name: 'Stormhawk Companion', kind: 'skill', ranks: 1, costs: [250], pet: 'stormhawk', req: [] },
  talent_pt: { id: 'talent_pt', name: 'Ancestral Insight', kind: 'stat', ranks: 1, costs: [500], points: 1, req: [] },
  second_breath: { id: 'second_breath', name: 'Second Breath', kind: 'resurrect', ranks: 1, costs: [500], charges: RES_META_CHARGES, req: ['flag:reachedBoss'] },
  oaths: { id: 'oaths', name: 'Oaths', kind: 'challenge', ranks: 1, costs: [0], req: ['flag:bossKill'] },
};

/** Oaths (rules 11.5). */
export const OATH = {
  haste: { id: 'haste', name: 'Oath of Haste', parHours: OATH_HASTE_HOURS },
  frailty: { id: 'frailty', name: 'Oath of Frailty' },
  thrift: { id: 'thrift', name: 'Oath of Thrift', priceMult: OATH_THRIFT_MULT },
};
export const OATH_IDS = ['haste', 'frailty', 'thrift'];

/**
 * Ability templates (rules 12.4): allowed ranges for content and the mechanic.
 * weight: intent weight (ENGINE_ASSUMPTION, see Part 3). below/at: HP fraction triggers from the spec.
 */
export const ABILITY_TEMPLATE = {
  heavy_blow: { id: 'heavy_blow', kind: 'hit', school: 'phys', heavy: true, pct: [1.60, 2.20], cd: [3, 4], weight: 30 },
  dark_cast: { id: 'dark_cast', kind: 'hit', school: 'magic', cast: true, pct: [1.80, 2.50], cd: [3, 5], weight: 25 },
  cleave_all: { id: 'cleave_all', kind: 'cleave', school: 'phys', pct: [0.70, 1.00], cd: [3, 3], weight: 30 },
  rend: { id: 'rend', kind: 'rend', school: 'phys', rounds: 3, pct: [0.50, 0.80], tickPct: [0.15, 0.25], cd: [3, 3], weight: 40 },
  curse: { id: 'curse', kind: 'curse', cast: true, rounds: 3, cd: [4, 4], weight: 15 },
  self_heal: { id: 'self_heal', kind: 'selfHeal', cast: true, pct: [0.15, 0.20], cd: [5, 5], below: 0.70, weight: 50 },
  self_shield: { id: 'self_shield', kind: 'selfShield', pct: [0.15, 0.25], cd: [5, 5], weight: 20 },
  enrage: { id: 'enrage', kind: 'enrage', pct: [0.30, 0.50], below: 0.30, once: true },
  summon: { id: 'summon', kind: 'summon', count: [1, 2], at: 0.50, once: true },
};

/** Content ranges (rules 12.1-12.5), used by validateContent. */
export const CONTENT_RANGE = {
  zones: ZONE_COUNT,
  normals: [6, 9], elites: [2, 3], rares: [1, 2], dungeonTrash: [3, 5], quests: [8, 12],
  itemNamesPerSlot: 3, affixWordsPerKey: 2, shrineLines: 2, treasureLines: 2, junkNames: 3,
  uniqueRares: 6, uniqueEpics: 6, uniqueWeapons: 3,
  hpMult: [0.85, 1.20], dmgMult: [0.85, 1.20], hpDmgProduct: [0.90, 1.15],
  abilities: { normal: [0, 0], trash: [0, 0], elite: [1, 1], rare: [2, 2], dboss: [2, 2] },
  questSizeAvg: [1.6, 2.4],
  len: { enemyName: 28, enemyText: 140, questTitle: 32, questText: 240, questTurnIn: 120, itemName: 30, itemText: 100, zoneName: 28, zoneTheme: 100, hubName: 28, hubText: 140, line: 100, abilityName: 28, classText: 240, flavour: 140, bossText: 240 },
  objectives: ['slay', 'gather', 'rescue', 'deliver', 'scout'],
};

/** End boss (rules 10). Names are rules data. */
export const BOSS_TEXT = {
  name: 'Oruvath, the Unlit Star', raid: 'the Sunken Observatory', shard: 'Dimming Shard',
  strike: 'Umbral Strike', crush: 'Gravity Crush', litany: 'Collapse Litany', brand: 'Brand of the Hollow',
  pulse: 'Starless Pulse', finalDark: 'Final Dark', linked: 'Linked', eclipse: 'Eclipse',
};

/** Statuses that count as debuffs (dispersal removes them from the player; autoplay counts them). */
export const DEBUFFS = ['BLEED', 'BURN', 'POISON', 'CHILLED', 'CURSED', 'BRAND', 'STUN', 'FROZEN', 'HEXED', 'SILENCED', 'EXPOSED', 'MARKED'];

// ---------------------------------------------------------------------------------------------
// Part 3. ENGINE_ASSUMPTION: values the spec leaves open (see the hand-off, "Spec questions").
// ---------------------------------------------------------------------------------------------
export const ENGINE_ASSUMPTION = {
  /** rules 7.4 says STEALTH is removed by "any non-opener action", so an opener keeps STEALTH. true = openers also break it. */
  OPENER_BREAKS_STEALTH: false,
  /** Camp is addressed as zone ZONE_COUNT + 1 in stream keys. */
  CAMP_ZONE: ZONE_COUNT + 1,
  /** Shard armor: a normal enemy of the Shard's level (ENEMY_ARMOR_PER_LEVEL × 60). */
  SHARD_LEVEL: 60,
  /** Autoplay conditions for talent spells (rules 6 gives none). */
  AUTO_HOURGLASS_MANA: 0.30,
  AUTO_RUPTURE_CP: 4,
  AUTO_THOUSAND_CUTS_CP_MAX: 3,
  /** Default out-of-combat policy of autoAction (not the 7.9 combat policy). */
  AUTO_INN_HP: 0.70,
  AUTO_REST_HP: 0.60,
  AUTO_TOPUP_HP: 0.75,
  AUTO_DUNGEON_HP: 0.85,
  AUTO_ELITE_HP: 0.80,
  AUTO_LEAVE_DUNGEON_HP: 0.30,
  AUTO_GRIND_WAVES: 2,
  AUTO_GRIND_STOP_HP: 0.50,
  AUTO_POTION_STOCK: 4,
  AUTO_MANA_STOCK: 2,
  AUTO_TONIC_STOCK: 3,
  AUTO_RATION_STOCK: 4,
  AUTO_GOLD_RESERVE_V: 2,
  AUTO_ELITE_LEVEL_SLACK: 0,
  AUTO_BAG_FREE_MIN: 4,
  AUTO_DEADFALL_ENEMIES: 2,
  AUTO_DUNGEON_LEVEL_SLACK: 1,
  /** Node preference of the default autopilot (higher first); rest jumps to restLow when HP < AUTO_REST_HP. */
  AUTO_NODE_SCORE: { quest: 50, dungeon: 60, elite: 45, grind: 40, shrine: 35, treasure: 30, vendor: 10, vendorNeed: 38, trainer: 8, trainerNeed: 42, rest: 15, restLow: 100, risky: 1 },
  /** Default autopilot talent tree per class (index into CLASS.trees). */
  AUTO_TREE: { rogue: 0, mage: 0, hunter: 1 },
  /** Default autopilot spell choice (first 7 known go on the bar) and bar priority order (rules 7.9 rule 5). */
  AUTO_PICK: {
    rogue: ['gutting_jab', 'severing_flourish', 'shadowstep_strike', 'throat_jab', 'final_reckoning', 'whirling_edges', 'vanishing_step', 'smoke_veil', 'thousand_cuts', 'rupture_venom', 'temple_blow', 'adrenal_surge', 'open_vein', 'expose_weakness', 'ghostblade_rush', 'bloodprice_gambit'],
    mage: ['ember_bolt', 'frost_lance', 'spellsnap', 'arcane_ward', 'pyre_comet', 'glacial_tomb', 'mana_siphon', 'starlance_barrage', 'rime_burst', 'cinder_storm', 'conflagrant_core', 'glacier_spike', 'hourglass_reversal', 'living_flame', 'hexbind', 'chrono_sigil', 'mirrorshade'],
    hunter: ['keen_shot', 'barbed_arrow', 'muzzle_shot', 'mend_companion', 'field_dressing', 'heartseeker_shot', 'volley_rain', 'feign_stillness', 'mark_prey', 'savage_order', 'rapid_volley', 'starfall_arrow', 'deadfall_trap', 'wild_communion', 'snare_trap', 'ricochet_bolt', 'beastcall_horn'],
  },
  AUTO_BAR_ORDER: {
    rogue: ['throat_jab', 'vanishing_step', 'smoke_veil', 'temple_blow', 'adrenal_surge', 'bloodprice_gambit', 'expose_weakness', 'open_vein', 'final_reckoning', 'rupture_venom', 'severing_flourish', 'whirling_edges', 'shadowstep_strike', 'thousand_cuts', 'ghostblade_rush', 'gutting_jab'],
    mage: ['spellsnap', 'glacial_tomb', 'arcane_ward', 'mirrorshade', 'mana_siphon', 'hourglass_reversal', 'conflagrant_core', 'rime_burst', 'cinder_storm', 'hexbind', 'chrono_sigil', 'living_flame', 'pyre_comet', 'glacier_spike', 'starlance_barrage', 'frost_lance', 'ember_bolt'],
    hunter: ['muzzle_shot', 'feign_stillness', 'field_dressing', 'beastcall_horn', 'mend_companion', 'snare_trap', 'rapid_volley', 'wild_communion', 'mark_prey', 'deadfall_trap', 'volley_rain', 'ricochet_bolt', 'barbed_arrow', 'starfall_arrow', 'heartseeker_shot', 'savage_order', 'keen_shot'],
  },
  AUTO_BOON_ORDER: ['return', 'fury', 'insight', 'mending', 'clarity', 'plenty'],
};
