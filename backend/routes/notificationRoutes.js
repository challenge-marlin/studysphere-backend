const express = require('express');
const router = express.Router();

const {
  saveSubscription,
  getPublicVapidKey,
  pushNotificationsConfigured,
} = require('../utils/pushNotifications');
const { authenticateToken } = require('../middleware/auth');

/**
 * 通知機能の設定情報を提供する
 * 認証前に参照される可能性があるため公開エンドポイントにしている
 */
router.get('/config', (req, res) => {
  const enabled = pushNotificationsConfigured();
  res.json({
    success: true,
    enabled,
    publicKey: enabled ? getPublicVapidKey() : null,
  });
});

/**
 * ブラウザから送信されたPush APIのサブスクリプション情報を保存する
 * ログイン済みユーザーのみ許可
 */
router.post('/subscribe', authenticateToken, async (req, res) => {
  if (!pushNotificationsConfigured()) {
    return res.status(503).json({
      success: false,
      message: 'プッシュ通知は現在無効化されています',
    });
  }

  const { subscription, userAgent } = req.body || {};
  if (!subscription) {
    return res.status(400).json({
      success: false,
      message: 'subscription情報が必要です',
    });
  }

  const userId = req.user?.user_id;
  if (!userId) {
    return res.status(400).json({
      success: false,
      message: 'ユーザー情報を取得できませんでした',
    });
  }

  try {
    await saveSubscription(userId, subscription, userAgent || req.headers['user-agent'] || null);
    return res.json({
      success: true,
      message: 'サブスクリプションを保存しました',
    });
  } catch (error) {
    console.error('Failed to save push subscription:', error);
    return res.status(500).json({
      success: false,
      message: 'サブスクリプションの保存に失敗しました',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

module.exports = router;

