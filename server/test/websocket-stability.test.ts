import { afterEach, beforeEach, expect, test } from 'vitest';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
import { setupWebSocket } from '../src/routes/websocket.js';
import { WebSocketManager } from '../src/services/websocketManager.js';
import { FeedManager } from '../src/models/feedManager.js';
import { Feed } from '../src/models/feed.js';

let dir: string;
let server: ReturnType<typeof createServer>;
let manager: WebSocketManager;
let url: string;
let clients: WebSocket[];
beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-stability-'));
  manager = new WebSocketManager({ maxBufferedBytes: 16384 });
  const fm = new FeedManager(dir, manager);
  manager.setFeedManager(fm);
  const feed = Feed.newFeed(path.join(dir, 'review'));
  server = createServer();
  setupWebSocket(server, manager, fm, { heartbeatIntervalMs: 30 });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  url = `ws://127.0.0.1:${(server.address() as any).port}/ws/review?secret=${feed.config.secret}`;
  clients = [];
});
afterEach(async () => {
  for (const client of clients) client.terminate();
  for (const socket of manager.feedSocketsForFeed('review')) socket.terminate();
  await new Promise<void>(resolve => server.close(() => resolve()));
  fs.rmSync(dir, { recursive: true, force: true });
});
async function connect(autoPong = true) {
  const client = new WebSocket(url, { autoPong }); clients.push(client);
  await once(client, 'open'); return client;
}
test('a client that stops responding to ping is terminated while healthy clients survive', async () => {
  const stale = await connect(false);
  const healthy = await connect();
  await delay(160);
  expect(stale.readyState).toBe(WebSocket.CLOSED);
  expect(healthy.readyState).toBe(WebSocket.OPEN);
  expect(manager.feedSocketsForFeed('review').size).toBe(1);
});
test('application heartbeat receives a pong without a feed scan', async () => {
  const client = await connect();
  const response = Promise.race([once(client, 'message').then(([data]) => data.toString()), delay(100).then(() => 'timeout')]);
  client.send('ping');
  expect(await response).toBe('pong');
});
test('a stalled receiver cannot retain an unlimited broadcast backlog', async () => {
  const client = await connect();
  (client as any)._socket.pause();
  const socket = [...manager.feedSocketsForFeed('review')][0];
  const item = { name: 'note.txt', date: '2026-09-10T00:00:00Z', type: 'text', feed: { name: 'review' }, displayName: 'x'.repeat(4096) };
  for (let i = 0; i < 5000; i++) manager.notifyUpdate(item as any);
  expect(socket.readyState).not.toBe(WebSocket.OPEN);
  expect(manager.feedSocketsForFeed('review').size).toBe(0);
});
test('snapshot requests use the same outgoing size bound', async () => {
  const client = await connect();
  fs.writeFileSync(path.join(dir, 'review', 'note.txt'), 'text');
  const file = path.join(dir, 'review', 'config.json');
  const config = JSON.parse(fs.readFileSync(file, 'utf8'));
  config.itemNameOverrides = { 'note.txt': 'x'.repeat(20000) };
  fs.writeFileSync(file, JSON.stringify(config));
  client.send('feed');
  await delay(80);
  expect(client.readyState).toBe(WebSocket.CLOSED);
});
