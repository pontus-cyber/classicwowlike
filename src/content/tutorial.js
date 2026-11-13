// Content table: the guided first run (docs/specs/m3-onboarding.md 2.3 overlay, 2.4 beats, 2.6-2.7 guide lines, 3.2
// first-time hints, 4.3 nudge; D135, D137). The authored overlay for zone 1 on TUTORIAL_SEED 8736 (board slot 1, Cull
// site fights, scripted fights S1-S4 with the wind-up fight third (D145 fix, D147), Gorrak's encounter and the gate that
// holds him back until S3 has been fought, D143), the 13 coach lines (D142: G13.closed while the Roads wait for Gorrak's
// fight; D147: G8's joint line with G7), the 37 hint lines and the Packed Satchel nudge. Status: draft (owner approval
// pending). Shape: src/content/SCHEMA.md 2.11. Plain data only; levels, counts and every rule number are constants (spec
// section 12). Lines hold {placeholders} the UI fills (SCHEMA.md 2.11): key names from its key map, numbers from C.

export const TUTORIAL = {
  seed: 8736, // TUTORIAL_SEED as accepted in D137; the engine reads C.TUTORIAL_SEED, this is a cross-check only
  zone: 1,

  // Start camp board slot 1 (spec 2.3 "Board"): a Cull of wild beasts in the Barleyreach Verge, zone 1.
  board: { slot: 1, kind: 'cull', z: 1, region: 'z1_wilds', family: 'wild' },

  // Cull site fights, by order of the site fights the player starts in zone 1: the first plays site_1, every later
  // one site_2. Both stay at the node's level. No wind-ups (see `windup` below). quest (D144, draft): the quest a Quest
  // node shows while it plays this fight (src/content/quests.js), so its text names these enemies.
  siteFights: [
    { id: 'site_1', beat: 'G10', quest: 'q_z1_guide_tusks_in_the_verge', enemies: [{ enemy: 'z1_furrow_boar' }] },
    { id: 'site_2', beat: 'G10', quest: 'q_z1_guide_wolf_at_the_wallow', enemies: [{ enemy: 'z1_furrow_boar' }, { enemy: 'z1_barn_wolf' }] },
  ],

  // Scripted fights S1-S4 (spec 2.3): the first ONB_SCRIPTED_FIGHTS fights the player starts in zone 1 on Quest or
  // Grind nodes that are not Cull sites, in this order. Each teaches one thing (beat). In the guided zone an enemy
  // makes its turn-2 action a wind-up only where `windup: true` is set here: FIRST_MEET_WINDUP is off for every other
  // guided-zone fight (S1-S3 and the site fights would otherwise get first-meeting wind-ups before G8 teaches them).
  // quest (D144, draft): the quest a Quest node shows while it plays this script (the blind testers met S1's boar under a
  // quest about cutpurses); S4 is zone 1's Lost Lambs, the others are the guided zone's own (src/content/quests.js).
  // D145 fix (m3-onboarding.md 2.8, draft; D147): S3 and S4 swapped, so the wind-up fight comes before Gorrak's gate (after
  // s3): G7 and G8 come in S3, before Gorrak; S4 (the Ogre and the Wolf) has no beat of its own (G7's "If not" may show).
  scripts: [
    { id: 's1', beat: 'G3', teaches: 'Attack with the bar and win; then loot.', quest: 'q_z1_guide_rooted_rows',
      enemies: [{ enemy: 'z1_furrow_boar' }],
      loot: { upgrade: 'uncommon', consumable: 'healing_draught' } }, // count: ONB_LOOT_POTIONS
    { id: 's2', beat: 'G6', teaches: 'Read the intent track: Heavy Smash shows two moves ahead.', quest: 'q_z1_guide_hedge_breaker',
      enemies: [{ enemy: 'z1_hedge_ogre' }] },
    { id: 's3', beat: 'G8', teaches: 'Open on the wind-up: the Hexer winds up Hex Bolt on its turn 2.', quest: 'q_z1_guide_straw_and_tusk',
      enemies: [{ enemy: 'z1_scarecrow_hexer', windup: true }, { enemy: 'z1_furrow_boar' }] },
    { id: 's4', beat: 'G7', teaches: 'Use the engage round on one of two foes.', quest: 'q_z1_lost_lambs',
      enemies: [{ enemy: 'z1_hedge_ogre' }, { enemy: 'z1_barn_wolf' }] },
  ],

  // Gorrak's encounter (spec 2.3 "Elite"; D137): the Elite node nearest the hub (seed 8736: node 18), Gorrak alone
  // (no add, never the rare variant), level clamp ONB_ELITE_LEVEL_MIN/MAX. His Deathblow is Threshing Blow (heavy).
  elite: {
    id: 'gorrak', beat: 'G9', enemy: 'z1_gorrak', deathblow: 'ab_z1_gorrak_heavy_blow', add: false, rare: false,
    // Gate (D137): the node is barred (MOVE onto it is illegal) until scripted fight `afterScript` has ended, by a
    // win, a flight or a rescue, so G6 (intents) and G7 (engage round) have had their fights first. D143 (draft,
    // Core Gameplay Engineer 2026-11-13): after S3, not S4, so the guided zone ends by a Road before the Dimming (S4 at
    // toll 17 left 2 tolls before his node dimmed); G7 and G8 come in S3, before Gorrak (D145 fix). The gate is open at
    // once after SKIP_GUIDE and outside the guided zone. Barring the node cuts no route
    // on seed 8736 (its neighbours 1, 7, 17 and 30 stay linked through 7 and 17). {n}: scripted fights still to come
    // before the gate opens (tutorialView.elite.left).
    gate: {
      afterScript: 's3',
      barredLine: 'Gorrak is out on the downs. He comes back after {n} more fights.',
      openLine: 'Gorrak is back on his threshing floor.',
    },
  },

  // Rescue and the end of the guide (spec 2.6, 2.7). {rescueTolls}: ONB_RESCUE_TOLLS.
  // rescueCapLine (D147, draft, Core Gameplay Engineer 2026-11-14): the ONB_RESCUE_MAX-th rescue ends the guide (event
  // guideSkipped with why 'rescues'); shown with that rescue's line, in place of the skip line.
  // hubLine / hubTrainerLine (D144, draft, Core Gameplay Engineer 2026-11-13): the welcome at a zone hub, any run; the
  // trainer line only while R.trainerView(state).useful (a lesson or a rank the gold covers), else the plain line. Both
  // blind testers paid a toll for "Visit the trainer" at level 1 with nothing to learn. {zone}: the zone's name.
  guide: {
    rescueLine: 'The Bellwrights pull you back ({rescueTolls} tolls).',
    rescueCapLine: 'That was the last rescue: the guide ends here, and from now on a death ends the run.',
    endLine: 'The guide ends here. New things get one hint each.',
    hubLine: 'Welcome to {zone}. Nothing to learn at the trainer yet: set out when ready.',
    hubTrainerLine: 'Welcome to {zone}. Visit the trainer for new spells or ranks, then set out.',
  },

  // The 13 beats (spec 2.4). line: the coach line; alt: the beat's other one-line states; byClass: the class line
  // (G9); hint: the first-time hint the beat stands in for (spec 3.1).
  beats: [
    { id: 'G1', name: 'Contracts', hint: 'H23', anchor: 'board slot 1',
      line: 'Take a contract: win its sites for extra XP and a reward.',
      alt: { noContract: 'Set out with no contract? Press Set out again.' } },
    { id: 'G2', name: 'Moving', hint: 'H15', anchor: "player's node",
      line: 'Click a lit node next to you to walk there.' },
    { id: 'G3', name: 'First fight', anchor: 'bar slot 1',
      line: 'Press {key_spell1} to attack. Bring their health to zero.' },
    { id: 'G4', name: 'Loot', hint: 'H11', anchor: 'loot window',
      line: '{key_take_all} takes all. A green arrow marks an upgrade: equip it in your bags ({key_bags}).' },
    { id: 'G5', name: 'The Furnace', hint: 'H16', anchor: 'the Furnace',
      line: "The Furnace: each step costs tolls. Stay left of the Star's line." },
    { id: 'G6', name: 'Intents', hint: 'H02', anchor: "enemy's track",
      line: 'Its next three moves, in order. The big one is marked.' },
    { id: 'G7', name: 'Engage round', hint: 'H01', anchor: 'engage panel',
      line: 'Round 1 is yours: they act from round 2. Open with {key_engage1}, {key_engage2} or {key_engage3}.' },
    // withEngage (D145 fix, m3-onboarding.md 2.8, draft): S3 is the first fight with two enemies and the first with a
    // wind-up, so G7 and G8 open in the same engage round; the engine gives G8 this joint line (G7's waits) and the UI
    // points it at the engage panel's W button, with a second marker on the wind-up badge.
    { id: 'G8', name: 'Wind-up', hint: 'H03', anchor: 'wind-up badge',
      line: 'Wind-up: stop it with {key_engage2}, an interrupt or a stun, and it is weakened all fight.',
      alt: {
        landed: 'It landed: that enemy hits harder until it dies.',
        withEngage: 'Round 1 is yours: open with {key_engage2} on the wind-up and it is weakened all fight.',
      } },
    // byClass (D144, draft, Core Gameplay Engineer 2026-11-13): no turn number. "on turn 2" (its own turn) read against
    // the round labels everywhere else ("Deathblow R3", "round 3"); the badge the line points at shows the round.
    { id: 'G9', name: 'Deathblow', hint: 'H04', anchor: 'Deathblow badge',
      byClass: {
        rogue: 'This Deathblow maims you if it lands. Sap it ({key_engage2}), then wait a round ({key_pass}).',
        mage: 'This Deathblow maims you if it lands. Freeze it: Binding Glyph ({key_engage2}).',
        hunter: 'This Deathblow maims you if it lands. Trap it ({key_engage2}): the trap springs on it.',
      },
      alt: { landed: 'Maimed: your healing is halved this fight. Drink early.' } },
    { id: 'G10', name: 'Contract sites', hint: 'H20', anchor: 'site badge',
      line: 'Contract site: win this fight to count it.',
      alt: { done: 'Contract done: choose one reward.' } },
    { id: 'G11', name: 'Potions', hint: 'H09', anchor: 'item slot',
      line: 'Low health: drink a Healing Draught ({key_item1}). It uses your turn.' },
    { id: 'G12', name: 'The Dimming', hint: 'H18', anchor: 'dark wash nearest the player',
      line: 'The Dimming spreads from the Shardfall. Leave by a Road before it reaches you.',
      alt: { caught: 'In the dark: walk away from the Shardfall.' } },
    // closed (D142, draft, Core Gameplay Engineer 2026-11-13): while the guided zone's Roads stay closed until Gorrak's
    // fight has ended; anchor: Gorrak's node (tutorialView.roads.node).
    { id: 'G13', name: 'Homeward Bell', hint: 'H19', anchor: 'Bell or Road button',
      line: 'Far from a Road? Ring the Homeward Bell: it takes you to the next hub in {bellTolls} tolls.',
      alt: {
        onRoad: 'On a Road: take it to the next zone. Keep the Bell for when no Road is near.',
        closed: 'Face Gorrak first: the Roads open once his fight is over.',
      } },
  ],

  // The 37 first-time hints (spec 3.2). perClass: seen per class (spec 3.1). sameAs: the line is that beat's line
  // (H04: the class lines of G9; H19: both lines of G13).
  hints: [
    { id: 'H01', system: 'Engage round', perClass: true, line: 'Round 1 is yours: they act from round 2. Open with {key_engage1}, {key_engage2} or {key_engage3}.' },
    { id: 'H02', system: 'Intent track', line: 'Above each enemy: its next three moves, in order.' },
    { id: 'H03', system: 'Wind-up', line: 'Wind-up: stop it with {key_engage2}, an interrupt or a stun, and it is weakened all fight.' },
    { id: 'H04', system: 'Deathblow', perClass: true, sameAs: 'G9' },
    // alt.shield (D144, draft): the target's shield would absorb a whole hit (R.offBalance(...).absorbs): the big hit goes
    // into the shield (casual s0193: a crit for 0, 88 absorbed), so the line says to break the shield first
    { id: 'H05', system: 'Off-balance', line: 'Off-balance: it takes +{offbalPct}% damage. Spend your big hit now.',
      alt: { shield: 'Off-balance, but its shield takes your hits first: break it, then spend your big hit.' } },
    { id: 'H06', system: 'Maimed', line: 'Maimed: your healing is halved for this fight.' },
    { id: 'H07', system: 'Lethal', line: 'Lethal: this hit kills you. Stop it, heal, or kill first.' },
    { id: 'H08', system: 'DoT preview', line: 'The marked end of a health bar is what damage over time will still take.' },
    { id: 'H09', system: 'Potions', line: 'Low health: drink a Healing Draught ({key_item1}). It uses your turn.' },
    { id: 'H10', system: 'Free potion', line: 'Packed Satchel: your first potion each fight costs no turn, at half strength.' },
    { id: 'H11', system: 'Loot', line: '{key_take_all} takes all. A green arrow marks an upgrade: equip it in your bags ({key_bags}).' },
    { id: 'H12', system: 'Trainer', line: 'New spell ranks: train them at a hub or a Trainer node.' },
    { id: 'H13', system: 'Spell bar', line: 'Drag your new spell onto the bar (spellbook, {key_spellbook}).' },
    { id: 'H14', system: 'Talents', line: 'Talent point: spend it in Talents ({key_talents}).' },
    { id: 'H15', system: 'Fog', line: 'You see the nodes next to you. Walking shows more.' },
    { id: 'H16', system: 'The Furnace', line: "The Furnace: each step costs tolls. Stay left of the Star's line." },
    { id: 'H17', system: 'Heat pays', line: 'Burning: more XP, gold and better drops, but the end boss grows stronger.' },
    { id: 'H18', system: 'The Dimming', line: 'The Dimming spreads from the Shardfall. Leave by a Road before it reaches you.' },
    { id: 'H19', system: 'Homeward Bell', sameAs: 'G13' },
    { id: 'H20', system: 'Contract site', line: 'Contract site: win this fight to count it.' },
    { id: 'H21', system: 'Contract done', line: 'Contract done: choose one reward.' },
    { id: 'H22', system: 'Hub contract', line: 'This hub offers a contract: pay from your Reserve or swap one you hold.' },
    { id: 'H23', system: 'Start camp', line: 'Points buy contracts and supplies. Points you keep become Reserve.' },
    { id: 'H24', system: 'Elite', line: 'Elite: hover it to see its Deathblow before you go in.' },
    { id: 'H25', system: 'Rare', line: 'Rare: a named foe with better loot. Read its moves first.' },
    { id: 'H26', system: 'Dungeon', line: 'Dungeon: several fights and a boss in one visit.' },
    { id: 'H27', system: 'Disrupt', line: 'Bosses resist control: {key_engage2} disrupts their first wind-up instead.' },
    { id: 'H28', system: 'Vendor', line: 'Sell what you do not need. Potions are always in stock.' },
    { id: 'H29', system: 'Rest', line: 'Rest: back to full health and mana, for tolls.' },
    { id: 'H30', system: 'Pass', line: 'Waiting ({key_pass}) keeps them sapped: the wind-up never comes.' },
    { id: 'H31', system: 'Autoplay', line: '{key_autoplay} lets autoplay fight for you. It answers Deathblows too.' },
    { id: 'H32', system: 'Flee', line: 'You can flee ({key_flee}). The node stays open for later.' },
    { id: 'H33', system: 'Pet', perClass: true, line: 'Your pet fights beside you and draws some of the blows.' },
    { id: 'H34', system: 'Stealth', perClass: true, line: 'You start hidden: openers work only from stealth.' },
    { id: 'H35', system: 'The Camp', line: 'The Camp: last stop before the Unlit Star. Spend your gold here.' },
    { id: 'H36', system: 'End boss', line: 'No engage round here: read its schedule above it.' },
    { id: 'H37', system: 'Hall of Echoes', line: 'Echoes buy lasting unlocks. They stay when a run ends.' },
  ],

  // The first-run nudge (spec 4.2-4.3). unlock: the META id the nudge points at. {satchelPotions}: META.satchel.potions.
  nudge: {
    unlock: 'satchel',
    welcomeLabel: "The Bellwrights' welcome",
    summaryLine: 'Your first unlock is ready: Packed Satchel.',
    hallLine: 'Buy Packed Satchel: {satchelPotions} potions every run, and your first potion each fight costs no turn.',
    later: 'Later',
  },
};
