import { createBridge } from './engine-bridge.js';
const bridge = createBridge();
document.getElementById('boot').textContent = `Engine: ${bridge.mode}, phase ${bridge.view.phase}`;
