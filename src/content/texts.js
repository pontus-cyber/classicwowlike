// Content table: flavour lines for engine-defined ids (src/content/SCHEMA.md 2.10). The expedition group (D51) holds the
// Shardfall, Shardspawn, Dimming and Homeward Bell lines (rules.md 1.9.5-1.9.7), written by the Content Designer
// (docs/handoffs/content-2026-11-10b.md). The families, prep and contracts groups (docs/handoffs/content-2026-11-11.md)
// hold the contract and start-camp text of docs/specs/expedition.md 2-3. Plain data only. D150 (naming rule, owner
// 2026-11-14): the final boss is Oruvath, "hidden" is not used for fogged nodes (Stealth is the hidden state), and the
// Homeward Bell's line says where it takes you (the next zone's hub, not home). D152 (docs/specs/changes-m3-v2.md 3.3,
// draft): dimming_pace, the Dimming panel's tooltip line for the steady Dimming ({maxPerToll}, {grace}: mapView.dim).
// Newcomer check 2026-11-15 (draft): the progress group, the talent window's rule lines.
export const TEXTS = {
  // Display names of the enemy family ids (zones.js regions, enemies.js family), used in contract texts.
  // content-2026-11-20 (blind Legacy v2 s0293, s0415; draft): `done` is the line a completed Cull or Bounty contract on
  // that family shows in its reward window, so no two contracts end on the same words. The UI reads
  // families[contract.family].done (ui-text.js contractDoneLine).
  families: {
    outlaw: { singular: 'outlaw', plural: 'outlaws', done: 'Fewer outlaws on the roads. The carters will sleep easier.' },
    wild: { singular: 'wild beast', plural: 'wild beasts', done: 'The wild beasts keep their distance now. The herders thank you.' },
    blight: { singular: 'blighted thing', plural: 'blighted things', done: 'The blighted things are burnt back. The fields can breathe.' },
    fenbeast: { singular: 'fen beast', plural: 'fen beasts', done: 'The fen beasts have gone quiet in the reeds. Good riddance.' },
    reedfolk: { singular: 'reedfolk', plural: 'reedfolk', done: 'The reedfolk have pulled back into the marsh. The boats can go out again.' },
    witchkin: { singular: 'witchkin', plural: 'witchkin', done: 'The witchkin\'s hexes are broken, and the wells taste clean.' },
    crag: { singular: 'crag beast', plural: 'crag beasts', done: 'The crag beasts no longer prowl the passes. The shepherds owe you.' },
    reiver: { singular: 'reiver', plural: 'reivers', done: 'The reivers have learned what raiding here costs.' },
    stormward: { singular: 'stormward', plural: 'stormwards', done: 'The stormwards are still, and the ridge has its sky back.' },
    tomb: { singular: 'tomb guardian', plural: 'tomb guardians', done: 'The tomb guardians lie down in the sand again.' },
    dune: { singular: 'dune stalker', plural: 'dune stalkers', done: 'No more stalkers in the dunes. The caravans move at dawn.' },
    sunbound: { singular: 'sunbound', plural: 'sunbound', done: 'The sunbound chant no more. The obelisks are silent.' },
    rootkin: { singular: 'rootkin', plural: 'rootkin', done: 'The rootkin are cut down to the stump. The paths stay open.' },
    grave: { singular: 'grave walker', plural: 'grave walkers', done: 'The grave walkers are back in the ground, where they belong.' },
    veil: { singular: 'veilwraith', plural: 'veilwraiths', done: 'The veilwraiths have thinned, and the mist with them.' },
    cinder: { singular: 'cinder beast', plural: 'cinder beasts', done: 'The cinder beasts are ash. The outposts can rest.' },
    forgeborn: { singular: 'forgeborn', plural: 'forgeborn', done: 'The forgeborn lie as slag on the forge floor. The smiths will be glad.' },
    pyrecult: { singular: 'pyre cultist', plural: 'pyre cultists', done: 'The pyre cultists\' fires are out. The villages are safe tonight.' },
  },
  // Start camp options (C.PREP_OPTION). name repeats the constant's name as a check; flavour is one line of colour,
  // rule is one plain line without numbers (the numbers are constants and may change).
  prep: {
    prep_draughts: { name: 'Field Draughts', flavour: 'Corked bottles of bitter red, brewed by a hedge healer who will not say what is in them.', rule: 'Adds Healing Draughts to your bag at the start of the run.' },
    prep_rations: { name: 'Trail Pack', flavour: 'Dried meat, hard bread and a rind of cheese, wrapped by someone who has walked far.', rule: 'Adds Trail Rations to your bag at the start of the run.' },
    prep_ember: { name: 'Ember of Return', flavour: 'A coal that never cools, kept in a clay pot for the day the road ends badly.', rule: 'Adds one Ember of Return to your bag, up to the most you may carry.' },
    prep_bell: { name: 'Second Clapper', flavour: 'A spare clapper for the Homeward Bell, tied with red thread so it is not lost.', rule: 'Adds one charge to your Homeward Bell, up to its limit.' },
    prep_mule: { name: 'Pack Mule', flavour: 'Stubborn, sure-footed and unimpressed by anything on the road.', rule: 'Adds bag slots for the whole run.' },
    prep_charts: { name: 'Region Charts', flavour: 'Hand-inked sheets, folded soft from use, with the roads and the bad ground marked.', rule: 'Shows the region of every place and where every dungeon is.' },
    prep_tracker: { name: "Tracker's Notes", flavour: 'A scout\'s cramped notes on tracks, droppings and where the quarry sleeps.', rule: 'Shows contract marks a few steps away, even on places you have not seen yet.' },
    prep_guide: { name: 'Local Guide', flavour: 'A farmer\'s son who knows every stile and sheep-track for ten miles.', rule: 'Widens how far you see around you for the whole run.' },
    prep_spyglass: { name: 'Spyglass', flavour: 'A brass tube with a cracked lens that still shows far hills sharp and clear.', rule: 'Lets you reveal one distant place and its neighbours, a few times per run.' },
  },
  // Contract templates. Placeholders: {n} sites needed, {family} plural family name, {familyOne} singular family name,
  // {region} region name, {zone} zone name, {levels} level band such as "levels 1-10", {elite} the named elite,
  // {dungeon} dungeon name, {hub} hub name, {contract} the text of the offered contract.
  // Blind Legacy v2 (2026-11-20, s0255; draft): the sentence no longer repeats the zone and the band (the tooltip's
  // subline has them) or the kind's name (the title has it).
  contracts: {
    cull: 'Beat the {family} at {n} marked places, most of them in {region}.',
    bounty: 'Hunt down {elite}, a {familyOne} roaming {region}.',
    delve: 'Clear {dungeon}, its boss included.',
    hub: '{hub} has work on the board: {contract}',
  },
  expedition: {
    shardfall: 'Where a falling shard struck the land. The dark spreads from here.',
    shardspawn: "Things that walked into the Dimming and came out hollow, lit only by the shard's cold glow.",
    dimming: 'Darkness that spreads from the Shardfall, place by place. Whoever stands in it must fight.',
    homeward_bell: 'A small brass bell. Rung, it carries you on to the next zone\'s hub.',
    dimming_pace: 'It spreads up to {maxPerToll} places for each toll, nearest the purple star first, once you have spent {grace} tolls in the zone.',
  },
  // The talent window's rule lines (newcomer check 2026-11-15, draft; ids C.PROGRESS_TEXT_IDS): {first} is
  // C.TALENT_FIRST_LEVEL, {step} C.TALENT_LEVEL_STEP (rules 6: one point at the first level, then one every step).
  progress: {
    talent_points: 'One point at level {first}, then one every {step} levels. Reset at a trainer.',
    talents_locked: 'Talents unlock at level {first}.',
  },
  // Economy v2 clarity lines (D159, docs/specs/legacy.md 4.7 E6, draft; ids C.ECONOMY_TEXT_IDS), for a Legacy run while
  // C.GATES.economyV2 is on. Placeholders: {points} camp points (prepView.left or points, the tracker's reserve), {contracts}
  // contracts held, {price} a hub offer's price; {level} / {was} hero levels now and at the run's start; {legacy} Legacy
  // points, {next} / {cost} the next hall entry and its price; {n} a count; {from} / {to} values before and after;
  // {spell} a spell's name; {key_talents} the talents key; {xp} HERO_XP_AT_MAX and {legacy} LEGACY_PER_LEVEL at level 25.
  economy: {
    camp_points: 'camp points',
    camp_points_tip: 'Points you keep can buy a contract at a hub on the way. They do not carry over to the next run.',
    set_out: 'You set out with {contracts} contracts and {points} camp points.',
    hub_offer: 'Take for {price} camp points (you have {points}).',
    tracker: '{points} camp points',
    first_run_lost: 'Camp points you do not spend are lost.',
    second_camp: 'Your camp has grown: {points} camp points and a contract board. Contracts give XP, gold and a choice of gear.',
    run_kept: 'Kept: level {level} (was {was}) · spells and ranks · talents · Legacy unlocks',
    run_left: 'Left behind: gear, gold, potions and camp points. Your next run starts with new gear for your level.',
    run_balance: 'You have {legacy} Legacy points. Next in the hall: {next}, {cost}.',
    abandon_confirm: 'End the run here? You keep your level, XP and spells; gear, gold and camp points are lost. Legacy points count only what you did.',
    level_title: 'Level {level}',
    level_title_multi: 'Level {level} (+{n})',
    level_health: 'Health {from} → {to}',
    level_mana: 'Mana {from} → {to}',
    level_new_spell: 'New spell: {spell}. Learn it at a trainer.',
    level_new_ranks: 'Better ranks for {n} spells at a trainer.',
    level_talent: 'Talent point to spend ({key_talents}).',
    level_legacy: '+{legacy} Legacy points when this run ends, to spend in the Legacy hall.',
    level_hero20: 'Level 20: your other talent trees can open in the Legacy hall.',
    level_hero25: 'Level 25, the highest. From now on every {xp} XP pays {legacy} Legacy points.',
    level_progress: 'Level {from} → {to}',
  },
};
