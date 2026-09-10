import webPush from 'web-push';
import { PushSubscription, NotificationSettings } from '../models/types.js';

export async function sendPushNotification(
  feedName: string,
  subscriptions: PushSubscription[],
  notificationSettings: NotificationSettings,
): Promise<void> {
  const payload = `New item posted to feed ${feedName}`;

  for (const subscription of subscriptions) {
    try {
      await webPush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            auth: subscription.keys.auth,
            p256dh: subscription.keys.p256dh,
          },
        },
        payload,
        {
          vapidDetails: {
            subject: 'mailto:ybfeed@tynsoe.org',
            publicKey: notificationSettings.VAPIDPublicKey,
            privateKey: notificationSettings.VAPIDPrivateKey,
          },
          TTL: 30,
        },
      );
    } catch (err) {
      console.error('Sending push notification failed:', err);
      continue;
    }
  }
}
