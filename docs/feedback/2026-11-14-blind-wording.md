# Blind tester report: Information editor (owner request 2026-11-14 12:32, D144)

Date: 2026-11-14. Tester: fresh agent, Fable, high effort, no repo or docs access, played game.html build 2609a70 through screenshots and key/click actions at 1366x768. Brief: judge the amount of text per screen, repetition, unnatural wording and hint precision, and propose cuts.
Session: 220 actions, Rogue, guided first run, zone 1 from class select to the Bell (zone 2 arrival not reached; spellbook and settings not opened). Screenshot names (sNNNN) refer to the tester's shots folder outside the repo. Word counts are estimates.

Status: feedback for the owner to steer (owner leads this direction). No text is changed until the owner picks.

## 1. Verdict

Far too much text for a first run, and most of it repeats the same fact. Worst: the first round of every fight (about 240 words; about 290 against the elite, where "Deathblow" appears 10 times and "Sap, then wait" 5 times). Second worst: the map with the Furnace bar ("toll(s)" about 20 times; four toll counters and up to four Dimming countdowns before any line says what a toll is). The Furnace is the least natural writing: six metaphors on one mechanic (furnace, tolls, the Star's line, clock, dimming, par), a 145-word tooltip, and a 12-word coach line five tolls too late. Quest panels, bags, talents and the Bell dialog show the game can be brief.

## 2. Per screen (summary)

| Screen | Words visible | Main repeats | Unnatural or unexplained (quoted) | Verdict |
|---|---|---|---|---|
| Class select (s0001-s0006) | ~75 | Rogue tags twice; "Echoes" 3x in one tooltip | "0 Echoes · no unlocks within reach"; SEED field; "Hall of Echoes" before any play | Acceptable; hide Seed and Echoes on a first run |
| Start camp (s0008-s0019) | ~120; contract tooltips 60-75 | Contract tooltip: "Barleyreach Verge" 3x, "Cull" 3x, "site(s)" 4x, lines 2 and 3 the same sentence; "sold back for a full refund until you set out" in all four supply tooltips | "Supplies and sight ... sight lasts the whole run"; "nodes in full view: within 1 hop"; "two Elite nodes of rings 2 and 3"; "2.8 levels of XP at level 8 (8 176 XP)"; footer "Unspent: 10 points = 20 Echoes" vs tooltip (points become Reserve, then Echoes) | Too much, too early: contracts for zones 1, 4 and 6 and three currencies before a map |
| First hub (s0021-s0046) | ~115 | "toll(s)" 6x; "set out" in banner, log and button; Trainer tooltip repeats its card | "20 tolls in hand", "Boss +0 %", "Dimming: 14 tolls", "Tolls so far: 0", "3 points of Reserve", "Resurrect charges" | Panel fine; Furnace bar and open log are noise |
| Map and Furnace bar (s0049-s0057, s0166) | ~150-175 | "toll(s)" ~20x; "Pass · 1 toll" 4x+; "Greywater Fens CLOSED" 3x; "dims in 4" up to 4x; four toll figures at once | "The hotter clock sets the state: now the line (Calm)."; "Boss +0 % if you keep the line from here."; "the Star's line"; "(Ascendancy)"; "par 120"; "Type known"; Bell "calls its bearer home along the road it was cast for"; "SMOULDERING · Dimming 8 tolls in hand Boss +0 % Dimming: 4 tolls" | Worst resting screen; the Moves panel duplicates the node chips |
| Node tooltips | Quest ~85, Grind ~60, Rest ~65, Elite 75-110 | Same 4-line Furnace block on every tooltip; two Dimming numbers in one tooltip; "Foes: 1 enemy" plus "One wave of 1 enemy" | "Pays Calm: no reward"; "ends Burning (a new state)"; "Ring 1 · guided fight"; "Dims in 0 tolls"; the Deathblow rules list | Top halves good; shrink the Furnace block to one cost line |
| Combat engage round | ~240 (elite ~290), ~60 after round 5 | "do(es) not act" 4x plus "Unaware" 2x; "You stay in Stealth" 3x; enemy plan in 3 places; elite: "Deathblow" 10x, "Sap, then wait" 5x, "MAIMS if it lands" 4x | "Read their tracks, pick a target, then open."; "Shadowstep Strike once learned, else Gutting Jab x1.5"; "Sure if you wait"; "Round 2 · its turn 1"; one event with four names (answered, stopped, cancelled, staggered); Pass also called "wait" | Opening rounds overloaded; right after round 5 |
| Loot and reward | 40-60 | "in your bags" 2x; "of the Fox" on all three first items | "ilvl 3" / "Item level 3"; "Upgrade (+1.6)" with no unit; "+1 AGI +1 POWER" vs "+1 Agility"; names like "Fierce Lucky Barleycorn of the Fox", "Sturdy Cord of Wheat of Grit"; "BURNING SPOILS" | Layout good; naming and abbreviations bad; long names clip the third card (s0164) |
| Trainer | 80-95 | "Level" 9x; "Level 1 ·" means rank on known spells and requirement on locked ones | "Spells grow only when trained to your level" | Usable; "Train all" did not learn the new spell |
| Bags, talents, character, contracts | 8 / 20 / 45 / 25 | Talents: points shown four ways; effect said three times | "avg 26.37"; "Resurrections: Ember of Return" (fourth name); mana and pet text shown to a Rogue | Bags and talents cleanest |

Coach lines in order (verdicts): "Take a contract..." stays after the action, "sites" undefined; "Click a lit node next to you to walk there." good; "Contract site: win this fight to count it." shown twice; "Press [1] to attack..." contradicts the Engage panel (Q, W, E); loot line wrong (items already in bags, no green arrow on screen); "The Furnace: each step costs tolls. Stay left of the Star's line." five tolls late; "You start hidden: openers work only from stealth." when no opener is owned; "New spell ranks..." duplicates the level-up banner; the Dimming line shown 3 times while all Roads read CLOSED; "Round 1 is yours..." right line, two fights late; "Contract done: choose one reward." three screens early; "Its next three moves, in order. The big one is marked." good but late; "Talent point: spend it in Talents ([N])." good; "Face Gorrak first..." over the Talents panel; the Burning line arrives at toll 22 while the bar reads INFERNAL; the Deathblow instruction is the fifth copy and stays after Sap; "Off-balance... Spend your big hit now." at 0 combo points; "Low health..." well written; "In the dark: walk away from the Shardfall." with nowhere to walk. No line ever explains combo points and finishers, energy, the growing "+10 %" enemy badge, or how to change target.

## 3. Glossary problem

About 60 invented or specialised terms appear in zone 1; about 25 before the first fight. Main offenders: Echoes and Hall of Echoes (class select, not needed); Seed (never explained); five names for the final boss (Oruvath, the Unlit Star, the Star, Boss, end boss); Contracts, Cull, Bounty, sites, preparation points, Reserve, "sight", hop, rings (start camp); four names for the revive (Ember of Return, Resurrect charges, Resurrections, Carried); the Furnace, tolls "in hand", zone toll, "Tolls so far", par, Calm/Smouldering/Burning/Infernal, "the Star's line", Ascendancy, "Pays", Spoils, Burning Spoils; the Dimming, Dimmed, dims, "the dark", Shardfall, Shardspawn; "guided fight"; Seen/Remembered/Type known/Unknown; Pass with two meanings; Engage, Opening, "tracks", Unaware; STRIKE/CONTROL/SETUP tags; Stealth and "hidden"; combo points, builder, finisher (never coached); energy (never explained); the "+10 %" badge; Deathblow, Answer, Maimed, Staggered, Off-balance, Empowered, Mirrorshade, ward; ilvl, item level, item score, AGI/STA/SPI/POWER; rank and level.

## 4. Cut list (ranked by impact)

| # | Where | Current | Proposed | Why |
|---|---|---|---|---|
| 1 | Furnace bar, hub and map (s0021, s0049) | "The Furnace ● CALM 20 tolls in hand Boss +0 % Dimming: 14 tolls" and "Burning pays +35 % XP and gold · 1 in 2 drops up" | Hide until the coach introduces it; then "Calm · 18 tolls to spare"; show "Boss" only above 0; remove the subline | Six unexplained terms on the first interactive screen |
| 2 | Elite engage (s0195) | The instruction in 5 places | Keep only the prompt bar: "Round 3: Threshing Blow, about 85. Sap now [W], then Pass [X]." | "Deathblow" 10x, "Sap, then wait" 5x |
| 3 | Engage panel (s0071) | "They have not noticed you: enemies do not act this round. Read their tracks, pick a target, then open." plus three more copies | Header: "Free first move. They act from round 2." Keep the UNAWARE badge | One fact, six times |
| 4 | Engage cards (s0071) | "You stay in Stealth." 3x; "...Shadowstep Strike once learned, else Gutting Jab x1.5 for +2 combo points." | Remove the three; Ambush: "Gutting Jab at x1.5. +2 combo points." | Repetition; "else" is code syntax |
| 5 | Furnace tooltip (s0027) | 145 words incl. "The hotter clock sets the state..." | "Every move costs tolls. Overspend and fights pay more, but the final boss gets stronger." plus the 4-row table | Unparseable |
| 6 | Node tooltip Furnace block (s0058) | Four lines ending "Or walk through it without doing it (1 toll): Pass in the list of moves." | "Costs 3 tolls." plus a bonus line only when there is one | Four lines on every node |
| 7 | All node tooltips | "Pays Calm: no reward" | Remove | Reads as "no reward" |
| 8 | Node tooltips and bar | "Dims in 9 tolls" plus "Dimming in 6 tolls"; "Dims in 0 tolls" | Keep map chips and the Dimming panel; remove both tooltip lines | Four countdowns, different numbers |
| 9 | Moves panel (s0049) | "Enter Quest · 3 tolls / Pass · 1 toll" in 8+ rows | Remove the panel; offer "Pass through (1 toll)" on the node | Duplicate of the chips |
| 10 | Toll counters | "zone toll 2", "Tolls: 2 (par 120)", "Tolls so far: 0" | Remove all three | One number is enough |
| 11 | Coach, fight 1 (s0071) | "Press [1] to attack. Bring their health to zero."; "You start hidden: openers work only from stealth." | Use "Round 1 is yours: they act from round 2. Open with [Q], [W] or [E]." in fight 1; remove the other two | Contradicts the panel |
| 12 | Coach, Furnace (s0097) | "The Furnace: each step costs tolls. Stay left of the Star's line." | At the first hub: "Every move costs tolls. Spend too many and the final boss gets stronger." | Late; refers to bar geometry |
| 13 | Coach, Dimming (s0134, s0166, s0176) | Dimming line 3x; "In the dark: walk away from the Shardfall." | Once: "The dark spreads from the purple star. Places it reaches are lost." After the elite: "Take a Road to leave." | Roads closed when shown; last line cannot be followed |
| 14 | Contract tooltip (s0010) | ~75 words, task stated twice | "Win 2 Quest or Grind fights in Barleyreach Verge. Reward: about 3 levels of XP, 3s 12c and 1 of 3 items. Cost: 2 points." | Name 3x; jargon before the map |
| 15 | Start camp (s0008) | Zone 4 and 6 contract cards; "Supplies and sight..."; "Unspent: 10 points = 20 Echoes, usable at hubs" | First run: zone 1 contract only; remove both lines; heading "Supplies" | Cannot judge zone 6 yet; footer contradicts tooltip |
| 16 | Enemy plan (s0071) | Same three moves in target panel, Opening strip and chips | Keep the chips; remove the Opening strip; list on hover | ~45 duplicated words; strip mislabels past rounds |
| 17 | Skill tooltips (s0039, s0040) | "Before level difference, crits and the target's defences."; "Right-click to clear · drag to reorder"; damage said twice | Remove the first two (keep the second in the spellbook); keep one damage line | Developer disclaimer; repetition |
| 18 | Coach, loot (s0091, s0094) | "[Space] takes all. A green arrow marks an upgrade: equip it in your bags ([B])." | "Green arrow means upgrade. Equip it in your bags [B]." Only when a row has the arrow, never on reward screens | Wrong twice; stale |
| 19 | Loot rows (s0091) | "Coins (already in your purse)", "in your bags" 2x, "Earned in this fight", "ilvl 3" | Remove the notes; write "item level 3" | Continue already implies it |
| 20 | Item names | "Fierce Lucky Barleycorn of the Fox", "Sturdy Cord of Wheat of Grit" | One affix at most: "Lucky Barleycorn", "Wheat Cord"; never two "of" | Machine-made; clips cards |
| 21 | Trainer (s0139) | "Spells grow only when trained to your level"; "Level 1 · ..."; "Train all" | "Train spells to bring them up to your level."; drop "Level N ·" on known spells; "Train all" includes new spells | Awkward; double meaning; trap |
| 22 | Hub trainer card (s0021) | "Nothing new to learn yet (next spell at level 4)" with a 1-toll cost | Grey the card: "Next spell at level 4." | Charges a toll for nothing |
| 23 | Elite node tooltip (s0167) | The Deathblow rules list; "Closed for now: you cannot enter it yet" | "Has a Deathblow: one huge hit you must stop."; "Not here yet." | Rules for abilities not owned |
| 24 | Deathblow stopped (s0201) | "DEATHBLOW STOPPED / staggered: −30 % dmg", "ANSWERED", "OFF-BALANCE · +50 % DMG · +20 % CRIT", chip, coach, prompt | One banner: "Deathblow stopped. It is weakened: hit it now." plus one status chip | Three statuses, four verbs, one event |
| 25 | Toasts and state line (s0146) | "Smouldering: the Dimming draws near."; "SMOULDERING · Dimming 8 tolls in hand Boss +0 % Dimming: 4 tolls" | Remove the toast; state line "Smouldering · 8 tolls to spare" | No consequence stated; "Dimming" twice |

## 5. What works and should stay

Quest accept and complete panels (s0068, s0094); "When the straw man starts to chant, stop it." (s0178), the best tutorial line; the Bell confirm dialog (s0218); the level-up banner "New at the trainer: Shadowstep Strike" (s0130); coach lines "Click a lit node next to you to walk there.", "Round 1 is yours...", "Its next three moves, in order. The big one is marked.", "Talent point: spend it in Talents ([N]).", "Low health: drink a Healing Draught ([8]). It uses your turn."; the Roads-open toast (s0207); the prompt bar "YOUR TURN · R2 Choose [1]-[7], [A] attack or [X] pass"; short tooltips (Pass, Flee, region lines, "Remembered: seen before, out of sight now.", "Gorrak is out on the downs. He comes back after 3 more fights.", "Junk. Sell it to a vendor."); bags and talents at rest; combat after round 5 (~60 words).

## 6. Ratings

| Measure | Score |
|---|---|
| Amount of text | 3 |
| Clarity of wording | 4 |
| Precision of hints | 4 |
| Naturalness of language | 5 |

## 7. Text that is wrong, not only long

- Opening strip: past rounds read "no hits on you" while the log shows hits (s0083, s0126, s0153).
- Severing Flourish in combat says about 24 per combo point; 2 points hit for 17 (s0085).
- Loot "404 experience Earned in this fight" vs float and log "+1555" (s0091).
- "Train all" left Shadowstep Strike on "Learn" with enough coin; card then "Used this visit" (s0140-s0142).
- Gorrak: node tooltip "Level 6", panel "Elite · level 5" (s0191, s0193).
- Elite move cost: chip "5 tolls", Moves panel "Enter Elite · 3 tolls" (s0189).
- Bell: dialog "in 2 tolls", tooltip and bar "4 tolls + Dimmed fight"; dialog omits the fight (s0218, s0220).
- "INFERNAL" bar next to "This node pays Burning"; "BURNING SPOILS" next to "Spoils: +50 % XP and gold" (s0193, s0207).
- The Dimming tooltip promises Shardspawn; the enemies were Barn Wolf and Hedge Ogre (s0209).
- The "+10 %" to "+50 %" enemy badge has no tooltip (s0084, s0157).
