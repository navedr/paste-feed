import { afterEach, beforeEach, expect, test } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import axios from 'axios';
import { createServer } from '../src/server.js';
import { FeedManager } from '../src/models/feedManager.js';
import { WebSocketManager } from '../src/services/websocketManager.js';

let dir: string;
let base: string;
let server: ReturnType<typeof createServer>['server'];
beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paste-feed-test-'));
  const ws = new WebSocketManager();
  const fm = new FeedManager(dir, ws);
  ws.setFeedManager(fm);
  ({ server } = createServer({ feedManager: fm, wsManager: ws, version: 'test', vapidPublicKey: '', maxBodySize: 1024, uiDistPath: 'web/ui/dist' }));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as any).port}/api/feeds/review`;
});
afterEach(async () => {
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
  fs.rmSync(dir, { recursive: true, force: true });
});
async function createFeed() {
  const response = await fetch(base);
  expect(response.status).toBe(200);
  return response.json();
}
function upload(data: string, name = 'test.txt', type = 'text/plain') {
  const form = new FormData();
  form.append('file', new Blob([data], { type }), name);
  return form;
}
test('existing feeds require authentication and never disclose secrets anonymously', async () => {
  const { secret } = await createFeed();
  const response = await fetch(base);
  expect(response.status).toBe(401);
  expect(response.headers.get('set-cookie')).toBeNull();
  expect(await response.text()).not.toContain(secret);
  expect((await fetch(base + '?secret=wrong')).status).toBe(401);
  expect((await fetch(base, { headers: { Cookie: `Secret=${secret}` } })).status).toBe(200);
});
test('PIN sharing accepts the existing Axios request and unlocks another client', async () => {
  const { secret } = await createFeed();
  const response = await axios.patch(base + '?secret=' + secret, '1234', { validateStatus: () => true });
  expect(response.status).toBe(200);
  const unlocked = await fetch(base + '?secret=1234');
  expect(unlocked.status).toBe(200);
  expect((await unlocked.json()).secret).toBe(secret);
});
test('oversized uploads are rejected without writing a partial item', async () => {
  const { secret } = await createFeed();
  const response = await fetch(base + '?secret=' + secret, { method: 'POST', body: upload('x'.repeat(1025)) });
  expect(response.status).toBe(413);
  expect(fs.readdirSync(path.join(dir, 'review'))).toEqual(['config.json']);
  expect((await fetch(base + '?secret=' + secret, { method: 'POST', body: upload('x'.repeat(1024)) })).status).toBe(200);
});
test('authentication runs before parsing multipart bodies', async () => {
  await createFeed();
  const response = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'multipart/form-data; boundary=missing' }, body: 'malformed' });
  expect(response.status).toBe(401);
});
test('multiple uploaded files are rejected without saving any', async () => {
  const { secret } = await createFeed();
  const form = upload('first');
  form.append('file', new Blob(['second']), 'second.txt');
  const response = await fetch(base + '?secret=' + secret, { method: 'POST', body: form });
  expect(response.status).toBe(413);
  expect(fs.readdirSync(path.join(dir, 'review'))).toEqual(['config.json']);
});
test.each(['100%.pdf', 'literal%20name.pdf'])('percent filename %s survives download, rename and deletion', async name => {
  const { secret } = await createFeed();
  expect((await fetch(base + '?secret=' + secret, { method: 'POST', body: upload('pdf-content', name, 'application/pdf') })).status).toBe(200);
  const url = `${base}/items/${encodeURIComponent(name)}?secret=${secret}`;
  const response = await fetch(url);
  expect(response.status).toBe(200);
  expect(await response.text()).toBe('pdf-content');
  expect((await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'renamed' }) })).status).toBe(200);
  expect((await fetch(url, { method: 'DELETE' })).status).toBe(200);
});
test('invalid rename payloads and missing items cannot mutate stored configuration', async () => {
  const { secret } = await createFeed();
  await fetch(base + '?secret=' + secret, { method: 'POST', body: upload('text') });
  const configPath = path.join(dir, 'review', 'config.json');
  const original = fs.readFileSync(configPath, 'utf8');
  for (const body of [{ name: { bad: 'value' } }, {}, { name: '' }]) {
    const response = await fetch(`${base}/items/Pasted%20Text.txt?secret=${secret}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    expect(response.status).toBe(400);
    expect(fs.readFileSync(configPath, 'utf8')).toBe(original);
  }
  const missing = await fetch(`${base}/items/missing.txt?secret=${secret}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'valid' }) });
  expect(missing.status).toBe(404);
  expect(fs.readFileSync(configPath, 'utf8')).toBe(original);
});
test('existing Go feed configuration and files remain usable', async () => {
  const feedDir = path.join(dir, 'review');
  fs.mkdirSync(feedDir);
  fs.writeFileSync(path.join(feedDir, 'config.json'), JSON.stringify({ secret: 'old-go-secret', Subscriptions: null, itemNameOverrides: { 'Pasted Text.txt': 'Saved note' } }));
  fs.writeFileSync(path.join(feedDir, 'Pasted Text.txt'), 'existing data');
  const response = await fetch(base + '?secret=old-go-secret');
  expect(response.status).toBe(200);
  expect((await response.json()).items[0].displayName).toBe('Saved note');
  expect(await (await fetch(base + '/items/Pasted%20Text.txt?secret=old-go-secret')).text()).toBe('existing data');
});
