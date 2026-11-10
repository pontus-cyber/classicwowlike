# Lore process

Status: draft (not yet approved by the owner)

How the owner and the lore chat build the story, and how it reaches the game. The owner supplies the story. The lore chat interviews, organises, finds gaps and contradictions, and writes it up. Nothing becomes canon until the owner approves it.

## 1. Method
Standard practice for game narrative, adapted to a roguelike [inference: from general narrative-design practice in training knowledge, not checked against a source in this session].
- **Top-down.** Settle the foundation first: theme, premise, the player's role and the central conflict. Then the world, then zones, then characters, then individual lines. Detail written before the foundation is set usually has to be rewritten.
- **One story bible.** Every fact lives in exactly one file in docs/lore/. Other files link to it rather than repeat it.
- **Canon tiers.** Every fact has one of three statuses: *approved* (owner signed off), *draft* (written up, waiting for the owner), *inherited* (written earlier by the build team; kept only until the owner keeps, changes or drops it).
- **Iceberg.** We write much more than the player will see. The hidden part keeps the visible text consistent.
- **Built for repetition.** A run lasts about 45 minutes and is played many times. Text seen every run must stay short and survive repetition. The deeper story is revealed in pieces across runs, tied to meta progression, so the hundredth run still shows something new.

## 2. Phases
| Phase | Output (docs/lore/) | What the owner gives |
|---|---|---|
| 1 Foundation | foundation.md: theme, premise, player role, central conflict, ending, tone | Interview round 1 |
| 2 World | world.md, history.md, factions.md, peoples (in world.md) | Interview rounds 2-3 |
| 3 Zones | zones/<zone>.md: each zone's local story and how it ties to the main conflict | One round per zone, or batches |
| 4 Characters | characters.md: quest givers, elites, bosses, recurring figures | Ideas as they come |
| 5 Delivery plan | delivery.md: where each piece of story appears in the game, mapped to game systems | Review |
| 6 Proposal to the Lead | docs/feedback/ note with scope, content list and what each role builds | Approval |

Phases can overlap. The owner can give material for any phase at any time; the lore chat files it in the right place and notes what it changes.

## 3. Interview log
docs/lore/interview.md records each round: the questions, the owner's answers as given (tagged [stated]), and what was filed where. Superseded answers are marked as such, not deleted.

## 4. The existing lore
world.md and style.md (2026-11-10) and the names and texts in src/content/ were written by agents, not the owner. They are *inherited*. They stay in the game until the owner's story replaces them.
