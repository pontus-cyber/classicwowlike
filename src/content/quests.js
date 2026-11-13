// Content table: quest templates per zone with enemy subsets (rules.md 2.1, 12). Plain data only (Content Designer).
export const QUESTS = {
 "q_z1_blight_in_the_barley": {
  "id": "q_z1_blight_in_the_barley",
  "title": "Blight in the Barley",
  "giver": "Farmer Osric Dunne",
  "objective": "slay",
  "text": "The boars have trampled my north field flat, and thieves are stripping what is left. Cull them before the harvest is lost.",
  "turnIn": "Good. The barley may yet stand next year.",
  "sizeWeights": [
   40,
   40,
   20
  ],
  "enemies": [
   "z1_furrow_boar",
   "z1_hedgerow_cutpurse"
  ]
 },
 "q_z1_lost_lambs": {
  "id": "q_z1_lost_lambs",
  "title": "Lost Lambs",
  "giver": "Maud Thatcher",
  "objective": "rescue",
  "text": "Three lambs strayed into the wood, where wolves circle and an ogre has been seen. Find them and drive the lot off.",
  "turnIn": "You found them! I will light a candle for you tonight.",
  "sizeWeights": [
   30,
   40,
   30
  ],
  "enemies": [
   "z1_barn_wolf",
   "z1_hedge_ogre"
  ]
 },
 "q_z1_hedge_and_thorn": {
  "id": "q_z1_hedge_and_thorn",
  "title": "Hedge and Thorn",
  "giver": "Wardkeeper Ilsa",
  "objective": "slay",
  "text": "Cutpurses have taken to the hedgerows along the Millbrook road. Clear them out.",
  "turnIn": "The road is quiet again. Take your fee.",
  "sizeWeights": [
   20,
   40,
   40
  ],
  "enemies": [
   "z1_hedgerow_cutpurse",
   "z1_bramble_herbalist"
  ]
 },
 "q_z1_flour_for_the_crossing": {
  "id": "q_z1_flour_for_the_crossing",
  "title": "Flour for the Crossing",
  "giver": "Miller Teodor",
  "objective": "deliver",
  "text": "Carry this sack of flour to the guard post by the old bridge. Mind the wolves and the road thieves on the way.",
  "turnIn": "Fresh bread tonight, thanks to you.",
  "sizeWeights": [
   50,
   40,
   10
  ],
  "enemies": [
   "z1_barn_wolf",
   "z1_hedgerow_cutpurse"
  ]
 },
 "q_z1_what_the_scarecrow_saw": {
  "id": "q_z1_what_the_scarecrow_saw",
  "title": "What the Scarecrow Saw",
  "giver": "Elder Wynne",
  "objective": "scout",
  "text": "Strange lights move among the straw men and the old stone sentinels at night. Go see what stirs them.",
  "turnIn": "So the charm is stolen. That is worse than I feared.",
  "sizeWeights": [
   30,
   40,
   30
  ],
  "enemies": [
   "z1_scarecrow_hexer",
   "z1_stonewall_sentinel"
  ]
 },
 "q_z1_pillars_of_the_field": {
  "id": "q_z1_pillars_of_the_field",
  "title": "Pillars of the Field",
  "giver": "Wardkeeper Ilsa",
  "objective": "gather",
  "text": "The boundary stones are cracking. Gather shards from the stone sentinels to be reset, and watch for boars rooting among the rubble.",
  "turnIn": "These shards will mend the old wards.",
  "sizeWeights": [
   20,
   40,
   40
  ],
  "enemies": [
   "z1_stonewall_sentinel",
   "z1_furrow_boar"
  ]
 },
 "q_z1_a_hermit_s_debt": {
  "id": "q_z1_a_hermit_s_debt",
  "title": "A Hermit's Debt",
  "giver": "Brother Alden",
  "objective": "rescue",
  "text": "An old herbalist in the briars owes me a favour and will not answer. See that she is well.",
  "turnIn": "She lives, though changed. I am in your debt.",
  "sizeWeights": [
   40,
   40,
   20
  ],
  "enemies": [
   "z1_bramble_herbalist",
   "z1_hedgerow_cutpurse"
  ]
 },
 "q_z1_the_ogre_of_the_threshing_floor": {
  "id": "q_z1_the_ogre_of_the_threshing_floor",
  "title": "The Ogre of the Threshing Floor",
  "giver": "Reeve Hollis",
  "objective": "slay",
  "text": "An ogre and his thieving crew have seized the village threshing floor and the grain with it. Drive them out.",
  "turnIn": "The floor is ours again. Well fought.",
  "sizeWeights": [
   10,
   40,
   50
  ],
  "enemies": [
   "z1_hedge_ogre",
   "z1_hedgerow_cutpurse"
  ]
 },
 "q_z1_ashes_on_the_wind": {
  "id": "q_z1_ashes_on_the_wind",
  "title": "Ashes on the Wind",
  "giver": "Captain Brae",
  "objective": "scout",
  "text": "Smoke rises from the old Harrow manor, where thieves and straw figures shelter in the ruins. Learn who lit the fires.",
  "turnIn": "Cultists in the cellars, and thieves above. We must act at once.",
  "sizeWeights": [
   30,
   40,
   30
  ],
  "enemies": [
   "z1_hedgerow_cutpurse",
   "z1_scarecrow_hexer"
  ]
 },
 // The guided zone's quest texts (M3 guided first run, D144; draft, Core Gameplay Engineer 2026-11-13, for the Content
 // Designer): content tutorial.js names one for each scripted and site fight, and a Quest node that plays that fight shows
 // it, so the text matches the enemies (the blind testers met a boar under a quest about cutpurses). In no zone's list:
 // normal runs never draw them. S3 uses Lost Lambs above.
 "q_z1_guide_rooted_rows": {
  "id": "q_z1_guide_rooted_rows",
  "title": "Rooted Rows",
  "giver": "Goodwife Ennet",
  "objective": "slay",
  "text": "A furrow boar is rooting up the seed rows behind the mill. Drive it off before it eats the lot.",
  "turnIn": "Bless you. Take this, and a draught for the road.",
  "enemies": [
   "z1_furrow_boar"
  ]
 },
 "q_z1_guide_hedge_breaker": {
  "id": "q_z1_guide_hedge_breaker",
  "title": "The Hedge Breaker",
  "giver": "Hobb Larrow",
  "objective": "slay",
  "text": "An ogre keeps smashing through the hedges on the east lane. He swings slow and heavy. Send him back to the woods.",
  "turnIn": "The lane is quiet again. Well struck.",
  "enemies": [
   "z1_hedge_ogre"
  ]
 },
 "q_z1_guide_straw_and_tusk": {
  "id": "q_z1_guide_straw_and_tusk",
  "title": "Straw and Tusk",
  "giver": "Tamsy Crake",
  "objective": "slay",
  "text": "A scarecrow walks the turnip field at night, and a boar trots at its heels. When the straw man starts to chant, stop it.",
  "turnIn": "No more chanting in my field. Thank you.",
  "enemies": [
   "z1_scarecrow_hexer",
   "z1_furrow_boar"
  ]
 },
 "q_z1_guide_tusks_in_the_verge": {
  "id": "q_z1_guide_tusks_in_the_verge",
  "title": "Tusks in the Verge",
  "giver": "Warden Pell",
  "objective": "slay",
  "text": "Boars come down from the Verge and churn every field they cross. Thin them out for us.",
  "turnIn": "That will keep them off the fields a while.",
  "enemies": [
   "z1_furrow_boar"
  ]
 },
 "q_z1_guide_wolf_at_the_wallow": {
  "id": "q_z1_guide_wolf_at_the_wallow",
  "title": "The Wolf at the Wallow",
  "giver": "Swineherd Brannick",
  "objective": "slay",
  "text": "A barn wolf stalks the boar wallow by the old fence. Clear out the boar and the wolf together.",
  "turnIn": "Good. The herd can graze in peace again.",
  "enemies": [
   "z1_furrow_boar",
   "z1_barn_wolf"
  ]
 },
 "q_z2_fever_on_the_water": {
  "id": "q_z2_fever_on_the_water",
  "title": "Fever on the Water",
  "giver": "Healer Maren",
  "objective": "gather",
  "text": "The fen fever spreads. Bring me sap from the stalks guarded by the bog witches and their acolytes.",
  "turnIn": "Brewed and ready. The sick will thank you.",
  "sizeWeights": [
   30,
   40,
   30
  ],
  "enemies": [
   "z2_bog_witch",
   "z2_fen_healer"
  ]
 },
 "q_z2_stilts_and_snares": {
  "id": "q_z2_stilts_and_snares",
  "title": "Stilts and Snares",
  "giver": "Harbourwarden Pell",
  "objective": "slay",
  "text": "Mist hounds and the reed stalkers who run with them are snatching the catch from our drying racks. Thin their ranks.",
  "turnIn": "The racks hold fish again.",
  "sizeWeights": [
   20,
   40,
   40
  ],
  "enemies": [
   "z2_mist_hound",
   "z2_reed_stalker"
  ]
 },
 "q_z2_the_lost_causeway": {
  "id": "q_z2_the_lost_causeway",
  "title": "The Lost Causeway",
  "giver": "Surveyor Ansel",
  "objective": "scout",
  "text": "The old causeway has sunk out of sight. Walk the margins and mark where the stones remain.",
  "turnIn": "This map saves lives. Thank you.",
  "sizeWeights": [
   40,
   40,
   20
  ],
  "enemies": [
   "z2_marsh_lurker",
   "z2_reed_stalker"
  ]
 },
 "q_z2_salt_for_the_smokehouse": {
  "id": "q_z2_salt_for_the_smokehouse",
  "title": "Salt for the Smokehouse",
  "giver": "Ketil Reedman",
  "objective": "deliver",
  "text": "Bring this salt crate across the fen to the smokehouse. The lurkers hunt the shallows and witches hex the path.",
  "turnIn": "Not a grain wet. You have my thanks.",
  "sizeWeights": [
   50,
   40,
   10
  ],
  "enemies": [
   "z2_marsh_lurker",
   "z2_bog_witch"
  ]
 },
 "q_z2_a_witch_s_bargain": {
  "id": "q_z2_a_witch_s_bargain",
  "title": "A Witch's Bargain",
  "giver": "Old Sedge",
  "objective": "slay",
  "text": "The bog witches poison the wells to sell the cure, and their peat guardians keep watch. End their trade for good.",
  "turnIn": "The wells run clear. At last.",
  "sizeWeights": [
   10,
   40,
   50
  ],
  "enemies": [
   "z2_bog_witch",
   "z2_peat_sentinel"
  ]
 },
 "q_z2_fenmother_s_request": {
  "id": "q_z2_fenmother_s_request",
  "title": "Fenmother's Request",
  "giver": "Priestess Lorn",
  "objective": "rescue",
  "text": "Two of our acolytes are missing past the black pool. Bring them home, if they live.",
  "turnIn": "They are safe. The waters bless you.",
  "sizeWeights": [
   30,
   40,
   30
  ],
  "enemies": [
   "z2_fen_healer",
   "z2_marsh_lurker"
  ]
 },
 "q_z2_gloam_eel_tales": {
  "id": "q_z2_gloam_eel_tales",
  "title": "Gloam Eel Tales",
  "giver": "Fisher Dagny",
  "objective": "slay",
  "text": "Gape-jawed lurkers and a mire brute have taken three boats this season. Hunt them down in the dark channel.",
  "turnIn": "Things like that should not be swimming. Well done.",
  "sizeWeights": [
   30,
   40,
   30
  ],
  "enemies": [
   "z2_marsh_lurker",
   "z2_mire_brute"
  ]
 },
 "q_z2_rot_beneath_the_planks": {
  "id": "q_z2_rot_beneath_the_planks",
  "title": "Rot Beneath the Planks",
  "giver": "Harbourwarden Pell",
  "objective": "slay",
  "text": "Peat guardians wake near the stilt walkways and crack our footings, and lurkers follow the noise. Break them apart.",
  "turnIn": "The footings hold. We owe you.",
  "sizeWeights": [
   40,
   40,
   20
  ],
  "enemies": [
   "z2_peat_sentinel",
   "z2_marsh_lurker"
  ]
 },
 "q_z2_the_weir_keeps_rising": {
  "id": "q_z2_the_weir_keeps_rising",
  "title": "The Weir Keeps Rising",
  "giver": "Surveyor Ansel",
  "objective": "scout",
  "text": "Something works the floodgates of the old weir at night. Look into the dam-keep and report.",
  "turnIn": "So the weir is held. Then we must act.",
  "sizeWeights": [
   20,
   40,
   40
  ],
  "enemies": [
   "z2_mire_brute",
   "z2_reed_stalker"
  ]
 },
 "q_z3_wolves_at_the_wall": {
  "id": "q_z3_wolves_at_the_wall",
  "title": "Wolves at the Wall",
  "giver": "Thane Brannoch",
  "objective": "slay",
  "text": "Crag prowlers, driven by a shaman's call, have been taking our herd-dogs. Hunt them down above the high pasture.",
  "turnIn": "The herd sleeps safe tonight.",
  "sizeWeights": [
   40,
   40,
   20
  ],
  "enemies": [
   "z3_crag_prowler",
   "z3_wind_shaman"
  ]
 },
 "q_z3_stones_that_walk": {
  "id": "q_z3_stones_that_walk",
  "title": "Stones That Walk",
  "giver": "Lorekeeper Ysolt",
  "objective": "scout",
  "text": "The old guardian stones are moving along the ridge, and shamans call the wind around them. Watch where they go and why.",
  "turnIn": "They march toward Barrowdeep. This is troubling.",
  "sizeWeights": [
   30,
   40,
   30
  ],
  "enemies": [
   "z3_standing_stone_guard",
   "z3_wind_shaman"
  ]
 },
 "q_z3_lightning_on_the_ridge": {
  "id": "q_z3_lightning_on_the_ridge",
  "title": "Lightning on the Ridge",
  "giver": "Shepherd Tam",
  "objective": "slay",
  "text": "Wind shamans and their stone-sworn bodyguards have burnt three of my flocks with storm-calling. Silence them.",
  "turnIn": "May the grass grow back swiftly.",
  "sizeWeights": [
   20,
   40,
   40
  ],
  "enemies": [
   "z3_wind_shaman",
   "z3_cairn_brute"
  ]
 },
 "q_z3_mead_for_the_steading": {
  "id": "q_z3_mead_for_the_steading",
  "title": "Mead for the Steading",
  "giver": "Innkeeper Hild",
  "objective": "deliver",
  "text": "Bring this cask of mead to Stonehaven before the feast. The heath reivers will hunt it, and their shaman rides with them.",
  "turnIn": "You saved the feast! Drink with us.",
  "sizeWeights": [
   50,
   40,
   10
  ],
  "enemies": [
   "z3_reiver_scout",
   "z3_wind_shaman"
  ]
 },
 "q_z3_reiver_s_toll": {
  "id": "q_z3_reiver_s_toll",
  "title": "Reiver's Toll",
  "giver": "Thane Brannoch",
  "objective": "slay",
  "text": "Heath reivers and the prowlers they keep take tolls at the ford where none are owed. Show them the Hold's answer.",
  "turnIn": "The ford is free again.",
  "sizeWeights": [
   20,
   40,
   40
  ],
  "enemies": [
   "z3_reiver_scout",
   "z3_crag_prowler"
  ]
 },
 "q_z3_ram_horn_signal": {
  "id": "q_z3_ram_horn_signal",
  "title": "Ram-Horn Signal",
  "giver": "Huntress Ketra",
  "objective": "gather",
  "text": "We need ridge-ram horns for the warning pipes. Gather six past the guardian stones and bring them down.",
  "turnIn": "These will carry across three valleys.",
  "sizeWeights": [
   30,
   40,
   30
  ],
  "enemies": [
   "z3_ridge_ram",
   "z3_standing_stone_guard"
  ]
 },
 "q_z3_a_healer_taken": {
  "id": "q_z3_a_healer_taken",
  "title": "A Healer Taken",
  "giver": "Hearth-Mother Orla",
  "objective": "rescue",
  "text": "Our hearth-priest was seized on the high road. Free him from the warband that holds him.",
  "turnIn": "He lives! Blessings on you.",
  "sizeWeights": [
   40,
   40,
   20
  ],
  "enemies": [
   "z3_reiver_scout",
   "z3_hearth_priest"
  ]
 },
 "q_z3_the_silent_cairns": {
  "id": "q_z3_the_silent_cairns",
  "title": "The Silent Cairns",
  "giver": "Lorekeeper Ysolt",
  "objective": "scout",
  "text": "No bell has rung from the Barrow road in a week, and the wind there carries chanting. Go and see what has silenced it.",
  "turnIn": "A giant has torn up the cairns. We must warn the clans.",
  "sizeWeights": [
   30,
   40,
   30
  ],
  "enemies": [
   "z3_cairn_brute",
   "z3_wind_shaman"
  ]
 },
 "q_z3_tavrik_s_oath": {
  "id": "q_z3_tavrik_s_oath",
  "title": "Tavrik's Oath",
  "giver": "Thane Brannoch",
  "objective": "slay",
  "text": "Tavrik Cairnfist blocks the pass and will not yield. Break his oath if you must.",
  "turnIn": "He kept his word to the end. May he rest.",
  "sizeWeights": [
   10,
   40,
   50
  ],
  "enemies": [
   "z3_reiver_scout",
   "z3_cairn_brute"
  ]
 },
 "q_z4_the_thirsty_caravan": {
  "id": "q_z4_the_thirsty_caravan",
  "title": "The Thirsty Caravan",
  "giver": "Caravanmaster Sefu",
  "objective": "deliver",
  "text": "Carry water-skins to our stranded caravan beyond the dunes. Jackals and sand stalkers are thick on that road.",
  "turnIn": "You have saved eleven lives. Thank you.",
  "sizeWeights": [
   50,
   40,
   10
  ],
  "enemies": [
   "z4_dust_jackal",
   "z4_sand_stalker"
  ]
 },
 "q_z4_scarab_plague": {
  "id": "q_z4_scarab_plague",
  "title": "Scarab Plague",
  "giver": "Digger Imhotep",
  "objective": "slay",
  "text": "Gilded scarabs are devouring the food in our camp, and an adept is feeding them. Crush the swarms at their nest.",
  "turnIn": "The pests are gone. Our camp can sleep again.",
  "sizeWeights": [
   20,
   40,
   40
  ],
  "enemies": [
   "z4_scarab_swarm",
   "z4_sun_cultist"
  ]
 },
 "q_z4_whispers_in_the_glyphs": {
  "id": "q_z4_whispers_in_the_glyphs",
  "title": "Whispers in the Glyphs",
  "giver": "Scholar Neferu",
  "objective": "scout",
  "text": "Strange voices speak from the engraved walls near the old gate. Hear what they say.",
  "turnIn": "The glyphs are waking. This is dire news.",
  "sizeWeights": [
   30,
   40,
   30
  ],
  "enemies": [
   "z4_sun_cultist",
   "z4_sepulchre_guard"
  ]
 },
 "q_z4_cistern_keeper_s_plea": {
  "id": "q_z4_cistern_keeper_s_plea",
  "title": "Cistern Keeper's Plea",
  "giver": "Warden Tarek",
  "objective": "rescue",
  "text": "Our wardens at the east cistern have not returned. Find them and drive off whatever holds them.",
  "turnIn": "The cistern is safe. The oasis lives.",
  "sizeWeights": [
   40,
   40,
   20
  ],
  "enemies": [
   "z4_sand_stalker",
   "z4_canal_healer"
  ]
 },
 "q_z4_relics_of_the_empire": {
  "id": "q_z4_relics_of_the_empire",
  "title": "Relics of the Empire",
  "giver": "Digger Imhotep",
  "objective": "gather",
  "text": "Gather broken sun-discs from the ruin juggernauts. The scholars can read their markings, but sunscribe adepts guard the dig.",
  "turnIn": "These discs hold names we thought lost.",
  "sizeWeights": [
   30,
   40,
   30
  ],
  "enemies": [
   "z4_dune_juggernaut",
   "z4_sun_cultist"
  ]
 },
 "q_z4_sandstorm_hunters": {
  "id": "q_z4_sandstorm_hunters",
  "title": "Sandstorm Hunters",
  "giver": "Caravanmaster Sefu",
  "objective": "slay",
  "text": "Sand stalkers and their jackals strike from the dunes whenever a sandstorm hides them. Hunt them down.",
  "turnIn": "Open ground feels safe again.",
  "sizeWeights": [
   20,
   40,
   40
  ],
  "enemies": [
   "z4_sand_stalker",
   "z4_dust_jackal"
  ]
 },
 "q_z4_the_unburied_champion": {
  "id": "q_z4_the_unburied_champion",
  "title": "The Unburied Champion",
  "giver": "Scholar Neferu",
  "objective": "slay",
  "text": "The champion Kharun walks his old halls again, and the tomb scarabs swarm with him. Put him back to rest.",
  "turnIn": "At last the tomb may be sealed.",
  "sizeWeights": [
   10,
   40,
   50
  ],
  "enemies": [
   "z4_sepulchre_guard",
   "z4_scarab_swarm"
  ]
 },
 "q_z4_light_the_beacon": {
  "id": "q_z4_light_the_beacon",
  "title": "Light the Beacon",
  "giver": "Warden Tarek",
  "objective": "scout",
  "text": "The signal beacon at the south ridge has gone dark. Climb up and find out why.",
  "turnIn": "Someone put it out. We shall be wary.",
  "sizeWeights": [
   30,
   40,
   30
  ],
  "enemies": [
   "z4_dust_jackal",
   "z4_sun_cultist"
  ]
 },
 "q_z4_sun_priest_s_silence": {
  "id": "q_z4_sun_priest_s_silence",
  "title": "Sun-Priest's Silence",
  "giver": "Scholar Neferu",
  "objective": "slay",
  "text": "Sunscribe adepts chant at the obelisk base, drawing power from the glyphs. End their rite.",
  "turnIn": "The chanting has stopped. Thank you.",
  "sizeWeights": [
   40,
   40,
   20
  ],
  "enemies": [
   "z4_sun_cultist",
   "z4_canal_healer"
  ]
 },
 "q_z5_lanterns_for_the_lost": {
  "id": "q_z5_lanterns_for_the_lost",
  "title": "Lanterns for the Lost",
  "giver": "Warden Ysmay",
  "objective": "gather",
  "text": "We light lanterns to guide the living out of the wood. Gather wisp-glass for new wicks.",
  "turnIn": "Our lights burn brighter. You are kind.",
  "sizeWeights": [
   30,
   40,
   30
  ],
  "enemies": [
   "z5_thorn_wisp",
   "z5_lantern_keeper"
  ]
 },
 "q_z5_the_weeping_statues": {
  "id": "q_z5_the_weeping_statues",
  "title": "The Weeping Statues",
  "giver": "Brother Corvin",
  "objective": "scout",
  "text": "The stone penitents move at night and a woman is heard crying. Learn what binds them.",
  "turnIn": "A broken vow. We must mend it.",
  "sizeWeights": [
   30,
   40,
   30
  ],
  "enemies": [
   "z5_stone_penitent",
   "z5_hex_widow"
  ]
 },
 "q_z5_hollow_heart": {
  "id": "q_z5_hollow_heart",
  "title": "Hollow Heart",
  "giver": "Woodcutter Aldo",
  "objective": "slay",
  "text": "The hollow oaks fall upon our camp each dusk, led on by thorn wisps. Fell them before they fell us.",
  "turnIn": "Quiet again. Thank you.",
  "sizeWeights": [
   20,
   40,
   40
  ],
  "enemies": [
   "z5_hollow_oak",
   "z5_thorn_wisp"
  ]
 },
 "q_z5_bell_in_the_mist": {
  "id": "q_z5_bell_in_the_mist",
  "title": "Bell in the Mist",
  "giver": "Warden Ysmay",
  "objective": "scout",
  "text": "A bell tolls from Dunmere Chapel where no ringer has lived for years. Find who rings it.",
  "turnIn": "The dead hold service. This bodes ill.",
  "sizeWeights": [
   40,
   40,
   20
  ],
  "enemies": [
   "z5_wraith_stalker",
   "z5_lantern_keeper"
  ]
 },
 "q_z5_hounds_of_the_graveyard": {
  "id": "q_z5_hounds_of_the_graveyard",
  "title": "Hounds of the Graveyard",
  "giver": "Gravekeeper Isolde",
  "objective": "slay",
  "text": "Grave hounds are digging up our churchyard, and wisps lead them on. Put them down for good.",
  "turnIn": "The dead may rest at last.",
  "sizeWeights": [
   20,
   40,
   40
  ],
  "enemies": [
   "z5_ghoul_hound",
   "z5_thorn_wisp"
  ]
 },
 "q_z5_letters_to_the_grave": {
  "id": "q_z5_letters_to_the_grave",
  "title": "Letters to the Grave",
  "giver": "Widow Perrin",
  "objective": "deliver",
  "text": "Take this bundle of letters to the Dunmere crypt. Do not read them, and do not linger.",
  "turnIn": "He will have them now. Thank you.",
  "sizeWeights": [
   50,
   40,
   10
  ],
  "enemies": [
   "z5_ghoul_hound",
   "z5_wraith_stalker"
  ]
 },
 "q_z5_veil_cursed": {
  "id": "q_z5_veil_cursed",
  "title": "Veil-Cursed",
  "giver": "Brother Corvin",
  "objective": "rescue",
  "text": "A hunter has been cursed by a hex widow and wanders the woods in a daze, her hounds close behind. Find him.",
  "turnIn": "He wakes! The curse has broken.",
  "sizeWeights": [
   40,
   40,
   20
  ],
  "enemies": [
   "z5_hex_widow",
   "z5_ghoul_hound"
  ]
 },
 "q_z5_the_pale_hunter": {
  "id": "q_z5_the_pale_hunter",
  "title": "The Pale Hunter",
  "giver": "Warden Ysmay",
  "objective": "slay",
  "text": "A spectral huntsman and his grave hounds have been tracking our scouts through the mist. Make him the quarry.",
  "turnIn": "His horn is silent. Well done.",
  "sizeWeights": [
   10,
   40,
   50
  ],
  "enemies": [
   "z5_wraith_stalker",
   "z5_ghoul_hound"
  ]
 },
 "q_z5_lord_varis_s_penance": {
  "id": "q_z5_lord_varis_s_penance",
  "title": "Lord Varis's Penance",
  "giver": "Gravekeeper Isolde",
  "objective": "slay",
  "text": "Lord Varis haunts the burnt manor and will not let any pass. Lay him to rest.",
  "turnIn": "He is at peace. The manor sleeps.",
  "sizeWeights": [
   30,
   40,
   30
  ],
  "enemies": [
   "z5_wraith_stalker",
   "z5_hex_widow"
  ]
 },
 "q_z6_the_ash_road": {
  "id": "q_z6_the_ash_road",
  "title": "The Ash Road",
  "giver": "Marshal Doran",
  "objective": "scout",
  "text": "The ash road to the fortress is blocked by shifting slag. Scout the route and mark safe passages.",
  "turnIn": "Safe paths at last. We march at dawn.",
  "sizeWeights": [
   30,
   40,
   30
  ],
  "enemies": [
   "z6_slag_brute",
   "z6_ash_stalker"
  ]
 },
 "q_z6_hounds_of_fire": {
  "id": "q_z6_hounds_of_fire",
  "title": "Hounds of Fire",
  "giver": "Scout Kettil",
  "objective": "slay",
  "text": "Magma hounds roam the foothills with pyre magi at their heels, scorching our outposts. Drive them back.",
  "turnIn": "The outposts are quiet. Well done.",
  "sizeWeights": [
   20,
   40,
   40
  ],
  "enemies": [
   "z6_magma_hound",
   "z6_pyre_magus"
  ]
 },
 "q_z6_embers_of_the_old_forge": {
  "id": "q_z6_embers_of_the_old_forge",
  "title": "Embers of the Old Forge",
  "giver": "Smith Brennar",
  "objective": "gather",
  "text": "The old forges still hold cinder-steel in their ash. Retrieve ingots from the slag brutes and the priests who tend them.",
  "turnIn": "Perfect metal. We can arm the garrison.",
  "sizeWeights": [
   30,
   40,
   30
  ],
  "enemies": [
   "z6_slag_brute",
   "z6_forge_priest"
  ]
 },
 "q_z6_the_last_supply_wagon": {
  "id": "q_z6_the_last_supply_wagon",
  "title": "The Last Supply Wagon",
  "giver": "Quartermaster Lisel",
  "objective": "deliver",
  "text": "A wagon of supplies lies abandoned in the pass. Fetch the cargo before the wyrmlings and ash stalkers find it.",
  "turnIn": "The garrison eats tonight. Thank you.",
  "sizeWeights": [
   50,
   40,
   10
  ],
  "enemies": [
   "z6_cinder_wyrmling",
   "z6_ash_stalker"
  ]
 },
 "q_z6_the_obsidian_wardens": {
  "id": "q_z6_the_obsidian_wardens",
  "title": "The Obsidian Wardens",
  "giver": "Marshal Doran",
  "objective": "slay",
  "text": "The glassy wardens and their magma hounds guard the pass and will not stand aside. Smash them.",
  "turnIn": "The pass is open. Excellent work.",
  "sizeWeights": [
   40,
   40,
   20
  ],
  "enemies": [
   "z6_obsidian_warden",
   "z6_magma_hound"
  ]
 },
 "q_z6_cult_of_the_furnace": {
  "id": "q_z6_cult_of_the_furnace",
  "title": "Cult of the Furnace",
  "giver": "Scout Kettil",
  "objective": "scout",
  "text": "A fire cult has seized the old forge fortress. Learn their numbers and bring word.",
  "turnIn": "So many. We need a plan.",
  "sizeWeights": [
   30,
   40,
   30
  ],
  "enemies": [
   "z6_forge_priest",
   "z6_pyre_magus"
  ]
 },
 "q_z6_pyre_magus": {
  "id": "q_z6_pyre_magus",
  "title": "Pyre Magus",
  "giver": "Marshal Doran",
  "objective": "slay",
  "text": "A renegade magus and his slag thralls burn villages for fuel. Stop them before the flame spreads.",
  "turnIn": "The fires are dying down. Thank you.",
  "sizeWeights": [
   10,
   40,
   50
  ],
  "enemies": [
   "z6_pyre_magus",
   "z6_slag_brute"
  ]
 },
 "q_z6_rescue_at_emberwatch": {
  "id": "q_z6_rescue_at_emberwatch",
  "title": "Rescue at Emberwatch",
  "giver": "Smith Brennar",
  "objective": "rescue",
  "text": "Two smiths were taken to the Furnace to feed its fires. Free them if they still live.",
  "turnIn": "They breathe! We are in your debt.",
  "sizeWeights": [
   40,
   40,
   20
  ],
  "enemies": [
   "z6_forge_priest",
   "z6_ash_stalker"
  ]
 },
 "q_z6_the_drake_s_roost": {
  "id": "q_z6_the_drake_s_roost",
  "title": "The Drake's Roost",
  "giver": "Quartermaster Lisel",
  "objective": "slay",
  "text": "Wyrmlings and the slag brutes that serve them circle a ridge high above the pass, and their mother is the cause. End the nest.",
  "turnIn": "The sky is clear. May the pass stay safe.",
  "sizeWeights": [
   20,
   40,
   40
  ],
  "enemies": [
   "z6_cinder_wyrmling",
   "z6_slag_brute"
  ]
 }
};
