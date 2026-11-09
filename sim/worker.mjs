// Worker thread for sim/run.mjs: plays the runs of one task and returns their records.
// Message in:  { id, kind: 'runs', cell, seeds, table, opts }    -> out: { id, records }
//              { id, kind: 'campaign', cls, index, seeds, table } -> out: { id, campaign }
import { parentPort } from 'node:worker_threads';
import { playRun } from './lib/runner.mjs';
import { playCampaign } from './lib/campaign.mjs';

parentPort.on('message', (m) => {
  try {
    if (m.kind === 'runs') {
      const records = m.seeds.map((seed) => playRun(m.cell, seed, m.table, m.opts || {}));
      parentPort.postMessage({ id: m.id, records });
    } else if (m.kind === 'campaign') {
      parentPort.postMessage({ id: m.id, campaign: playCampaign(m.cell, m.index, m.seeds, m.table) });
    } else {
      throw new Error(`unknown task kind ${m.kind}`);
    }
  } catch (e) {
    parentPort.postMessage({ id: m.id, error: `${e.message}\n${e.stack}` });
  }
});
