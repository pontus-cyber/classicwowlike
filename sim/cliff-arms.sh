#!/bin/bash
# Scratch arms of report docs/reports/balance-2026-11-13c.md: one constant edit on a COPY of src/ (never on src/ itself).
#   bash sim/cliff-arms.sh <arm> <scratch src dir>
#   a1  RING_CL_BASE [0, 1, 4, 7] -> [0, 0, 4, 7]   (ring 1 of every expedition zone one level lower: the zone-entry step)
#   a2  QUEST_MAX_SIZE_Z1 2 -> 3                     (zone 1 quests may hold three enemies, as zone 2's do)
#   a3  a1 and a2 together
#   a4  zone 1's quest cap QUEST_MAX_SIZE_Z1 applies to rings 1-2 only: rim quests (ring 3, levels 8-10) may hold three
#       enemies (engine line in expedition.js setupExpNode; the draws are unchanged, so every other node is identical)
#   a5  a4, and zone 2's ring 1 (levels 12-14) takes the cap of 2 (three-enemy quests start at zone 2's ring 2)
#   a6  zone 2's ring 1 takes the cap of 2 only (zone 1 as built)
set -euo pipefail
ARM=$1; S=$2
case "$ARM" in
  a1|a2|a3|a4|a5|a6) ;;
  *) echo "unknown arm $ARM" >&2; exit 1 ;;
esac
[[ "$S" == */src ]] || { echo "refusing: $S is not a scratch src dir" >&2; exit 1; }
W=$(cd "$(dirname "$0")/.." && pwd)
[ "$(cd "$S" && pwd)" != "$W/src" ] || { echo "refusing to edit the repository's src/" >&2; exit 1; }
F="$S/constants.js"
if [ "$ARM" = a1 ] || [ "$ARM" = a3 ]; then
  sed -i 's/^export const RING_CL_BASE = \[0, 1, 4, 7\];/export const RING_CL_BASE = [0, 0, 4, 7];/' "$F"
  grep -q '^export const RING_CL_BASE = \[0, 0, 4, 7\];' "$F" || { echo "a1 edit failed" >&2; exit 1; }
fi
if [ "$ARM" = a2 ] || [ "$ARM" = a3 ]; then
  sed -i 's/^export const QUEST_MAX_SIZE_Z1 = 2;/export const QUEST_MAX_SIZE_Z1 = 3;/' "$F"
  grep -q '^export const QUEST_MAX_SIZE_Z1 = 3;' "$F" || { echo "a2 edit failed" >&2; exit 1; }
fi
E="$S/engine/expedition.js"
OLD='    const size = z === 1 ? Math.min(QUEST_MAX_SIZE_Z1, drawn) : drawn;'
if [ "$ARM" = a4 ]; then NEW='    const size = z === 1 \&\& n.ring < 3 ? Math.min(QUEST_MAX_SIZE_Z1, drawn) : drawn;'; fi
if [ "$ARM" = a5 ]; then NEW='    const size = (z === 1 \&\& n.ring < 3) || (z === 2 \&\& n.ring === 1) ? Math.min(QUEST_MAX_SIZE_Z1, drawn) : drawn;'; fi
if [ "$ARM" = a6 ]; then NEW='    const size = z === 1 || (z === 2 \&\& n.ring === 1) ? Math.min(QUEST_MAX_SIZE_Z1, drawn) : drawn;'; fi
if [ "$ARM" = a4 ] || [ "$ARM" = a5 ] || [ "$ARM" = a6 ]; then
  grep -qF "$OLD" "$E" || { echo "a4/a5: engine line not found" >&2; exit 1; }
  sed -i "s/^    const size = z === 1 ? Math.min(QUEST_MAX_SIZE_Z1, drawn) : drawn;\$/$NEW/" "$E"
  grep -q 'n.ring < 3\|z === 2 && n.ring === 1' "$E" || { echo "a4-a6 edit failed" >&2; exit 1; }
fi
echo "arm $ARM applied to $S"
