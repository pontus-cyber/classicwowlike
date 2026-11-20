// content-2026-11-20 section 3 (draft lines), the UI's pure parts in Node: the contract reward window's closing line
// (families[id].done for a Cull or Bounty, "{dungeon} is quiet at last." for a Delve, the old runner line as the fallback)
// The browser checks are ui-regress parts I, X, Y and M.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { CONTENT } = await import('../../src/content/index.js');
const { contractDoneLine } = await import('../../src/ui/ui-text.js');

test('contract pay line: a Cull and a Bounty read their family\'s done line, no two families the same', () => {
  const ids = Object.keys(CONTENT.texts.families);
  assert.ok(ids.length >= 18);
  const seen = new Set();
  for (const id of ids) {
    const done = CONTENT.texts.families[id].done;
    assert.ok(done && !/runner/.test(done), id);
    for (const kind of ['cull', 'bounty']) assert.equal(contractDoneLine({ kind, family: id }, 'Millbrook Rest', CONTENT), done);
    seen.add(done);
  }
  assert.equal(seen.size, ids.length);
});

test('contract pay line: a Delve names its dungeon; the runner line only without a family line or dungeon', () => {
  assert.equal(contractDoneLine({ kind: 'delve', dungeon: 'Hollow Weir' }, 'Millbrook Rest', CONTENT), 'Hollow Weir is quiet at last.');
  assert.equal(contractDoneLine({ kind: 'delve', family: 'outlaw', dungeon: 'Hollow Weir' }, 'x', CONTENT), 'Hollow Weir is quiet at last.');
  assert.equal(contractDoneLine({ kind: 'delve' }, 'Millbrook Rest', CONTENT), 'A runner from Millbrook Rest brings your pay. Well done.');
  assert.equal(contractDoneLine({ kind: 'cull', family: 'nope' }, null, CONTENT), 'A runner from the hub brings your pay. Well done.');
});
