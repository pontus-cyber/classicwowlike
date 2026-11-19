// Content table: item base names per slot and level band (rules.md 8, 12). Plain data only (Content Designer).
// Newcomer check 2026-11-15 (draft; s0126, a Mage's offhand named "Quiver of Rushes"): `offhand` is `{ AGI, INT, hunter }`:
// shields for an Agility item, caster offhands (orbs, tomes) for an Intellect item, quivers for a Hunter's Agility item.
// Legacy bugs 2026-11-19 (draft; blind returning player s0122, s0206: a Rogue offered a "Yew Shortbow" and shields):
// `weapon.rogue` (the band's blades, no bows) and `offhand.rogue` (parrying blades) for a Rogue's Agility items.
// The first name of each list is the band's old one; the other 36 are new (generic object names in each zone's words).
export const ITEM_NAMES = [
 {
  "head": [
   "Hempen Hood",
   "Farmhand's Cap",
   "Boarhide Helm"
  ],
  "chest": [
   "Linen Jerkin",
   "Tanner's Coat",
   "Tenant's Vest"
  ],
  "legs": [
   "Field Leggings",
   "Wool Breeches",
   "Hedge-Walker Trousers"
  ],
  "hands": [
   "Work Gloves",
   "Reaper's Mitts",
   "Thornproof Gauntlets"
  ],
  "feet": [
   "Muddy Boots",
   "Furrow Treads",
   "Millroad Shoes"
  ],
  "neck": [
   "Seed-Bead Necklace",
   "Cord of Wheat",
   "Boundary Charm"
  ],
  "ring": [
   "Copper Tally Ring",
   "Twisted Straw Band",
   "Brass Sowing Ring"
  ],
  "trinket": [
   "Lucky Barleycorn",
   "Scarecrow Button",
   "Millstone Chip"
  ],
  "weapon": {
   "AGI": [
    "Harvest Knife",
    "Yew Shortbow",
    "Skinning Blade"
   ],
   "INT": [
    "Hazel Wand",
    "Hazel Rod",
    "Elm Switch"
   ],
   "rogue": [
    "Harvest Knife",
    "Skinning Blade",
    "Hedge Dagger"
   ]
  },
  "offhand": {
   "AGI": [
    "Wooden Buckler",
    "Millwheel Buckler",
    "Hedgewood Shield"
   ],
   "INT": [
    "Lantern Orb",
    "Almanac of the Furrow",
    "Millbrook Tome"
   ],
   "hunter": [
    "Quiver of Rushes",
    "Boarhide Quiver",
    "Strawbound Quiver"
   ],
   "rogue": [
    "Parrying Knife",
    "Sickle Blade",
    "Thresher's Dirk"
   ]
  }
 },
 {
  "head": [
   "Reedweave Cap",
   "Fenwarden's Cowl",
   "Eelskin Hood"
  ],
  "chest": [
   "Waxed Fen Coat",
   "Peatstained Jerkin",
   "Marshwalker Tunic"
  ],
  "legs": [
   "Waders",
   "Reedcloth Leggings",
   "Bogtrotter Breeches"
  ],
  "hands": [
   "Net-Mender Gloves",
   "Silt-Stained Mitts",
   "Eelhide Grips"
  ],
  "feet": [
   "Stilt Boots",
   "Marsh Treads",
   "Reedsoles"
  ],
  "neck": [
   "Pearl Drop Pendant",
   "Lantern-Fly Charm",
   "Bog-Oak Amulet"
  ],
  "ring": [
   "Mist Signet",
   "Tarnished Fen Band",
   "Brineglass Ring"
  ],
  "trinket": [
   "Sunken Bell Clapper",
   "Glow-Moss Vial",
   "Heron Feather Charm"
  ],
  "weapon": {
   "AGI": [
    "Gutting Hook",
    "Reedwood Longbow",
    "Fen Cutlass"
   ],
   "INT": [
    "Bog-Oak Staff",
    "Reed Rod",
    "Willow Staff"
   ],
   "rogue": [
    "Gutting Hook",
    "Fen Cutlass",
    "Reedcutter's Knife"
   ]
  },
  "offhand": {
   "AGI": [
    "Driftwood Shield",
    "Reedwoven Buckler",
    "Stilt-Plank Shield"
   ],
   "INT": [
    "Witchlight Orb",
    "Gloam-Bound Tome",
    "Mirewater Codex"
   ],
   "hunter": [
    "Smuggler's Quiver",
    "Eelskin Quiver",
    "Stiltwalker's Quiver"
   ],
   "rogue": [
    "Eel-Bone Knife",
    "Mire Parrying Blade",
    "Stiltwalker's Dirk"
   ]
  }
 },
 {
  "head": [
   "Ironbound Helm",
   "Heather Hood",
   "Ramhorn Cap"
  ],
  "chest": [
   "Thane's Hauberk",
   "Woolen Brigandine",
   "Highland Plaid Vest"
  ],
  "legs": [
   "Hillwalker Greaves",
   "Plaid Leggings",
   "Cairnguard Cuisses"
  ],
  "hands": [
   "Stonehaul Gauntlets",
   "Reiver's Gloves",
   "Torque-Banded Mitts"
  ],
  "feet": [
   "Crag Boots",
   "Heathstride Treads",
   "Ironnail Boots"
  ],
  "neck": [
   "Torc of the Clans",
   "Cairn-Stone Pendant",
   "Wind-Etched Amulet"
  ],
  "ring": [
   "Clan Signet",
   "Knotted Iron Band",
   "Skald's Ring"
  ],
  "trinket": [
   "Hearth-Coal Ember",
   "Bone Whistle",
   "Thane's Seal"
  ],
  "weapon": {
   "AGI": [
    "Reiver's Dirk",
    "Highland Recurve",
    "Raider's Axe"
   ],
   "INT": [
    "Stormwood Staff",
    "Rowan Wand",
    "Oakheart Staff"
   ],
   "rogue": [
    "Reiver's Dirk",
    "Heather Kris",
    "Cairn Knife"
   ]
  },
  "offhand": {
   "AGI": [
    "Ironbound Targe",
    "Heathwood Buckler",
    "Cairnstone Shield"
   ],
   "INT": [
    "Standing-Stone Orb",
    "Barrow-Lore Tome",
    "Oathbound Codex"
   ],
   "hunter": [
    "Hornquiver",
    "Heath-Stag Quiver",
    "Windbarrow Quiver"
   ],
   "rogue": [
    "Heath Parrying Dirk",
    "Cairnstone Knife",
    "Raider's Off-Blade"
   ]
  }
 },
 {
  "head": [
   "Sunveil Helm",
   "Dustwrap Cowl",
   "Bronze Crest"
  ],
  "chest": [
   "Scribe's Robe",
   "Gilded Cuirass",
   "Dustrunner Vest"
  ],
  "legs": [
   "Sandweave Leggings",
   "Brass Greaves",
   "Caravan Breeches"
  ],
  "hands": [
   "Glyph-Carver Gloves",
   "Bronze Gauntlets",
   "Dune Wraps"
  ],
  "feet": [
   "Sandstrider Boots",
   "Burnished Sabatons",
   "Wind-Worn Sandals"
  ],
  "neck": [
   "Sunstone Pendant",
   "Scarab Amulet",
   "Ankh of Dust"
  ],
  "ring": [
   "Signet of Veth",
   "Gilded Scarab Ring",
   "Sun-Disc Band"
  ],
  "trinket": [
   "Hourglass of Ash",
   "Sealed Papyrus Vial",
   "Cracked Sun-Disc"
  ],
  "weapon": {
   "AGI": [
    "Scimitar of Dust",
    "Dunewood Bow",
    "Khopesh of Sand"
   ],
   "INT": [
    "Sunscribe Staff",
    "Glass Wand",
    "Sandglass Rod"
   ],
   "rogue": [
    "Scimitar of Dust",
    "Khopesh of Sand",
    "Dune Fang Dagger"
   ]
  },
  "offhand": {
   "AGI": [
    "Bronze Tower Shield",
    "Dune Buckler",
    "Sun-Disc Shield"
   ],
   "INT": [
    "Glyph-Etched Orb",
    "Sunscribe Codex",
    "Tablets of Veth"
   ],
   "hunter": [
    "Sandsilk Quiver",
    "Jackal-Hide Quiver",
    "Kharun Quiver"
   ],
   "rogue": [
    "Sandglass Kris",
    "Dune Parrying Blade",
    "Jackal-Tooth Dagger"
   ]
  }
 },
 {
  "head": [
   "Wraithcloth Cowl",
   "Ghostwood Circlet",
   "Mourner's Veil"
  ],
  "chest": [
   "Shroudweave Robe",
   "Gravewarden Coat",
   "Pale Bark Cuirass"
  ],
  "legs": [
   "Lichwalker Leggings",
   "Shadowthread Pants",
   "Graveyard Greaves"
  ],
  "hands": [
   "Candle-Bearer Gloves",
   "Phantom Grips",
   "Thornbark Gauntlets"
  ],
  "feet": [
   "Fogstep Boots",
   "Silent Treads",
   "Mourner's Shoes"
  ],
  "neck": [
   "Wisp-Glass Pendant",
   "Black Rosary",
   "Grave-Moss Charm"
  ],
  "ring": [
   "Banshee Band",
   "Pale Vigil Ring",
   "Raven-Bone Ring"
  ],
  "trinket": [
   "Wisp Lantern",
   "Funeral Bell",
   "Veil of the Lost"
  ],
  "weapon": {
   "AGI": [
    "Wraith Stiletto",
    "Hunter's Whitebow",
    "Grave Cleaver"
   ],
   "INT": [
    "Ghostwood Staff",
    "Bone Wand",
    "Pale Yew Staff"
   ],
   "rogue": [
    "Wraith Stiletto",
    "Grave Cleaver",
    "Lychgate Knife"
   ]
  },
  "offhand": {
   "AGI": [
    "Gravewarden Shield",
    "Coffin-Lid Buckler",
    "Penitent's Shield"
   ],
   "INT": [
    "Spirit-Light Orb",
    "Chapel Psalter",
    "Lanternfall Hymnal"
   ],
   "hunter": [
    "Quiver of Pale Arrows",
    "Mourner's Quiver",
    "Lychgate Quiver"
   ],
   "rogue": [
    "Mourner's Dirk",
    "Pale Parrying Blade",
    "Bone-Hilt Knife"
   ]
  }
 },
 {
  "head": [
   "Cinderplate Helm",
   "Ashen Cowl",
   "Emberguard Coif"
  ],
  "chest": [
   "Slagplate Cuirass",
   "Pyre-Silk Robe",
   "Soot-Dark Brigandine"
  ],
  "legs": [
   "Forge Greaves",
   "Cinderweave Leggings",
   "Obsidian Cuisses"
  ],
  "hands": [
   "Smith's Gauntlets",
   "Ashen Gloves",
   "Flamewrap Grips"
  ],
  "feet": [
   "Ashwalker Boots",
   "Slag Sabatons",
   "Soot-Black Treads"
  ],
  "neck": [
   "Ember Pendant",
   "Obsidian Choker",
   "Forge-Fire Amulet"
  ],
  "ring": [
   "Cinder Band",
   "Magma Signet",
   "Soot-Glass Ring"
  ],
  "trinket": [
   "Pocket Furnace",
   "Ember Heart",
   "Drake-Scale Charm"
  ],
  "weapon": {
   "AGI": [
    "Obsidian Stiletto",
    "Drakebone Bow",
    "Cinder Hatchet"
   ],
   "INT": [
    "Pyrewood Staff",
    "Ash Wand",
    "Cinderwood Rod"
   ],
   "rogue": [
    "Obsidian Stiletto",
    "Cinder Hatchet",
    "Slagglass Dirk"
   ]
  },
  "offhand": {
   "AGI": [
    "Slag Bulwark",
    "Anvil Buckler",
    "Forgeplate Targe"
   ],
   "INT": [
    "Ember-Core Orb",
    "Ashbound Grimoire",
    "Codex of Karth"
   ],
   "hunter": [
    "Cinder Quiver",
    "Drakehide Quiver",
    "Emberwatch Quiver"
   ],
   "rogue": [
    "Ember Dirk",
    "Slag Parrying Blade",
    "Forgehand Knife"
   ]
  }
 }
];
