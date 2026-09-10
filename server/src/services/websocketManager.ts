import WebSocket from 'ws';
import { PublicFeedItem, FeedNotification } from '../models/types.js';

export class WebSocketManager {
  private feedSockets: Map<string, Set<WebSocket>> = new Map();
  private feedManager: any;
  private readonly maxBufferedBytes: number;

  constructor(options: { maxBufferedBytes?: number } = {}) {
    this.maxBufferedBytes = options.maxBufferedBytes ?? 8 * 1024 * 1024;
  }

  private disconnect(feedName: string, ws: WebSocket): void {
    this.removeConnection(feedName, ws);
    ws.terminate();
  }

  private send(feedName: string, ws: WebSocket, payload: string): void {
    if (ws.readyState !== WebSocket.OPEN ||
        ws.bufferedAmount + Buffer.byteLength(payload) > this.maxBufferedBytes) {
      this.disconnect(feedName, ws);
      return;
    }
    try {
      ws.send(payload, err => {
        if (err) this.disconnect(feedName, ws);
      });
    } catch {
      this.disconnect(feedName, ws);
    }
  }

  setFeedManager(feedManager: any): void {
    this.feedManager = feedManager;
  }

  feedSocketsForFeed(feedName: string): Set<WebSocket> {
    return this.feedSockets.get(feedName) ?? new Set();
  }

  addConnection(feedName: string, ws: WebSocket): void {
    let sockets = this.feedSockets.get(feedName);
    if (!sockets) {
      sockets = new Set();
      this.feedSockets.set(feedName, sockets);
    }
    sockets.add(ws);
  }

  removeConnection(feedName: string, ws: WebSocket): void {
    const sockets = this.feedSockets.get(feedName);
    if (sockets) {
      sockets.delete(ws);
      if (sockets.size === 0) this.feedSockets.delete(feedName);
    }
  }

  handleMessage(feedName: string, ws: WebSocket, message: string): void {
    const trimmed = message.trim();
    if (trimmed === 'ping') {
      this.send(feedName, ws, 'pong');
      return;
    }
    if (trimmed === 'feed') {
      if (!this.feedManager) {
        return;
      }
      try {
        const feed = this.feedManager.getFeed(feedName);
        const publicFeed = feed.public();
        this.send(feedName, ws, JSON.stringify(publicFeed));
      } catch (err) {
        console.error('Error handling feed message:', err);
      }
    }
  }

  notifyAdd(item: PublicFeedItem): void {
    this.broadcast(item.feed.name, { action: 'add', item });
  }

  notifyUpdate(item: PublicFeedItem): void {
    this.broadcast(item.feed.name, { action: 'update', item });
  }

  notifyRemove(item: PublicFeedItem): void {
    this.broadcast(item.feed.name, { action: 'remove', item });
  }

  notifyEmpty(feedName: string): void {
    this.broadcast(feedName, { action: 'empty', item: {} as PublicFeedItem });
  }

  private broadcast(feedName: string, notification: FeedNotification): void {
    const sockets = this.feedSockets.get(feedName);
    if (!sockets) {
      return;
    }
    const payload = JSON.stringify(notification);
    for (const ws of sockets) {
      this.send(feedName, ws, payload);
    }
  }
}
