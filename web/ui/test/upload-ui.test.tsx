// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { PasteCardComponent } from '../src/Feed/Components/PasteCardComponent';
import { Y } from '../src/FeedClient';
vi.mock('react-router-dom', () => ({ useParams: () => ({ feedName: 'review' }) }));
vi.mock('../src/FeedClient', () => ({ Y: { post: vi.fn() } }));
beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.resetAllMocks(); });
test('file picker accepts several files and exposes saved, error and retry feedback', async () => {
  vi.mocked(Y.post).mockResolvedValueOnce('OK').mockRejectedValueOnce({ response: { status: 413 } }).mockResolvedValueOnce('OK');
  render(<MantineProvider><PasteCardComponent /></MantineProvider>);
  fireEvent.change(screen.getByLabelText('Choose files to upload'), { target: { files: [new File(['a'], 'a.txt'), new File(['b'], 'b.txt')] } });
  await waitFor(() => expect(screen.getByText('Saved to feed')).toBeTruthy());
  expect(screen.getByText('a.txt')).toBeTruthy(); expect(screen.getByText('b.txt')).toBeTruthy();
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('size limit'));
  fireEvent.click(screen.getByRole('button', { name: 'Retry b.txt' }));
  await waitFor(() => expect(screen.getAllByText('Saved to feed')).toHaveLength(2));
});
test('pasting in another form field does not upload, but the paste area shows pending progress', async () => {
  let finish!: (value: string) => void;
  vi.mocked(Y.post).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  render(<MantineProvider><input aria-label="Search" /><PasteCardComponent /></MantineProvider>);
  const clipboardData = { items: [], getData: () => 'hello' };
  fireEvent.paste(screen.getByLabelText('Search'), { clipboardData });
  expect(Y.post).not.toHaveBeenCalled();
  fireEvent.paste(screen.getByLabelText('Paste into feed'), { clipboardData });
  await waitFor(() => expect(screen.getByText('Uploading 0%')).toBeTruthy());
  act(() => vi.mocked(Y.post).mock.calls[0][2]!.onUploadProgress!({ progress: 0.5 } as any));
  expect(screen.getByText('Uploading 50%')).toBeTruthy();
  await act(async () => finish('OK'));
  expect(screen.getByText('Saved to feed')).toBeTruthy();
});
