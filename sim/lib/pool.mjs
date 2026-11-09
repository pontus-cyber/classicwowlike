// Worker pool over node:worker_threads. Tasks are independent; results come back in task order, so the
// caller's output never depends on the number of workers or on scheduling.
import { Worker } from 'node:worker_threads';
import { cpus } from 'node:os';

const WORKER = new URL('../worker.mjs', import.meta.url);

export class Pool {
  constructor(size = cpus().length) {
    this.size = Math.max(1, size);
    this.workers = [];
    this.idle = [];
    this.queue = [];
    this.pending = new Map();
    this.nextId = 1;
    for (let i = 0; i < this.size; i++) {
      const w = new Worker(WORKER);
      w.on('message', (msg) => this.done(w, msg));
      w.on('error', (e) => { for (const p of this.pending.values()) p.reject(e); this.pending.clear(); });
      this.workers.push(w);
      this.idle.push(w);
    }
  }

  done(w, msg) {
    const p = this.pending.get(msg.id);
    this.pending.delete(msg.id);
    if (msg.error) p.reject(new Error(msg.error)); else p.resolve(msg);
    this.idle.push(w);
    this.pump();
  }

  pump() {
    while (this.idle.length && this.queue.length) {
      const w = this.idle.pop();
      const t = this.queue.shift();
      this.pending.set(t.msg.id, t);
      w.postMessage(t.msg);
    }
  }

  run(msg) {
    return new Promise((resolve, reject) => {
      this.queue.push({ msg: { ...msg, id: this.nextId++ }, resolve, reject });
      this.pump();
    });
  }

  /** Run every task; resolves with the results in task order. */
  all(msgs) {
    return Promise.all(msgs.map((m) => this.run(m)));
  }

  async close() {
    await Promise.all(this.workers.map((w) => w.terminate()));
  }
}
