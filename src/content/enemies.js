// Content table: enemy templates per zone: normals, elites, rares, dungeon trash and bosses (rules.md 2, 12). Plain data only (Content Designer).
export const ENEMIES = {
 "z1_hedge_ogre": {
  "id": "z1_hedge_ogre",
  "name": "Hedge Ogre",
  "kind": "normal",
  "archetype": "brute",
  "hpMult": 1.1,
  "dmgMult": 0.95,
  "abilities": [],
  "text": "A stooped giant who tears fence posts from the earth and swings them like clubs."
 },
 "z1_furrow_boar": {
  "id": "z1_furrow_boar",
  "name": "Furrow Boar",
  "kind": "normal",
  "archetype": "beast",
  "hpMult": 1,
  "dmgMult": 1,
  "abilities": [],
  "text": "A tusked boar driven wild by the blight in the barley. It charges anything that moves."
 },
 "z1_barn_wolf": {
  "id": "z1_barn_wolf",
  "name": "Barn Wolf",
  "kind": "normal",
  "archetype": "beast",
  "hpMult": 0.9,
  "dmgMult": 1.1,
  "abilities": [],
  "text": "A lean grey wolf that has learned to open latches. It hunts in the hour before dawn."
 },
 "z1_hedgerow_cutpurse": {
  "id": "z1_hedgerow_cutpurse",
  "name": "Hedgerow Cutpurse",
  "kind": "normal",
  "archetype": "skulker",
  "hpMult": 1,
  "dmgMult": 1,
  "abilities": [],
  "text": "A road bandit who lurks in the briars and takes coin before the knife."
 },
 "z1_scarecrow_hexer": {
  "id": "z1_scarecrow_hexer",
  "name": "Scarecrow Hexer",
  "kind": "normal",
  "archetype": "caster",
  "hpMult": 0.95,
  "dmgMult": 1.1,
  "abilities": [],
  "text": "A straw figure animated by a stolen charm. Its crooked fingers throw sparks of blight."
 },
 "z1_stonewall_sentinel": {
  "id": "z1_stonewall_sentinel",
  "name": "Stonewall Sentinel",
  "kind": "normal",
  "archetype": "guardian",
  "hpMult": 1.1,
  "dmgMult": 0.9,
  "abilities": [],
  "text": "A boundary-stone given legs by an old warding. It guards fields no one tends any more."
 },
 "z1_bramble_herbalist": {
  "id": "z1_bramble_herbalist",
  "name": "Bramble Herbalist",
  "kind": "normal",
  "archetype": "mender",
  "hpMult": 1,
  "dmgMult": 1,
  "abilities": [],
  "text": "A hermit who binds wounds with thorn-sap. She fights for whoever last fed her."
 },
 "z1_gorrak": {
  "id": "z1_gorrak",
  "name": "Gorrak the Fieldbreaker",
  "kind": "elite",
  "archetype": "brute",
  "hpMult": 1.1,
  "dmgMult": 0.95,
  "abilities": [
   "ab_z1_gorrak_heavy_blow"
  ],
  "text": "Pillar-fisted ogre who claimed the Millbrook threshing floor as his throne."
 },
 "z1_marrow": {
  "id": "z1_marrow",
  "name": "Old Marrow the Hexer",
  "kind": "elite",
  "archetype": "caster",
  "hpMult": 1,
  "dmgMult": 1.05,
  "abilities": [
   "ab_z1_marrow_curse"
  ],
  "text": "A gaunt scarecrow-maker whose last straw man learned to curse its master."
 },
 "z1_thistlewick": {
  "id": "z1_thistlewick",
  "name": "Mother Thistlewick",
  "kind": "rare",
  "archetype": "mender",
  "hpMult": 1.05,
  "dmgMult": 1,
  "abilities": [
   "ab_z1_thistlewick_self_heal",
   "ab_z1_thistlewick_rend"
  ],
  "text": "An ancient herb-witch whose garden grows only at night."
 },
 "z1_cellar_rat_swarm": {
  "id": "z1_cellar_rat_swarm",
  "name": "Cellar Rat Swarm",
  "kind": "trash",
  "archetype": "beast",
  "hpMult": 1,
  "dmgMult": 1,
  "abilities": [],
  "text": "A shifting carpet of black rats gnawing at the old grain stores."
 },
 "z1_harrow_deserter": {
  "id": "z1_harrow_deserter",
  "name": "Harrow Deserter",
  "kind": "trash",
  "archetype": "skulker",
  "hpMult": 1,
  "dmgMult": 1,
  "abilities": [],
  "text": "A runaway soldier turned cellar thief, knives drawn."
 },
 "z1_rust_shackled_guard": {
  "id": "z1_rust_shackled_guard",
  "name": "Rust-Shackled Guard",
  "kind": "trash",
  "archetype": "guardian",
  "hpMult": 1.1,
  "dmgMult": 0.9,
  "abilities": [],
  "text": "A dead jailer still bound to the keys it never gave up."
 },
 "z1_candle_cultist": {
  "id": "z1_candle_cultist",
  "name": "Candle Cultist",
  "kind": "trash",
  "archetype": "caster",
  "hpMult": 0.95,
  "dmgMult": 1.1,
  "abilities": [],
  "text": "A robed zealot burning tallow to a hungry darkness."
 },
 "z1_belk": {
  "id": "z1_belk",
  "name": "Warden Belk of Harrow",
  "kind": "dboss",
  "archetype": "brute",
  "hpMult": 1.05,
  "dmgMult": 1.05,
  "abilities": [
   "ab_z1_belk_heavy_blow",
   "ab_z1_belk_rend"
  ],
  "text": "The manor reeve who bricked himself in with his stolen rents and never left."
 },
 "z2_mire_brute": {
  "id": "z2_mire_brute",
  "name": "Mire Brute",
  "kind": "normal",
  "archetype": "brute",
  "hpMult": 1.15,
  "dmgMult": 0.9,
  "abilities": [],
  "text": "A hulking swamp-dweller coated in peat. Its fists hit like dropped boulders."
 },
 "z2_reed_stalker": {
  "id": "z2_reed_stalker",
  "name": "Reed Stalker",
  "kind": "normal",
  "archetype": "skulker",
  "hpMult": 0.95,
  "dmgMult": 1.05,
  "abilities": [],
  "text": "A thin fen-hunter who moves unseen through the tall reeds."
 },
 "z2_bog_witch": {
  "id": "z2_bog_witch",
  "name": "Bog Witch",
  "kind": "normal",
  "archetype": "caster",
  "hpMult": 0.9,
  "dmgMult": 1.15,
  "abilities": [],
  "text": "A hag who brews fever-mist over her cauldron and flings it at travellers."
 },
 "z2_marsh_lurker": {
  "id": "z2_marsh_lurker",
  "name": "Marsh Lurker",
  "kind": "normal",
  "archetype": "beast",
  "hpMult": 1,
  "dmgMult": 1,
  "abilities": [],
  "text": "A gape-jawed amphibian that waits just below the waterline."
 },
 "z2_peat_sentinel": {
  "id": "z2_peat_sentinel",
  "name": "Peat Sentinel",
  "kind": "normal",
  "archetype": "guardian",
  "hpMult": 1.1,
  "dmgMult": 0.9,
  "abilities": [],
  "text": "A walking heap of sodden turf and old timber, slow but nearly unbreakable."
 },
 "z2_fen_healer": {
  "id": "z2_fen_healer",
  "name": "Fenmother Acolyte",
  "kind": "normal",
  "archetype": "mender",
  "hpMult": 1,
  "dmgMult": 1,
  "abilities": [],
  "text": "A priestess of the slow waters who knits wounds with silt and prayer."
 },
 "z2_mist_hound": {
  "id": "z2_mist_hound",
  "name": "Mistfang Hound",
  "kind": "normal",
  "archetype": "beast",
  "hpMult": 0.9,
  "dmgMult": 1.1,
  "abilities": [],
  "text": "A pale hound bred by smugglers, fast and silent in the fog."
 },
 "z2_bargh": {
  "id": "z2_bargh",
  "name": "Bargh the Drowned King",
  "kind": "elite",
  "archetype": "brute",
  "hpMult": 1.1,
  "dmgMult": 0.95,
  "abilities": [
   "ab_z2_bargh_heavy_blow"
  ],
  "text": "A chieftain dragged under years ago who returned wearing the marsh like a crown."
 },
 "z2_sisel": {
  "id": "z2_sisel",
  "name": "Sisel Mistweaver",
  "kind": "elite",
  "archetype": "caster",
  "hpMult": 0.95,
  "dmgMult": 1.1,
  "abilities": [
   "ab_z2_sisel_dark_cast"
  ],
  "text": "A fen-witch who stitches fog into a shroud around her enemies."
 },
 "z2_gloam_eel": {
  "id": "z2_gloam_eel",
  "name": "The Gloam Eel",
  "kind": "rare",
  "archetype": "beast",
  "hpMult": 1,
  "dmgMult": 1.05,
  "abilities": [
   "ab_z2_gloam_eel_rend",
   "ab_z2_gloam_eel_cleave_all"
  ],
  "text": "An enormous eel said to be older than the causeways."
 },
 "z2_weir_crawler": {
  "id": "z2_weir_crawler",
  "name": "Weir Crawler",
  "kind": "trash",
  "archetype": "beast",
  "hpMult": 1,
  "dmgMult": 1,
  "abilities": [],
  "text": "A pale cave-crab grown huge on the dam's drowned stores."
 },
 "z2_drowned_sentry": {
  "id": "z2_drowned_sentry",
  "name": "Drowned Sentry",
  "kind": "trash",
  "archetype": "guardian",
  "hpMult": 1.1,
  "dmgMult": 0.9,
  "abilities": [],
  "text": "A rotting gate-guard that still stands its watch under the water."
 },
 "z2_sluice_cutthroat": {
  "id": "z2_sluice_cutthroat",
  "name": "Sluice Cutthroat",
  "kind": "trash",
  "archetype": "skulker",
  "hpMult": 1,
  "dmgMult": 1,
  "abilities": [],
  "text": "A smuggler who works the underwater sluices with a hooked blade."
 },
 "z2_tidecaller_adept": {
  "id": "z2_tidecaller_adept",
  "name": "Tidecaller Adept",
  "kind": "trash",
  "archetype": "caster",
  "hpMult": 0.95,
  "dmgMult": 1.1,
  "abilities": [],
  "text": "A cultist who calls surges of cold brine against intruders."
 },
 "z2_mawgrim": {
  "id": "z2_mawgrim",
  "name": "Mawgrim of the Locks",
  "kind": "dboss",
  "archetype": "brute",
  "hpMult": 1.1,
  "dmgMult": 1,
  "abilities": [
   "ab_z2_mawgrim_heavy_blow",
   "ab_z2_mawgrim_self_heal"
  ],
  "text": "A bloated gatekeeper who opens the floodgates on those who owe him toll."
 },
 "z3_cairn_brute": {
  "id": "z3_cairn_brute",
  "name": "Cairn Brute",
  "kind": "normal",
  "archetype": "brute",
  "hpMult": 1.15,
  "dmgMult": 0.9,
  "abilities": [],
  "text": "A mountain-born giant who builds his lair from toppled burial stones."
 },
 "z3_crag_prowler": {
  "id": "z3_crag_prowler",
  "name": "Crag Prowler",
  "kind": "normal",
  "archetype": "beast",
  "hpMult": 1,
  "dmgMult": 1,
  "abilities": [],
  "text": "A tawny hill-cat that drops from ledges onto unwary riders."
 },
 "z3_reiver_scout": {
  "id": "z3_reiver_scout",
  "name": "Heath Reiver",
  "kind": "normal",
  "archetype": "skulker",
  "hpMult": 0.95,
  "dmgMult": 1.05,
  "abilities": [],
  "text": "A raider of the high moors who strikes from the heather and vanishes."
 },
 "z3_wind_shaman": {
  "id": "z3_wind_shaman",
  "name": "Wind Shaman",
  "kind": "normal",
  "archetype": "caster",
  "hpMult": 0.9,
  "dmgMult": 1.15,
  "abilities": [],
  "text": "A hill-priest who calls lightning on the exposed ridgelines."
 },
 "z3_standing_stone_guard": {
  "id": "z3_standing_stone_guard",
  "name": "Standing Stone Guardian",
  "kind": "normal",
  "archetype": "guardian",
  "hpMult": 1.15,
  "dmgMult": 0.9,
  "abilities": [],
  "text": "An ancient menhir given purpose by a forgotten oath."
 },
 "z3_hearth_priest": {
  "id": "z3_hearth_priest",
  "name": "Hearth-Priest",
  "kind": "normal",
  "archetype": "mender",
  "hpMult": 1,
  "dmgMult": 1,
  "abilities": [],
  "text": "A clan healer who tends his warband's wounds at a portable altar."
 },
 "z3_ridge_ram": {
  "id": "z3_ridge_ram",
  "name": "Ridge Ram",
  "kind": "normal",
  "archetype": "beast",
  "hpMult": 1.05,
  "dmgMult": 0.95,
  "abilities": [],
  "text": "A horned wild ram, rock-hard and fond of charging downhill."
 },
 "z3_hrothgar": {
  "id": "z3_hrothgar",
  "name": "Hrothgar Stonefist",
  "kind": "elite",
  "archetype": "brute",
  "hpMult": 1.15,
  "dmgMult": 0.9,
  "abilities": [
   "ab_z3_hrothgar_heavy_blow"
  ],
  "text": "A clan champion who swore never to retreat from the Reach."
 },
 "z3_urseth": {
  "id": "z3_urseth",
  "name": "Urseth the Stormcaller",
  "kind": "elite",
  "archetype": "caster",
  "hpMult": 0.95,
  "dmgMult": 1.1,
  "abilities": [
   "ab_z3_urseth_dark_cast"
  ],
  "text": "A shaman who bargained with the gales and lost his name to them."
 },
 "z3_mawra": {
  "id": "z3_mawra",
  "name": "Mawra Ironbrow",
  "kind": "elite",
  "archetype": "guardian",
  "hpMult": 1.1,
  "dmgMult": 0.95,
  "abilities": [
   "ab_z3_mawra_self_shield"
  ],
  "text": "The grim matriarch of a steading that no one has ever breached."
 },
 "z3_grey_stag": {
  "id": "z3_grey_stag",
  "name": "The Grey Stag",
  "kind": "rare",
  "archetype": "beast",
  "hpMult": 1.05,
  "dmgMult": 1,
  "abilities": [
   "ab_z3_grey_stag_cleave_all",
   "ab_z3_grey_stag_heavy_blow"
  ],
  "text": "A great antlered stag worshipped by the old clans."
 },
 "z3_barrow_wight": {
  "id": "z3_barrow_wight",
  "name": "Barrow Wight",
  "kind": "trash",
  "archetype": "skulker",
  "hpMult": 0.95,
  "dmgMult": 1.05,
  "abilities": [],
  "text": "A restless raider still guarding his master's treasure."
 },
 "z3_bone_thane": {
  "id": "z3_bone_thane",
  "name": "Bone Thane",
  "kind": "trash",
  "archetype": "guardian",
  "hpMult": 1.1,
  "dmgMult": 0.9,
  "abilities": [],
  "text": "A skeletal retainer in rusted mail, loyal past death."
 },
 "z3_grave_skald": {
  "id": "z3_grave_skald",
  "name": "Grave Skald",
  "kind": "trash",
  "archetype": "caster",
  "hpMult": 0.95,
  "dmgMult": 1.1,
  "abilities": [],
  "text": "A dead poet whose elegies wither the living."
 },
 "z3_cairn_hound": {
  "id": "z3_cairn_hound",
  "name": "Cairn Hound",
  "kind": "trash",
  "archetype": "beast",
  "hpMult": 1,
  "dmgMult": 1,
  "abilities": [],
  "text": "A spectral wolfhound that guards the tomb entrance."
 },
 "z3_tomb_priest": {
  "id": "z3_tomb_priest",
  "name": "Tomb Priest",
  "kind": "trash",
  "archetype": "mender",
  "hpMult": 1,
  "dmgMult": 1,
  "abilities": [],
  "text": "An embalmer-priest who stitches fallen warriors back to their feet."
 },
 "z3_king_aldrec": {
  "id": "z3_king_aldrec",
  "name": "Aldrec Barrow-King",
  "kind": "dboss",
  "archetype": "brute",
  "hpMult": 1.1,
  "dmgMult": 1,
  "abilities": [
   "ab_z3_king_aldrec_heavy_blow",
   "ab_z3_king_aldrec_cleave_all"
  ],
  "text": "The last king of the Reach, buried with his hall and unwilling to rest."
 },
 "z4_dune_juggernaut": {
  "id": "z4_dune_juggernaut",
  "name": "Ruin Juggernaut",
  "kind": "normal",
  "archetype": "brute",
  "hpMult": 1.15,
  "dmgMult": 0.9,
  "abilities": [],
  "text": "A clay colossus, cracked and sand-filled, still carrying out its last order."
 },
 "z4_sand_stalker": {
  "id": "z4_sand_stalker",
  "name": "Sand Stalker",
  "kind": "normal",
  "archetype": "skulker",
  "hpMult": 0.95,
  "dmgMult": 1.05,
  "abilities": [],
  "text": "A burrowing hunter that erupts from the dune beneath its prey."
 },
 "z4_scarab_swarm": {
  "id": "z4_scarab_swarm",
  "name": "Gilded Scarab",
  "kind": "normal",
  "archetype": "beast",
  "hpMult": 0.9,
  "dmgMult": 1.15,
  "abilities": [],
  "text": "A palm-sized beetle with a golden shell, swarming over any intruder."
 },
 "z4_sun_cultist": {
  "id": "z4_sun_cultist",
  "name": "Sunscribe Adept",
  "kind": "normal",
  "archetype": "caster",
  "hpMult": 0.9,
  "dmgMult": 1.15,
  "abilities": [],
  "text": "A priest of the dead empire whose scorching glyphs blister the air."
 },
 "z4_sepulchre_guard": {
  "id": "z4_sepulchre_guard",
  "name": "Sepulchre Guardian",
  "kind": "normal",
  "archetype": "guardian",
  "hpMult": 1.15,
  "dmgMult": 0.9,
  "abilities": [],
  "text": "An armoured statue sealed to a doorway long ago. It has never left its post."
 },
 "z4_canal_healer": {
  "id": "z4_canal_healer",
  "name": "Cistern Keeper",
  "kind": "normal",
  "archetype": "mender",
  "hpMult": 1,
  "dmgMult": 1,
  "abilities": [],
  "text": "A robed warden who draws water from hidden wells to mend the wounded."
 },
 "z4_dust_jackal": {
  "id": "z4_dust_jackal",
  "name": "Dust Jackal",
  "kind": "normal",
  "archetype": "beast",
  "hpMult": 1,
  "dmgMult": 1,
  "abilities": [],
  "text": "A rangy desert scavenger that circles ruins in packs."
 },
 "z4_kharun": {
  "id": "z4_kharun",
  "name": "Kharun the Unburied",
  "kind": "elite",
  "archetype": "brute",
  "hpMult": 1.15,
  "dmgMult": 0.9,
  "abilities": [
   "ab_z4_kharun_heavy_blow"
  ],
  "text": "An imperial champion whose tomb was never sealed."
 },
 "z4_nesret": {
  "id": "z4_nesret",
  "name": "Nesret Sunscribe",
  "kind": "elite",
  "archetype": "caster",
  "hpMult": 0.95,
  "dmgMult": 1.1,
  "abilities": [
   "ab_z4_nesret_dark_cast"
  ],
  "text": "A high priestess whose scorching hymns have outlived her empire."
 },
 "z4_tazem": {
  "id": "z4_tazem",
  "name": "Tazem Sandwraith",
  "kind": "elite",
  "archetype": "skulker",
  "hpMult": 0.95,
  "dmgMult": 1.1,
  "abilities": [
   "ab_z4_tazem_rend"
  ],
  "text": "A desert assassin who dissolves into dust between strikes."
 },
 "z4_gilded_queen": {
  "id": "z4_gilded_queen",
  "name": "The Gilded Queen",
  "kind": "rare",
  "archetype": "beast",
  "hpMult": 1.05,
  "dmgMult": 1,
  "abilities": [
   "ab_z4_gilded_queen_cleave_all",
   "ab_z4_gilded_queen_summon"
  ],
  "text": "A beetle-matriarch the size of a wagon, plated in stolen gold."
 },
 "z4_pharan": {
  "id": "z4_pharan",
  "name": "Pharan the Sleepless",
  "kind": "rare",
  "archetype": "guardian",
  "hpMult": 1.1,
  "dmgMult": 0.95,
  "abilities": [
   "ab_z4_pharan_self_shield",
   "ab_z4_pharan_heavy_blow"
  ],
  "text": "A guardian who guards a tomb that no longer exists."
 },
 "z4_obelisk_servant": {
  "id": "z4_obelisk_servant",
  "name": "Obelisk Servant",
  "kind": "trash",
  "archetype": "guardian",
  "hpMult": 1.1,
  "dmgMult": 0.9,
  "abilities": [],
  "text": "A stone attendant that rises when a sigil is trodden on."
 },
 "z4_sand_priest": {
  "id": "z4_sand_priest",
  "name": "Sand Priest",
  "kind": "trash",
  "archetype": "mender",
  "hpMult": 1,
  "dmgMult": 1,
  "abilities": [],
  "text": "A shrivelled priest who tends the sacred fires within."
 },
 "z4_sigil_hound": {
  "id": "z4_sigil_hound",
  "name": "Sigil Hound",
  "kind": "trash",
  "archetype": "beast",
  "hpMult": 1,
  "dmgMult": 1,
  "abilities": [],
  "text": "A bronze hound animated by temple magic."
 },
 "z4_veth_acolyte": {
  "id": "z4_veth_acolyte",
  "name": "Veth Acolyte",
  "kind": "trash",
  "archetype": "caster",
  "hpMult": 0.95,
  "dmgMult": 1.1,
  "abilities": [],
  "text": "A blind scribe-priest reading glyphs of fire."
 },
 "z4_ammeset": {
  "id": "z4_ammeset",
  "name": "Ammeset, Voice of Veth",
  "kind": "dboss",
  "archetype": "caster",
  "hpMult": 0.95,
  "dmgMult": 1.1,
  "abilities": [
   "ab_z4_ammeset_dark_cast",
   "ab_z4_ammeset_self_heal"
  ],
  "text": "The final high priestess, bound to the obelisk by her own prophecy."
 },
 "z5_hollow_oak": {
  "id": "z5_hollow_oak",
  "name": "Hollow Oak",
  "kind": "normal",
  "archetype": "brute",
  "hpMult": 1.15,
  "dmgMult": 0.9,
  "abilities": [],
  "text": "A walking oak, hollow within and filled with whispers."
 },
 "z5_wraith_stalker": {
  "id": "z5_wraith_stalker",
  "name": "Fogwraith",
  "kind": "normal",
  "archetype": "skulker",
  "hpMult": 0.95,
  "dmgMult": 1.05,
  "abilities": [],
  "text": "A hungry spirit that slips from the mist to feed."
 },
 "z5_hex_widow": {
  "id": "z5_hex_widow",
  "name": "Hex Widow",
  "kind": "normal",
  "archetype": "caster",
  "hpMult": 0.9,
  "dmgMult": 1.15,
  "abilities": [],
  "text": "A ghostly bride whose cursed lace leaves lingering sickness."
 },
 "z5_ghoul_hound": {
  "id": "z5_ghoul_hound",
  "name": "Grave Hound",
  "kind": "normal",
  "archetype": "beast",
  "hpMult": 1,
  "dmgMult": 1,
  "abilities": [],
  "text": "A bone-chewing hound from the old churchyard, always hungry."
 },
 "z5_stone_penitent": {
  "id": "z5_stone_penitent",
  "name": "Stone Penitent",
  "kind": "normal",
  "archetype": "guardian",
  "hpMult": 1.15,
  "dmgMult": 0.9,
  "abilities": [],
  "text": "A weeping statue that moves only when unobserved."
 },
 "z5_lantern_keeper": {
  "id": "z5_lantern_keeper",
  "name": "Lantern Keeper",
  "kind": "normal",
  "archetype": "mender",
  "hpMult": 1,
  "dmgMult": 1,
  "abilities": [],
  "text": "A spectral caretaker whose pale lantern knits flesh and shade."
 },
 "z5_thorn_wisp": {
  "id": "z5_thorn_wisp",
  "name": "Thorn Wisp",
  "kind": "normal",
  "archetype": "caster",
  "hpMult": 0.85,
  "dmgMult": 1.15,
  "abilities": [],
  "text": "A cold light that leads the lost to their ruin, then burns them."
 },
 "z5_varis": {
  "id": "z5_varis",
  "name": "Lord Varis Dunmere",
  "kind": "elite",
  "archetype": "brute",
  "hpMult": 1.1,
  "dmgMult": 0.95,
  "abilities": [
   "ab_z5_varis_heavy_blow"
  ],
  "text": "A ghost knight bound to guard a manor that burned down centuries ago."
 },
 "z5_morrigan": {
  "id": "z5_morrigan",
  "name": "Morrigan of the Veil",
  "kind": "elite",
  "archetype": "caster",
  "hpMult": 0.95,
  "dmgMult": 1.1,
  "abilities": [
   "ab_z5_morrigan_dark_cast"
  ],
  "text": "A banshee whose wail strips colour from the forest."
 },
 "z5_grimmel": {
  "id": "z5_grimmel",
  "name": "Grimmel Rootbound",
  "kind": "elite",
  "archetype": "guardian",
  "hpMult": 1.1,
  "dmgMult": 0.95,
  "abilities": [
   "ab_z5_grimmel_self_shield"
  ],
  "text": "An ancient treant half-consumed by a spectral blight."
 },
 "z5_pale_hunter": {
  "id": "z5_pale_hunter",
  "name": "The Pale Hunter",
  "kind": "rare",
  "archetype": "skulker",
  "hpMult": 0.95,
  "dmgMult": 1.1,
  "abilities": [
   "ab_z5_pale_hunter_rend",
   "ab_z5_pale_hunter_dark_cast"
  ],
  "text": "A spectral huntsman who tracks the living through the trees."
 },
 "z5_black_doe": {
  "id": "z5_black_doe",
  "name": "The Black Doe",
  "kind": "rare",
  "archetype": "beast",
  "hpMult": 1.05,
  "dmgMult": 1,
  "abilities": [
   "ab_z5_black_doe_heavy_blow",
   "ab_z5_black_doe_self_heal"
  ],
  "text": "A shadow-coated deer whose antlers weep dark sap."
 },
 "z5_chapel_bellringer": {
  "id": "z5_chapel_bellringer",
  "name": "Chapel Bellringer",
  "kind": "trash",
  "archetype": "brute",
  "hpMult": 1.1,
  "dmgMult": 0.95,
  "abilities": [],
  "text": "A massive undead who tolls the bell and the dead rise."
 },
 "z5_pallid_chorister": {
  "id": "z5_pallid_chorister",
  "name": "Pallid Chorister",
  "kind": "trash",
  "archetype": "caster",
  "hpMult": 0.9,
  "dmgMult": 1.15,
  "abilities": [],
  "text": "A hymn-singer whose song withers the living."
 },
 "z5_crypt_hound": {
  "id": "z5_crypt_hound",
  "name": "Crypt Hound",
  "kind": "trash",
  "archetype": "beast",
  "hpMult": 1,
  "dmgMult": 1,
  "abilities": [],
  "text": "A ghostly hound guarding the family vaults."
 },
 "z5_mourning_nun": {
  "id": "z5_mourning_nun",
  "name": "Mourning Nun",
  "kind": "trash",
  "archetype": "mender",
  "hpMult": 1,
  "dmgMult": 1,
  "abilities": [],
  "text": "A weeping sister who tends the fallen in the pews."
 },
 "z5_father_vael": {
  "id": "z5_father_vael",
  "name": "Father Vael the Unfaithful",
  "kind": "dboss",
  "archetype": "caster",
  "hpMult": 1,
  "dmgMult": 1.1,
  "abilities": [
   "ab_z5_father_vael_dark_cast",
   "ab_z5_father_vael_curse"
  ],
  "text": "The last priest of Dunmere, who sold his flock to the dark."
 },
 "z6_slag_brute": {
  "id": "z6_slag_brute",
  "name": "Slag Brute",
  "kind": "normal",
  "archetype": "brute",
  "hpMult": 1.15,
  "dmgMult": 0.9,
  "abilities": [],
  "text": "A hulking creature of cooling lava and black iron."
 },
 "z6_ash_stalker": {
  "id": "z6_ash_stalker",
  "name": "Ash Stalker",
  "kind": "normal",
  "archetype": "skulker",
  "hpMult": 0.95,
  "dmgMult": 1.05,
  "abilities": [],
  "text": "A soot-grey hunter that moves unseen through the smoke."
 },
 "z6_pyre_magus": {
  "id": "z6_pyre_magus",
  "name": "Pyre Magus",
  "kind": "normal",
  "archetype": "caster",
  "hpMult": 0.9,
  "dmgMult": 1.15,
  "abilities": [],
  "text": "A mage who sold himself to the mountain for fire."
 },
 "z6_cinder_wyrmling": {
  "id": "z6_cinder_wyrmling",
  "name": "Cinder Wyrmling",
  "kind": "normal",
  "archetype": "beast",
  "hpMult": 1,
  "dmgMult": 1,
  "abilities": [],
  "text": "A young fire-drake, too small to fly but dangerous in a pack."
 },
 "z6_obsidian_warden": {
  "id": "z6_obsidian_warden",
  "name": "Obsidian Warden",
  "kind": "normal",
  "archetype": "guardian",
  "hpMult": 1.15,
  "dmgMult": 0.9,
  "abilities": [],
  "text": "A glassy sentinel forged in the volcano's first eruption."
 },
 "z6_forge_priest": {
  "id": "z6_forge_priest",
  "name": "Forge Priest",
  "kind": "normal",
  "archetype": "mender",
  "hpMult": 1,
  "dmgMult": 1,
  "abilities": [],
  "text": "A cultist who tends the mountain's sacred fires and mends allies in flame."
 },
 "z6_magma_hound": {
  "id": "z6_magma_hound",
  "name": "Magma Hound",
  "kind": "normal",
  "archetype": "beast",
  "hpMult": 0.9,
  "dmgMult": 1.15,
  "abilities": [],
  "text": "A snarling hound whose fur smoulders and whose bite sears."
 },
 "z6_skarn": {
  "id": "z6_skarn",
  "name": "Skarn the Flamebound",
  "kind": "elite",
  "archetype": "brute",
  "hpMult": 1.15,
  "dmgMult": 0.9,
  "abilities": [
   "ab_z6_skarn_heavy_blow"
  ],
  "text": "A chieftain wedded to the volcano, his armour fused to his flesh."
 },
 "z6_kaelith": {
  "id": "z6_kaelith",
  "name": "Kaelith Pyreweaver",
  "kind": "elite",
  "archetype": "caster",
  "hpMult": 0.95,
  "dmgMult": 1.1,
  "abilities": [
   "ab_z6_kaelith_dark_cast"
  ],
  "text": "A fire-mage who weaves lava into living spears."
 },
 "z6_drathor": {
  "id": "z6_drathor",
  "name": "Drathor Ashmantle",
  "kind": "elite",
  "archetype": "skulker",
  "hpMult": 0.95,
  "dmgMult": 1.1,
  "abilities": [
   "ab_z6_drathor_rend"
  ],
  "text": "A scorched assassin whose blades are quenched in lava."
 },
 "z6_ember_drake": {
  "id": "z6_ember_drake",
  "name": "Emberhorn the Drake",
  "kind": "rare",
  "archetype": "beast",
  "hpMult": 1.05,
  "dmgMult": 1,
  "abilities": [
   "ab_z6_ember_drake_cleave_all",
   "ab_z6_ember_drake_dark_cast"
  ],
  "text": "A full-grown fire-drake, last of its brood."
 },
 "z6_stone_matron": {
  "id": "z6_stone_matron",
  "name": "The Obsidian Matron",
  "kind": "rare",
  "archetype": "guardian",
  "hpMult": 1.1,
  "dmgMult": 0.95,
  "abilities": [
   "ab_z6_stone_matron_self_shield",
   "ab_z6_stone_matron_heavy_blow"
  ],
  "text": "An ancient warden whose glass hide reflects blade and spell alike."
 },
 "z6_furnace_stoker": {
  "id": "z6_furnace_stoker",
  "name": "Furnace Stoker",
  "kind": "trash",
  "archetype": "brute",
  "hpMult": 1.1,
  "dmgMult": 0.95,
  "abilities": [],
  "text": "A sweating hulk who feeds the great fires with whatever is nearest."
 },
 "z6_cinder_acolyte": {
  "id": "z6_cinder_acolyte",
  "name": "Cinder Acolyte",
  "kind": "trash",
  "archetype": "caster",
  "hpMult": 0.9,
  "dmgMult": 1.15,
  "abilities": [],
  "text": "A cultist chanting to the flames, hands blistering."
 },
 "z6_bellows_guard": {
  "id": "z6_bellows_guard",
  "name": "Bellows Guardian",
  "kind": "trash",
  "archetype": "guardian",
  "hpMult": 1.15,
  "dmgMult": 0.9,
  "abilities": [],
  "text": "An iron automaton that pumps the forge with relentless rhythm."
 },
 "z6_slag_hound": {
  "id": "z6_slag_hound",
  "name": "Slag Hound",
  "kind": "trash",
  "archetype": "beast",
  "hpMult": 1,
  "dmgMult": 1,
  "abilities": [],
  "text": "A cinder-coated hound that hunts in the forge corridors."
 },
 "z6_ash_priest": {
  "id": "z6_ash_priest",
  "name": "Ash Priest",
  "kind": "trash",
  "archetype": "mender",
  "hpMult": 1,
  "dmgMult": 1,
  "abilities": [],
  "text": "A ministrant who keeps the cult's wounded burning."
 },
 "z6_karth": {
  "id": "z6_karth",
  "name": "Karth, Heart of the Furnace",
  "kind": "dboss",
  "archetype": "brute",
  "hpMult": 1.1,
  "dmgMult": 1,
  "abilities": [
   "ab_z6_karth_heavy_blow",
   "ab_z6_karth_cleave_all"
  ],
  "text": "A colossus of molten iron, fuelled by the forge it guards."
 }
};
