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
import { GATES } from '../constants.js';

/**
 * Legacy wording (D154, legacy.md 4.6, draft): the tutorial lines that name Echoes read their `TUTORIAL.legacy` text while
 * C.GATES.legacy is on (a getter per field, read at each use; off: the line as written). Lines only, no rule.
 */
(function legacyWords(T) {
  const L = T.legacy;
  if (!L) return;
  const bind = (obj, k, text) => {
    const was = obj[k];
    Object.defineProperty(obj, k, { get: () => (GATES.legacy ? text : was), enumerable: true, configurable: true });
  };
  for (const [k, text] of Object.entries(L.prep || {})) if (T.prep && k in T.prep) bind(T.prep, k, text);
  for (const [id, f] of Object.entries(L.hints || {})) {
    const hint = (T.hints || []).find((x) => x.id === id);
    if (hint) for (const [k, text] of Object.entries(f)) bind(hint, k, text);
  }
}(TUTORIAL));

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
