// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { FeedItemsComponent } from '../src/Feed/Components/FeedItemsComponent';

vi.mock('@mantine/core', () => ({ Box: ({ children }: any) => children, Space: () => null, TextInput: () => null }));
vi.mock('@tabler/icons-react', () => ({ IconSearch: () => null }));
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('../src/Feed/index', () => ({ Connector: {} }));
vi.mock('../src/Feed/Components/index', async () => {
  const { useContext, createElement } = await import('react');
  return { FeedItemComponent: () => {
    const { name } = useContext(FeedItemContext)!;
    return createElement('span', null, name);
  } };
});
import { FeedItemContext } from '../src/Feed/Components/FeedItemsComponent';
const navigate = vi.fn();
class Socket {
  static OPEN = 1;
  static instances: Socket[] = [];
  readyState = 0;
  onopen: null | (() => void) = null;
  onclose: null | ((e: { code: number }) => void) = null;
  onmessage: null | ((e: { data: string }) => void) = null;
  onerror: null | (() => void) = null;
  sent: string[] = [];
  constructor(public url: string) { Socket.instances.push(this); }
  send(message: string) { this.sent.push(message); }
  open() { this.readyState = 1; this.onopen?.(); }
  close() { this.readyState = 3; this.onclose?.({ code: 1000 }); }
  lose() { this.readyState = 3; this.onclose?.({ code: 1006 }); }
  receive(data: unknown) { this.onmessage?.({ data: typeof data === 'string' ? data : JSON.stringify(data) }); }
}
beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal('WebSocket', Socket); Socket.instances = []; navigate.mockReset(); });
afterEach(() => { cleanup(); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const item = (name: string) => ({ name, type: 'text', date: '2026-09-10T00:00:00Z', feed: { name: 'review' } });
test('reconnected sockets apply a new snapshot and subsequent updates', () => {
  render(<FeedItemsComponent feedName="review" secret="secret" />);
  act(() => { Socket.instances[0].open(); Socket.instances[0].receive({ items: [item('before')] }); });
  expect(screen.getByText('before')).toBeTruthy();
  act(() => { Socket.instances[0].lose(); vi.advanceTimersByTime(1000); });
  const replacement = Socket.instances[1];
  act(() => { replacement.open(); replacement.receive({ items: [item('after')] }); });
  expect(screen.queryByText('before')).toBeNull();
  expect(screen.getByText('after')).toBeTruthy();
  act(() => replacement.receive({ action: 'add', item: item('new') }));
  expect(screen.getByText('new')).toBeTruthy();
});
test('unmount cancels a pending reconnect', () => {
  const view = render(<FeedItemsComponent feedName="review" secret="secret" />);
  act(() => { Socket.instances[0].open(); Socket.instances[0].lose(); });
  view.unmount();
  act(() => vi.advanceTimersByTime(60000));
  expect(Socket.instances).toHaveLength(1);
});
test('a silent connection is replaced after heartbeat timeout', () => {
  render(<FeedItemsComponent feedName="review" secret="secret" />);
  act(() => Socket.instances[0].open());
  act(() => vi.advanceTimersByTime(40000));
  expect(Socket.instances.length).toBeGreaterThan(1);
  expect(Socket.instances[0].readyState).toBe(3);
});
test('pong responses keep a healthy connection alive', () => {
  render(<FeedItemsComponent feedName="review" secret="secret" />);
  act(() => Socket.instances[0].open());
  for (let i = 0; i < 3; i++) {
    act(() => { vi.advanceTimersByTime(25000); Socket.instances[0].receive('pong'); });
  }
  expect(Socket.instances[0].sent).toContain('ping');
  expect(Socket.instances).toHaveLength(1);
});
test('changing feeds disposes the old connection and encodes the new URL', () => {
  const view = render(<FeedItemsComponent feedName="review" secret="secret" />);
  act(() => Socket.instances[0].open());
  view.rerender(<FeedItemsComponent feedName="100% feed" secret="new-secret" />);
  expect(Socket.instances[0].readyState).toBe(3);
  expect(Socket.instances[1].url).toContain('/ws/100%25%20feed?secret=new-secret');
});
test('rapid messages apply in order without losing unrelated items', () => {
  render(<FeedItemsComponent feedName="review" secret="secret" />);
  act(() => {
    const socket = Socket.instances[0]; socket.open();
    socket.receive({ items: [item('a'), item('b')] });
    socket.receive({ action: 'add', item: item('c') });
    socket.receive({ action: 'remove', item: item('a') });
    socket.receive({ action: 'update', item: { ...item('b'), displayName: 'renamed' } });
  });
  expect(screen.queryByText('a')).toBeNull();
  expect(screen.getByText('b')).toBeTruthy();
  expect(screen.getByText('c')).toBeTruthy();
});
test('unmount clears heartbeat deadlines and ignores late events', () => {
  const view = render(<FeedItemsComponent feedName="review" secret="secret" />);
  act(() => Socket.instances[0].open());
  const lateClose = Socket.instances[0].onclose;
  act(() => vi.advanceTimersByTime(25000));
  view.unmount();
  act(() => { lateClose?.({ code: 1006 }); vi.advanceTimersByTime(60000); });
  expect(Socket.instances).toHaveLength(1);
  expect(vi.getTimerCount()).toBe(0);
});
test('connection status follows syncing, disconnection, and a restored snapshot', () => {
  render(<FeedItemsComponent feedName="review" secret="secret" />);
  expect(screen.getByRole('status').textContent).toContain('Connecting');
  act(() => Socket.instances[0].open());
  expect(screen.getByRole('status').textContent).toContain('Syncing');
  act(() => Socket.instances[0].receive({ items: [] }));
  expect(screen.getByRole('status').textContent).toContain('Connected');
  expect(screen.getByRole('status').textContent).toContain('Synced at');
  act(() => Socket.instances[0].lose());
  expect(screen.getByRole('status').textContent).toContain('Reconnecting');
  act(() => { vi.advanceTimersByTime(1000); Socket.instances[1].open(); Socket.instances[1].receive({ items: [] }); });
  expect(screen.getByRole('status').textContent).toContain('Connected');
});
test('offline state is visible and reconnects when the browser returns online', () => {
  render(<FeedItemsComponent feedName="review" secret="secret" />);
  act(() => { Socket.instances[0].open(); window.dispatchEvent(new Event('offline')); });
  expect(screen.getByRole('status').textContent).toContain('Offline');
  act(() => window.dispatchEvent(new Event('online')));
  expect(Socket.instances).toHaveLength(2);
});
