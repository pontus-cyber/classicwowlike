// Content table: the six zones: names, hubs, themes, level bands (rules.md 1.3, 12). Plain data only (Content Designer).
export const ZONES = [
 {
  "id": "z1",
  "regions": [
   {
    "id": "z1_wilds",
    "name": "Barleyreach Verge",
    "kind": "wilds",
    "families": ["wild"]
   },
   {
    "id": "z1_road",
    "name": "Carter's Furrow Road",
    "kind": "road",
    "families": ["outlaw"]
   },
   {
    "id": "z1_haunt",
    "name": "Boundary Stone Hollow",
    "kind": "haunt",
    "families": ["blight"]
   },
   {
    "id": "z1_steads",
    "name": "Millbrook Steadings",
    "kind": "steads",
    "families": ["wild","outlaw"]
   }
  ],
  "roads": ["Millbrook Gate", "Harrow Lane", "Stonecutters' Way"],
  "name": "Amberfold Downs",
  "theme": "Farmland giving way to the forest edge, where old boundary stones keep failing.",
  "hubName": "Millbrook Rest",
  "hubText": "A mill, a well and a militia that has not slept in days.",
  "normals": [
   "z1_hedge_ogre",
   "z1_furrow_boar",
   "z1_barn_wolf",
   "z1_hedgerow_cutpurse",
   "z1_scarecrow_hexer",
   "z1_stonewall_sentinel",
   "z1_bramble_herbalist"
  ],
  "addPool": [
   "z1_hedge_ogre",
   "z1_hedgerow_cutpurse",
   "z1_barn_wolf"
  ],
  "elites": [
   "z1_gorrak",
   "z1_marrow"
  ],
  "rares": [
   "z1_thistlewick"
  ],
  "dungeon": {
   "name": "The Harrow Cellars",
   "text": "Sunken storerooms under a burned manor, now home to bandits and worse.",
   "trash": [
    "z1_cellar_rat_swarm",
    "z1_harrow_deserter",
    "z1_rust_shackled_guard",
    "z1_candle_cultist"
   ],
   "boss": "z1_belk"
  },
  "quests": [
   "q_z1_blight_in_the_barley",
   "q_z1_lost_lambs",
   "q_z1_hedge_and_thorn",
   "q_z1_flour_for_the_crossing",
   "q_z1_what_the_scarecrow_saw",
   "q_z1_pillars_of_the_field",
   "q_z1_a_hermit_s_debt",
   "q_z1_the_ogre_of_the_threshing_floor",
   "q_z1_ashes_on_the_wind"
  ],
  "shrineLines": [
   "A mossy boundary stone hums softly, warm under your hand, as though a ward still sleeps within it.",
   "Ribbons and wheat sheaves cover a roadside altar, tied there by farmers praying for a good year."
  ],
  "treasureLines": [
   "A farmer's strongbox lies half-buried beneath a collapsed haystack, its lock long rusted.",
   "Behind a loose hearthstone in a burned cottage, a pouch of coins waits for whoever looks."
  ],
  "junkNames": [
   "Cracked Hoof",
   "Torn Sackcloth",
   "Bent Nail"
  ]
 },
 {
  "id": "z2",
  "regions": [
   {
    "id": "z2_wilds",
    "name": "Sedge Flats",
    "kind": "wilds",
    "families": ["fenbeast"]
   },
   {
    "id": "z2_road",
    "name": "Rotplank Causeway",
    "kind": "road",
    "families": ["reedfolk"]
   },
   {
    "id": "z2_haunt",
    "name": "Gloamwater Hollow",
    "kind": "haunt",
    "families": ["witchkin"]
   },
   {
    "id": "z2_steads",
    "name": "Stiltrow Hamlets",
    "kind": "steads",
    "families": ["reedfolk","fenbeast"]
   }
  ],
  "roads": ["Stilt Haven Boardwalk", "Lanternless Causeway", "Heron's Ford"],
  "name": "Greywater Fens",
  "theme": "Drowned wetlands of reed, mist and rotting causeways.",
  "hubName": "Stilt Haven",
  "hubText": "Rope bridges and lamplit stilts above black water.",
  "normals": [
   "z2_mire_brute",
   "z2_reed_stalker",
   "z2_bog_witch",
   "z2_marsh_lurker",
   "z2_peat_sentinel",
   "z2_fen_healer",
   "z2_mist_hound"
  ],
  "addPool": [
   "z2_mire_brute",
   "z2_reed_stalker",
   "z2_mist_hound"
  ],
  "elites": [
   "z2_bargh",
   "z2_sisel"
  ],
  "rares": [
   "z2_gloam_eel"
  ],
  "dungeon": {
   "name": "The Sunken Weir",
   "text": "A flooded dam-keep where the water rises one step each day.",
   "trash": [
    "z2_weir_crawler",
    "z2_drowned_sentry",
    "z2_sluice_cutthroat",
    "z2_tidecaller_adept"
   ],
   "boss": "z2_mawgrim"
  },
  "quests": [
   "q_z2_fever_on_the_water",
   "q_z2_stilts_and_snares",
   "q_z2_the_lost_causeway",
   "q_z2_salt_for_the_smokehouse",
   "q_z2_a_witch_s_bargain",
   "q_z2_fenmother_s_request",
   "q_z2_gloam_eel_tales",
   "q_z2_rot_beneath_the_planks",
   "q_z2_the_weir_keeps_rising"
  ],
  "shrineLines": [
   "A shrine of knotted reeds floats on a still pool, glowing with a dim green light.",
   "A sunken bell chimes beneath the mist, though no wind moves it."
  ],
  "treasureLines": [
   "A smuggler's oilcloth bundle is wedged in the roots of a drowned willow.",
   "A tilted pole holds a lockbox just above the waterline, left by a fisher who never returned."
  ],
  "junkNames": [
   "Waterlogged Rope",
   "Cracked Eel Jar",
   "Rotten Net Float"
  ]
 },
 {
  "id": "z3",
  "regions": [
   {
    "id": "z3_wilds",
    "name": "Ramsback Heath",
    "kind": "wilds",
    "families": ["crag"]
   },
   {
    "id": "z3_road",
    "name": "Reivers' Drovepath",
    "kind": "road",
    "families": ["reiver"]
   },
   {
    "id": "z3_haunt",
    "name": "Standing Stone Hollow",
    "kind": "haunt",
    "families": ["stormward"]
   },
   {
    "id": "z3_steads",
    "name": "Windbarrow Steadings",
    "kind": "steads",
    "families": ["reiver","crag"]
   }
  ],
  "roads": ["Windbarrow Pass", "Cairnwatch Stair", "Drovers' Gap"],
  "name": "Highcairn Reach",
  "theme": "Windswept highlands of stone cairns, heather and fortified steadings.",
  "hubName": "Windbarrow Hold",
  "hubText": "A walled steading with fires lit against the wind.",
  "normals": [
   "z3_cairn_brute",
   "z3_crag_prowler",
   "z3_reiver_scout",
   "z3_wind_shaman",
   "z3_standing_stone_guard",
   "z3_hearth_priest",
   "z3_ridge_ram"
  ],
  "addPool": [
   "z3_cairn_brute",
   "z3_reiver_scout",
   "z3_crag_prowler"
  ],
  "elites": [
   "z3_tavrik",
   "z3_urseth",
   "z3_mawra"
  ],
  "rares": [
   "z3_grey_stag"
  ],
  "dungeon": {
   "name": "Barrowdeep",
   "text": "A burial complex carved into the mountain, where the clan kings still hold court.",
   "trash": [
    "z3_barrow_sleeper",
    "z3_bone_thane",
    "z3_grave_skald",
    "z3_cairn_hound",
    "z3_tomb_priest"
   ],
   "boss": "z3_king_aldrec"
  },
  "quests": [
   "q_z3_wolves_at_the_wall",
   "q_z3_stones_that_walk",
   "q_z3_lightning_on_the_ridge",
   "q_z3_mead_for_the_steading",
   "q_z3_reiver_s_toll",
   "q_z3_ram_horn_signal",
   "q_z3_a_healer_taken",
   "q_z3_the_silent_cairns",
   "q_z3_tavrik_s_oath"
  ],
  "shrineLines": [
   "A ring of standing stones hums with old power, the heather around them strangely still.",
   "A cairn crowned with iron nails marks a fallen hero; the wind carries a faint horn call."
  ],
  "treasureLines": [
   "A reiver's cache sits under a flat stone, wrapped in an oiled hide.",
   "A fallen caravan's chest rests against a boulder, half buried by a rockslide."
  ],
  "junkNames": [
   "Frayed Plaid Scrap",
   "Chipped Whetstone",
   "Sheep-Bone Whistle"
  ]
 },
 {
  "id": "z4",
  "regions": [
   {
    "id": "z4_wilds",
    "name": "Jackal Dunes",
    "kind": "wilds",
    "families": ["dune"]
   },
   {
    "id": "z4_road",
    "name": "Saltglass Caravan Way",
    "kind": "road",
    "families": ["dune","tomb"]
   },
   {
    "id": "z4_haunt",
    "name": "Sepulchre Terraces",
    "kind": "haunt",
    "families": ["tomb","sunbound"]
   },
   {
    "id": "z4_steads",
    "name": "Cistern Gardens",
    "kind": "steads",
    "families": ["sunbound"]
   }
  ],
  "roads": ["Cisternhold Gate", "Saltglass Track", "Obelisk Crossing"],
  "name": "Sunscoured Wastes",
  "theme": "Dry ruins of a fallen empire half-buried in wind-cut sand.",
  "hubName": "Cisternhold",
  "hubText": "A cistern-fort with shade, water and wary guards.",
  "normals": [
   "z4_dune_juggernaut",
   "z4_sand_stalker",
   "z4_scarab_swarm",
   "z4_sun_cultist",
   "z4_sepulchre_guard",
   "z4_canal_healer",
   "z4_dust_jackal"
  ],
  "addPool": [
   "z4_dune_juggernaut",
   "z4_sand_stalker",
   "z4_dust_jackal"
  ],
  "elites": [
   "z4_kharun",
   "z4_nesret",
   "z4_tazem"
  ],
  "rares": [
   "z4_gilded_queen",
   "z4_pharan"
  ],
  "dungeon": {
   "name": "The Obelisk of Veth",
   "text": "A half-sunken temple-tower whose glowing sigils reawaken at dusk.",
   "trash": [
    "z4_obelisk_servant",
    "z4_sand_priest",
    "z4_sigil_hound",
    "z4_veth_acolyte"
   ],
   "boss": "z4_ammeset"
  },
  "quests": [
   "q_z4_the_thirsty_caravan",
   "q_z4_scarab_plague",
   "q_z4_whispers_in_the_glyphs",
   "q_z4_cistern_keeper_s_plea",
   "q_z4_relics_of_the_empire",
   "q_z4_sandstorm_hunters",
   "q_z4_the_unburied_champion",
   "q_z4_light_the_beacon",
   "q_z4_sun_priest_s_silence"
  ],
  "shrineLines": [
   "A cracked altar to the sun still radiates a faint warmth, though it has stood cold for centuries.",
   "A basin of clear water sits impossibly full amid the ruins, ringed with bronze offerings."
  ],
  "treasureLines": [
   "A sealed urn, half buried in sand, rattles with coins when you nudge it.",
   "A collapsed merchant's cart spills silk and silver beneath a toppled column."
  ],
  "junkNames": [
   "Broken Clay Tablet",
   "Sun-Bleached Bone",
   "Tarnished Bronze Pin"
  ]
 },
 {
  "id": "z5",
  "regions": [
   {
    "id": "z5_wilds",
    "name": "Rootwood Thicket",
    "kind": "wilds",
    "families": ["rootkin"]
   },
   {
    "id": "z5_road",
    "name": "Pilgrim's Gravelane",
    "kind": "road",
    "families": ["grave"]
   },
   {
    "id": "z5_haunt",
    "name": "Veilfall Glade",
    "kind": "haunt",
    "families": ["veil","grave"]
   },
   {
    "id": "z5_steads",
    "name": "Lanternfall Cottages",
    "kind": "steads",
    "families": ["veil","rootkin"]
   }
  ],
  "roads": ["Lanternfall Path", "Pilgrim's Stile", "Hollow Oak Road"],
  "name": "Mournwood",
  "theme": "A haunted forest of pale trees, drifting fog and restless spirits.",
  "hubName": "Lanternfall",
  "hubText": "A ring of lanterns that keeps the fog from the doors.",
  "normals": [
   "z5_hollow_oak",
   "z5_wraith_stalker",
   "z5_hex_widow",
   "z5_ghoul_hound",
   "z5_stone_penitent",
   "z5_lantern_keeper",
   "z5_thorn_wisp"
  ],
  "addPool": [
   "z5_hollow_oak",
   "z5_wraith_stalker",
   "z5_ghoul_hound"
  ],
  "elites": [
   "z5_varis",
   "z5_wenlith",
   "z5_grimmel"
  ],
  "rares": [
   "z5_pale_hunter",
   "z5_black_doe"
  ],
  "dungeon": {
   "name": "Dunmere Chapel",
   "text": "A fallen chapel where the dead gather for a service that never ends.",
   "trash": [
    "z5_chapel_bellringer",
    "z5_pallid_chorister",
    "z5_crypt_hound",
    "z5_mourning_nun"
   ],
   "boss": "z5_father_vael"
  },
  "quests": [
   "q_z5_lanterns_for_the_lost",
   "q_z5_the_weeping_statues",
   "q_z5_hollow_heart",
   "q_z5_bell_in_the_mist",
   "q_z5_hounds_of_the_graveyard",
   "q_z5_letters_to_the_grave",
   "q_z5_veil_cursed",
   "q_z5_the_pale_hunter",
   "q_z5_lord_varis_s_penance"
  ],
  "shrineLines": [
   "A hollow tree glows faintly from within, and whispered blessings drift from its roots.",
   "A circle of candles burns without wax or flame, ringing a pale stone."
  ],
  "treasureLines": [
   "A coffin half-risen from soft earth has a purse tied to the dead man's wrist.",
   "A rotting hunter's pack hangs in a tree, lashed shut with old cord."
  ],
  "junkNames": [
   "Cold Candle Stub",
   "Mouldy Prayer Book",
   "Rusted Grave Nail"
  ]
 },
 {
  "id": "z6",
  "regions": [
   {
    "id": "z6_wilds",
    "name": "Cinderscree Slopes",
    "kind": "wilds",
    "families": ["cinder"]
   },
   {
    "id": "z6_road",
    "name": "Ashmarch Switchback",
    "kind": "road",
    "families": ["cinder","forgeborn"]
   },
   {
    "id": "z6_haunt",
    "name": "Pyrecult Terraces",
    "kind": "haunt",
    "families": ["pyrecult"]
   },
   {
    "id": "z6_steads",
    "name": "Emberwatch Foundries",
    "kind": "steads",
    "families": ["forgeborn","pyrecult"]
   }
  ],
  "roads": ["Emberwatch Steps", "Slagfall Pass", "Ashen Stair"],
  "name": "Cindercrown Peaks",
  "theme": "Scorched volcanic mountains of ash, lava seams and ruined forts.",
  "hubName": "Emberwatch",
  "hubText": "A bastion of black stone at the edge of the ash road.",
  "normals": [
   "z6_slag_brute",
   "z6_ash_stalker",
   "z6_pyre_magus",
   "z6_cinder_wyrmling",
   "z6_obsidian_warden",
   "z6_forge_priest",
   "z6_magma_hound"
  ],
  "addPool": [
   "z6_slag_brute",
   "z6_ash_stalker",
   "z6_magma_hound"
  ],
  "elites": [
   "z6_skarn",
   "z6_kaelith",
   "z6_drathor"
  ],
  "rares": [
   "z6_ember_drake",
   "z6_stone_matron"
  ],
  "dungeon": {
   "name": "The Furnace of Karth",
   "text": "An abandoned dwarven-style forge-fortress, now the heart of a fire cult.",
   "trash": [
    "z6_furnace_stoker",
    "z6_cinder_acolyte",
    "z6_bellows_guard",
    "z6_slag_hound",
    "z6_ash_priest"
   ],
   "boss": "z6_karth"
  },
  "quests": [
   "q_z6_the_ash_road",
   "q_z6_hounds_of_fire",
   "q_z6_embers_of_the_old_forge",
   "q_z6_the_last_supply_wagon",
   "q_z6_the_obsidian_wardens",
   "q_z6_cult_of_the_furnace",
   "q_z6_pyre_magus",
   "q_z6_rescue_at_emberwatch",
   "q_z6_the_drake_s_roost"
  ],
  "shrineLines": [
   "A pool of molten glass cools in a perfect circle, gleaming with a strange inner light.",
   "A lone forge anvil stands in the ash, still warm, rune-etched with a smith's vow."
  ],
  "treasureLines": [
   "A dwarf-forged strongbox is wedged between two slabs of cooled lava.",
   "A dead soldier's satchel lies in the ash, singed but unopened."
  ],
  "junkNames": [
   "Cooled Slag Lump",
   "Scorched Boot Sole",
   "Cracked Obsidian Chip"
  ]
 }
];
