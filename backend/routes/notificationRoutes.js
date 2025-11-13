const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
  saveSubscription,
  getPublicVapidKey,
  pushNotificationsConfigured,
} = require('../utils/pushNotifications');

router.get('/public-key', (req, res) => {
  const publicKey = getPublicVapidKey();
  if (!publicKey || !pushNotificationsConfigured()) {
    return res.status(503).json({
      success: false,
      message: 'プッシュ通知は現在利用できません（システム未設定）。',
    });
  }
  return res.json({
    success: true,
    data: {
      publicKey,
    },
  });
});

router.post('/subscribe', authenticateToken, async (req, res) => {
  if (!pushNotificationsConfigured()) {
    return res.status(503).json({
      success: false,
      message: 'プッシュ通知は現在利用できません（システム未設定）。',
    });
  }

  const { subscription } = req.body;
  if (!subscription || !subscription.endpoint || !subscription.keys) {
    return res.status(400).json({
      success: false,
      message: '無効な購読情報です。',
    });
  }

  try {
    await saveSubscription(req.user.user_id, subscription, req.headers['user-agent'] || null);
    return res.json({
      success: true,
      message: 'プッシュ通知を登録しました。',
    });
  } catch (error) {
    console.error('Failed to save push subscription:', error);
    return res.status(500).json({
      success: false,
      message: 'プッシュ通知の登録に失敗しました。',
    });
  }
});

module.exports = router;

