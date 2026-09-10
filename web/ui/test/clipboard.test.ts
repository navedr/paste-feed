import { expect, test } from 'vitest';
import { clipboardFiles } from '../src/paste';
test('all clipboard files are preserved rather than uploading only the first', () => {
  const files = [new File(['a'], 'a.png', { type: 'image/png' }), new File(['b'], 'b.pdf', { type: 'application/pdf' })];
  const event = { clipboardData: { items: files.map(file => ({ kind: 'file', type: file.type, getAsFile: () => file })), getData: () => 'fallback' } } as unknown as ClipboardEvent;
  expect(clipboardFiles(event).map(file => file.name)).toEqual(['a.png', 'b.pdf']);
});
test('plain text becomes a text upload and unsupported or empty pastes do nothing', async () => {
  const event = { clipboardData: { items: [], getData: () => 'hello' } } as unknown as ClipboardEvent;
  const [file] = clipboardFiles(event);
  expect(file.type).toBe('text/plain'); expect(await file.text()).toBe('hello');
  expect(clipboardFiles({ clipboardData: null } as ClipboardEvent)).toEqual([]);
  expect(clipboardFiles({ clipboardData: { items: [], getData: () => '' } } as unknown as ClipboardEvent)).toEqual([]);
});
