import fs from 'fs';
import path from 'path';
import webpush from 'web-push';
import { NotificationSettings } from './models/types.js';

interface AppConfig {
  notification?: NotificationSettings;
}

let config: AppConfig = {};

export function initConfig(dataDir: string): NotificationSettings {
  const configPath = path.join(dataDir, 'config.json');

  try {
    const data = fs.readFileSync(configPath, 'utf-8');
    config = JSON.parse(data);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    config = {};
  }

  if (!config.notification) {
    const vapidKeys = webpush.generateVAPIDKeys();
    config.notification = {
      VAPIDPublicKey: vapidKeys.publicKey,
      VAPIDPrivateKey: vapidKeys.privateKey,
    };
    fs.writeFileSync(configPath, JSON.stringify(config), { mode: 0o600 });
  }

  return config.notification;
}

export function getConfig(): AppConfig {
  return config;
}
