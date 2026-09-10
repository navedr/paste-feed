import fs from 'node:fs';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { FeedConfig } from './feedConfig.js';
import {
  type PublicFeed,
  type PublicFeedItem,
  type NotificationSettings,
  type FileTypeInfo,
  getItemType,
} from './types.js';
import {
  FeedAlreadyExistsError,
  FeedNotFoundError,
  InvalidSecretError,
  IncorrectSecretError,
  ItemNotFoundError,
  ItemEmptyError,
  InvalidFeedItemError,
} from '../utils/errors.js';
import { sendPushNotification } from '../services/pushNotifications.js';

const INTERNAL_FILES = new Set(['secret', 'pin', 'config.json']);

export class Feed {
  path: string;
  config: FeedConfig;
  notificationSettings: NotificationSettings | null = null;
  websocketManager: any = null;
  masterPin: string | null = null;

  private constructor(feedPath: string, config: FeedConfig) {
    this.path = feedPath;
    this.config = config;
  }

  static newFeed(feedPath: string): Feed {
    if (fs.existsSync(feedPath)) {
      throw new FeedAlreadyExistsError();
    }

    fs.mkdirSync(feedPath, { mode: 0o700 });

    const config = new FeedConfig(feedPath);
    config.secret = uuidv4();
    const feed = new Feed(feedPath, config);
    config.write();

    return feed;
  }

  static getFeed(feedPath: string): Feed {
    if (!fs.existsSync(feedPath)) {
      throw new FeedNotFoundError(path.basename(feedPath));
    }

    const config = FeedConfig.load(feedPath);
    return new Feed(feedPath, config);
  }

  name(): string {
    return path.basename(this.path);
  }

  public(): PublicFeed {
    const items = this.publicItems();
    const result: PublicFeed = {
      name: this.name(),
      items,
      secret: this.config.secret,
      vapidpublickey: this.notificationSettings?.VAPIDPublicKey ?? '',
    };
    return result;
  }

  publicItems(): PublicFeedItem[] {
    const entries = fs.readdirSync(this.path, { withFileTypes: true });
    const items: PublicFeedItem[] = [];

    for (const entry of entries) {
      if (INTERNAL_FILES.has(entry.name)) continue;

      const stat = fs.statSync(path.join(this.path, entry.name));
      const item: PublicFeedItem = {
        name: entry.name,
        date: stat.mtime.toISOString(),
        type: getItemType(entry.name),
        feed: { name: this.name() },
      };

      if (this.config.itemNameOverrides[entry.name]) {
        item.displayName = this.config.itemNameOverrides[entry.name];
      }

      items.push(item);
    }

    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return items;
  }

  empty(): void {
    const items = this.publicItems();
    for (const item of items) {
      this.removeItem(item.name, false);
    }
    if (this.websocketManager) {
      this.websocketManager.notifyEmpty(this.name());
    }
  }

  getPublicItem(itemName: string): PublicFeedItem {
    if (INTERNAL_FILES.has(itemName)) {
      throw new InvalidFeedItemError();
    }

    const safeName = path.join('/', itemName);
    const itemPath = path.join(this.path, safeName);
    let stat: fs.Stats;

    try {
      stat = fs.statSync(itemPath);
    } catch {
      throw new ItemNotFoundError(itemName);
    }

    const item: PublicFeedItem = {
      name: itemName,
      date: stat.mtime.toISOString(),
      type: getItemType(itemName),
      feed: { name: this.name(), secret: this.config.secret },
    };

    if (this.config.itemNameOverrides[itemName]) {
      item.displayName = this.config.itemNameOverrides[itemName];
    }

    return item;
  }

  getItemData(itemName: string): Buffer {
    if (itemName.includes('../')) {
      throw new ItemNotFoundError(itemName);
    }

    const safeName = path.join('/', itemName);
    const filePath = path.join(this.path, safeName);

    if (INTERNAL_FILES.has(path.basename(filePath))) {
      throw new ItemNotFoundError(itemName);
    }

    try {
      return fs.readFileSync(filePath);
    } catch {
      throw new ItemNotFoundError(itemName);
    }
  }

  isSecretValid(secret: string): void {
    if (!secret) {
      throw new InvalidSecretError();
    }

    if (secret.length === 4) {
      if (this.masterPin && secret === this.masterPin) {
        return;
      }
      this.config.validatePIN(secret);
    } else {
      if (this.config.secret !== secret) {
        throw new IncorrectSecretError();
      }
    }
  }

  addItem(contentType: string, filename: string, buffer: Buffer): void {
    const mimeInfos: Record<string, FileTypeInfo> = {
      'image/png': { fileExtension: 'png', fileNameTemplate: 'Pasted Image' },
      'image/jpeg': { fileExtension: 'jpg', fileNameTemplate: 'Pasted Image' },
      'text/plain': { fileExtension: 'txt', fileNameTemplate: 'Pasted Text' },
    };

    let info = mimeInfos[contentType];
    if (!info) {
      const ext = path.extname(filename);
      info = {
        fileExtension: ext.slice(1),
        fileNameTemplate: filename.slice(0, filename.length - ext.length),
      };
    }

    if (buffer.length === 0) {
      throw new ItemEmptyError();
    }

    let fileIndex = 0;
    let finalName: string;
    while (true) {
      const suffix = fileIndex > 0 ? ` ${fileIndex}` : '';
      finalName = `${info.fileNameTemplate}${suffix}`;
      const matches = fs.readdirSync(this.path).filter(name => name.startsWith(finalName + '.'));
      if (matches.length === 0) break;
      fileIndex++;
    }

    const fullName = `${finalName!}.${info.fileExtension}`;
    const filePath = path.join(this.path, fullName);
    fs.writeFileSync(filePath, buffer, { mode: 0o600 });

    // Remove any existing name override for this item
    if (this.config.itemNameOverrides[fullName]) {
      delete this.config.itemNameOverrides[fullName];
      this.config.write();
    }

    const publicItem = this.getPublicItem(fullName);

    if (this.websocketManager) {
      this.websocketManager.notifyAdd(publicItem);
    }

    if (this.notificationSettings && this.config.Subscriptions.length > 0) {
      sendPushNotification(
        this.name(),
        this.config.Subscriptions,
        this.notificationSettings,
      ).catch((err) => console.error('Error sending push notification:', err));
    }
  }

  removeItem(itemName: string, notify: boolean): void {
    const safeName = path.join('/', itemName);
    const itemPath = path.join(this.path, safeName);

    // Save public item before deletion for notification
    const publicItem = this.getPublicItem(itemName);

    try {
      fs.unlinkSync(itemPath);
    } catch {
      throw new ItemNotFoundError(itemName);
    }

    if (this.websocketManager && notify) {
      this.websocketManager.notifyRemove(publicItem);
    }
  }

  setPIN(pin: string): void {
    this.config.setPIN(pin);
  }

  setItemNameOverride(itemName: string, displayName: string): void {
    const publicItem = this.getPublicItem(itemName);
    this.config.itemNameOverrides[itemName] = displayName;
    this.config.write();

    publicItem.displayName = displayName;

    if (this.websocketManager) {
      this.websocketManager.notifyUpdate(publicItem);
    }
  }
}
