import { expect, test } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initConfig } from '../src/config.js';

test('malformed existing configuration is preserved and startup fails', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paste-config-test-'));
  try {
    const file = path.join(dir, 'config.json');
    fs.writeFileSync(file, '{broken');
    expect(() => initConfig(dir)).toThrow();
    expect(fs.readFileSync(file, 'utf8')).toBe('{broken');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test('new configuration keys persist unchanged when loaded again', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paste-config-test-'));
  try {
    const first = initConfig(dir);
    expect(first.VAPIDPublicKey.length).toBeGreaterThan(0);
    expect(initConfig(dir)).toEqual(first);
    expect(JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8')).notification).toEqual(first);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
