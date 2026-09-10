import fs from 'node:fs';
import path from 'node:path';
import type { FeedConfigData, PIN, PushSubscription } from './types.js';
import { PinExpiredError, PinIncorrectError, PinIncorrectLengthError } from '../utils/errors.js';

export class FeedConfig {
  secret: string = '';
  pin: PIN | null = null;
  Subscriptions: PushSubscription[] = [];
  itemNameOverrides: Record<string, string> = {};

  private feedPath: string;

  constructor(feedPath: string) {
    this.feedPath = feedPath;
  }

  private migratev1v2(): void {
    if (!this.secret) {
      const secretPath = path.join(this.feedPath, 'secret');
      this.secret = fs.readFileSync(secretPath, 'utf-8');
    }

    const pinPath = path.join(this.feedPath, 'pin');
    try {
      const stat = fs.statSync(pinPath);
      const pincode = fs.readFileSync(pinPath, 'utf-8');
      const expiration = new Date(stat.mtimeMs + 2 * 60 * 1000);
      this.pin = {
        pin: pincode,
        expiration: expiration.toISOString(),
      };
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }

    this.write();

    try { fs.unlinkSync(path.join(this.feedPath, 'secret')); } catch {}
    try { fs.unlinkSync(path.join(this.feedPath, 'pin')); } catch {}
  }

  static load(feedPath: string): FeedConfig {
    const config = new FeedConfig(feedPath);
    const configPath = path.join(feedPath, 'config.json');

    if (!fs.existsSync(configPath)) {
      config.migratev1v2();
    }

    const data: FeedConfigData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    config.secret = data.secret;
    config.pin = data.pin ?? null;
    config.Subscriptions = data.Subscriptions ?? [];
    config.itemNameOverrides = data.itemNameOverrides ?? {};

    return config;
  }

  write(): void {
    const configPath = path.join(this.feedPath, 'config.json');
    const data: FeedConfigData = {
      secret: this.secret,
      pin: this.pin,
      Subscriptions: this.Subscriptions,
      itemNameOverrides: this.itemNameOverrides,
    };
    fs.writeFileSync(configPath, JSON.stringify(data, null, 2) + '\n');
  }

  setPIN(s: string): void {
    if (typeof s !== 'string' || !/^\d{4}$/.test(s)) {
      throw new PinIncorrectLengthError();
    }
    this.pin = {
      pin: s,
      expiration: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
    };
    this.write();
  }

  validatePIN(s: string): void {
    if (!this.pin) {
      throw new PinIncorrectError();
    }
    if (new Date(this.pin.expiration) < new Date()) {
      throw new PinExpiredError();
    }
    if (s !== this.pin.pin) {
      throw new PinIncorrectError();
    }
  }

  addSubscription(sub: PushSubscription): void {
    const exists = this.Subscriptions.some(
      (t) => t.endpoint === sub.endpoint && t.keys.auth === sub.keys.auth && t.keys.p256dh === sub.keys.p256dh,
    );
    if (exists) return;
    this.Subscriptions.push(sub);
    this.write();
  }

  deleteSubscription(sub: PushSubscription): void {
    this.Subscriptions = this.Subscriptions.filter(
      (t) => !(t.endpoint === sub.endpoint && t.keys.auth === sub.keys.auth && t.keys.p256dh === sub.keys.p256dh),
    );
    this.write();
  }
}
