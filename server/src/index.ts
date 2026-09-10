import fs from 'node:fs';
import { FeedManager } from './models/feedManager.js';
import { WebSocketManager } from './services/websocketManager.js';
import { initConfig } from './config.js';
import { createServer } from './server.js';

const port = parseInt(process.env.FEED_HTTP_PORT || '8080', 10);
const listenAddr = process.env.FEED_LISTEN_ADDR || '0.0.0.0';
const dataDir = process.env.FEED_DATA_DIR || './data';
const maxUploadMB = parseInt(process.env.FEED_MAX_UPLOAD_SIZE || '5', 10);
const masterPin = process.env.MASTER_PIN || null;
const debug = process.env.DEBUG === 'true' || process.env.DEBUG === '1';

if (debug) {
  console.log('Running in DEBUG mode');
}

// Ensure data directory exists
fs.mkdirSync(dataDir, { recursive: true });

// Initialize config (generates VAPID keys if needed)
const notificationSettings = initConfig(dataDir);

// Create managers
const wsManager = new WebSocketManager();
const feedManager = new FeedManager(dataDir, wsManager);
feedManager.notificationSettings = notificationSettings;
feedManager.masterPin = masterPin;
wsManager.setFeedManager(feedManager);

// Create and start server
const { server, shutdown } = createServer({
  feedManager,
  wsManager,
  version: process.env.npm_package_version || '0.0.0',
  vapidPublicKey: notificationSettings.VAPIDPublicKey,
  maxBodySize: maxUploadMB * 1024 * 1024,
  uiDistPath: 'web/ui/dist',
});

server.listen(port, listenAddr, () => {
  console.log(`paste-feed starting`);
  console.log(`  version: ${process.env.npm_package_version || '0.0.0'}`);
  console.log(`  data_dir: ${dataDir}`);
  console.log(`  port: ${port}`);
  console.log(`  address: ${listenAddr}`);
  console.log(`  max-upload-size: ${maxUploadMB}MB`);
});

function stop() {
  const deadline = setTimeout(() => process.exit(1), 10000);
  deadline.unref();
  shutdown().then(() => {
    clearTimeout(deadline);
    process.exit(0);
  }).catch(err => {
    console.error('Shutdown failed:', err);
    process.exit(1);
  });
}
process.once('SIGTERM', stop);
process.once('SIGINT', stop);
