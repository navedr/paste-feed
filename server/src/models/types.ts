export enum FeedItemType {
  Text = 0,
  Image = 1,
  Binary = 2,
}

export interface PublicFeedItem {
  name: string;
  date: string;
  type: FeedItemType;
  feed: { name: string; secret?: string };
  displayName?: string;
}

export interface PublicFeed {
  name: string;
  items: PublicFeedItem[];
  secret: string;
  vapidpublickey: string;
  itemNameOverrides?: Record<string, string>;
}

export interface PushSubscription {
  endpoint: string;
  keys: {
    auth: string;
    p256dh: string;
  };
}

export interface PIN {
  pin: string;
  expiration: string; // ISO date string
}

export interface FeedConfigData {
  secret: string;
  pin?: PIN | null;
  itemNameOverrides?: Record<string, string>;
  Subscriptions?: PushSubscription[]; // Capital S for backward compat with Go-written configs
}

export interface NotificationSettings {
  VAPIDPublicKey: string;
  VAPIDPrivateKey: string;
}

export interface FeedNotification {
  action: 'add' | 'update' | 'remove' | 'empty';
  item: PublicFeedItem;
}

export interface FileTypeInfo {
  fileExtension: string;
  fileNameTemplate: string;
}

export function getItemType(fileName: string): FeedItemType {
  const ext = fileName.substring(fileName.lastIndexOf('.'));
  switch (ext) {
    case '.txt':
      return FeedItemType.Text;
    case '.png':
    case '.jpg':
      return FeedItemType.Image;
    default:
      return FeedItemType.Binary;
  }
}
