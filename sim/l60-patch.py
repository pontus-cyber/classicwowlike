#!/usr/bin/env python3
"""Attribution arms of the level-60 oruvathLegacy measure (report legacy-l60-2026-11-18): take ONE piece of what the
switch changes back to its off value in a scratch copy (src/ and sim/ under the scratch dir; the repo is untouched).

  python3 sim/l60-patch.py <scratch dir> <token>[,<token>...]

Tokens:
  dot        rules 7.9 / legacy.md 2.4.1 item 5: autoplay's boss DoT rule (autoplay.js dotTarget) off
  pet        legacy.md 2.4.1 item 6: the sim Hunter's Camp pet step (policy.mjs campSteps) off
  prevent    the sim Camp bar valuation of handoff sim-2026-11-18c (SIM.CAMP_BAR_PREVENT) off
  <spell id> that ORUVATH_SPELL entry removed (the SPELL field keeps its rules.md value), e.g. barbed_arrow
  ferocity   ORUVATH_TALENT.h_a2 removed (Ferocity petDmgPct as rules.md)
  nonum      every ORUVATH_SPELL and ORUVATH_TALENT entry removed (all class numbers off)
"""
import re
import sys

root, tokens = sys.argv[1], sys.argv[2].split(',')
SPELLS = ['frost_lance', 'pyre_comet', 'barbed_arrow', 'field_dressing', 'cinder_storm', 'glacial_tomb',
          'feign_stillness', 'heartseeker_shot', 'open_vein']


def edit(rel, old, new, count=1):
    p = f'{root}/{rel}'
    s = open(p).read()
    if s.count(old) != count:
        sys.exit(f'{rel}: expected {count} of {old!r}, found {s.count(old)}')
    open(p, 'w').write(s.replace(old, new))


def drop_line(rel, pattern, after='export const ORUVATH_SPELL = {'):
    """Remove the first line matching pattern after the marker (the ORUVATH_SPELL / ORUVATH_TALENT blocks)."""
    p = f'{root}/{rel}'
    s = open(p).read()
    i = s.index(after)
    s2, n = re.subn(pattern, '', s[i:], count=1, flags=re.M)
    if n != 1:
        sys.exit(f'{rel}: no line {pattern!r} after {after!r}')
    open(p, 'w').write(s[:i] + s2)


for t in tokens:
    if t == 'nonum':
        for sp in SPELLS:
            drop_line('src/constants.js', rf'^  {sp}: \{{.*\}},\n')
        drop_line('src/constants.js', r'^  h_a2: \{ petDmgPct: 0\.10 \},\n')
    elif t == 'dot':
        edit('src/engine/autoplay.js', "function dotTarget(e, tgtHp, sp) {\n  if (GATES.oruvathLegacy) {", "function dotTarget(e, tgtHp, sp) {\n  if (false) {")
    elif t == 'pet':
        edit('sim/lib/policy.mjs', 'const campSteps = C.GATES.oruvathLegacy ?', 'const campSteps = false ?')
    elif t == 'prevent':
        edit('sim/lib/params.mjs', 'CAMP_BAR_PREVENT: true', 'CAMP_BAR_PREVENT: false')
    elif t == 'ferocity':
        drop_line('src/constants.js', r'^  h_a2: \{ petDmgPct: 0\.10 \},\n')
    elif t in SPELLS:
        drop_line('src/constants.js', rf'^  {t}: \{{.*\}},\n')
    else:
        sys.exit(f'unknown token {t}')
print(f'patched {root}: {",".join(tokens)}')
