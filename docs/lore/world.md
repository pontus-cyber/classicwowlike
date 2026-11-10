# World

Status: draft (not yet approved by the owner)

The frame that ties the existing canon together: the land, the sky, the deep past, the present crisis and why the player keeps coming back. Everything here marked "proposal" is new and waits for the owner. Everything marked "canon" already exists in the game and is only explained here.

## 1. Canon this file builds on
- Six zones in travel order, then the Camp and the end boss [source: src/content/zones.js, src/content/camp.js, docs/specs/rules.md 10]: Amberfold Downs, Greywater Fens, Highcairn Reach, Sunscoured Wastes, Mournwood, Cindercrown Peaks, Observatory Steps (the Camp), the Sunken Observatory.
- Oruvath, the Unlit Star, the end boss; its Dimming Shards; Ascendancy (time makes it stronger) [source: docs/specs/rules.md 1.7, 10].
- The Shardfall, the Dimming, Shardspawn, the Roads, the Homeward Bell [source: docs/specs/expedition.md 6-7, src/content/texts.js].
- Echoes, the meta currency kept between runs [source: docs/specs/rules.md 11.1].
- Zone details that point at a shared past [source: src/content/zones.js, src/content/enemies.js]: boundary stones that keep failing (Downs), standing stones bound by a forgotten oath (Reach), a fallen sun-empire and the Obelisk of Veth (Wastes), lanterns that hold back the fog (Mournwood), a volcano whose first eruption forged the Obsidian Wardens (Peaks), a drowned dome at the end of the road (Camp).

## 2. The land (proposal)
The country is called **Calvenmark**. One long road crosses it, from the farms of Amberfold Downs to the ash slopes of Cindercrown Peaks. The road climbs out of the Downs, drops into the Greywater Fens, rises again onto the Highcairn moors, and falls down the Reach's dry southern face into the Sunscoured Wastes. Beyond the Wastes the land turns green and dark in the valleys of Mournwood, which lie under the Peaks. On the far side of the Peaks a crater lake fills a broken caldera. The Sunken Observatory lies at the bottom of it.

People live in small, practical settlements: a mill town, stilt hamlets, walled steadings, a cistern-fort, a lantern ring, an ash-road bastion. No kingdom holds the whole road. Each hub looks after itself, and each believes its own trouble is the worst one.

## 3. The sky: the Unlit Star (proposal, built on canon)
On clear nights the people of Calvenmark can see a small, round gap in the stars where no light shows. That gap is **Oruvath, the Unlit Star**. It gives no light. It takes it.

Oruvath rises a little higher every night. Farmers say "the hole is climbing". This is the fiction behind **Ascendancy**: every hour the player spends, the star climbs closer to the top of the sky, and the closer it is, the stronger it is when the player finally faces it.

## 4. The deep past: Veth and the binding (proposal, built on canon)
Long before the present hubs, the empire of **Veth** ruled the Wastes, which were then irrigated garden country. Its priests, the Sunscribes, were the first to chart the Unlit Star. They learned that it fed on light and that it was coming closer.

The Sunscribes did two things:
1. They built the **Observatory** in the caldera beyond the Peaks to watch the star and to sing against it. Their long hymn, sung without pause, held Oruvath still in the sky.
2. They set a chain of **wards** along the road to carry the hymn's strength across the land: obelisks in their own country, standing stones on the moors, boundary stones in the farmland. Each ward was bound by an oath to stand until relieved.

Then the mountain broke. The first eruption of Cindercrown split the caldera, the lake poured in and the Observatory sank. The hymn stopped. Veth fell within a generation, and the sand took its gardens.

The wards stayed. Later peoples did not know what the stones were for. They kept them out of habit: the Downs farmers tie ribbons to them, the moor clans swear oaths at them, the Mournwood folk light lanterns in the same places without knowing why those places matter.

This explains several existing details: the Standing Stone Guardians still obey "a forgotten oath", the Sepulchre Guardians "never left their post", Pharan "guards a tomb that no longer exists", and Ammeset is "bound to the obelisk by her own prophecy" [source: src/content/enemies.js].

## 5. The present: the Shardfall night (proposal, built on canon)
The wards are failing, one by one, from age and neglect. In the season the game begins, enough of them failed at once that Oruvath shed pieces of itself. In one night, shards of the Unlit Star fell on the rim of every land along the road. People call it **the Shardfall**, for both the night and the places where the shards struck.

From every Shardfall **the Dimming** spreads: a darkness that eats the land outward, hop by hop. Animals, bandits and the restless dead that wander into it come out as **Shardspawn**, hollow and lit only by the shard's cold glow [source: src/content/texts.js].

The Dimming also wakes and worsens what was already wrong. The blight in the barley, the drowned king in the fens, the barrow-kings who will not rest, the sun-priests whose sigils wake at dusk, the dead gathering at Dunmere Chapel and the fire cult in the Furnace of Karth are each local troubles. The shard's dark makes all of them bolder. A player who travels the whole road starts to see that these are one trouble.

## 6. The Bellwrights, the Bell and Echoes (proposal; explains the run loop)
The roads of Calvenmark were laid out by the **Bellwrights**, an old guild of bellfounders and wayfinders. A Bellwright casts each bell for one road. Rung, a **Homeward Bell** calls its bearer home along that road [source: src/content/texts.js for the bell's function].

Bells also listen. A bell carried through the Dimming remembers what it heard: every fight, every turn of the road, every mistake. When a bearer falls, the bell rings once on its own, wherever it lies, and the Bellwrights hear it. They melt what is left of it into the next bell. What the old bell remembered passes into the new one. The guild calls these remembered things **Echoes**.

This is the fiction behind meta progression. The player is a **Wayfarer**, one of many sent down the road by the Bellwrights. Each Wayfarer is a new person. Each starts with a little more than the last, because the bell they carry remembers the ones before.

The start camp, where the player spends preparation points on contracts and supplies, is the Bellwrights' muster yard at the head of the road. The contract board holds requests sent up the road by the hubs.

## 7. What the end boss fight means (proposal)
At the Observatory Steps, the last fire before the drowned dome [source: src/content/camp.js], the Wayfarer goes down into the Sunken Observatory. Oruvath is not inside it. The Observatory is the one place where the star can be reached: the old Sunscribe instruments still point at it and pull it close. Killing Oruvath there does not destroy the star for ever. It drives it back up into the sky and buys the land a long quiet, until the next Shardfall.

That keeps every victory meaningful and every new run plausible.

## 8. Open questions for the owner
Defaults apply until the owner answers.
1. Player frame: Wayfarers sent by the Bellwrights, with Echoes as bell memory (section 6). Default: yes.
2. Peoples: the game has ogres and calls the Furnace of Karth "dwarven-style" [source: src/content/zones.js]. Default: humans are the only settled people on the road; ogres, giants and beast-folk are wild; the Furnace was built by a vanished human smith-clan, and the zone text drops "dwarven-style".
3. Tone: weary but hopeful frontier folk, dark at the edges, no comic relief as a main register. Default: yes (see style.md).
