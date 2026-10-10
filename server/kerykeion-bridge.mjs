import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { AstrologyError } from './astrology-quota.mjs';

export const KERYKEION_VERSION = '6.0.2';
export const ENGINE_BACKEND = 'swisseph-moshier';

export function createKerykeionBridge(options = {}) {
  const localPython = path.resolve('.venv/bin/python');
  const python = options.python || process.env.ASTROLOGY_PYTHON || (existsSync(localPython) ? localPython : 'python3');
  const script = options.script || path.resolve('server/kerykeion_worker.py');
  const concurrency = options.concurrency ?? 2, maxQueue = options.maxQueue ?? 16;
  const timeoutMs = options.timeoutMs ?? 30_000, maxOutputBytes = options.maxOutputBytes ?? 3_000_000;
  const queue = [];
  let active = 0;
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8 || !Number.isInteger(maxQueue) || maxQueue < 0) throw new Error('Invalid chart worker bounds');

  function pump() {
    while (active < concurrency && queue.length) {
      const item = queue.shift();
      active++;
      item.running = true;
      let child;
      try {
        child = spawn(python, ['-u', script], {
          stdio: ['pipe', 'pipe', 'pipe'], shell: false,
          env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, LANG: 'C.UTF-8', ...options.env, KERYKEION_BACKEND: 'swisseph', PYTHONDONTWRITEBYTECODE: '1', PYTHONUNBUFFERED: '1' },
        });
      } catch { item.finish(new AstrologyError('engine_unavailable', 'The local chart runtime is unavailable.')); continue; }
      item.child = child;
      const chunks = [];
      let bytes = 0;
      child.stdout.on('data', chunk => {
        bytes += chunk.length;
        if (bytes > maxOutputBytes) item.stop(new AstrologyError('engine_output', 'The local chart exceeded its output bound.'));
        else chunks.push(chunk);
      });
      // Drain diagnostics without logging private inputs or library exception text.
      child.stderr.on('data', () => {});
      child.stdin.on('error', () => {});
      child.on('error', () => { item.failure ||= new AstrologyError('engine_unavailable', 'The local chart runtime is unavailable.'); });
      child.on('close', code => {
        if (item.failure) return item.finish(item.failure);
        if (code !== 0) return item.finish(new AstrologyError('engine_failed', 'The local chart could not be calculated.'));
        try {
          const output = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if (output.status !== 'OK' || !output.data || typeof output.data !== 'object') throw new Error('Invalid worker result');
          item.finish(null, output.data);
        } catch { item.finish(new AstrologyError('engine_output', 'The local chart returned invalid data.')); }
      });
      child.stdin.end(item.input);
    }
  }

  return function calculate(job, signal) {
    if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
    const input = JSON.stringify(job);
    if (Buffer.byteLength(input) > 16_384) return Promise.reject(new AstrologyError('engine_input', 'The chart input is too large.', 400));
    if (active >= concurrency && queue.length >= maxQueue) return Promise.reject(new AstrologyError('engine_busy', 'The local chart runtime is busy. Try again shortly.'));
    return new Promise((resolve, reject) => {
      const item = { input, running: false, child: null, failure: null, done: false };
      item.finish = (error, data) => {
        if (item.done) return;
        item.done = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', cancel);
        if (item.running) active--;
        else { const index = queue.indexOf(item); if (index >= 0) queue.splice(index, 1); }
        if (error) reject(error); else resolve(data);
        pump();
      };
      item.stop = error => {
        item.failure ||= error;
        if (item.child) item.child.kill('SIGKILL');
        else item.finish(item.failure);
      };
      const cancel = () => item.stop(new DOMException('Aborted', 'AbortError'));
      const timer = setTimeout(() => item.stop(new AstrologyError('engine_timeout', 'The local chart calculation timed out.')), timeoutMs);
      signal?.addEventListener('abort', cancel, { once: true });
      queue.push(item);
      pump();
    });
  };
}

// All route bundles share the same process-wide concurrency bound.
const key = Symbol.for('myAeon.kerykeion.worker');
export const calculateCharts = globalThis[key] ||= createKerykeionBridge();
