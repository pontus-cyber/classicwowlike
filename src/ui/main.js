// Entry point of the visual client (bundled into one HTML file by tools/build.mjs).
import { App } from './app.js';

function start() {
  try {
    new App();
  } catch (err) {
    console.error(err);
    const boot = document.getElementById('boot');
    if (boot) boot.textContent = `Could not start: ${err && err.message}`;
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
