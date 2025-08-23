const { pool } = require('../utils/database');
const { customLogger } = require('../utils/logger');
const AWS = require('aws-sdk');
const path = require('path');

// S3設定
const s3 = new AWS.S3({
  region: 'ap-northeast-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

class RemoteSupportController {
  /**
   * 画像アップロード（カメラ・スクリーンショット）
   */
  static async uploadCapture(req, res) {
    try {
      const { userToken } = req.body;
      const files = req.files;

      if (!userToken) {
        return res.status(400).json({
          success: false,
          message: 'ユーザートークンが必須です'
        });
      }

      // ログインコードからユーザー情報を取得
      const [users] = await pool.execute(
        'SELECT id, login_code, company_id, satellite_ids FROM user_accounts WHERE login_code = ?',
        [userToken]
      );

      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ユーザーが見つかりません'
        });
      }

      const user = users[0];
      
      // 企業・拠点情報を取得
      const [companies] = await pool.execute(
        'SELECT token FROM companies WHERE id = ?',
        [user.company_id]
      );

      const [satellites] = await pool.execute(
        'SELECT token FROM satellites WHERE id = ?',
        [JSON.parse(user.satellite_ids)[0]] // 最初の拠点を使用
      );

      if (companies.length === 0 || satellites.length === 0) {
        return res.status(404).json({
          success: false,
          message: '企業または拠点情報が見つかりません'
        });
      }

      const companyToken = companies[0].token;
      const satelliteToken = satellites[0].token;
      const userLoginCode = user.login_code;

      // 現在の日時
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const timestamp = `${year}${month}${day}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

      // S3パス構造: capture/{企業トークン}/{拠点トークン}/{利用者トークン}/YYYY/MM/DD/
      const basePath = `capture/${companyToken}/${satelliteToken}/${userLoginCode}/${year}/${month}/${day}`;

      const uploadPromises = [];

      // カメラ画像のアップロード
      if (files.photo && files.photo[0]) {
        const photoKey = `${basePath}/camera/${timestamp}.png`;
        uploadPromises.push(
          s3.upload({
            Bucket: 'studysphere',
            Key: photoKey,
            Body: files.photo[0].buffer,
            ContentType: 'image/png'
          }).promise()
        );
      }

      // スクリーンショットのアップロード
      if (files.screenshot && files.screenshot[0]) {
        const screenshotKey = `${basePath}/screenshot/${timestamp}.png`;
        uploadPromises.push(
          s3.upload({
            Bucket: 'studysphere',
            Key: screenshotKey,
            Body: files.screenshot[0].buffer,
            ContentType: 'image/png'
          }).promise()
        );
      }

      // アップロード実行
      await Promise.all(uploadPromises);

      // 画像URLを準備
      const photoUrl = files.photo ? `${basePath}/camera/${timestamp}.png` : null;
      const screenshotUrl = files.screenshot ? `${basePath}/screenshot/${timestamp}.png` : null;

      customLogger.info(`Remote support capture uploaded for user ${userLoginCode}`);

             res.json({
         success: true,
         message: '画像のアップロードが完了しました',
         data: {
           photoPath: photoUrl,
           screenshotPath: screenshotUrl
         }
       });

    } catch (error) {
      customLogger.error('Remote support capture upload error:', error);
      res.status(500).json({
        success: false,
        message: '画像のアップロードに失敗しました',
        error: error.message
      });
    }
  }

  /**
   * 勤怠打刻
   */
  static async markAttendance(req, res) {
    try {
      const {
        login_code,
        mark_type,
        timestamp,
        temperature,
        condition,
        condition_note,
        work_note,
        work_result,
        daily_report
      } = req.body;

      if (!login_code || !mark_type) {
        return res.status(400).json({
          success: false,
          message: 'ログインコードと打刻タイプが必須です'
        });
      }

      // ユーザー情報を取得
      const [users] = await pool.execute(
        'SELECT id, company_id, satellite_ids FROM user_accounts WHERE login_code = ?',
        [login_code]
      );

      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ユーザーが見つかりません'
        });
      }

      const user = users[0];
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD形式

      // 勤怠打刻のログを記録
      customLogger.info(`Remote support attendance marked: ${mark_type} for user ${login_code} at ${timestamp || new Date().toISOString()}`);

      customLogger.info(`Remote support attendance marked: ${mark_type} for user ${login_code}`);

      res.json({
        success: true,
        message: '勤怠打刻が完了しました'
      });

    } catch (error) {
      customLogger.error('Remote support attendance error:', error);
      res.status(500).json({
        success: false,
        message: '勤怠打刻に失敗しました',
        error: error.message
      });
    }
  }

  /**
   * 一時パスワード監視
   */
  static async checkTempPassword(req, res) {
    try {
      const { loginCode } = req.params;

      if (!loginCode) {
        return res.status(400).json({
          success: false,
          message: 'ログインコードが必須です'
        });
      }

      customLogger.info(`Temp password check requested for login code: ${loginCode}`);

      // ユーザーIDを取得
      const [users] = await pool.execute(
        'SELECT id FROM user_accounts WHERE login_code = ?',
        [loginCode]
      );

      if (users.length === 0) {
        customLogger.warn(`User not found for login code: ${loginCode}`);
        return res.status(404).json({
          success: false,
          message: 'ユーザーが見つかりません'
        });
      }

      // デバッグ用：ユーザー情報をログ出力
      customLogger.info(`User found for login code ${loginCode}: ID ${users[0].id}`);

      const userId = users[0].id;
      customLogger.info(`User found: ID ${userId} for login code: ${loginCode}`);

             // 有効な一時パスワードをチェック
       const [tempPasswords] = await pool.execute(
         `SELECT temp_password, expires_at 
          FROM user_temp_passwords 
          WHERE user_id = ? 
          AND expires_at > NOW() 
          AND is_used = 0 
          ORDER BY issued_at DESC 
          LIMIT 1`,
         [userId]
       );

      customLogger.info(`Found ${tempPasswords.length} valid temp passwords for user ${userId}`);

      if (tempPasswords.length > 0) {
        const tempPassword = tempPasswords[0];
        
        // 一時パスワードを使用済みにマーク
        await pool.execute(
          'UPDATE user_temp_passwords SET is_used = 1 WHERE user_id = ? AND temp_password = ?',
          [userId, tempPassword.temp_password]
        );

        customLogger.info(`Temp password found and marked as used for user ${userId}`);

        res.json({
          success: true,
          hasTempPassword: true,
          tempPassword: tempPassword.temp_password,
          expiresAt: tempPassword.expires_at
        });
      } else {
        customLogger.info(`No valid temp password found for user ${userId}`);
        res.json({
          success: true,
          hasTempPassword: false
        });
      }

    } catch (error) {
      customLogger.error('Temp password check error:', error);
      res.status(500).json({
        success: false,
        message: '一時パスワードの確認に失敗しました',
        error: error.message
      });
    }
  }

  /**
   * 支援アプリログイン
   */
  static async login(req, res) {
    try {
      const { login_code, temperature, condition, condition_note, work_note } = req.body;

      if (!login_code) {
        return res.status(400).json({
          success: false,
          message: 'ログインコードが必須です'
        });
      }

      // ユーザー情報を取得
      const [users] = await pool.execute(
        'SELECT id, name, login_code, company_id, satellite_ids FROM user_accounts WHERE login_code = ?',
        [login_code]
      );

      if (users.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'ログインコードが無効です'
        });
      }

      const user = users[0];

      customLogger.info(`Remote support login: ${login_code} logged in successfully`);

      res.json({
        success: true,
        message: 'ログインに成功しました',
        data: {
          user_id: user.id,
          name: user.name,
          login_code: user.login_code
        }
      });

    } catch (error) {
      customLogger.error('Remote support login error:', error);
      res.status(500).json({
        success: false,
        message: 'ログイン処理に失敗しました',
        error: error.message
      });
    }
  }

  /**
   * 学習ページ自動ログイン
   */
  static async autoLogin(req, res) {
    try {
      const { login_code, target } = req.body;

      if (!login_code) {
        return res.status(400).json({
          success: false,
          message: 'ログインコードが必須です'
        });
      }

      // ユーザー情報を取得
      const [users] = await pool.execute(
        'SELECT id, name, login_code FROM user_accounts WHERE login_code = ?',
        [login_code]
      );

      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ユーザーが見つかりません'
        });
      }

      const user = users[0];

      // 環境に応じたURLを設定
      const baseUrl = target === 'prod' 
        ? 'https://studysphere-frontend.vercel.app'
        : 'http://localhost:3000';

      // 自動ログイン用のHTMLを生成
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>自動ログイン中...</title>
          <meta charset="UTF-8">
        </head>
        <body>
          <script>
            // ローカルストレージにログイン情報を保存
            localStorage.setItem('autoLoginCode', '${user.login_code}');
            localStorage.setItem('autoLoginUser', '${user.name}');
            localStorage.setItem('autoLoginTarget', '${target}');
            
            // 利用者ダッシュボードにリダイレクト
            window.location.href = '${baseUrl}/student-dashboard';
          </script>
          <p>自動ログイン中...</p>
        </body>
        </html>
      `;

      res.setHeader('Content-Type', 'text/html');
      res.send(html);

    } catch (error) {
      customLogger.error('Auto login error:', error);
      res.status(500).json({
        success: false,
        message: '自動ログインに失敗しました',
        error: error.message
      });
    }
  }

  /**
   * デバッグ用：一時パスワード一覧取得
   */
  static async debugTempPasswords(req, res) {
    try {
      const { loginCode } = req.params;

      if (!loginCode) {
        return res.status(400).json({
          success: false,
          message: 'ログインコードが必須です'
        });
      }

      // ユーザーIDを取得
      const [users] = await pool.execute(
        'SELECT id, name, login_code FROM user_accounts WHERE login_code = ?',
        [loginCode]
      );

      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ユーザーが見つかりません'
        });
      }

      const userId = users[0].id;

             // 一時パスワード一覧を取得
       const [tempPasswords] = await pool.execute(
         `SELECT temp_password, expires_at, is_used, issued_at
          FROM user_temp_passwords 
          WHERE user_id = ? 
          ORDER BY issued_at DESC`,
         [userId]
       );

      res.json({
        success: true,
        user: {
          id: users[0].id,
          name: users[0].name,
          login_code: users[0].login_code
        },
        temp_passwords: tempPasswords
      });

    } catch (error) {
      customLogger.error('Debug temp passwords error:', error);
      res.status(500).json({
        success: false,
        message: '一時パスワード一覧の取得に失敗しました',
        error: error.message
      });
    }
  }

  /**
   * 一時パスワード通知受信
   */
  static async notifyTempPassword(req, res) {
    try {
      const { loginCode, tempPassword, userName, timestamp } = req.body;

      if (!loginCode || !tempPassword || !userName) {
        return res.status(400).json({
          success: false,
          message: 'ログインコード、一時パスワード、ユーザー名は必須です'
        });
      }

      customLogger.info(`一時パスワード通知を受信: ${userName} (${loginCode})`);

      // 通知データを保存（後で支援アプリが取得できるように）
      const notificationData = {
        loginCode,
        tempPassword,
        userName,
        timestamp,
        receivedAt: new Date().toISOString()
      };

      // メモリまたはデータベースに保存（簡易実装）
      // 実際の実装では、Redisやデータベースを使用することを推奨
      global.tempPasswordNotifications = global.tempPasswordNotifications || {};
      global.tempPasswordNotifications[loginCode] = notificationData;

      customLogger.info(`一時パスワード通知を保存: ${loginCode}`);

      res.json({
        success: true,
        message: '一時パスワード通知を受信しました',
        data: {
          loginCode,
          userName,
          timestamp
        }
      });

    } catch (error) {
      customLogger.error('一時パスワード通知受信エラー:', error);
      res.status(500).json({
        success: false,
        message: '一時パスワード通知の受信に失敗しました',
        error: error.message
      });
    }
  }

  /**
   * 一時パスワード通知取得
   */
  static async getTempPasswordNotification(req, res) {
    try {
      const { loginCode } = req.params;

      if (!loginCode) {
        return res.status(400).json({
          success: false,
          message: 'ログインコードが必須です'
        });
      }

      // 保存された通知データを取得
      const notificationData = global.tempPasswordNotifications?.[loginCode];

      if (!notificationData) {
        return res.status(404).json({
          success: false,
          message: '通知データが見つかりません'
        });
      }

      customLogger.info(`一時パスワード通知を取得: ${loginCode}`);

      res.json({
        success: true,
        message: '一時パスワード通知を取得しました',
        data: notificationData
      });

    } catch (error) {
      customLogger.error('一時パスワード通知取得エラー:', error);
      res.status(500).json({
        success: false,
        message: '一時パスワード通知の取得に失敗しました',
        error: error.message
      });
    }
  }
}

module.exports = RemoteSupportController;
