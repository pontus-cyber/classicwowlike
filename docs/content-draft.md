# Content draft (M1 1.4)

Plain-table draft of all content tables. Source for the conversion into src/content/*.js once SCHEMA.md exists. Ability tuples: id, display name, value, cooldown, bleed tick. Values are fractions of the base hit (rules 12.4). Elites carry exactly 1 ability, rares 2, dungeon bosses 2.

## Z1: Amberfold Downs (levels 1-10)

Theme: Farmland giving way to the forest edge, where old boundary stones keep failing.
Hub: Millbrook Rest

### Normal enemies

| id | name | archetype | hp | dmg | description |
|---|---|---|---|---|---|
| hedge_ogre | Hedge Ogre | brute | 1.1 | 0.95 | A stooped giant who tears fence posts from the earth and swings them like clubs. |
| furrow_boar | Furrow Boar | beast | 1 | 1 | A tusked boar driven wild by the blight in the barley. It charges anything that moves. |
| barn_wolf | Barn Wolf | beast | 0.9 | 1.1 | A lean grey wolf that has learned to open latches. It hunts in the hour before dawn. |
| hedgerow_cutpurse | Hedgerow Cutpurse | skulker | 1 | 1 | A road bandit who lurks in the briars and takes coin before the knife. |
| scarecrow_hexer | Scarecrow Hexer | caster | 0.95 | 1.1 | A straw figure animated by a stolen charm. Its crooked fingers throw sparks of blight. |
| stonewall_sentinel | Stonewall Sentinel | guardian | 1.1 | 0.9 | A boundary-stone given legs by an old warding. It guards fields no one tends any more. |
| bramble_herbalist | Bramble Herbalist | mender | 1 | 1 | A hermit who binds wounds with thorn-sap. She fights for whoever last fed her. |

### Elites

| id | name | archetype | hp | dmg | ability | description |
|---|---|---|---|---|---|---|
| gorrak | Gorrak the Fieldbreaker | brute | 1.1 | 0.95 | Threshing Blow (heavy_blow 1.9, CD 3) | Pillar-fisted ogre who claimed the Millbrook threshing floor as his throne. |
| marrow | Old Marrow the Hexer | caster | 1 | 1.05 | Rot-in-the-Seed (curse 0, CD 4) | A gaunt scarecrow-maker whose last straw man learned to curse its master. |

### Rares

| id | name | archetype | hp | dmg | abilities | description |
|---|---|---|---|---|---|---|
| thistlewick | Mother Thistlewick | mender | 1.05 | 1 | Nightbloom Poultice (self_heal 0.18, CD 5); Thorn Lash (rend 0.65/tick 0.2, CD 3) | An ancient herb-witch whose garden grows only at night. |

### Dungeon: The Harrow Cellars

Sunken storerooms under a burned manor, now home to bandits and worse.

Trash:

| id | name | archetype | hp | dmg | description |
|---|---|---|---|---|---|
| cellar_rat_swarm | Cellar Rat Swarm | beast | 1 | 1 | A shifting carpet of black rats gnawing at the old grain stores. |
| harrow_deserter | Harrow Deserter | skulker | 1 | 1 | A runaway soldier turned cellar thief, knives drawn. |
| rust_shackled_guard | Rust-Shackled Guard | guardian | 1.1 | 0.9 | A dead jailer still bound to the keys it never gave up. |
| candle_cultist | Candle Cultist | caster | 0.95 | 1.1 | A robed zealot burning tallow to a hungry darkness. |

Boss:

| id | name | archetype | hp | dmg | abilities | description |
|---|---|---|---|---|---|---|
| belk | Warden Belk of Harrow | brute | 1.05 | 1.05 | Ledger-Breaker (heavy_blow 2, CD 3); Call the Tenants (summon 1, CD 0) | The manor reeve who bricked himself in with his stolen rents and never left. |

### Quests

| title | giver | objective | text | turn-in | size weights 1/2/3 |
|---|---|---|---|---|---|
| Blight in the Barley | Farmer Osric Dunne | slay | The boars have trampled my north field flat. Cull them before they ruin the harvest. | Good. The barley may yet stand next year. | 4/4/2 |
| Lost Lambs | Maud Thatcher | rescue | Three lambs strayed into the wood and the wolves are circling. Find them and drive the pack off. | You found them! I will light a candle for you tonight. | 3/4/3 |
| Hedge and Thorn | Wardkeeper Ilsa | slay | Cutpurses have taken to the hedgerows along the Millbrook road. Clear them out. | The road is quiet again. Take your fee. | 2/4/4 |
| Flour for the Crossing | Miller Teodor | deliver | Carry this sack of flour to the guard post by the old bridge. Mind the wolves on the way. | Fresh bread tonight, thanks to you. | 5/4/1 |
| What the Scarecrow Saw | Elder Wynne | scout | Strange lights move among the straw men at night. Go see what stirs them. | So the charm is stolen. That is worse than I feared. | 3/4/3 |
| Pillars of the Field | Wardkeeper Ilsa | gather | The boundary stones are cracking. Gather shards from the stone sentinels to be reset. | These shards will mend the old wards. | 2/4/4 |
| A Hermit's Debt | Brother Alden | rescue | An old herbalist in the briars owes me a favour and will not answer. See that she is well. | She lives, though changed. I am in your debt. | 4/4/2 |
| The Ogre of the Threshing Floor | Reeve Hollis | slay | An ogre has seized the village threshing floor and the grain with it. Drive him out. | The floor is ours again. Well fought. | 1/4/5 |
| Ashes on the Wind | Captain Brae | scout | Smoke rises from the old Harrow manor. Learn who lights fires among the ruins. | Cultists in the cellars. We must act at once. | 3/4/3 |

### Shrine lines

- A mossy boundary stone hums softly, warm under your hand, as though a ward still sleeps within it.
- Ribbons and wheat sheaves cover a roadside altar, tied there by farmers praying for a good year.

### Treasure lines

- A farmer's strongbox lies half-buried beneath a collapsed haystack, its lock long rusted.
- Behind a loose hearthstone in a burned cottage, a pouch of coins waits for whoever looks.

### Item base names

| slot | names |
|---|---|
| Head | Hempen Hood / Farmhand's Cap / Boarhide Helm |
| Chest | Linen Jerkin / Tanner's Coat / Tenant's Vest |
| Legs | Field Leggings / Wool Breeches / Hedge-Walker Trousers |
| Hands | Work Gloves / Reaper's Mitts / Thornproof Gauntlets |
| Feet | Muddy Boots / Furrow Treads / Millroad Shoes |
| Neck | Seed-Bead Necklace / Cord of Wheat / Boundary Charm |
| Ring | Copper Tally Ring / Twisted Straw Band / Brass Sowing Ring |
| Trinket | Lucky Barleycorn / Scarecrow Button / Millstone Chip |
| Weapon | Harvest Knife / Hazel Wand / Yew Shortbow (rogue / mage / hunter) |
| Off-hand | Wooden Buckler / Lantern Orb / Quiver of Rushes |

## Z2: Greywater Fens (levels 11-20)

Theme: Drowned wetlands of reed, mist and rotting causeways.
Hub: Stilt Haven

### Normal enemies

| id | name | archetype | hp | dmg | description |
|---|---|---|---|---|---|
| mire_brute | Mire Brute | brute | 1.15 | 0.9 | A hulking swamp-dweller coated in peat. Its fists hit like dropped boulders. |
| reed_stalker | Reed Stalker | skulker | 0.95 | 1.05 | A thin fen-hunter who moves unseen through the tall reeds. |
| bog_witch | Bog Witch | caster | 0.9 | 1.15 | A hag who brews fever-mist over her cauldron and flings it at travellers. |
| marsh_lurker | Marsh Lurker | beast | 1 | 1 | A gape-jawed amphibian that waits just below the waterline. |
| peat_sentinel | Peat Sentinel | guardian | 1.1 | 0.9 | A walking heap of sodden turf and old timber, slow but nearly unbreakable. |
| fen_healer | Fenmother Acolyte | mender | 1 | 1 | A priestess of the slow waters who knits wounds with silt and prayer. |
| mist_hound | Mistfang Hound | beast | 0.9 | 1.1 | A pale hound bred by smugglers, fast and silent in the fog. |

### Elites

| id | name | archetype | hp | dmg | ability | description |
|---|---|---|---|---|---|---|
| bargh | Bargh the Drowned King | brute | 1.1 | 0.95 | Tidefall Slam (heavy_blow 1.8, CD 3) | A chieftain dragged under years ago who returned wearing the marsh like a crown. |
| sisel | Sisel Mistweaver | caster | 0.95 | 1.1 | Choking Mist (dark_cast 2.1, CD 4) | A fen-witch who stitches fog into a shroud around her enemies. |

### Rares

| id | name | archetype | hp | dmg | abilities | description |
|---|---|---|---|---|---|---|
| gloam_eel | The Gloam Eel | beast | 1 | 1.05 | Venom Fangs (rend 0.7/tick 0.2, CD 3); Thrashing Coils (cleave_all 0.85, CD 3) | An enormous eel said to be older than the causeways. |

### Dungeon: The Sunken Weir

A flooded dam-keep where the water rises one step each day.

Trash:

| id | name | archetype | hp | dmg | description |
|---|---|---|---|---|---|
| weir_crawler | Weir Crawler | beast | 1 | 1 | A pale cave-crab grown huge on the dam's drowned stores. |
| drowned_sentry | Drowned Sentry | guardian | 1.1 | 0.9 | A rotting gate-guard that still stands its watch under the water. |
| sluice_cutthroat | Sluice Cutthroat | skulker | 1 | 1 | A smuggler who works the underwater sluices with a hooked blade. |
| tidecaller_adept | Tidecaller Adept | caster | 0.95 | 1.1 | A cultist who calls surges of cold brine against intruders. |

Boss:

| id | name | archetype | hp | dmg | abilities | description |
|---|---|---|---|---|---|---|
| mawgrim | Mawgrim of the Locks | brute | 1.1 | 1 | Flood Hammer (heavy_blow 2, CD 4); Draw the Tide (self_heal 0.18, CD 5) | A bloated gatekeeper who opens the floodgates on those who owe him toll. |

### Quests

| title | giver | objective | text | turn-in | size weights 1/2/3 |
|---|---|---|---|---|---|
| Fever on the Water | Healer Maren | gather | The fen fever spreads. Bring me sap from the stalks guarded by the bog witches. | Brewed and ready. The sick will thank you. | 3/4/3 |
| Stilts and Snares | Harbourwarden Pell | slay | Mist hounds are snatching the catch from our drying racks. Thin their packs. | The racks hold fish again. | 2/4/4 |
| The Lost Causeway | Surveyor Ansel | scout | The old causeway has sunk out of sight. Walk the margins and mark where the stones remain. | This map saves lives. Thank you. | 4/4/2 |
| Salt for the Smokehouse | Ketil Reedman | deliver | Bring this salt crate across the fen to the smokehouse. The lurkers hunt the shallows. | Not a grain wet. You have my thanks. | 5/4/1 |
| A Witch's Bargain | Old Sedge | slay | The bog witches poison the wells to sell the cure. End their trade for good. | The wells run clear. At last. | 1/4/5 |
| Fenmother's Request | Priestess Lorn | rescue | Two of our acolytes are missing past the black pool. Bring them home, if they live. | They are safe. The waters bless you. | 3/4/3 |
| Gloam Eel Tales | Fisher Dagny | slay | A giant eel has taken three boats this season. Hunt it down in the dark channel. | A thing like that should not be swimming. Well done. | 3/4/3 |
| Rot Beneath the Planks | Harbourwarden Pell | slay | Peat guardians wake near the stilt walkways and crack our footings. Break them apart. | The footings hold. We owe you. | 4/4/2 |
| The Weir Keeps Rising | Surveyor Ansel | scout | Something works the floodgates of the old weir at night. Look into the dam-keep and report. | So the weir is held. Then we must act. | 2/4/4 |

### Shrine lines

- A shrine of knotted reeds floats on a still pool, glowing with a dim green light.
- A sunken bell chimes beneath the mist, though no wind moves it.

### Treasure lines

- A smuggler's oilcloth bundle is wedged in the roots of a drowned willow.
- A tilted pole holds a lockbox just above the waterline, left by a fisher who never returned.

### Item base names

| slot | names |
|---|---|
| Head | Reedweave Cap / Fenwarden's Cowl / Eelskin Hood |
| Chest | Waxed Fen Coat / Peatstained Jerkin / Marshwalker Tunic |
| Legs | Waders / Reedcloth Leggings / Bogtrotter Breeches |
| Hands | Net-Mender Gloves / Silt-Stained Mitts / Eelhide Grips |
| Feet | Stilt Boots / Marsh Treads / Reedsoles |
| Neck | Pearl Drop Pendant / Lantern-Fly Charm / Bog-Oak Amulet |
| Ring | Mist Signet / Tarnished Fen Band / Brineglass Ring |
| Trinket | Sunken Bell Clapper / Glow-Moss Vial / Heron Feather Charm |
| Weapon | Gutting Hook / Bog-Oak Staff / Reedwood Longbow (rogue / mage / hunter) |
| Off-hand | Driftwood Shield / Witchlight Orb / Smuggler's Quiver |

## Z3: Highcairn Reach (levels 21-30)

Theme: Windswept highlands of stone cairns, heather and fortified steadings.
Hub: Windbarrow Hold

### Normal enemies

| id | name | archetype | hp | dmg | description |
|---|---|---|---|---|---|
| cairn_brute | Cairn Brute | brute | 1.15 | 0.9 | A mountain-born giant who builds his lair from toppled burial stones. |
| crag_prowler | Crag Prowler | beast | 1 | 1 | A tawny hill-cat that drops from ledges onto unwary riders. |
| reiver_scout | Heath Reiver | skulker | 0.95 | 1.05 | A raider of the high moors who strikes from the heather and vanishes. |
| wind_shaman | Wind Shaman | caster | 0.9 | 1.15 | A hill-priest who calls lightning on the exposed ridgelines. |
| standing_stone_guard | Standing Stone Guardian | guardian | 1.15 | 0.9 | An ancient menhir given purpose by a forgotten oath. |
| hearth_priest | Hearth-Priest | mender | 1 | 1 | A clan healer who tends his warband's wounds at a portable altar. |
| ridge_ram | Ridge Ram | beast | 1.05 | 0.95 | A horned wild ram, rock-hard and fond of charging downhill. |

### Elites

| id | name | archetype | hp | dmg | ability | description |
|---|---|---|---|---|---|---|
| hrothgar | Hrothgar Stonefist | brute | 1.15 | 0.9 | Cairn-Splitter (heavy_blow 2, CD 4) | A clan champion who swore never to retreat from the Reach. |
| urseth | Urseth the Stormcaller | caster | 0.95 | 1.1 | Stormbolt (dark_cast 2.2, CD 4) | A shaman who bargained with the gales and lost his name to them. |
| mawra | Mawra Ironbrow | guardian | 1.1 | 0.95 | Shieldwall (self_shield 0.22, CD 5) | The grim matriarch of a steading that no one has ever breached. |

### Rares

| id | name | archetype | hp | dmg | abilities | description |
|---|---|---|---|---|---|---|
| grey_stag | The Grey Stag | beast | 1.05 | 1 | Antler Sweep (cleave_all 0.9, CD 3); Rutting Charge (heavy_blow 1.9, CD 3) | A great antlered stag worshipped by the old clans. |

### Dungeon: Barrowdeep

A burial complex carved into the mountain, where the clan kings still hold court.

Trash:

| id | name | archetype | hp | dmg | description |
|---|---|---|---|---|---|
| barrow_wight | Barrow Wight | skulker | 0.95 | 1.05 | A restless raider still guarding his master's treasure. |
| bone_thane | Bone Thane | guardian | 1.1 | 0.9 | A skeletal retainer in rusted mail, loyal past death. |
| grave_skald | Grave Skald | caster | 0.95 | 1.1 | A dead poet whose elegies wither the living. |
| cairn_hound | Cairn Hound | beast | 1 | 1 | A spectral wolfhound that guards the tomb entrance. |
| tomb_priest | Tomb Priest | mender | 1 | 1 | An embalmer-priest who stitches fallen warriors back to their feet. |

Boss:

| id | name | archetype | hp | dmg | abilities | description |
|---|---|---|---|---|---|---|
| king_aldrec | Aldrec Barrow-King | brute | 1.1 | 1 | Crown-Breaker (heavy_blow 2.1, CD 4); Royal Sweep (cleave_all 0.85, CD 3) | The last king of the Reach, buried with his hall and unwilling to rest. |

### Quests

| title | giver | objective | text | turn-in | size weights 1/2/3 |
|---|---|---|---|---|---|
| Wolves at the Wall | Thane Brannoch | slay | Crag prowlers have been taking our herd-dogs. Hunt them down above the high pasture. | The herd sleeps safe tonight. | 4/4/2 |
| Stones That Walk | Lorekeeper Ysolt | scout | The old guardian stones are moving along the ridge. Watch where they go and why. | They march toward Barrowdeep. This is troubling. | 3/4/3 |
| Lightning on the Ridge | Shepherd Tam | slay | Wind shamans have burnt three of my flocks with their storm-calling. Silence them. | May the grass grow back swiftly. | 2/4/4 |
| Mead for the Steading | Innkeeper Hild | deliver | Bring this cask of mead to Stonehaven before the feast. The heath reivers will hunt it. | You saved the feast! Drink with us. | 5/4/1 |
| Reiver's Toll | Thane Brannoch | slay | Heath reivers take tolls at the ford where none are owed. Show them the Hold's answer. | The ford is free again. | 2/4/4 |
| Ram-Horn Signal | Huntress Ketra | gather | We need ridge-ram horns for the warning pipes. Gather six and bring them down. | These will carry across three valleys. | 3/4/3 |
| A Healer Taken | Hearth-Mother Orla | rescue | Our hearth-priest was seized on the high road. Free him from the warband that holds him. | He lives! Blessings on you. | 4/4/2 |
| The Silent Cairns | Lorekeeper Ysolt | scout | No bell has rung from the Barrow road in a week. Go and see what has silenced it. | The dead walk. We must warn the clans. | 3/4/3 |
| Hrothgar's Oath | Thane Brannoch | slay | Hrothgar Stonefist blocks the pass and will not yield. Break his oath if you must. | He kept his word to the end. May he rest. | 1/4/5 |

### Shrine lines

- A ring of standing stones hums with old power, the heather around them strangely still.
- A cairn crowned with iron nails marks a fallen hero; the wind carries a faint horn call.

### Treasure lines

- A reiver's cache sits under a flat stone, wrapped in an oiled hide.
- A fallen caravan's chest rests against a boulder, half buried by a rockslide.

### Item base names

| slot | names |
|---|---|
| Head | Ironbound Helm / Heather Hood / Ramhorn Cap |
| Chest | Thane's Hauberk / Woolen Brigandine / Highland Plaid Vest |
| Legs | Hillwalker Greaves / Plaid Leggings / Cairnguard Cuisses |
| Hands | Stonehaul Gauntlets / Reiver's Gloves / Torque-Banded Mitts |
| Feet | Crag Boots / Heathstride Treads / Ironnail Boots |
| Neck | Torc of the Clans / Cairn-Stone Pendant / Wind-Etched Amulet |
| Ring | Clan Signet / Knotted Iron Band / Skald's Ring |
| Trinket | Hearth-Coal Ember / Bone Whistle / Thane's Seal |
| Weapon | Reiver's Dirk / Stormwood Staff / Highland Recurve (rogue / mage / hunter) |
| Off-hand | Ironbound Targe / Standing-Stone Orb / Hornquiver |

## Z4: Sunscoured Wastes (levels 31-40)

Theme: Dry ruins of a fallen empire half-buried in wind-cut sand.
Hub: Cisternhold

### Normal enemies

| id | name | archetype | hp | dmg | description |
|---|---|---|---|---|---|
| dune_juggernaut | Ruin Juggernaut | brute | 1.15 | 0.9 | A clay colossus, cracked and sand-filled, still carrying out its last order. |
| sand_stalker | Sand Stalker | skulker | 0.95 | 1.05 | A burrowing hunter that erupts from the dune beneath its prey. |
| scarab_swarm | Gilded Scarab | beast | 0.9 | 1.15 | A palm-sized beetle with a golden shell, swarming over any intruder. |
| sun_cultist | Sunscribe Adept | caster | 0.9 | 1.15 | A priest of the dead empire whose scorching glyphs blister the air. |
| sepulchre_guard | Sepulchre Guardian | guardian | 1.15 | 0.9 | An armoured statue sealed to a doorway long ago. It has never left its post. |
| canal_healer | Cistern Keeper | mender | 1 | 1 | A robed warden who draws water from hidden wells to mend the wounded. |
| dust_jackal | Dust Jackal | beast | 1 | 1 | A rangy desert scavenger that circles ruins in packs. |

### Elites

| id | name | archetype | hp | dmg | ability | description |
|---|---|---|---|---|---|---|
| kharun | Kharun the Unburied | brute | 1.15 | 0.9 | Imperial Smite (heavy_blow 2.1, CD 4) | An imperial champion whose tomb was never sealed. |
| nesret | Nesret Sunscribe | caster | 0.95 | 1.1 | Sun-Glyph (dark_cast 2.3, CD 4) | A high priestess whose scorching hymns have outlived her empire. |
| tazem | Tazem Sandwraith | skulker | 0.95 | 1.1 | Dune Fang (rend 0.75/tick 0.22, CD 3) | A desert assassin who dissolves into dust between strikes. |

### Rares

| id | name | archetype | hp | dmg | abilities | description |
|---|---|---|---|---|---|---|
| gilded_queen | The Gilded Queen | beast | 1.05 | 1 | Brood Sweep (cleave_all 0.9, CD 3); Call the Brood (summon 2, CD 0) | A beetle-matriarch the size of a wagon, plated in stolen gold. |
| pharan | Pharan the Sleepless | guardian | 1.1 | 0.95 | Eternal Vigil (self_shield 0.25, CD 5); Pillar Fall (heavy_blow 1.9, CD 4) | A guardian who guards a tomb that no longer exists. |

### Dungeon: The Obelisk of Veth

A half-sunken temple-tower whose glowing sigils reawaken at dusk.

Trash:

| id | name | archetype | hp | dmg | description |
|---|---|---|---|---|---|
| obelisk_servant | Obelisk Servant | guardian | 1.1 | 0.9 | A stone attendant that rises when a sigil is trodden on. |
| sand_priest | Sand Priest | mender | 1 | 1 | A shrivelled priest who tends the sacred fires within. |
| sigil_hound | Sigil Hound | beast | 1 | 1 | A bronze hound animated by temple magic. |
| veth_acolyte | Veth Acolyte | caster | 0.95 | 1.1 | A blind scribe-priest reading glyphs of fire. |

Boss:

| id | name | archetype | hp | dmg | abilities | description |
|---|---|---|---|---|---|---|
| ammeset | Ammeset, Voice of Veth | caster | 0.95 | 1.1 | Sunbrand (dark_cast 2.3, CD 4); Sacred Flame (self_heal 0.18, CD 5) | The final high priestess, bound to the obelisk by her own prophecy. |

### Quests

| title | giver | objective | text | turn-in | size weights 1/2/3 |
|---|---|---|---|---|---|
| The Thirsty Caravan | Caravanmaster Sefu | deliver | Carry water-skins to our stranded caravan beyond the dunes. The jackals are thick on that road. | You have saved eleven lives. Thank you. | 5/4/1 |
| Scarab Plague | Digger Imhotep | slay | Gilded scarabs are devouring the food in our camp. Crush the swarms at their nest. | The pests are gone. Our camp can sleep again. | 2/4/4 |
| Whispers in the Glyphs | Scholar Neferu | scout | Strange voices speak from the engraved walls near the old gate. Hear what they say. | The glyphs are waking. This is dire news. | 3/4/3 |
| Cistern Keeper's Plea | Warden Tarek | rescue | Our wardens at the east cistern have not returned. Find them and drive off whatever holds them. | The cistern is safe. The oasis lives. | 4/4/2 |
| Relics of the Empire | Digger Imhotep | gather | Gather broken sun-discs from the ruin juggernauts. The scholars can read their markings. | These discs hold names we thought lost. | 3/4/3 |
| Sandstorm Hunters | Caravanmaster Sefu | slay | Sand stalkers strike from the dunes whenever a sandstorm hides them. Hunt them down. | Open ground feels safe again. | 2/4/4 |
| The Unburied Champion | Scholar Neferu | slay | The champion Kharun walks his old halls again. Put him back to rest. | At last the tomb may be sealed. | 1/4/5 |
| Light the Beacon | Warden Tarek | scout | The signal beacon at the south ridge has gone dark. Climb up and find out why. | Someone put it out. We shall be wary. | 3/4/3 |
| Sun-Priest's Silence | Scholar Neferu | slay | Sunscribe adepts chant at the obelisk base, drawing power from the glyphs. End their rite. | The chanting has stopped. Thank you. | 4/4/2 |

### Shrine lines

- A cracked altar to the sun still radiates a faint warmth, though it has stood cold for centuries.
- A basin of clear water sits impossibly full in the heart of the ruin, ringed with offerings of bronze.

### Treasure lines

- A sealed urn, half buried in sand, rattles with coins when you nudge it.
- A collapsed merchant's cart spills silk and silver beneath a toppled column.

### Item base names

| slot | names |
|---|---|
| Head | Sunveil Helm / Dustwrap Cowl / Bronze Crest |
| Chest | Scribe's Robe / Gilded Cuirass / Dustrunner Vest |
| Legs | Sandweave Leggings / Brass Greaves / Caravan Breeches |
| Hands | Glyph-Carver Gloves / Bronze Gauntlets / Dune Wraps |
| Feet | Sandstrider Boots / Burnished Sabatons / Wind-Worn Sandals |
| Neck | Sunstone Pendant / Scarab Amulet / Ankh of Dust |
| Ring | Signet of Veth / Gilded Scarab Ring / Sun-Disc Band |
| Trinket | Hourglass of Ash / Sealed Papyrus Vial / Cracked Sun-Disc |
| Weapon | Scimitar of Dust / Sunscribe Staff / Dunewood Bow (rogue / mage / hunter) |
| Off-hand | Bronze Tower Shield / Glyph-Etched Orb / Sandsilk Quiver |

## Z5: Mournwood (levels 41-50)

Theme: A haunted forest of pale trees, drifting fog and restless spirits.
Hub: Lanternfall

### Normal enemies

| id | name | archetype | hp | dmg | description |
|---|---|---|---|---|---|
| hollow_oak | Hollow Oak | brute | 1.15 | 0.9 | A walking oak, hollow within and filled with whispers. |
| wraith_stalker | Fogwraith | skulker | 0.95 | 1.05 | A hungry spirit that slips from the mist to feed. |
| hex_widow | Hex Widow | caster | 0.9 | 1.15 | A ghostly bride whose cursed lace leaves lingering sickness. |
| ghoul_hound | Grave Hound | beast | 1 | 1 | A bone-chewing hound from the old churchyard, always hungry. |
| stone_penitent | Stone Penitent | guardian | 1.15 | 0.9 | A weeping statue that moves only when unobserved. |
| lantern_keeper | Lantern Keeper | mender | 1 | 1 | A spectral caretaker whose pale lantern knits flesh and shade. |
| thorn_wisp | Thorn Wisp | caster | 0.85 | 1.15 | A cold light that leads the lost to their ruin, then burns them. |

### Elites

| id | name | archetype | hp | dmg | ability | description |
|---|---|---|---|---|---|---|
| varis | Lord Varis Dunmere | brute | 1.1 | 0.95 | Graveblade (heavy_blow 2.1, CD 4) | A ghost knight bound to guard a manor that burned down centuries ago. |
| morrigan | Morrigan of the Veil | caster | 0.95 | 1.1 | Keening Wail (dark_cast 2.4, CD 4) | A banshee whose wail strips colour from the forest. |
| grimmel | Grimmel Rootbound | guardian | 1.1 | 0.95 | Barkwall (self_shield 0.22, CD 5) | An ancient treant half-consumed by a spectral blight. |

### Rares

| id | name | archetype | hp | dmg | abilities | description |
|---|---|---|---|---|---|---|
| pale_hunter | The Pale Hunter | skulker | 0.95 | 1.1 | Silver Arrow (rend 0.75/tick 0.22, CD 3); Horn of the Hunt (dark_cast 2.2, CD 4) | A spectral huntsman who tracks the living through the trees. |
| black_doe | The Black Doe | beast | 1.05 | 1 | Antler Rush (heavy_blow 1.9, CD 3); Sap Blessing (self_heal 0.17, CD 5) | A shadow-coated deer whose antlers weep dark sap. |

### Dungeon: Dunmere Chapel

A fallen chapel where the dead gather for a service that never ends.

Trash:

| id | name | archetype | hp | dmg | description |
|---|---|---|---|---|---|
| chapel_bellringer | Chapel Bellringer | brute | 1.1 | 0.95 | A massive undead who tolls the bell and the dead rise. |
| pallid_chorister | Pallid Chorister | caster | 0.9 | 1.15 | A hymn-singer whose song withers the living. |
| crypt_hound | Crypt Hound | beast | 1 | 1 | A ghostly hound guarding the family vaults. |
| mourning_nun | Mourning Nun | mender | 1 | 1 | A weeping sister who tends the fallen in the pews. |

Boss:

| id | name | archetype | hp | dmg | abilities | description |
|---|---|---|---|---|---|---|
| father_vael | Father Vael the Unfaithful | caster | 1 | 1.1 | Black Benediction (dark_cast 2.4, CD 4); Raise the Congregation (summon 2, CD 0) | The last priest of Dunmere, who sold his flock to the dark. |

### Quests

| title | giver | objective | text | turn-in | size weights 1/2/3 |
|---|---|---|---|---|---|
| Lanterns for the Lost | Warden Ysmay | gather | We light lanterns to guide the living out of the wood. Gather wisp-glass for new wicks. | Our lights burn brighter. You are kind. | 3/4/3 |
| The Weeping Statues | Brother Corvin | scout | The stone penitents move at night and a woman is heard crying. Learn what binds them. | A broken vow. We must mend it. | 3/4/3 |
| Hollow Heart | Woodcutter Aldo | slay | The hollow oaks fall upon our camp each dusk. Fell them before they fell us. | Quiet again. Thank you. | 2/4/4 |
| Bell in the Mist | Warden Ysmay | scout | A bell tolls from Dunmere Chapel where no ringer has lived for years. Find who rings it. | The dead hold service. This bodes ill. | 4/4/2 |
| Hounds of the Graveyard | Gravekeeper Isolde | slay | Grave hounds are digging up our churchyard. Put them down for good. | The dead may rest at last. | 2/4/4 |
| Letters to the Grave | Widow Perrin | deliver | Take this bundle of letters to the Dunmere crypt. Do not read them, and do not linger. | He will have them now. Thank you. | 5/4/1 |
| Veil-Cursed | Brother Corvin | rescue | A hunter has been cursed by a hex widow and wanders the woods in a daze. Find him. | He wakes! The curse has broken. | 4/4/2 |
| The Pale Hunter | Warden Ysmay | slay | A spectral huntsman has been tracking our scouts through the mist. Make him the quarry. | His horn is silent. Well done. | 1/4/5 |
| Lord Varis's Penance | Gravekeeper Isolde | slay | Lord Varis haunts the burnt manor and will not let any pass. Lay him to rest. | He is at peace. The manor sleeps. | 3/4/3 |

### Shrine lines

- A hollow tree glows faintly from within, and whispered blessings drift from its roots.
- A circle of candles burns without wax or flame, ringing a pale stone.

### Treasure lines

- A coffin half-risen from soft earth has a purse tied to the dead man's wrist.
- A rotting hunter's pack hangs in a tree, lashed shut with old cord.

### Item base names

| slot | names |
|---|---|
| Head | Wraithcloth Cowl / Ghostwood Circlet / Mourner's Veil |
| Chest | Shroudweave Robe / Gravewarden Coat / Pale Bark Cuirass |
| Legs | Lichwalker Leggings / Shadowthread Pants / Graveyard Greaves |
| Hands | Candle-Bearer Gloves / Phantom Grips / Thornbark Gauntlets |
| Feet | Fogstep Boots / Silent Treads / Mourner's Shoes |
| Neck | Wisp-Glass Pendant / Black Rosary / Grave-Moss Charm |
| Ring | Banshee Band / Pale Vigil Ring / Raven-Bone Ring |
| Trinket | Wisp Lantern / Funeral Bell / Veil of the Lost |
| Weapon | Wraith Stiletto / Ghostwood Staff / Hunter's Whitebow (rogue / mage / hunter) |
| Off-hand | Gravewarden Shield / Spirit-Light Orb / Quiver of Pale Arrows |

## Z6: Cindercrown Peaks (levels 51-60)

Theme: Scorched volcanic mountains of ash, lava seams and ruined forts.
Hub: Emberwatch

### Normal enemies

| id | name | archetype | hp | dmg | description |
|---|---|---|---|---|---|
| slag_brute | Slag Brute | brute | 1.15 | 0.9 | A hulking creature of cooling lava and black iron. |
| ash_stalker | Ash Stalker | skulker | 0.95 | 1.05 | A soot-grey hunter that moves unseen through the smoke. |
| pyre_magus | Pyre Magus | caster | 0.9 | 1.15 | A mage who sold himself to the mountain for fire. |
| cinder_wyrmling | Cinder Wyrmling | beast | 1 | 1 | A young fire-drake, too small to fly but dangerous in a pack. |
| obsidian_warden | Obsidian Warden | guardian | 1.15 | 0.9 | A glassy sentinel forged in the volcano's first eruption. |
| forge_priest | Forge Priest | mender | 1 | 1 | A cultist who tends the mountain's sacred fires and mends allies in flame. |
| magma_hound | Magma Hound | beast | 0.9 | 1.15 | A snarling hound whose fur smoulders and whose bite sears. |

### Elites

| id | name | archetype | hp | dmg | ability | description |
|---|---|---|---|---|---|---|
| skarn | Skarn the Flamebound | brute | 1.15 | 0.9 | Magma Fist (heavy_blow 2.2, CD 4) | A chieftain wedded to the volcano, his armour fused to his flesh. |
| kaelith | Kaelith Pyreweaver | caster | 0.95 | 1.1 | Firestorm (dark_cast 2.5, CD 4) | A fire-mage who weaves lava into living spears. |
| drathor | Drathor Ashmantle | skulker | 0.95 | 1.1 | Searing Cut (rend 0.8/tick 0.25, CD 3) | A scorched assassin whose blades are quenched in lava. |

### Rares

| id | name | archetype | hp | dmg | abilities | description |
|---|---|---|---|---|---|---|
| ember_drake | Emberhorn the Drake | beast | 1.05 | 1 | Tail Sweep (cleave_all 0.95, CD 3); Inferno Breath (dark_cast 2.4, CD 4) | A full-grown fire-drake, last of its brood. |
| stone_matron | The Obsidian Matron | guardian | 1.1 | 0.95 | Glassplate (self_shield 0.25, CD 5); Mountain Fall (heavy_blow 2, CD 4) | An ancient warden whose glass hide reflects blade and spell alike. |

### Dungeon: The Furnace of Karth

An abandoned dwarven-style forge-fortress, now the heart of a fire cult.

Trash:

| id | name | archetype | hp | dmg | description |
|---|---|---|---|---|---|
| furnace_stoker | Furnace Stoker | brute | 1.1 | 0.95 | A sweating hulk who feeds the great fires with whatever is nearest. |
| cinder_acolyte | Cinder Acolyte | caster | 0.9 | 1.15 | A cultist chanting to the flames, hands blistering. |
| bellows_guard | Bellows Guardian | guardian | 1.15 | 0.9 | An iron automaton that pumps the forge with relentless rhythm. |
| slag_hound | Slag Hound | beast | 1 | 1 | A cinder-coated hound that hunts in the forge corridors. |
| ash_priest | Ash Priest | mender | 1 | 1 | A ministrant who keeps the cult's wounded burning. |

Boss:

| id | name | archetype | hp | dmg | abilities | description |
|---|---|---|---|---|---|---|
| karth | Karth, Heart of the Furnace | brute | 1.1 | 1 | Anvil Strike (heavy_blow 2.2, CD 4); Molten Wave (cleave_all 0.9, CD 3) | A colossus of molten iron, fuelled by the forge it guards. |

### Quests

| title | giver | objective | text | turn-in | size weights 1/2/3 |
|---|---|---|---|---|---|
| The Ash Road | Marshal Doran | scout | The ash road to the fortress is blocked by shifting slag. Scout the route and mark safe passages. | Safe paths at last. We march at dawn. | 3/4/3 |
| Hounds of Fire | Scout Kettil | slay | Magma hounds roam the foothills, scorching our outposts. Drive them back. | The outposts are quiet. Well done. | 2/4/4 |
| Embers of the Old Forge | Smith Brennar | gather | The old forges still hold cinder-steel in their ash. Retrieve ingots from the slag brutes. | Perfect metal. We can arm the garrison. | 3/4/3 |
| The Last Supply Wagon | Quartermaster Lisel | deliver | A wagon of supplies lies abandoned in the pass. Fetch the cargo before the wyrmlings find it. | The garrison eats tonight. Thank you. | 5/4/1 |
| The Obsidian Wardens | Marshal Doran | slay | The glassy wardens guard the pass and will not stand aside. Smash them. | The pass is open. Excellent work. | 4/4/2 |
| Cult of the Furnace | Scout Kettil | scout | A fire cult has seized the old forge fortress. Learn their numbers and bring word. | So many. We need a plan. | 3/4/3 |
| Pyre Magus | Marshal Doran | slay | A renegade magus burns villages for fuel. Stop him before his flame spreads. | The fires are dying down. Thank you. | 1/4/5 |
| Rescue at Emberwatch | Smith Brennar | rescue | Two smiths were taken to the Furnace to feed its fires. Free them if they still live. | They breathe! We are in your debt. | 4/4/2 |
| The Drake's Roost | Quartermaster Lisel | slay | Wyrmlings circle a ridge high above the pass, and their mother is the cause. End the nest. | The sky is clear. May the pass stay safe. | 2/4/4 |

### Shrine lines

- A pool of molten glass cools in a perfect circle, gleaming with a strange inner light.
- A lone forge anvil stands in the ash, still warm, rune-etched with a smith's vow.

### Treasure lines

- A dwarf-forged strongbox is wedged between two slabs of cooled lava.
- A dead soldier's satchel lies in the ash, singed but unopened.

### Item base names

| slot | names |
|---|---|
| Head | Cinderplate Helm / Ashen Cowl / Emberguard Coif |
| Chest | Slagplate Cuirass / Pyre-Silk Robe / Soot-Dark Brigandine |
| Legs | Forge Greaves / Cinderweave Leggings / Obsidian Cuisses |
| Hands | Smith's Gauntlets / Ashen Gloves / Flamewrap Grips |
| Feet | Ashwalker Boots / Slag Sabatons / Soot-Black Treads |
| Neck | Ember Pendant / Obsidian Choker / Forge-Fire Amulet |
| Ring | Cinder Band / Magma Signet / Soot-Glass Ring |
| Trinket | Pocket Furnace / Ember Heart / Drake-Scale Charm |
| Weapon | Obsidian Stiletto / Pyrewood Staff / Drakebone Bow (rogue / mage / hunter) |
| Off-hand | Slag Bulwark / Ember-Core Orb / Cinder Quiver |

## Stat-flavour words

| stat(s) | prefixes | suffixes |
|---|---|---|
| agi | Nimble, Swift, Keen | of the Hare, of Quickness, of the Fox |
| int | Learned, Lucid, Arcane | of Insight, of the Owl, of Clear Sight |
| sta | Sturdy, Hardy, Stout | of the Bear, of Endurance, of the Oak |
| spi | Serene, Calm, Tranquil | of Peace, of the Dove, of Stillness |
| agi+sta | Wary, Tenacious, Hardened | of the Stalwart Hunter, of the Wolf, of Grit |
| agi+spi | Patient, Measured, Quiet | of the Still Blade, of the Heron, of Poise |
| int+sta | Resolute, Warded, Steadfast | of the Bulwark, of the Standing Stone, of Resolve |
| int+spi | Meditative, Attuned, Mindful | of the Clear Pool, of the Lotus, of Reverie |
| sta+spi | Hale, Restful, Wholesome | of the Hearth, of Recovery, of the Meadow |

## Unique items

| id | name | slot | zone | rarity | effect | flavour |
|---|---|---|---|---|---|---|
| sunder_loop | Ring of the Fallen Thane | Ring | Z3 | rare | proc | A ring prised from a barrow-king's finger. It bites back when you are struck. |
| gravewatch_cloak | Gravewatch Mantle | Chest | Z5 | rare | ward | Woven for a chapel sexton, it wraps its wearer in a pale hush. |
| boundary_charm | Boundarystone Charm | Neck | Z1 | rare | heal_on_kill | A pebble from the first field wall. Each victory warms it. |
| reedlight_lantern | Reedlight Lantern | Trinket | Z2 | rare | potion_pct | A fen lamp that steeps every draught in swamp-warmth. |
| sunbrand_band | Sunbrand Band | Ring | Z4 | rare | elite_dmg | A priest's signet that burns brighter against the mighty. |
| ashheart_stone | Ashheart Stone | Trinket | Z6 | rare | proc | A coal that never cools, spitting sparks at foes. |
| harrowbane | Harrowbane Greaves | Legs | Z1 | epic | heal_on_kill | Taken from a deserter's corpse, they seem to renew with each kill. |
| mistwalker_hood | Mistwalker's Hood | Head | Z2 | epic | ward | Fog clings to this hood and shrugs off the first blow. |
| stormcaller_torc | Stormcaller's Torc | Neck | Z3 | epic | proc | Crackles with the last of a shaman's bargain. |
| pharaoh_circlet | Circlet of Veth | Head | Z4 | epic | elite_dmg | A priestess's crown, hungry for worthy opponents. |
| lanternkeeper_phial | Lanternkeeper's Phial | Trinket | Z5 | epic | potion_pct | Light caught from a spectral lamp deepens every healing. |
| karth_heartplate | Heartplate of Karth | Chest | Z6 | epic | ward | Forge-iron that shields its wearer at the start of every fight. |
| whisper_of_the_veil | Whisperfang, Veil-Cutter | Weapon | any | epic (rogue) | proc | A thin blade that sings only when drawn in shadow. |
| starfall_staff | Starfall Staff | Weapon | any | epic (mage) | elite_dmg | A staff of black glass that blazes against the great and the proud. |
| heartseeker_bow | Heartseeker, the Last Bowshot | Weapon | any | epic (hunter) | proc | A longbow strung with a drake's sinew, said never to miss twice. |
