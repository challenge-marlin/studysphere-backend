const webPush = require('web-push');
const { pool } = require('./database');

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:no-reply@studysphere.jp';

let isConfigured = false;
let ensureTablePromise = null;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    isConfigured = true;
  } catch (error) {
    console.error('Failed to configure web-push:', error);
    isConfigured = false;
  }
} else {
  console.warn('Push notifications disabled: VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY is not set.');
}

const ensureSubscriptionTable = async () => {
  if (!ensureTablePromise) {
    ensureTablePromise = pool.execute(`
      CREATE TABLE IF NOT EXISTS user_push_subscriptions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        endpoint VARCHAR(512) NOT NULL,
        p256dh VARCHAR(255) NOT NULL,
        auth VARCHAR(255) NOT NULL,
        user_agent VARCHAR(255),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_endpoint (user_id, endpoint),
        CONSTRAINT fk_user_push_subscriptions_user FOREIGN KEY (user_id)
          REFERENCES user_accounts(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `).catch((error) => {
      console.error('Failed to ensure user_push_subscriptions table:', error);
      // 失敗した場合は次回再実行できるようにPromiseをリセット
      ensureTablePromise = null;
      throw error;
    });
  }
  return ensureTablePromise;
};

const truncate = (value, maxLength) => {
  if (!value) return '';
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
};

const saveSubscription = async (userId, subscription, userAgent = null) => {
  if (!isConfigured) {
    throw new Error('Push notifications are not configured.');
  }

  if (!subscription || !subscription.endpoint || !subscription.keys) {
    throw new Error('Invalid subscription payload.');
  }

  const { endpoint, keys } = subscription;
  const { auth, p256dh } = keys;

  if (!auth || !p256dh) {
    throw new Error('Invalid subscription keys.');
  }

  await ensureSubscriptionTable();

  await pool.execute(
    `
      INSERT INTO user_push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        p256dh = VALUES(p256dh),
        auth = VALUES(auth),
        user_agent = VALUES(user_agent),
        updated_at = CURRENT_TIMESTAMP
    `,
    [
      userId,
      truncate(endpoint, 512),
      truncate(p256dh, 255),
      truncate(auth, 255),
      userAgent ? truncate(userAgent, 255) : null,
    ],
  );
};

const getSubscriptionsForUser = async (userId) => {
  if (!isConfigured) {
    return [];
  }
  await ensureSubscriptionTable();
  const [rows] = await pool.execute(
    'SELECT id, endpoint, p256dh, auth FROM user_push_subscriptions WHERE user_id = ?',
    [userId],
  );
  return rows || [];
};

const removeSubscriptionById = async (id) => {
  try {
    await pool.execute('DELETE FROM user_push_subscriptions WHERE id = ?', [id]);
  } catch (error) {
    console.error('Failed to remove push subscription:', error);
  }
};

const sendPushNotificationToUser = async (userId, payload) => {
  if (!isConfigured) {
    return;
  }

  const subscriptions = await getSubscriptionsForUser(userId);
  if (!subscriptions.length) {
    return;
  }

  const notificationPayload = JSON.stringify({
    title: payload.title || 'Study Sphere',
    body: payload.body || '',
    url: payload.url || '/',
  });

  await Promise.all(subscriptions.map(async (subscription) => {
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        auth: subscription.auth,
        p256dh: subscription.p256dh,
      },
    };

    try {
      await webPush.sendNotification(pushSubscription, notificationPayload);
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        await removeSubscriptionById(subscription.id);
      } else {
        console.error('Failed to send push notification:', error);
      }
    }
  }));
};

const getPublicVapidKey = () => (VAPID_PUBLIC_KEY || null);

const pushNotificationsConfigured = () => isConfigured;

module.exports = {
  saveSubscription,
  getPublicVapidKey,
  sendPushNotificationToUser,
  pushNotificationsConfigured,
};

