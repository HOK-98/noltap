import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModelFile } from '../src/pirate/model-loader.js';

function response() {
  const bytes = new ArrayBuffer(12);
  new DataView(bytes).setUint32(0, 0x46546c67, true);
  return new Response(bytes);
}

test('returns a parsed model after downloading a GLB', async () => {
  const model = { scene: {} };
  const actual = await loadModelFile({ parseAsync: async () => model }, '/models/pirate.glb', { fetchImpl: async () => response() });
  assert.equal(actual, model);
});

test('a stalled download aborts and stops after one retry', { timeout: 1000 }, async () => {
  const signals = [];
  await assert.rejects(loadModelFile({ parseAsync: () => assert.fail('No data to parse') }, '/models/pirate.glb', {
    timeoutMs: 15,
    fetchImpl: async (_, options) => { signals.push(options.signal); return new Promise(() => {}); },
  }), /timed out/);
  assert.equal(signals.length, 2);
  assert.ok(signals.every(signal => signal.aborted));
});

test('stalled texture decoding is also bounded', { timeout: 1000 }, async () => {
  let attempts = 0;
  await assert.rejects(loadModelFile({ parseAsync: () => { attempts++; return new Promise(() => {}); } }, '/models/pirate.glb', {
    timeoutMs: 15, fetchImpl: async () => response(),
  }), /timed out/);
  assert.equal(attempts, 2);
});

test('decoding has its own budget after a successful download', async () => {
  const model = { scene: {} };
  const actual = await loadModelFile({ parseAsync: () => new Promise(resolve => setTimeout(() => resolve(model), 30)) }, '/models/pirate.glb', {
    timeoutMs: 10, decodeTimeoutMs: 200, fetchImpl: async () => response(),
  });
  assert.equal(actual, model);
});

test('reuses an early delivery buffer without downloading the model again', async () => {
  const model = { scene: {} }, bytes = await response().arrayBuffer();
  globalThis.__pirateModelDownloads = new Map([['http://localhost/models/pirate.glb', Promise.resolve(bytes)]]);
  try {
    const actual = await loadModelFile({ parseAsync: async () => model }, '/models/pirate.glb', {
      fetchImpl: () => assert.fail('Buffer was already delivered'),
    });
    assert.equal(actual, model);
    assert.equal(globalThis.__pirateModelDownloads.size, 0);
  } finally { delete globalThis.__pirateModelDownloads; }
});
