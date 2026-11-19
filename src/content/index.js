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
 * C.GATES.legacy is on (a getter per field, read at each use; off: the line as written); D159 (legacy.md 4.7 E6.1, draft):
 * a field of `TUTORIAL.legacy.economyV2.prep` reads its text while C.GATES.economyV2 is on as well. Lines only, no rule.
 */
(function legacyWords(T) {
  const L = T.legacy;
  if (!L) return;
  // D159 (legacy.md 4.7 E6.1, draft): under GATES.economyV2 as well, the `legacy.economyV2` text of a field
  const v2 = (L.economyV2 && L.economyV2.prep) || {};
  const bind = (obj, k, text, textV2) => {
    const was = obj[k];
    Object.defineProperty(obj, k, { get: () => (GATES.legacy ? (GATES.economyV2 && textV2 !== undefined ? textV2 : text) : was), enumerable: true, configurable: true });
  };
  for (const [k, text] of Object.entries(L.prep || {})) if (T.prep && k in T.prep) bind(T.prep, k, text, v2[k]);
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
