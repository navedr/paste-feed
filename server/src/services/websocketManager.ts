import WebSocket from 'ws';
import { PublicFeedItem, FeedNotification } from '../models/types.js';

export class WebSocketManager {
  private feedSockets: Map<string, Set<WebSocket>> = new Map();
  private feedManager: any;

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
    }
  }

  handleMessage(feedName: string, ws: WebSocket, message: string): void {
    const trimmed = message.trim();
    if (trimmed === 'feed') {
      if (!this.feedManager) {
        return;
      }
      try {
        const feed = this.feedManager.getFeed(feedName);
        const publicFeed = feed.public();
        ws.send(JSON.stringify(publicFeed));
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
      try {
        ws.send(payload);
      } catch {
        sockets.delete(ws);
      }
    }
  }
}
