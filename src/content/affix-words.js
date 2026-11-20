// Content table: item name words per stat-pair affix (rules.md 8.3, 12). Plain data only (Content Designer).
// content-2026-11-20 (blind Legacy v2 s0293, wording cut list item 20; draft): new words throughout. Animal suffixes
// ("of the Bear", "of the Owl", "of the Wolf") are gone: they echo an existing game's naming and made every item end the
// same way. An empty string is a valid suffix and means "no suffix": the base name alone. Each list holds two of them, so
// about half of the items without an affix carry a plain name and the "of ..." tail no longer reads as a pattern.
// Prefixes are words of make or finish that sit well before any base name ("Potent Barleycorn Token", not "Fierce Lucky
// Barleycorn").
export const AFFIX_WORDS = {
 "suffix": {
  "AGI": [
   "",
   "of Quick Hands",
   "",
   "of the Long Stride"
  ],
  "INT": [
   "",
   "of Lamplight",
   "",
   "of the Inkwell"
  ],
  "STA": [
   "",
   "of Deep Roots",
   "",
   "of the Long Winter"
  ],
  "AGI_STA": [
   "",
   "of the Drover",
   "",
   "of Hard Roads"
  ],
  "AGI_SPI": [
   "",
   "of Still Water",
   "",
   "of the Calm Hand"
  ],
  "INT_STA": [
   "",
   "of the Watchfire",
   "",
   "of Thick Walls"
  ],
  "INT_SPI": [
   "",
   "of Quiet Hours",
   "",
   "of the Hermit"
  ],
  "AGI_STA_SPI": [
   "",
   "of the Outrider",
   "",
   "of Open Country"
  ],
  "INT_STA_SPI": [
   "",
   "of Old Lore",
   "",
   "of the Hedge-Seer"
  ]
 },
 "prefix": {
  "crit": [
   "Keen",
   "Honed",
   "Deft"
  ],
  "power": [
   "Runed",
   "Potent",
   "Hallowed"
  ],
  "armor": [
   "Sturdy",
   "Reinforced",
   "Warded"
  ]
 }
};
