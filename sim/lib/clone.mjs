// State copies for the tactician's look-ahead. A fight step can change player, fight, stats, node, loot, the
// loot stream, death, outcome and (when the fight ends) zone row flags, phase, service and result; everything
// else (content, profile, meta, create, hub, camp) is shared read-only. qa/sim checks that a look-ahead never
// changes the live state (serialize before == after).
export function treeClone(v) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) {
    const n = v.length;
    const a = new Array(n);
    for (let i = 0; i < n; i++) a[i] = treeClone(v[i]);
    return a;
  }
  const o = {};
  for (const k in v) o[k] = treeClone(v[k]);
  return o;
}

export function fightClone(s) {
  const o = {};
  for (const k in s) o[k] = s[k];
  o.player = treeClone(s.player);
  o.fight = treeClone(s.fight);
  o.stats = treeClone(s.stats);
  o.node = treeClone(s.node);
  o.loot = treeClone(s.loot);
  o.lootRng = s.lootRng ? s.lootRng.slice() : s.lootRng;
  o.death = treeClone(s.death);
  o.service = treeClone(s.service);
  o.hub = treeClone(s.hub);
  o.camp = treeClone(s.camp);
  if (s.zone) {
    o.zone = { ...s.zone, pos: { ...s.zone.pos } };
    if (s.zone.rows) o.zone.rows = s.zone.rows.map((row) => row.map((n) => ({ ...n })));
    if (s.zone.path) o.zone.path = s.zone.path.slice();
  }
  return o;
}
