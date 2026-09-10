import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import WebSocket from 'ws';

const image = process.argv[2] || 'paste-feed:latest';
const name = `paste-feed-smoke-${randomUUID()}`;
const volume = `${name}-data`;
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
let base;
async function start() {
  docker('run', '-d', '--name', name, '-p', '127.0.0.1::8080', '-v', `${volume}:/data`, '-e', 'FEED_MAX_UPLOAD_SIZE=1', '--health-interval=1s', image);
  const port = JSON.parse(docker('inspect', name))[0].NetworkSettings.Ports['8080/tcp'][0].HostPort;
  base = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (JSON.parse(docker('inspect', name))[0].State.Health.Status === 'healthy') return;
    await delay(200);
  }
  throw new Error('Container did not become healthy');
}
try {
  docker('volume', 'create', volume);
  await start();
  const page = await fetch(base + '/');
  assert.equal(page.status, 200);
  assert.match(await page.text(), /<div id="root">/);
  const feed = await (await fetch(base + '/api/feeds/smoke')).json();
  assert.ok(feed.secret);
  assert.equal((await fetch(base + '/api/feeds/smoke')).status, 401);
  const form = new FormData();
  form.append('file', new Blob(['survives container replacement'], { type: 'text/plain' }), 'note.txt');
  assert.equal((await fetch(base + `/api/feeds/smoke?secret=${feed.secret}`, { method: 'POST', body: form })).status, 200);
  const oversized = new FormData();
  oversized.append('file', new Blob(['x'.repeat(1024 * 1024 + 1)]), 'large.bin');
  assert.equal((await fetch(base + `/api/feeds/smoke?secret=${feed.secret}`, { method: 'POST', body: oversized })).status, 413);
  const config = docker('exec', name, 'cat', '/data/config.json');
  const socket = new WebSocket(base.replace('http:', 'ws:') + `/ws/smoke?secret=${feed.secret}`);
  try {
    await once(socket, 'open', { signal: AbortSignal.timeout(5000) });
    const snapshot = once(socket, 'message', { signal: AbortSignal.timeout(5000) });
    socket.send('feed');
    assert.equal(JSON.parse((await snapshot)[0].toString()).items.length, 1);
    const pong = once(socket, 'message', { signal: AbortSignal.timeout(5000) });
    socket.send('ping');
    assert.equal((await pong)[0].toString(), 'pong');
    const closed = once(socket, 'close', { signal: AbortSignal.timeout(15000) });
    docker('stop', '--time', '12', name);
    await closed;
    assert.equal(JSON.parse(docker('inspect', name))[0].State.ExitCode, 0);
  } finally { socket.terminate(); }
  docker('rm', name);
  await start();
  const restored = await fetch(base + `/api/feeds/smoke?secret=${feed.secret}`);
  assert.equal(restored.status, 200);
  const items = (await restored.json()).items;
  assert.equal(items.length, 1);
  assert.equal(await (await fetch(base + `/api/feeds/smoke/items/${encodeURIComponent(items[0].name)}?secret=${feed.secret}`)).text(), 'survives container replacement');
  assert.equal(docker('exec', name, 'cat', '/data/config.json'), config);
  console.log(`PASS ${image}: healthy startup, UI, auth, uploads, size limit, WebSocket snapshot/heartbeat, graceful shutdown, container recreation, persistent content and VAPID keys`);
} catch (err) {
  try { console.error(docker('logs', name)); } catch {}
  throw err;
} finally {
  try { docker('rm', '-f', name); } catch {}
  try { docker('volume', 'rm', volume); } catch {}
}
