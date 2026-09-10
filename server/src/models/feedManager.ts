import fs from 'node:fs';
import path from 'node:path';
import { Feed } from './feed.js';
import type { NotificationSettings } from './types.js';

export class FeedManager {
  path: string;
  websocketManager: any;
  notificationSettings: NotificationSettings | null = null;
  masterPin: string | null = null;

  constructor(dataPath: string, websocketManager: any) {
    this.path = dataPath;
    this.websocketManager = websocketManager;
  }

  getFeed(feedName: string): Feed {
    const feedPath = path.join(this.path, feedName);
    const feed = Feed.getFeed(feedPath);
    feed.websocketManager = this.websocketManager;
    feed.notificationSettings = this.notificationSettings;
    feed.masterPin = this.masterPin;
    return feed;
  }

  getFeedWithAuth(feedName: string, secret: string): Feed {
    const feed = this.getFeed(feedName);
    feed.isSecretValid(secret);
    return feed;
  }

  dumpSecrets(): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(this.path, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const feedPath = path.join(this.path, entry.name);
      try {
        const feed = Feed.getFeed(feedPath);
        console.log(`Feed ${feed.name()}: ${feed.config.secret}`);
      } catch {
        // skip feeds that can't be loaded
      }
    }
  }
}
