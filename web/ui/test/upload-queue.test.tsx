// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { useUploadQueue } from '../src/Feed/useUploadQueue';
import { Y } from '../src/FeedClient';
vi.mock('../src/FeedClient', () => ({ Y: { post: vi.fn() } }));
afterEach(() => vi.resetAllMocks());
function request() {
  let resolve!: (value: string) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<string>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
test('multiple files upload separately and are saved only after the server confirms', async () => {
  const first = request(); const second = request();
  vi.mocked(Y.post).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const { result } = renderHook(() => useUploadQueue('review'));
  act(() => result.current.enqueue([new File(['a'], 'a.txt'), new File(['b'], 'b.txt')]));
  await waitFor(() => expect(Y.post).toHaveBeenCalledTimes(1));
  expect(result.current.jobs.map(job => job.status)).toEqual(['uploading', 'queued']);
  const options = vi.mocked(Y.post).mock.calls[0][2]!;
  act(() => options.onUploadProgress!({ progress: 1 } as any));
  expect(result.current.jobs[0].status).toBe('uploading');
  expect(result.current.jobs[0].progress).toBe(100);
  await act(async () => first.resolve('OK'));
  await waitFor(() => expect(Y.post).toHaveBeenCalledTimes(2));
  expect(result.current.jobs[0].status).toBe('saved');
  expect(result.current.jobs[0].file).toBeUndefined();
  const form = vi.mocked(Y.post).mock.calls[1][1] as FormData;
  expect((form.get('file') as File).name).toBe('b.txt');
  await act(async () => second.resolve('OK'));
  expect(result.current.jobs.map(job => job.status)).toEqual(['saved', 'saved']);
});
test('a failed upload does not block the queue and only that file is retried', async () => {
  vi.mocked(Y.post).mockRejectedValueOnce({ response: { status: 413 } }).mockResolvedValueOnce('OK').mockResolvedValueOnce('OK');
  const { result } = renderHook(() => useUploadQueue('review'));
  act(() => result.current.enqueue([new File(['a'], 'a.txt'), new File(['b'], 'b.txt')]));
  await waitFor(() => expect(result.current.jobs.map(job => job.status)).toEqual(['failed', 'saved']));
  expect(result.current.jobs[0].error).toContain('size limit');
  act(() => result.current.retry(result.current.jobs[0].id));
  await waitFor(() => expect(result.current.jobs.every(job => job.status === 'saved')).toBe(true));
  expect(Y.post).toHaveBeenCalledTimes(3);
  expect(((vi.mocked(Y.post).mock.calls[2][1] as FormData).get('file') as File).name).toBe('a.txt');
});
test('unmount aborts the active upload without starting queued files', async () => {
  const pending = request(); vi.mocked(Y.post).mockReturnValue(pending.promise);
  const { result, unmount } = renderHook(() => useUploadQueue('review'));
  act(() => result.current.enqueue([new File(['a'], 'a.txt'), new File(['b'], 'b.txt')]));
  await waitFor(() => expect(Y.post).toHaveBeenCalledTimes(1));
  const signal = vi.mocked(Y.post).mock.calls[0][2]!.signal!;
  unmount(); expect(signal.aborted).toBe(true);
  await act(async () => pending.resolve('OK'));
  expect(Y.post).toHaveBeenCalledTimes(1);
});

test('a refresh failure cannot relabel a confirmed save as failed', async () => {
  vi.mocked(Y.post).mockResolvedValueOnce('OK');
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const { result } = renderHook(() => useUploadQueue('review', () => { throw new Error('refresh failed'); }));
  act(() => result.current.enqueue([new File(['a'], 'a.txt')]));
  await waitFor(() => expect(result.current.jobs[0].status).toBe('saved'));
  expect(result.current.jobs[0].error).toBeUndefined();
  log.mockRestore();
});
test('retrying a previous failure does not interrupt the current upload', async () => {
  const second = request();
  vi.mocked(Y.post).mockRejectedValueOnce(new Error('network')).mockReturnValueOnce(second.promise).mockResolvedValueOnce('OK');
  const { result } = renderHook(() => useUploadQueue('review'));
  act(() => result.current.enqueue([new File(['a'], 'a.txt'), new File(['b'], 'b.txt')]));
  await waitFor(() => expect(Y.post).toHaveBeenCalledTimes(2));
  const signal = vi.mocked(Y.post).mock.calls[1][2]!.signal!;
  act(() => result.current.retry(result.current.jobs[0].id));
  expect(signal.aborted).toBe(false);
  expect(Y.post).toHaveBeenCalledTimes(2);
  await act(async () => second.resolve('OK'));
  await waitFor(() => expect(result.current.jobs.every(job => job.status === 'saved')).toBe(true));
  expect(Y.post).toHaveBeenCalledTimes(3);
});
