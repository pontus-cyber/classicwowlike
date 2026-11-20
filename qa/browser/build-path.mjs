/**
 * qa/browser/build-path.mjs - where the browser scripts find their build when no --file is given.
 *
 * Each worktree builds to its own path, /tmp/tbwcr-<worktree folder name>/game.html, so two worktrees on one machine never
 * overwrite each other's build (a shared /tmp/ui-game.html did: a run of one worktree tested the other's code). Without
 * --file the script rebuilds that file from the worktree's src/ first (about half a second), so it is never stale.
 * TBWCR_BUILD_DIR overrides the folder. Used by ui-regress, canvas-shot, style-snapshot and playtest-onboarding.
 */
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const WORKTREE = path.basename(REPO);
export const BUILD_DIR = process.env.TBWCR_BUILD_DIR ? path.resolve(process.env.TBWCR_BUILD_DIR) : path.join('/tmp', `tbwcr-${WORKTREE}`);
export const DEFAULT_BUILD = path.join(BUILD_DIR, 'game.html');

/** The build to test: --file as given, else this worktree's own build, rebuilt from src/ now. */
export function resolveBuild(file) {
  if (file) return path.resolve(file);
  const r = spawnSync(process.execPath, [path.join(REPO, 'tools/build.mjs'), '--out', DEFAULT_BUILD, '--quiet'], { cwd: REPO, encoding: 'utf8' });
  if (r.status !== 0) { console.error(`build of ${REPO}/src failed:\n${r.stdout}${r.stderr}`); process.exit(2); }
  return DEFAULT_BUILD;
}
