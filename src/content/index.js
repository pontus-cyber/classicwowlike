// Content index: imports every content table and exports CONTENT, the object newRun() validates and freezes (rules.md 12, engine-api.md newRun).
import { ZONES } from './zones.js';
import { CAMP } from './camp.js';
import { ENEMIES } from './enemies.js';
import { ABILITIES } from './abilities.js';
import { QUESTS } from './quests.js';
import { ITEM_NAMES } from './item-names.js';
import { AFFIX_WORDS } from './affix-words.js';
import { UNIQUES } from './uniques.js';
import { CLASSES } from './classes.js';
import { TEXTS } from './texts.js';
import { TUTORIAL } from './tutorial.js';

export const CONTENT = {
  version: 'm1-content-1',
  zones: ZONES,
  camp: CAMP,
  enemies: ENEMIES,
  abilities: ABILITIES,
  quests: QUESTS,
  itemNames: ITEM_NAMES,
  affixWords: AFFIX_WORDS,
  uniques: UNIQUES,
  classes: CLASSES,
  texts: TEXTS,
  tutorial: TUTORIAL,
};
