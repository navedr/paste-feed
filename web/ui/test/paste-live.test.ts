import { expect, test } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import WebSocket from 'ws';
import axios from 'axios';
import { PasteToFeed } from '../src/paste';
import { Y } from '../src/FeedClient';
import { createServer } from '../../../server/src/server';
import { FeedManager } from '../../../server/src/models/feedManager';
import { WebSocketManager } from '../../../server/src/services/websocketManager';

test('clipboard paste broadcasts to both devices and offline pastes appear on reconnect', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paste-live-'));
  const wm = new WebSocketManager();
  const fm = new FeedManager(dir, wm); wm.setFeedManager(fm);
  const { server, shutdown } = createServer({ feedManager: fm, wsManager: wm, version: 'test', vapidPublicKey: '', maxBodySize: 1024, uiDistPath: 'web/ui/dist' });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as any).port}/api/feeds/review`;
  const { secret } = await (await fetch(base)).json();
  const oldBase = Y.baseURL;
  Y.baseURL = base.replace('/feeds/review', '');
  // The browser supplies this cookie automatically. Use Axios defaults for the real Node transport.
  const oldCookie = axios.defaults.headers.common.Cookie;
  axios.defaults.headers.common.Cookie = `Secret=${secret}`;
  const wsURL = base.replace('/api/feeds/', '/ws/').replace('http:', 'ws:') + '?secret=' + secret;
  const first = new WebSocket(wsURL);
  let second = new WebSocket(wsURL);
  const next = (socket: WebSocket) => once(socket, 'message', { signal: AbortSignal.timeout(2000) }).then(([data]) => JSON.parse(data.toString()));
  try {
    await Promise.all([once(first, 'open'), once(second, 'open')]);
    const firstUpdate = next(first);
    const secondUpdate = next(second);
    const paste = (text: string) => PasteToFeed({ clipboardData: { items: [{ type: 'text/plain', kind: 'string' }], getData: () => text } } as unknown as ClipboardEvent, 'review');
    paste('shared clipboard content');
    const [local, remote] = await Promise.all([firstUpdate, secondUpdate]);
    expect(local.action).toBe('add');
    expect(remote).toEqual(local);
    expect(await (await fetch(`${base}/items/${encodeURIComponent(local.item.name)}?secret=${secret}`)).text()).toBe('shared clipboard content');
    const secondClosed = once(second, 'close'); second.close(); await secondClosed;
    const whileOffline = next(first);
    paste('pasted while the other device was offline');
    expect((await whileOffline).action).toBe('add');
    second = new WebSocket(wsURL); await once(second, 'open');
    const snapshot = next(second); second.send('feed');
    expect((await snapshot).items).toHaveLength(2);
  } finally {
    first.terminate(); second.terminate();
    Y.baseURL = oldBase;
    if (oldCookie === undefined) delete axios.defaults.headers.common.Cookie;
    else axios.defaults.headers.common.Cookie = oldCookie;
    await shutdown();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
