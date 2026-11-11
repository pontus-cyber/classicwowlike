# Combat v2 spec: the opening matters

Owner: Lead Game Designer (combat). Status: draft for Lead and owner review, 2026-11-10. A change set on top of docs/specs/rules.md section 7 (and 3, 5, 10 where named). Rules in sections 2-8; pacing 9; UI 10; bots 11; balance targets 12; prototype evidence 13; open choices 14; constants 15; combat v2.1 (2026-11-10, after the sim measure docs/reports/balance-2026-11-10d.md) in section 16, changed lines marked "(combat v2.1)", change table docs/specs/changes-combat-v21.md. M2b v13 "special fights demand thought" (2026-11-11, docs/specs/changes-m2b-v13.md, D105-D110; owner go-ahead 21:26) in section 17, changed lines marked "(M2b v13)"; in the engine since 2026-11-11 (docs/handoffs/engineer-2026-11-11j.md). M2b v14 (2026-11-12, docs/specs/changes-m2b-v14.md rows 1 and 4, D111 and D113; status draft as that file): autoplay rule H and the PASS that keeps STEALTH while every enemy is SAPPED (6.2, 8, 17.2), the v13 switches on by default (17.3); changed lines marked "(M2b v14)"; in the engine since 2026-11-12 (docs/handoffs/engineer-2026-11-12.md).
Audience: Core Gameplay Engineer, UI/UX Engineer, Simulation & Balance Engineer, Content Designer, QA.

Sources: owner feedback [stated: docs/feedback/2026-11-10-1043-owner.md]; current combat [source: docs/specs/rules.md 5, 6, 7, 10]; balance state [source: docs/reports/balance-2026-11-10b.md]; playtest [source: docs/handoffs/qa-2026-11-09.md]; scratch prototype on the real engine [source: sim/out/combat2/, git-ignored, section 13]. Every number is a named constant in the table at the end (section 15); all are starting values for the Simulation & Balance Engineer.

What the owner asked for [stated]:
1. Combat feels predictable and can be beaten by mashing buttons.
2. As in a deck-building roguelike, the player should think about the first 4-5 moves of a fight before engaging, because the opening can decide life or death.
3. Mashing should work to some extent; planning the opening must be clearly rewarded.
4. Animations become 40 % slower (UI task), so each fight takes longer: fights must carry more weight, not just more time.

Kept: the 7-slot bar plus 3 item slots, manual by default with an autoplay toggle, intents, the three classes and their spells and talents, the end boss, determinism (seed + action log), the damage pipeline (rules 7.2) except one new target modifier.

---

## 1. Diagnosis (why combat is mashable today)

Measured on the current engine, P0, 300 runs per class, seeds 1000-1299, the 11-10b planner risk table [source: sim/out/combat2/out-base]:

| Bot (combat policy) | Reach the boss | Non-boss deaths per 1 000 fights | Win rate |
|---|---|---|---|
| masher (biggest damage button, potion at 35 % HP, ignores intents) | 80.9 % | 4.54 | 4.1 % |
| planner (autoplay, rules 7.9) | 82.3 % | 4.11 | 25.3 % |
| opener (the tactician's per-round search in the first 5 rounds, then autoplay; see 13 for its limits) | 83.4 % | 3.75 | 27.4 % |

[inference: from the table] Levelling fights do not reward play at all: mashing reaches the boss as often as autoplay (1.4 pp less) and as often as a planned opening (2.5 pp less). The only skill check today is the end boss, which the masher loses (4 % against 25 %). The reasons are in the rules:
- Intents are rolled one round at a time with weights (basic attack 50-70 %), so the player can react to one round but cannot plan a sequence (rules 7.6).
- Dangerous moves (heavy, cast) appear at random rounds, so there is no "opening" to plan for; most rounds are basic attacks that any action answers equally well.
- Stopping a big move only prevents damage; it never creates an opportunity, so there is no setup -> payoff.
- Resources start full and cooldowns at 0, so "press the biggest button" is a near-optimal opening for every class.

The design below fixes each of these four points with one mechanism, and gives every class three opening plans from level 1.

---

## 2. Overview of the change set

| # | Mechanism | Replaces / changes in rules.md | Purpose |
|---|---|---|---|
| A | **Intent track**: every enemy shows its next INTENT_TRACK_LEN actions, not just the current one | 7.1 step 1, 7.6 intent roll, 10.3 | planning becomes possible |
| B | **Opening scripts**: each archetype has a fixed 3-turn opening; elites, rares and dungeon bosses play their signature ability on turn SIGNATURE_TURN | 7.6 (new column), 12.2, 12.4 | the danger is concentrated in rounds 2-4 and differs by enemy, so the first target and the first answer matter |
| C | **Pack roles**: Signal (skulker calls a reinforcement), Bolster (mender shields), Bloodlust (beast ramps), Shield Ally targets a named ward | 7.6 archetype table | composition punishes the wrong first target |
| D | **Off-balance windows**: a stopped or fully avoided big move leaves the enemy OFF_BALANCE (takes more damage, easier to crit) for one player action | 7.4 (new status), 7.7, 7.2 step 6 | setup -> payoff: the order of the first moves matters |
| E | **Engage round**: round 1 of every fight except the end boss is an engage round for all classes (enemies do not act); the player picks one of three class engage options or any bar spell | 7.1 round-1 exception, 5.3 stealth note | a deliberate pre-fight choice with real alternatives per class |
| F | **Autoplay v2**: engage rule, reads only the current intent | 7.9 | autoplay stays usable but measurably worse than a planned opening |
| G | **Pacing at slower animation** | rules 3 pacing terms, balance.md B15, B16 | fewer, weightier fights inside the 45 minutes |

Everything not named here keeps its rules.md text.

---

## 3. The intent track (A; replaces the intent roll in rules 7.6 and rules 7.1 step 1)

### 3.1 Turns and the track
- Fight round 1 is the engage round (section 6). An enemy's **turn t** is fight round `t + 1` (turn 1 = round 2). The end boss fight has no engage round: its turn t is round t.
- Every living enemy has a **track** of INTENT_TRACK_LEN entries: the entry for its current turn ("now") and the next INTENT_TRACK_LEN - 1 turns. In the engage round the track shows turns 1..INTENT_TRACK_LEN.
- An entry holds: action id, target (player, pet, an ally index, self, all), and flags `cast`, `heavy`. The estimated damage is computed from the current state whenever it is shown (it changes with CHILLED, CURSED, WARD etc.), as today.

### 3.2 Filling the track (stream `fight(...)`)
- At fight start, entries for turns 1..INTENT_TRACK_LEN are made in turn order, enemies in index order.
- At the start of every later round, after the head entry has been used, one entry is appended at the tail of each living enemy's track (enemies in index order).
- Entry for turn t: if `t <= OPENING_TURNS`, the scripted action (section 4); otherwise a weighted pick (1 draw) among the archetype actions and template abilities, as rules 7.6, where an ability counts as on cooldown if an earlier entry in the track already uses it within its CD. Target: 1 draw for player/pet aggro when a live pet exists and no TAUNT or feign is active, as today.
- Draws happen when an entry enters the track, never later. Consequence: entries already shown are fixed facts; entries not yet shown are not in the state. A look-ahead on a cloned state with a re-seeded fight stream (the tactician's samples) therefore knows exactly what the player sees and nothing more.

### 3.3 When an entry becomes "now"
- Conditions are checked at that moment (Mend needs an ally below MEND_BELOW, Shield Ally needs an ally, CD still running because of an interrupt, SILENCED for casts). If the entry is not valid, it is replaced by the archetype's basic attack and the UI shows the change ("Mend -> Strike: no wounded ally").
- TAUNT and feign retarget single-target entries at this moment (as rules 7.1 step 4).

### 3.4 Control and the track
- STUN, FROZEN, HEXED, SAPPED and a sprung trap **cancel the now-entry** of each turn the enemy is controlled. The rest of the track keeps its turns (it is not delayed). A cancelled `cast` or `heavy` entry makes the enemy OFF_BALANCE (section 5).
- An interrupt cancels a now-entry with `cast` (rules 7.7), and its CD starts.
- SILENCED: cast entries that become "now" while SILENCED are replaced by the basic attack (3.3).
- Summoned enemies and Signal reinforcements get a track at once; their turn 1 is the round after they appear; they play no opening script (they use weighted picks from turn 1).

### 3.5 The end boss (10.3)
The boss's schedule is already deterministic (Umbral Strike, Gravity Crush every BOSS_CRUSH_EVERY, Litany, Pulse, Shards, Brand counter). Its track shows the next INTENT_TRACK_LEN rounds of that schedule; phase changes caused by damage can change entries, which the UI marks as "if phase 2 starts". No rule of section 10 changes except the OFF_BALANCE hooks in 5.1.

---

## 4. Opening scripts and pack roles (B, C; adds to rules 7.6)

### 4.1 Archetype scripts (turns 1..OPENING_TURNS)
| Archetype | Turn 1 | Turn 2 | Turn 3 | What it asks of the player |
|---|---|---|---|---|
| brute | Strike | Heavy Smash (heavy) | Strike | stop or absorb turn 2; punish the window |
| caster | Bolt | Hex Bolt (cast) | Wither (cast) | interrupt or control turn 2, or kill the caster in rounds 1-2 |
| skulker | Rend | Strike | **Signal** (cast; only if the fight started with >= 2 enemies, else Strike) | kill, interrupt or control the skulker by turn 3 |
| beast | Frenzy | Bite | Frenzy; **Bloodlust** passive | kill it early; every turn alive makes it stronger |
| guardian | Shield Ally on its **ward** | Strike | Brace | do not spend burst on the ward in turns 1-2; or control the guardian at engage |
| mender | **Bolster** on the lowest-HP ally | Strike | Mend (cast) | kill or control the mender; interrupt Mend |

Elite, rare and dungeon boss variants: the entry for turn SIGNATURE_TURN is the template ability with the highest `pct` (ties: first listed); a dungeon boss also plays its second template ability on turn SIGNATURE_TURN_2. Abilities with `once` (enrage, summon) keep their HP triggers.

(combat v2.1) These signature entries are **wind-ups** (section 16.2): interruptible like a cast on every enemy, dungeon bosses included; answered, the enemy is STAGGERED for the rest of the fight (-STAGGER_DMG damage dealt); landed, it is EMPOWERED for the rest of the fight (+EMPOWER_DMG). SIGNATURE_TURN_2 moves from turn 5 to turn 4, so a dungeon boss's two wind-ups fall in rounds 3 and 5.

(M2b v13) The SIGNATURE_TURN wind-up (round 3) is the fight's **Deathblow** (17.1): a damaging one hits × DEATHBLOW_MULT on top of its script multiplier; landed, it EMPOWERS the enemy by DEATHBLOW_EMPOWER and MAIMS the player (MAIM_HEAL). A dungeon boss's SIGNATURE_TURN_2 wind-up stays an ordinary wind-up.

### 4.2 New archetype actions
| Action | Archetype | Effect | Flags | CD |
|---|---|---|---|---|
| Signal | skulker | at the end of the round, SIGNAL_ADDS normal enemy joins: template drawn (1 draw) from the encounter's add pool (the zone's normal templates of the node's region; Content fills the pool), level = the skulker's level, no XP or loot; at most once per fight | cast | once |
| Bolster | mender | the lowest-HP ally (self included) gains a shield of BOLSTER_PCT × its max HP (the existing enemy `shield`, absorbed first) | - | 4 |
| Bloodlust | beast | passive: +BLOODLUST_STEP damage per turn the beast has acted, at most BLOODLUST_MAX | - | - |
| Shield Ally (changed) | guardian | the target is the guardian's **ward**: the ally with the lowest index that is not a guardian, fixed at fight start and shown on both frames; the rest as rules 7.6 | - | 4 |

### 4.3 Encounter composition (Content, 12.2 and the expedition's encounters)
- Encounters of 2 or more enemies hold at least 2 different archetypes.
- Encounters of 3 enemies hold at least one of caster, mender, skulker, beast.
- A guardian never appears alone with a mender only (two passive enemies make a dull opening).
- The map tooltip shows the enemy count and archetype icons before the player enters (also fixes BUG-QA-02), so a pull can be planned from the map.

---

## 5. Off-balance windows (D; adds to rules 7.4, 7.7, 7.2 step 6)

### 5.1 Gaining OFF_BALANCE
An enemy becomes OFF_BALANCE when:
1. its now-entry with `cast` is interrupted; or
2. it is STUN, FROZEN, HEXED, SAPPED or trapped on a turn whose now-entry has `cast` or `heavy` (the big move is cancelled); or
3. it completes a `heavy` action from which the player lost 0 HP (miss, dodge, WARD, IMMUNE, Mirrorshade image, or redirected to a pet by TAUNT or feign).
End boss: (1) on an interrupted Collapse Litany, (3) on a Gravity Crush that costs the player 0 HP. Dimming Shards: as normal enemies.

### 5.2 Effect and duration
| Field | Value |
|---|---|
| Damage taken from the player and pet | +OFFBAL_TAKEN (end boss: +OFFBAL_BOSS_TAKEN); added to the rules 7.2 step 6 sum |
| Player crit chance against it | +OFFBAL_CRIT |
| Its dodge | 0 |
| Duration | through the end of the round after the round it was gained in (status duration 2 under rules 7.4, applied at the event). Gained by the player's own action: the pet hits in that round and the player gets the next round's action. Gained during enemy actions: the player gets exactly the next action. |
| Stacking | refresh, no stacks |
| Mage | FROZEN enemies count as OFF_BALANCE for the damage and crit bonus while FROZEN (Rime Burst and Binding Glyph open mass or single windows) |

The window is the payoff for a set-up: a held finisher, Pyre Comet, Starlance Barrage, Heartseeker Shot, Savage Order or a cooldown burst (Rapid Volley, Conflagrant Core, Thousand Cuts) is worth OFFBAL_TAKEN more and crits more often when it lands in the window. Mashing spends those buttons in round 1-2 and misses the window.

---

## 6. The engage round (E; replaces the round-1 exception in rules 7.1)

### 6.1 Rule
- Round 1 of every fight except the end boss is the **engage round** for every class: enemies show "Unaware" and do not act; DOT ticks, regen and durations run as in any round. (Today only a stealthed Rogue gets this round; v2 generalises it.) Dungeon bosses included; their CC immunity limits the control options (6.3).
- In the engage round the player sees every track (turns 1..INTENT_TRACK_LEN) and takes one action: `ENGAGE(optionId, targetIdx)`, any bar spell (`CAST`), `ATTACK`, `USE_ITEM`, or `PASS`. `ENGAGE` is legal only in the engage round, once per fight.
- Engage options are class abilities, not bar spells: they need no bar slot, no training and no resource, and are known from level 1. Their strength scales with L (and tl = L).
- Price of the free round: enemy damage × ENGAGE_DMG_COMP (section 13: measured to keep the autoplay reach-the-boss rate where it is today). Not in the Rogue's fights, which already had a free round (D48), except its dungeon-boss fights, which it starts without STEALTH (D49).

### 6.2 Class engage options
Each class has a **strike**, a **control** and a **setup** option. Damage options follow rules 7.2 like a spell.

Rogue (starts the fight in STEALTH as today; the engage round replaces its Unaware round)
| id | Kind | Effect |
|---|---|---|
| ambush | strike | Shadowstep Strike on the target if learned, else Gutting Jab × AMBUSH_MULT; +2 CP; keeps STEALTH like today's stealth opener (D48), so round 2 can open again |
| sap | control | target non-boss enemy is SAPPED for SAP_TURNS turns (cancels those now-entries, 3.4); breaks on any damage to it, DOT ticks and AoE included; the Rogue **stays in STEALTH**, so round 2 can still open with Shadowstep Strike on another enemy. (M2b v14) A PASS keeps STEALTH while every living enemy is SAPPED, so against a lone enemy the Rogue can wait for Sap to cancel its wind-up and still open from STEALTH into the OFF_BALANCE window |
| premeditate | setup | +PREMED_CP CP; stays in STEALTH. Typical use: round 2 Temple Blow with 3 CP (STUN 2) on the brute's turn-2 Heavy Smash -> cancelled -> OFF_BALANCE -> finisher into the window |

Mage (no stealth; the engage round is "from range")
| id | Kind | Effect |
|---|---|---|
| precast | strike/setup | cast one bar spell at 0 mana cost (its CD starts): a nuke, Living Flame before Pyre Comet, Frost Lance, Arcane Ward up before the turn-2 hit, Hexbind on the caster |
| binding_glyph | control | target non-boss enemy is FROZEN for GLYPH_TURNS turns (not broken by damage; counts as OFF_BALANCE while FROZEN, 5.2) |
| gather_power | setup | the next GATHER_SPELLS damaging spells cost 0 mana and have +GATHER_CRIT crit chance; lasts the fight |

Hunter (ranged, pet)
| id | Kind | Effect |
|---|---|---|
| opening_shot | strike | Keen Shot × OPENING_SHOT_MULT on the target, and MARKED (value SPELL.mark_prey value) for OPENING_MARK_ROUNDS rounds |
| lay_trap | control | a trap on a non-boss target: it springs on the target's first now-entry with `heavy` or `cast` within turns 1..INTENT_TRACK_LEN (cancels it, STUN TRAP_STUN, OFF_BALANCE), else on its turn 1 (STUN TRAP_STUN, no OFF_BALANCE) |
| send_pet | setup | the pet engages first: pet TAUNT for PET_LEAD_TURNS turns and takes -PET_LEAD_DR damage during them; needs a live pet |

### 6.3 Bosses and immunity
Control options cannot target CC-immune enemies (dungeon bosses) and are greyed out with a reason. `sap`, `binding_glyph` and `lay_trap` on an add of a boss fight work normally. The end boss has no engage round (open choice 4).
(combat v2.1) On a CC-immune enemy every control option is **Disrupt** instead: legal while its track shows a wind-up in turns 1..INTENT_TRACK_LEN; it cancels that one entry (a trap that springs on its turn: OFF_BALANCE and STAGGERED) and does nothing else. Greyed out with a reason when no wind-up is visible.

### 6.4 Class opening plans (what "real alternatives" means)
| Class, situation | Plan A | Plan B | Plan C |
|---|---|---|---|
| Rogue L8, brute + caster | ambush the caster (2 CP), Jab, Flourish: the caster usually survives to cast Hex Bolt on turn 2, and the brute's Heavy Smash lands the same round; fast, but takes both hits | sap the brute, ambush the caster in round 2 from STEALTH, kill it, then the brute wakes with no turn-2 Heavy | premeditate, Temple Blow the caster on turn 2 (Hex Bolt cancelled, OFF_BALANCE), finisher into the window |
| Mage L20, skulker + beast + mender | precast Hexbind on the mender, Frost Lance the beast, burn the skulker before Signal | binding_glyph on the skulker (no Signal), Rime Burst turn 2 (mass FROZEN = mass window), Cinder Storm | gather_power, two free crit nukes on the skulker in rounds 2-3, then deal with the ramped beast |
| Hunter L30, elite brute with dark_cast signature on turn 2 | lay_trap (springs on turn 2, OFF_BALANCE), Rapid Volley + Heartseeker into the window | send_pet (pet takes turn 1-2), Mark Prey, Barbed Arrow, build focus, Muzzle Shot on the turn-2 cast | opening_shot + Mark, Muzzle Shot turn 2, Heartseeker into the window |

Each line costs something the others do not: tempo (damage now), a control charge that could have covered another enemy, or exposure to a hit the plan chose to absorb.

---

## 7. Resources and cooldowns (small changes for ordering)
- Fight start is unchanged (energy and focus full, CP 0, cooldowns 0), so the opening budget is fixed and known; what changes is that its best use depends on the track.
- No spell values change in this spec. The ordering pressure comes from: (a) the engage choice, (b) scripted turn-2 and turn-3 threats, (c) OFF_BALANCE windows that a burst spent in round 1-2 misses, (d) existing combos (CP builder -> finisher, BURN -> Pyre Comet crit, CHILLED/FROZEN -> Shatter/Glacier Spike, MARKED -> burst).
- If B49 (mashing gap) stays under its floor after tuning OFFBAL_TAKEN, the first lever is OFFBAL_TAKEN, the second the scripted turn-2 multipliers (HEAVY_SCRIPT_MULT, CAST_SCRIPT_MULT), the third shorter cooldowns on the payoff spells. Not raw enemy damage: that punishes the planner as much as the masher.
- (combat v2.1) The levers of the opening's weight are now EMPOWER_DMG and STAGGER_DMG (16.2): together they move the masher and the planned opening apart; STAGGER_DMG - EMPOWER_DMG sets autoplay's difficulty (it answers about two thirds of the wind-ups). Setup options: PREMED_CP 3 -> 5, GATHER_SPELLS 2 -> 3, GATHER_CRIT 0.50 -> 1.0 (16.3).

---

## 8. Autoplay v2 (F; changes rules 7.9)
Before rule 1, in the engage round only:
- **E. Engage.** If at least 2 enemies are alive and the class's control option is usable on some enemy: the control option on the enemy whose track shows the largest estimated damage on the player over its turns 1..ENGAGE_AUTO_LOOK (ties: rules 7.9 default-target order). Otherwise the strike option on the default target (Mage: precast of the first bar spell whose autoplay condition holds). The Rogue never uses Sap here; Sap stays a manual option (D49).

- **E2. Answer the Deathblow** (M2b v13, D108), before E: the class's control option on the first living elite, rare or dungeon boss (index order) whose track shows a wind-up in turns 1..INTENT_TRACK_LEN, if legal on it (Disrupt on a dungeon boss); a lone special enemy counts and the Rogue may Sap here (E2 supersedes D49 and open choice 9 for this case; rule E keeps them). (M2b v13)

- **H. Wait in the shadows** (M2b v14, D111), after rules 1-2 and before rule 3, not in the engage round: while every living enemy is SAPPED and a SAPPED enemy's track shows, after its now-entry, a wind-up whose cancel the track predicts by SAPPED, PASS. Sap then cancels it at its turn (STAGGERED, OFF_BALANCE) and the PASS keeps STEALTH (6.2), so the Rogue opens next round. Switch `C.GATES.sapHold` (on). (M2b v14)

Then rules 1-6 as today. Autoplay reads **only the now-entry** (as today; rule H reads the track's predicted cancel, M2b v14) and never holds a spell for an OFF_BALANCE window. This is deliberate: the track and the window are the manual player's edge; autoplay remains a sound, safe default (it still interrupts, drinks and cleanses).

Default target: priority unchanged (mender > caster > others, lowest HP); SAPPED enemies are skipped like HEXED ones, and an enemy that was sapped is taken only when no other is left (D48).

---

## 9. Pacing at the slower animation (G; changes rules 3)
| Term | Today | v2 |
|---|---|---|
| PACE_ROUND_ANIM_S | 1.5 s | 2.1 s (+40 % [stated]) |
| PACE_ROUND_DECIDE_S | 1.0 s | 1.0 s |
| PACE_ENGAGE_S (reading the tracks and choosing the engage, manual profile, every fight with an engage round) | - | 6 s |
| PACE_AUTO_ROUND_S | 0.8 s | 1.1 s |

A manual round costs 3.1 s and every fight 9 s of overhead (PACE_FIGHT_OVERHEAD_S 3 + PACE_ENGAGE_S 6). A run today has about 300 rounds and 50 fights [source: sim/out/combat2/out-base, B15]: at v2 pacing that is 930 + 450 s = 23 min of combat, against 17.4 min today. To keep the 45-minute run [stated: BRIEF], combat gets a budget of COMBAT_MIN_MAX minutes per run (manual profile), reached by fewer fights, not shorter ones:
- Fights per run including the boss: FIGHTS_V2 band (today's B15 band 48-66 retires). The expedition spec (fewer, weightier fights per run) supplies this: each grind node is one fight (GRIND_MAX_WAVES 3 -> 1, with the wave's XP folded into a larger pack), and trivial 1-mob quest fights are merged into 2-3 enemy encounters.
- Fight length stays (rounds include the engage round): normal 4-6, elite 6-9, dungeon boss 8-12, end boss 30-40 (today 46; the boss windows in 5.1 shorten it).

---

## 10. What the UI must show
1. **Track per enemy**: INTENT_TRACK_LEN icons beside the unit frame, "now" largest; each with action name, target (player/pet/ally), estimated damage, `cast`/`heavy` badges, and the turn number. Hover gives the full text. Replaced entries show the change and the reason (3.3).
2. **Role badges** on frames: Lookout (skulker that will Signal; shows the Signal turn), Ward and Protector (guardian link drawn between the two frames), Bloodlust stacks, Bolster shield amount.
3. **Engage panel** in round 1: the three class options as large buttons (name, one-line effect, valid targets highlighted), the bar below. Hovering an option on a target previews its effect on the tracks (cancelled entries struck through, "OFF_BALANCE on turn 2" marker). Round 1 is labelled "Engage".
4. **Opening ruler**: a strip above the enemy frames numbering rounds 1-5 with the scripted threats placed on it, so the first five moves can be read at a glance.
5. **OFF_BALANCE**: a clear, animated marker on the frame and a "window" highlight on bar buttons whose damage benefits; ends with the window.
6. **Combat log** lines for cancelled entries ("Heavy Smash cancelled: stunned -> off-balance"), Signal reinforcements and Bolster shields.
7. Map tooltip: enemy count and archetype icons for each fight node (4.3).
8. Animation at the v2 budget: a manual round is on screen at most PACE_ROUND_ANIM_S (2.1 s); impact feedback per hit (the UI task already assigned).
9. (combat v2.1) Wind-ups: a distinct "Wind-up" badge on the track entry and on the opening ruler, with what answers it (interrupt, stun, control, Disrupt, or for a heavy one a full dodge, WARD or the pet); EMPOWERED and STAGGERED stacks as large, lasting badges on the enemy frame ("+15 % damage" / "-30 % damage"), and a log line "Wind-up answered: staggered" or "Wind-up landed: empowered". Disrupt shows on the engage panel as the control option's label on a dungeon boss.
10. (M2b v13) The Deathblow, MAIMED, answers, first meeting, map tooltip and autoplay hint: docs/specs/changes-m2b-v13.md "UI needs" 1-8; the engine's views in engine-api.md 6.2 (windupView, autoplayEngage, potionInfo's MAIMED amount, the map's Deathblow fields).

---

## 11. What the bots and the simulator need
| Item | Definition |
|---|---|
| masher (new bot) | planner for everything outside combat. Engage: the strike option on the default target. Each turn: a healing item if HP < AUTO_POTION_HP; else the usable bar spell with the highest damage amount (`spellInfo`; AoE × living enemies) on the default target; else the basic attack. Never reads intents. Manual time profile. Stands in for "rushing in and mashing" [stated]. |
| opener (new bot) | planner outside combat. At the engage round it plans the whole opening: candidate sequences of (engage option or bar spell, target) followed by OPEN_ROUNDS - 1 actions, built from the visible tracks (beam search, width OPENER_BEAM, over the bar, the engage options and the targets; candidates include holding a burst spell for a predicted OFF_BALANCE window), each sequence scored on OPENER_SAMPLES re-seeded fight streams to the end of round OPEN_ROUNDS plus OPENER_TAIL autoplay rounds, with the tactician's score and potions crediting their heal. It then follows the best sequence, re-planning when the track shows something the plan did not expect (a reinforcement, a changed entry). Later rounds and the end boss: autoplay. Autoplay's potion and cleanse rules (7.9 rules 1-2) always stand. Manual time profile. It isolates the value of planning the opening. Section 13 shows that a per-round 3-round search is not a substitute. |
| opener, combat v2.1 | the beam keeps, at every depth, the best sequence of every first action besides the OPENER_BEAM best (a setup or a Disrupt pays off two rounds later and fell out of the beam), and the final scoring on the held-out samples takes the best sequence of up to OPENER_ROOT_KEEP first actions. Stun and control spells are candidates on a CC-immune enemy whose now-entry is a cast (a wind-up). Measured in 16.4. |
| tactician | unchanged definition (balance.md 1) plus the engage search above. |
| planner, greedy, speedrunner | autoplay v2 (section 8). |
| Look-ahead fairness | clones keep the track (it is visible); the fight stream is re-seeded from the bot stream, so unshown tail entries are re-drawn (3.2). QA test: a look-ahead never reads an entry that is not yet in the track. |
| Fight replay harness (new) | at the start of a fight, clone the state; replay the same fight (same fight stream) with policy X for the first OPEN_ROUNDS rounds and policy Y after. Needed for B50. |
| Recorder | per fight: engage option used, target archetype, rounds to first OFF_BALANCE, OFF_BALANCE windows used/opened, Signal resolved (0/1), HP at end of round OPEN_ROUNDS; (combat v2.1) wind-ups answered and landed (engine events `stagger` and `empower`), by fight kind. |

---

## 12. Balance targets (new B48-B54; changes to B5, B15, B16)
| ID | Pri | Metric | Target | How |
|---|---|---|---|---|
| B48 | P1 | Opening value: opener minus planner, P0, paired seeds: (a) non-boss deaths per 1 000 fights, ratio opener / planner; (b) reach-the-boss rate | (a) <= OPEN_DEATH_RATIO_MAX; (b) >= OPEN_REACH_GAIN_MIN pp | full runs |
| B49 | P1 | Mashing works, to an extent: masher P0 reach-the-boss rate | >= MASH_REACH_MIN and <= planner - MASH_GAP_MIN pp | full runs |
| B50 | P1 | The opening decides: share of the masher's non-boss deaths that survive when the same fight is replayed with the opener's first OPEN_ROUNDS actions and the masher after; (combat v2.1) and that share minus the share that survives with autoplay's first OPEN_ROUNDS actions (the harness's control column) | >= OPEN_DECIDES_MIN; (combat v2.1) gap >= OPEN_DECIDES_GAP_MIN pp | replay harness |
| B51 | P2 | Engage diversity: share of each class option among the opener's engage choices in multi-enemy fights | each >= ENGAGE_SHARE_MIN, none > ENGAGE_SHARE_MAX | opener P0 |
| B52 | P2 | Windows are used by planning: (combat v2.1) OFF_BALANCE windows in which the player hits the enemy with a spell, per 100 non-boss fights, opener vs masher (was: share of windows opened, which the masher's few windows on its own target win) | opener >= WINDOW_PER100_MIN; opener - masher >= WINDOW_GAP100_MIN | recorder |
| B53 | P1 | Combat time budget: median manual combat minutes per run, planner P0 runs reaching the boss (v2 pacing) | <= COMBAT_MIN_MAX | estSeconds terms |
| B54 | P2 | First target differs from autoplay's default target in multi-enemy fights (opener) | >= FIRST_TARGET_DIFF_MIN | recorder |
| B55 | P1 | (combat v2.1) Wind-ups are answered by planning, not by mashing: share of wind-ups answered (16.2) in elite and dungeon-boss fights, opener and masher | opener >= WINDUP_ANSWER_MIN; masher <= WINDUP_ANSWER_MASH_MAX | recorder |
| B5 (changed) | P1 | tactician - planner, P0 | MANUAL_GAP_V2 band (was 8-25 pp); diagnostic: opener - planner >= OPEN_SHARE_MIN × (tactician - planner), i.e. most of the manual edge lives in the opening | full runs |
| B15 (changed) | P2 | Fights per run incl. boss, planner P0 runs reaching the boss | FIGHTS_V2 band (was 48-66) | full runs |
| B16 (changed) | P1 | Fight length in rounds incl. the engage round | normal 4-6, elite 6-9, dungeon boss 8-12, end boss ROUNDS_BOSS_V2 | full runs |

Kept as they are: B1-B4 (win-rate bands per bot; the engage compensation is tuned so that the planner stays in WR_P0_PLANNER), B21 stage deaths, B24 close fights, B38 tension, B26-B28 mechanic ablations.

(M2b v13) B59-B62 (one-button deaths per special fight kind, the planned opening's caps, autoplay kept playable, the grind kept as it is) are the sim's targets: docs/specs/changes-m2b-v13.md "Targets" (balance.md 3.5). B48 and B55 may move with rule E2 (O12).

If B48-B50 pass but B49's lower bound fails, mashing has become too punishing: lower OFFBAL_TAKEN or the scripted turn-2 multipliers before touching enemy HP.

---

## 13. Prototype evidence (scratch, real engine)
Built in a git-ignored copy (sim/out/combat2/v2) of src/ and sim/ at 39ecc5c. Implemented: B (archetype scripts for enemy turns 1-3 and the elite/rare/dungeon-boss signature on turn 2), D (OFF_BALANCE from interrupts, from control on a heavy turn and from a fully avoided heavy; +0.30 damage taken from player and pet; no crit bonus), E as a free engage round for every class with the existing bar only (no engage options), and enemy damage × 1.15 to pay for the free round. Not implemented: the multi-turn track display (scripted turns are deterministic, so the search already sees them; later turns stay one-round rolls), the engage options, Signal, Bolster, Bloodlust, the guardian ward, autoplay rule E. Bots added in the scratch copy: masher and opener (OPEN_ROUNDS 5) as in section 11. P0, 300 runs per class (900 per cell), seeds 1000-1299, risk table from the 11-10b pass (obs-P0), default trees of M2 v5.

| Cell | Reach boss | Non-boss deaths / 1 000 fights | Mean lowest-HP drop in won fights | Win rate | Rounds per run |
|---|---|---|---|---|---|
| today: masher | 80.9 % | 4.54 | 27.8 % | 4.1 % | 221 |
| today: planner (autoplay) | 82.3 % | 4.11 | 28.4 % | 25.3 % | 297 |
| today: opener | 83.4 % | 3.75 | 20.3 % | 27.4 % | 302 |
| v2 proto, no damage compensation: planner | 90.1 % | 2.20 | 20.9 % | 31.0 % | 308 |
| v2 proto, no damage compensation: masher | 85.9 % | 3.19 | 20.7 % | 3.6 % | 229 |
| v2 proto, enemy dmg × 1.15: planner | 82.0 % | 4.22 | 24.6 % | 28.2 % | 293 |
| v2 proto, enemy dmg × 1.15: masher | 74.7 % | 6.30 | 23.6 % | 3.0 % | 210 |
| v2 proto, enemy dmg × 1.15: opener | 77.0 % | 5.49 | 17.9 % | 26.2 % | 282 |

Read-out [inference: from the table; 900 runs per cell, a reach-the-boss rate has a 95 % interval of about ±2.5 pp]:
- Today, levelling does not reward combat play: masher, autoplay and the 5-round opener reach the boss at 81 / 82 / 83 %.
- With scripts + windows + engage round at matched autoplay difficulty (82.0 % against 82.3 %), the masher falls to 74.7 % and its non-boss death rate rises 49 % (6.30 against 4.22 per 1 000 fights). The masher gap in levelling grows from 1.4 pp to 7.3 pp with half the mechanisms built.
- The free engage round alone is worth about 8 pp of reach-the-boss to autoplay (90.1 % uncompensated); ENGAGE_DMG_COMP 1.15 cancels it.
- Fight lengths are unchanged (median quest 5 rounds, elite 8, dungeon boss 11), so the slower animation adds time per round, not rounds.
- The scratch opener bot does **not** measure the value of planning. It is the tactician's 3-round greedy search run in every one of the first 5 rounds, and it is worse than autoplay in v2 (reach 77.0 % against 82.0 %; deaths 5.49 against 4.22 per 1 000 fights) even though it loses less HP in the fights it wins (17.9 % against 24.6 %). By class (reach the boss, v2 planner / opener): rogue 77.3 / 74.7 %, mage 83.7 / 87.3 %, hunter 85.0 / 69.0 %; the same pattern exists today (hunter 84.7 / 76.3 %, mage 80.3 / 90.3 %). [inference: from the low HP drop with more deaths] the search holds potions back (its score does not credit a potion heal) and values the next 3 rounds only, so it cannot hold a burst for a window two rounds away. B48 and B50 therefore need the sequence-planning opener of section 11 (engage choice plus a plan over the visible track), not this search; until it exists, the measured evidence for v2 is the masher penalty above, and the planning reward is expected, not measured.

Reproduce: in sim/out/combat2/<base|v2>, `C2_DMG=1.15 node sim/run.mjs --bot <planner|masher|opener> --class all --runs 300 --seed-start 1000 --profile fresh --warmup 0 --risk-in ../obs-P0.json --workers 2 --out ../out-<cell>`, then `python3 sim/out/combat2/an.py <dirs>`. Switches: C2_SCRIPT=0, C2_ENGAGE=0, C2_OFFBAL=<value>.

Expected effect of the parts not built [inference: from the mechanism, not measured]: engage options give the planned opening control over the turn-2 threat from level 1 (today interrupts arrive at levels 6-14), which should widen the opener-masher gap further; Signal and Bloodlust add the "wrong first target" penalty that autoplay's fixed target order does not see (B54).

---

## 14. Open choices (owner review; the team builds on the default)
| # | Question | Default | Alternative |
|---|---|---|---|
| 1 | What does a stun do to the track? | cancels the now-entry; later turns keep their rounds | delays the whole track (stun buys time but never removes a threat) |
| 2 | Engage round for every class? | yes, with three options each; enemy damage × ENGAGE_DMG_COMP | Rogue only (today) plus one universal "pull" option |
| 3 | Track length | 3 (now + 2) | 2 (less to read) or 5 (the whole opening at once) |
| 4 | End boss engage round | none (the Camp is its preparation) | an engage round with control options disabled |
| 5 | Autoplay reads the track? | no, the now-entry only, and never holds for windows | reads the track (smaller manual edge, smoother autoplay) |
| 6 | Size of the window | (combat v2.1) +50 % damage taken, +20 % crit, one action | +30 % (combat v2) or two actions at +20 % |
| 7 | (combat v2.1) A wind-up's lasting result | answered -30 % enemy damage, landed +15 %, for the rest of the fight | no lasting result (only the window); or landed only (harder for autoplay) |
| 8 | (combat v2.1) Ambush in a fight of 2 or more enemies | keeps STEALTH (unchanged; measured alternative rejected, 16.3) | breaks STEALTH (autoplay Rogue -6 pp reach) |
| 9 | (combat v2.1) Autoplay answers a visible wind-up in the engage round also in a one-enemy fight | no (rule E only with 2 or more enemies) | yes (autoplay +3.5 pp reach, the opener's edge mostly gone) |

(M2b v13) Choice 9 is reversed for special fights (elites, rares, dungeon bosses): rule E2 (section 8, D108, owner O12 default "on"); normal fights keep the default.

---

## 15. Constant table (starting values)
| Constant | Value | Unit |
|---|---|---|
| INTENT_TRACK_LEN | 3 | entries (now + 2) |
| OPENING_TURNS | 3 | enemy turns with a scripted action |
| SIGNATURE_TURN | 2 | enemy turn (elite, rare, dungeon boss) |
| SIGNATURE_TURN_2 | 4 | enemy turn (dungeon boss, second template ability; was 5) (combat v2.1) |
| HEAVY_SCRIPT_MULT | 1.5 | × the action's damage pct on a scripted turn; heals and shields keep their own value (D60) (tuning lever, 7; was 1.0) (combat v2.1) |
| CAST_SCRIPT_MULT | 1.5 | × the action's damage pct on a scripted turn; heals and shields keep their own value (D60) (tuning lever, 7; was 1.0) (combat v2.1) |
| MEND_BELOW | 0.70 | fraction of max HP (= ARCHETYPE.mender Mend `below`, unchanged) |
| SIGNAL_ADDS | 1 | enemies |
| BOLSTER_PCT | 0.20 | fraction of the ally's max HP |
| BOLSTER_CD | 4 | turns |
| BLOODLUST_STEP | 0.10 | damage per turn acted |
| BLOODLUST_MAX | 0.50 | damage |
| OFFBAL_TAKEN | 0.50 | damage taken (was 0.30) (combat v2.1) |
| OFFBAL_BOSS_TAKEN | 0 | damage taken (end boss; was 0.15) (combat v2.1) |
| OFFBAL_CRIT | 0.20 | crit chance |
| OFFBAL_DURATION | 2 | status duration under rules 7.4 (one player action) |
| ENGAGE_DMG_COMP | 1.15 | × enemy damage (all template enemies; end boss excluded) |
| AMBUSH_MULT | 1.5 | × Gutting Jab before Shadowstep Strike is learned |
| SAP_TURNS | 3 | enemy turns |
| PREMED_CP | 5 | CP (was 3) (combat v2.1) |
| GLYPH_TURNS | 2 | enemy turns |
| GATHER_SPELLS | 3 | spells (was 2) (combat v2.1) |
| GATHER_CRIT | 1.0 | crit chance (was 0.50) (combat v2.1) |
| OPENING_SHOT_MULT | 1.5 | × Keen Shot |
| OPENING_MARK_ROUNDS | 4 | rounds |
| TRAP_STUN | 1 | rounds |
| PET_LEAD_TURNS | 2 | enemy turns |
| PET_LEAD_DR | 0.30 | damage taken by the pet |
| ENGAGE_AUTO_LOOK | 2 | enemy turns (autoplay rule E) |
| EMPOWER_DMG | 0.15 | damage dealt per EMPOWERED stack (wind-up landed) (combat v2.1) |
| STAGGER_DMG | 0.30 | damage dealt less per STAGGERED stack (wind-up answered) (combat v2.1) |
| DEATHBLOW_MULT | 2.0 | × the pct of a damaging Deathblow, on top of the script multiplier (M2b v13) |
| DEATHBLOW_EMPOWER | 1.00 | EMPOWERED value of a landed Deathblow's stack (M2b v13) |
| MAIM_HEAL | 0.50 | share of every heal on the player removed while MAIMED (M2b v13) |
| RARE_HP_MULT_Z1 | 3.0 | × HP of a zone-1 rare, gated: only with GATES.rareHpMultZ1 (M2b v13); the switch is on (M2b v14) |
| PACE_ROUND_ANIM_S | 2.1 | s (was 1.5) |
| PACE_ROUND_DECIDE_S | 1.0 | s |
| PACE_ENGAGE_S | 6 | s per fight with an engage round (manual profile) |
| PACE_AUTO_ROUND_S | 1.1 | s (was 0.8) |
| COMBAT_MIN_MAX | 21 | min per run (B53) |
| FIGHTS_V2 | 34-42 | fights per run incl. boss (B15) |
| ROUNDS_BOSS_V2 | 30-40 | rounds (B16) |
| OPEN_ROUNDS | 5 | fight rounds (opener bot, B50, recorder) |
| OPENER_BEAM | 12 | sequences kept per step (opener bot) |
| OPENER_SAMPLES | 8 | re-seeded fight streams per sequence (opener bot) |
| OPENER_TAIL | 3 | autoplay rounds after the plan in the score (opener bot) |
| OPENER_ROOT_KEEP | 6 | first actions whose best sequence is scored on the held-out samples (opener bot) (combat v2.1) |
| OPEN_DEATH_RATIO_MAX | 0.70 | opener / planner non-boss deaths (B48) |
| OPEN_REACH_GAIN_MIN | 5 | pp (B48) |
| MASH_REACH_MIN | 0.50 | reach-the-boss rate (B49) |
| MASH_GAP_MIN | 8 | pp below the planner (B49) |
| OPEN_DECIDES_MIN | 0.50 | share of masher non-boss deaths (B50) |
| OPEN_DECIDES_GAP_MIN | 8 | pp, opener opening minus autoplay opening (B50) (combat v2.1) |
| ENGAGE_SHARE_MIN / ENGAGE_SHARE_MAX | 0.15 / 0.60 | share (B51) |
| WINDOW_PER100_MIN | 20 | windows used per 100 non-boss fights, opener (B52; replaces WINDOW_USE_MIN 0.60) (combat v2.1) |
| WINDOW_GAP100_MIN | 15 | windows used per 100 non-boss fights, opener - masher (B52; replaces WINDOW_GAP_MIN 20 pp) (combat v2.1) |
| FIRST_TARGET_DIFF_MIN | 0.25 | share (B54) |
| WINDUP_ANSWER_MIN | 0.70 | share of wind-ups answered, opener, elite and dungeon-boss fights (B55) (combat v2.1) |
| WINDUP_ANSWER_MASH_MAX | 0.20 | share of wind-ups answered, masher (B55) (combat v2.1) |
| MANUAL_GAP_V2 | 15-30 | pp (B5, was MANUAL_GAP 8-25) |
| OPEN_SHARE_MIN | 0.60 | × (B5 diagnostic) |

---

## 16. Combat v2.1: the opening decides the fight (2026-11-10)
Why [source: docs/reports/balance-2026-11-10d.md]: on the combat v2 defaults mashing reached the boss as often as autoplay (78.7 % against 79.8 %), and the planned opening added +2.2 pp. The fights that kill are elite and dungeon-boss fights decided after round 5; the scripted threats of rounds 2-4 were survivable without an answer and left nothing behind. v2.1 puts the lethal moments in rounds 3 and 5 and makes their result last the whole fight. Change table with old -> new values: docs/specs/changes-combat-v21.md. Decisions D55-D59.

### 16.1 Constants from the sim's measure (D55)
OFFBAL_TAKEN 0.50, HEAVY_SCRIPT_MULT = CAST_SCRIPT_MULT 1.5, OFFBAL_BOSS_TAKEN 0, ENGAGE_DMG_COMP 1.15 unchanged.

### 16.2 Wind-ups and their lasting result (D56; rules 7.7, 7.10, 7.12, 7.4)
- The signature entries of 4.1 (elite, rare, dungeon boss on SIGNATURE_TURN; dungeon boss also on SIGNATURE_TURN_2, now turn 4) are **wind-ups**: flags `windup` and `cast`, whatever the action's kind. Every interrupt, stun or control stops one, on a dungeon boss too (rules 7.7). Its pct takes only the multiplier of its own flag (16.1).
- **Answered** (interrupted; cancelled by STUN, FROZEN, HEXED, SAPPED, a trap or Disrupt; replaced because SILENCED; a heavy one that cost the player 0 HP): OFF_BALANCE as in 5.1, and the enemy is **STAGGERED** for the rest of the fight: -STAGGER_DMG damage dealt per stack.
- **Landed** (played, and the player or pet lost HP to it; cleave, curse, self_heal and self_shield whenever played): the enemy is **EMPOWERED** for the rest of the fight: +EMPOWER_DMG damage dealt per stack.
- **Disrupt**: on a CC-immune enemy every control option (Sap, Binding Glyph, Lay Trap) cancels its first wind-up visible in turns 1..INTENT_TRACK_LEN (a trap on that turn) and does nothing else. Every class therefore has a level-1 answer to a dungeon boss's first wind-up; the second (round 5) needs an interrupt, a stun-tagged spell, or for a heavy one a full dodge, WARD, Mirrorshade or the pet (Send the Pet, TAUNT).
- What it asks of the player: read the round-3 (and round-5) wind-up in the engage round, keep the answer for it (an interrupt on cooldown, CP for Temple Blow, the control option not spent on an add), and spend the burst in the window that follows. A mashed opening lands both wind-ups and fights a boss with +30 % damage to the end; a planned one fights it at -60 %.

### 16.3 Setup options (D57)
PREMED_CP 5 (a full Temple Blow, 3-turn stun, on the turn-2 wind-up from round 2), GATHER_SPELLS 3 and GATHER_CRIT 1.0 (three free, certain crits: worth more than a Pre-cast in a long fight, less in a short one). Ambush keeps STEALTH in multi-enemy fights: breaking it was measured and rejected (autoplay's Rogue -6.3 pp reach; an autoplay Premeditate opener -23 pp).

### 16.4 Evidence (scratch, real engine)
Git-ignored copies sim/out/combat21/: the heat engine of main 8507303 with the prototype patch (sim/out/combat21/v21.patch: engine rules 16.2-16.3 behind switches, opener beam of section 11 "combat v2.1", recorder `sg`). P0, 300 runs per class (900 per cell), seeds 1000-1299, paired; risk table of the 11-10d measure (obs-P0); default trees. The opener in both arms has the beam fix (D59), so the difference between the arms is the rules.

| Arm | Autoplay reach R / M / H (all) | Masher reach | Opener reach | Autoplay - masher (paired) | Opener - autoplay (paired) | Non-boss deaths per 1 000 fights, opener / autoplay |
|---|---|---|---|---|---|---|
| today on main ac28155 (sim's opener; same seeds) [source: sim/out/m2b-2026-11-10d] | 75.3 / 84.7 / 81.7 (80.6) | 79.3 | 82.4 | +1.2 pp | +1.9 pp | 0.88 |
| reference: 16.1 only | 79.7 / 85.7 / 80.3 (81.9) | 70.9 | 81.4 | +11.0 pp (7.9 - 14.1) | -0.4 pp (-3.0 - 2.1) | 1.03 (0.83 - 1.27) |
| **v2.1: 16.1-16.3** | 80.3 / 87.0 / 77.3 (81.6) | 64.8 | 85.8 | **+16.8 pp (13.5 - 20.1)** | **+4.2 pp (1.7 - 6.7)** | **0.74 (0.59 - 0.93)** |

v2.1 detail (autoplay / masher / opener):
- Deaths per 1 000 fights: elite 24.9 / 74.0 / 14.1; dungeon boss 46.4 / 128.7 / 18.2; quest 3.2 / 3.7 / 3.4. The opening now decides the long fights: the opener's elite and dungeon-boss deaths are 43 % and 61 % below autoplay's.
- Wind-ups answered in elite and dungeon-boss fights (B55): 67.4 % / 7.6 % / 78.3 % (reference 43.7 / 7.5 / 54.2 %).
- B50 replays of the masher's deaths: 76.0 % survive with the opener's first 5 rounds, 65.9 % with autoplay's (gap +10.1 pp; reference 56.9 / 51.5 %, +5.4 pp).
- B52: windows used per 100 non-boss fights: opener 26.5, masher 3.9.
- B51, the opener's engage choices in multi-enemy fights: Rogue Ambush 73.3 %, Sap 14.5 %, Premeditate 2.0 %; Mage Pre-cast 49.0 %, Binding Glyph 41.8 %, Gathered Power 7.4 %; Hunter Opening Shot 26.1 %, Send the Pet 25.3 %, Lay Trap 23.7 %, a bar spell 24.8 %. Hunter passes; the Rogue and the Mage still fail.
- By class, opener - autoplay reach: Rogue +0.3, Mage +2.7, Hunter +9.7 pp. The Rogue gains least: autoplay's Rogue already answers most elite wind-ups with Throat Jab and Temple Blow, and its dungeon-boss fights start without STEALTH.
- Not longer: median rounds of won fights (autoplay) normal 6, elite 7, dungeon boss 9, end boss 41, as in the reference; combat minutes per run 26.2 (reference 26.3); fights per run 51 (B53 and B15 are the expedition's).
- End boss (autoplay): win 34.4 % (reference 34.8 %) on the heat engine with OFFBAL_BOSS_TAKEN 0.

Intermediate arms (same seeds; A-F on main ac28155, the rest on 8507303; autoplay / masher reach): landed-only EMPOWER 0.25, no stagger: 75.6 / 56.0 %; EMPOWER 0.25 and STAGGER 0.25 with SIGNATURE_TURN_2 4: without the wind-up's `cast` flag 76.1 %, with it 78.1 % (ac28155) and 77.0 / 55.7 % (8507303); EMPOWER 0.15, STAGGER 0.30 with Ambush breaking STEALTH in multi-enemy fights: SIGNATURE_TURN_2 5 81.0 %, turn 4 79.8 %; the same with Ambush keeping STEALTH (final): 81.6 / 64.8 %; autoplay also Disrupting in one-enemy fights: 85.4 % (rejected: the opener's edge goes with it). Opener with the sim's beam (no D59) on the wind-up rules: +1.6 pp over autoplay; with D59: +4.8 pp.

Reproduce: `cd sim/out/combat21 && SCR=v21b X_SIG2=4 X_STAGGER=0.30 X_EMPOWER=0.15 X_PREMED=5 X_GATHER_N=3 X_GATHER_CRIT=1.0 X_AMBUSH_BREAK=0 ./runv.sh K planner masher opener`, reference `SCR=v21b X_WINDUP=0 X_EMPOWER=0 X_CTL_IMMUNE=0 X_AMBUSH_BREAK=0 ./runv.sh ref2 planner masher opener`, then `node an.mjs ref2=out-ref2 K=out-K`. The scratch copy is built by `git archive 8507303 src sim` and `patch -p1 < v21.patch`.

### 16.5 Targets on v2.1 (combat-v2.md 12; 900 runs per cell)
| ID | Value | Target | Result |
|---|---|---|---|
| B48 (a) | 0.74 (0.59 - 0.93) | <= 0.70 | just fails (interval includes it) |
| B48 (b) | +4.2 pp (1.7 - 6.7) | >= +5 pp | just fails (interval includes it) |
| B49 | masher 64.8 %, autoplay - masher +16.8 pp | >= 50 %, gap >= 8 pp | pass |
| B50 | 76.0 %; gap to autoplay's opening +10.1 pp | >= 50 %; gap >= 8 pp | pass |
| B51 | see 16.4 | each >= 15 %, none > 60 % | Hunter pass; Rogue, Mage fail |
| B52 | opener 26.5, masher 3.9 per 100 fights | >= 20; gap >= 15 | pass |
| B54 | 38.0 % | >= 25 % | pass |
| B55 | opener 78.3 %, masher 7.6 % | >= 70 %; <= 20 % | pass |
| B16 | 6 / 7 / 9 / 41 rounds | normal 4-6, elite 6-9, dungeon boss 8-12, end boss 30-40 | end boss 41 (reference 41) |

---

## 17. M2b v13: special fights demand thought (2026-11-11)
Why and the measured package: docs/specs/changes-m2b-v13.md (owner 18:41, 18:46, 20:57; D105-D110; O11-O13 on their defaults). Rules text: rules.md 2.3, 7.2, 7.4, 7.5, 7.9, 7.12 and 13, marked "(M2b v13)".

### 17.1 The Deathblow and MAIMED (D105-D107)
- The SIGNATURE_TURN wind-up of every elite, rare and dungeon boss is its Deathblow (`deathblow` on the track entry and the intent). A damaging one (hit, rend, cleave) has pct × DEATHBLOW_MULT on top of HEAVY_SCRIPT_MULT or CAST_SCRIPT_MULT (× 3.0 of the ability's pct); a curse, self_heal or self_shield Deathblow keeps its pct and carries its weight through DEATHBLOW_EMPOWER and MAIMED.
- Answered: as any wind-up (STAGGERED, OFF_BALANCE where 5.1 gives it). Landed: an EMPOWERED stack worth DEATHBLOW_EMPOWER (other wind-ups EMPOWER_DMG; EMPOWERED and STAGGERED are the sums of their stacks' values), and the player is MAIMED for the rest of the fight: every heal received × (1 - MAIM_HEAL), potions and the free potion included; dispersal and a resurrect keep it; one per fight.
- Every class has a level-1 answer in the engage round: the control option (Sap, Binding Glyph, Lay Trap) on an elite or rare, Disrupt on a dungeon boss; later also interrupts, stun-tagged spells and, for a heavy one, a full dodge, WARD, Mirrorshade or the pet.

### 17.2 Autoplay rule E2 (D108)
Section 8. Engine reading: Sap on a lone special enemy cancels its turns only while nothing damages it; autoplay's rules 1-6 then attack it (it is the only target), so a lone elite's or rare's Deathblow is answered by the Rogue's E2 only when an add takes the hits first, or later by rule 3 (Throat Jab, Temple Blow). Binding Glyph (FROZEN, not broken by damage), Lay Trap and Disrupt hold. Measured only pooled by the designer; the sim reads it per class (handoff engineer-2026-11-11j). (M2b v14, D111) Rule H closes this: after the Sap of a lone special enemy autoplay waits a round (PASS, STEALTH kept), Sap cancels the Deathblow (STAGGERED) and the Rogue opens into the OFF_BALANCE window (section 8).

### 17.3 Gated rows 5-6 (D109)
Switches in `C.GATES`: `rareHpMultZ1` (zone-1 rares with RARE_HP_MULT_Z1, cell 6) and `firstMeetWindup` (FIRST_MEET_WINDUP: the first meeting of a normal enemy type in a quest fight makes its turn-2 scripted action a wind-up at the grind's stakes, cell 7). The engine records the met templates (`state.met`) whatever the switch. (M2b v14, D113) Both are on (the sim's decision rules of the v13 measure); the switches stay for sim arms, with `sapHold` and `passStealth` (rule H and the PASS that keeps STEALTH, section 8).
