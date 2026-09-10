import { afterAll, beforeAll, expect, test } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WebSocket } from 'ws';

let child: ChildProcess;
let dir: string;
let port: number;
let stderr = '';
beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paste-ws-test-'));
  child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', `
    import {createServer} from './server/src/server.ts';
    import {FeedManager} from './server/src/models/feedManager.ts';
    import {WebSocketManager} from './server/src/services/websocketManager.ts';
    const ws = new WebSocketManager(); const fm = new FeedManager(process.env.TEST_DATA, ws); ws.setFeedManager(fm);
    const {server} = createServer({feedManager:fm, wsManager:ws, version:'test', vapidPublicKey:'', maxBodySize:1024, uiDistPath:'web/ui/dist'});
    server.listen(0,'127.0.0.1',()=>console.log('PORT:'+server.address().port));
  `], { env: { ...process.env, TEST_DATA: dir }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stderr!.on('data', data => stderr += data);
  port = await new Promise<number>((resolve, reject) => {
    child.stdout!.on('data', data => { const match = String(data).match(/PORT:(\d+)/); if (match) resolve(Number(match[1])); });
    child.once('exit', () => reject(new Error(stderr)));
  });
});
afterAll(async () => {
  if (child.exitCode === null) {
    const exited = new Promise(resolve => child.once('exit', resolve));
    child.kill(); await exited;
  }
  fs.rmSync(dir, { recursive: true, force: true });
});
async function rawUpgrade(url: string, cookie = '') {
  return new Promise<void>((resolve, reject) => {
    const socket = net.connect(port, '127.0.0.1', () => {
      socket.write(`GET ${url} HTTP/1.1\r\nHost: localhost\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n${cookie ? `Cookie: ${cookie}\r\n` : ''}\r\n`);
    });
    socket.resume();
    socket.on('close', () => resolve());
    socket.on('error', reject);
    socket.setTimeout(2000, () => { socket.destroy(); reject(new Error('socket not closed')); });
  });
}
test('malformed upgrade URLs and cookies cannot crash the process', async () => {
  for (const [url, cookie] of [['/ws/%', ''], ['/ws/review', 'Secret=%']]) {
    await rawUpgrade(url, cookie);
    const alive = await fetch(`http://127.0.0.1:${port}/api`).then(r => r.status).catch(() => 0);
    expect(alive, stderr).toBe(200);
  }
});
test('websocket feed updates work and malformed frames only close their connection', async () => {
  const { secret } = await (await fetch(`http://127.0.0.1:${port}/api/feeds/review`)).json();
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/review?secret=${secret}`);
  await new Promise<void>((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
  const message = new Promise<any>(resolve => ws.once('message', data => resolve(JSON.parse(data.toString()))));
  ws.send('feed');
  expect((await message).name).toBe('review');
  const closed = new Promise(resolve => ws.once('close', resolve));
  // An unmasked client frame violates the WebSocket protocol.
  (ws as any)._socket.write(Buffer.from([0x81, 0x00]));
  await closed;
  expect(await fetch(`http://127.0.0.1:${port}/api`).then(r => r.status).catch(() => 0), stderr).toBe(200);
});
