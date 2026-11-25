// Build switches (docs/specs/demo.md 2.1, D171): DEMO_BUILD is true only in the demo build (tools/build.mjs --demo writes
// this module as `export const DEMO_BUILD = true;`); game.html and the unbundled src/ keep false. Nothing else differs.
export const DEMO_BUILD = false;
