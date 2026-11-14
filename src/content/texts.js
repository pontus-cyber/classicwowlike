// Content table: flavour lines for engine-defined ids (src/content/SCHEMA.md 2.10). The expedition group (D51) holds the
// Shardfall, Shardspawn, Dimming and Homeward Bell lines (rules.md 1.9.5-1.9.7), written by the Content Designer
// (docs/handoffs/content-2026-11-10b.md). The families, prep and contracts groups (docs/handoffs/content-2026-11-11.md)
// hold the contract and start-camp text of docs/specs/expedition.md 2-3. Plain data only. D150 (naming rule, owner
// 2026-11-14): the final boss is Oruvath, "hidden" is not used for fogged nodes (Stealth is the hidden state), and the
// Homeward Bell's line says where it takes you (the next zone's hub, not home).
export const TEXTS = {
  // Display names of the enemy family ids (zones.js regions, enemies.js family), used in contract texts.
  families: {
    outlaw: { singular: 'outlaw', plural: 'outlaws' },
    wild: { singular: 'wild beast', plural: 'wild beasts' },
    blight: { singular: 'blightborn', plural: 'blightborn' },
    fenbeast: { singular: 'fen beast', plural: 'fen beasts' },
    reedfolk: { singular: 'reedfolk', plural: 'reedfolk' },
    witchkin: { singular: 'witchkin', plural: 'witchkin' },
    crag: { singular: 'crag beast', plural: 'crag beasts' },
    reiver: { singular: 'reiver', plural: 'reivers' },
    stormward: { singular: 'stormward', plural: 'stormwards' },
    tomb: { singular: 'tomb guardian', plural: 'tomb guardians' },
    dune: { singular: 'dune stalker', plural: 'dune stalkers' },
    sunbound: { singular: 'sunbound', plural: 'sunbound' },
    rootkin: { singular: 'rootkin', plural: 'rootkin' },
    grave: { singular: 'grave walker', plural: 'grave walkers' },
    veil: { singular: 'veilwraith', plural: 'veilwraiths' },
    cinder: { singular: 'cinder beast', plural: 'cinder beasts' },
    forgeborn: { singular: 'forgeborn', plural: 'forgeborn' },
    pyrecult: { singular: 'pyre cultist', plural: 'pyre cultists' },
  },
  // Start camp options (C.PREP_OPTION). name repeats the constant's name as a check; flavour is one line of colour,
  // rule is one plain line without numbers (the numbers are constants and may change).
  prep: {
    prep_draughts: { name: 'Field Draughts', flavour: 'Corked bottles of bitter red, brewed by a hedge healer who will not say what is in them.', rule: 'Adds Healing Draughts to your bag at the start of the run.' },
    prep_rations: { name: 'Trail Pack', flavour: 'Dried meat, hard bread and a rind of cheese, wrapped by someone who has walked far.', rule: 'Adds Trail Rations to your bag at the start of the run.' },
    prep_ember: { name: 'Ember of Return', flavour: 'A coal that never cools, kept in a clay pot for the day the road ends badly.', rule: 'Adds one Ember of Return to your bag, up to the most you may carry.' },
    prep_bell: { name: 'Second Clapper', flavour: 'A spare clapper for the Homeward Bell, tied with red thread so it is not lost.', rule: 'Adds one charge to your Homeward Bell, up to its limit.' },
    prep_mule: { name: 'Pack Mule', flavour: 'Stubborn, sure-footed and unimpressed by anything on the road.', rule: 'Adds bag slots for the whole run.' },
    prep_charts: { name: 'Region Charts', flavour: 'Hand-inked sheets, folded soft from use, with the roads and the bad ground marked.', rule: 'Shows the region of every node and the location of every dungeon.' },
    prep_tracker: { name: "Tracker's Notes", flavour: 'A scout\'s cramped notes on tracks, droppings and where the quarry sleeps.', rule: 'Shows contract sites that are a few steps away, even on nodes you have not seen yet.' },
    prep_guide: { name: 'Local Guide', flavour: 'A farmer\'s son who knows every stile and sheep-track for ten miles.', rule: 'Widens how far you see around you for the whole run.' },
    prep_spyglass: { name: 'Spyglass', flavour: 'A brass tube with a cracked lens that still shows far hills sharp and clear.', rule: 'Lets you reveal one distant node and its neighbours, a few times per run.' },
  },
  // Contract templates. Placeholders: {n} sites needed, {family} plural family name, {familyOne} singular family name,
  // {region} region name, {zone} zone name, {levels} level band such as "levels 1-10", {elite} the named elite,
  // {dungeon} dungeon name, {hub} hub name, {contract} the text of the offered contract.
  contracts: {
    cull: 'Cull {n} {family} in {region}, {zone}, {levels}.',
    bounty: 'Bounty: hunt down {elite}, a {familyOne} roaming {region}, {zone}, {levels}.',
    delve: 'Delve: clear {dungeon} in {zone}, {levels}.',
    hub: '{hub} has work on the board: {contract}',
  },
  expedition: {
    shardfall: 'Where a shard of Oruvath fell and cracked the rim. The dark starts here.',
    shardspawn: "Things that walked into the Dimming and came out hollow, lit only by the shard's cold glow.",
    dimming: 'Darkness that spreads from the Shardfall. It takes the land hop by hop, and whoever stands in it.',
    homeward_bell: 'A small brass bell. Rung, it carries you on to the next zone\'s hub.',
  },
};
