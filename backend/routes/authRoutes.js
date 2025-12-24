const express = require('express');
const { loginValidation, handleValidationErrors } = require('../middleware/validation');
const { adminLogin, instructorLogin, getUserCompaniesAndSatellites, getUserCompanySatelliteInfo, refreshToken, logout, restoreMasterUser, setSatelliteManager, reauthenticateForSatellite } = require('../scripts/authController');
const { authenticateToken } = require('../middleware/auth');
const { pool } = require('../utils/database');

const router = express.Router();

router.post('/login', async (req, res) => {
  // リクエストボディのデバッグログ
  console.log('=== /api/login リクエスト受信 ===');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  console.log('Content-Type:', req.headers['content-type']);
  console.log('Action:', req.body?.action);
  console.log('Token:', req.body?.token ? 'あり' : 'なし');
  console.log('Request body keys:', Object.keys(req.body || {}));
  
  // findjob用のログインコード検証（action: "validate-token"の場合）
  // このチェックを最初に実行することで、通常のログインバリデーションをスキップ
  // action フィールドが存在し、値が 'validate-token' の場合のみ処理
  if (req.body && typeof req.body === 'object' && req.body.action === 'validate-token') {
    console.log('✅ findjob トークン検証モード - 通常のログインバリデーションをスキップ');
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          valid: false,
          message: 'トークンが未入力です'
        });
      }

      const connection = await pool.getConnection();

      try {
        // ユーザー情報と企業情報、拠点情報を取得
        // token_expiry_atはsatellitesテーブルにあるため、JOINで取得
        // ユーザーが所属する拠点（satellite_ids）の有効期限を確認
        const [rows] = await connection.execute(
          `SELECT 
            u.id,
            u.name, 
            u.role, 
            u.status, 
            u.company_id, 
            u.login_code,
            u.satellite_ids,
            COALESCE(c.name, 'システム管理者') AS company_name,
            MIN(s.token_expiry_at) AS token_expiry_at
           FROM user_accounts u
           LEFT JOIN companies c ON u.company_id = c.id
           LEFT JOIN satellites s ON (
             s.status = 1
             AND (
               -- ユーザーが所属する拠点を確認（satellite_idsがJSON配列の場合）
               (u.satellite_ids IS NOT NULL AND u.satellite_ids != 'null' AND u.satellite_ids != '[]' AND (
                 JSON_CONTAINS(u.satellite_ids, CAST(s.id AS JSON)) OR
                 JSON_SEARCH(u.satellite_ids, 'one', CAST(s.id AS CHAR)) IS NOT NULL
               ))
               OR
               -- ユーザーが企業に所属している場合、企業のすべての拠点を確認（company_idがNULLでない場合のみ）
               ((u.satellite_ids IS NULL OR u.satellite_ids = 'null' OR u.satellite_ids = '[]')
                AND u.company_id IS NOT NULL)
             )
             AND (u.company_id IS NULL OR s.company_id = u.company_id)
             AND (s.token_expiry_at > NOW() OR s.token_expiry_at IS NULL)
           )
           WHERE u.login_code = ?
           GROUP BY u.id, u.name, u.role, u.status, u.company_id, u.login_code, u.satellite_ids, c.name`,
          [token]
        );

        if (rows.length === 0) {
          return res.status(404).json({
            valid: false,
            message: 'このトークンは存在しません'
          });
        }

        const user = rows[0];

        // ユーザーステータスチェック
        if (user.status !== 1) {
          return res.status(403).json({
            valid: false,
            message: 'このトークンは停止中です'
          });
        }

        // 有効期限チェック（satellitesテーブルから取得した有効期限を使用）
        if (user.token_expiry_at) {
          const now = new Date();
          const expiry = new Date(user.token_expiry_at);
          if (now > expiry) {
            return res.status(403).json({
              valid: false,
              message: 'このトークンは有効期限切れです'
            });
          }
        }

        // ユーザーが所属する拠点名を取得
        let locationNames = [];
        if (user.satellite_ids) {
          try {
            const satelliteIds = typeof user.satellite_ids === 'string' 
              ? JSON.parse(user.satellite_ids) 
              : user.satellite_ids;
            
            if (Array.isArray(satelliteIds) && satelliteIds.length > 0) {
              const placeholders = satelliteIds.map(() => '?').join(',');
              const [satelliteRows] = await connection.execute(
                `SELECT name FROM satellites 
                 WHERE id IN (${placeholders}) AND status = 1 
                 ORDER BY name`,
                satelliteIds
              );
              locationNames = satelliteRows.map(row => row.name);
            }
          } catch (error) {
            console.error('拠点名取得エラー:', error);
            // エラーが発生しても処理を続行
          }
        }

        // 拠点名が取得できない場合は、企業のすべての拠点を取得
        // ロール9（システム管理者）の場合はすべての拠点を取得
        if (locationNames.length === 0) {
          try {
            if (user.role >= 9 && !user.company_id) {
              // ロール9以上でcompany_idがNULLの場合はすべての拠点を取得
              const [satelliteRows] = await connection.execute(
                `SELECT name FROM satellites 
                 WHERE status = 1 
                 ORDER BY name`
              );
              locationNames = satelliteRows.map(row => row.name);
            } else if (user.company_id) {
              // 企業に所属している場合は企業のすべての拠点を取得
              const [satelliteRows] = await connection.execute(
                `SELECT name FROM satellites 
                 WHERE company_id = ? AND status = 1 
                 ORDER BY name`,
                [user.company_id]
              );
              locationNames = satelliteRows.map(row => row.name);
            }
          } catch (error) {
            console.error('企業拠点名取得エラー:', error);
          }
        }

        // 企業トークンと拠点トークンを取得
        let companyToken = null;
        let satelliteToken = null;
        
        try {
          const [companyRows] = await connection.execute(
            'SELECT token FROM companies WHERE id = ?',
            [user.company_id]
          );
          if (companyRows.length && companyRows[0].token) {
            companyToken = companyRows[0].token;
          }
        } catch (error) {
          console.error('企業トークン取得エラー:', error);
        }

        // 拠点トークンを取得（satellite_idsから最初の拠点IDを使用）
        if (user.satellite_ids) {
          try {
            let parsedSatelliteIds = [];
            if (typeof user.satellite_ids === 'string') {
              if (user.satellite_ids.includes(',')) {
                parsedSatelliteIds = user.satellite_ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
              } else {
                const parsed = JSON.parse(user.satellite_ids);
                parsedSatelliteIds = Array.isArray(parsed) ? parsed : [parsed];
              }
            } else if (Array.isArray(user.satellite_ids)) {
              parsedSatelliteIds = user.satellite_ids;
            } else if (typeof user.satellite_ids === 'number') {
              parsedSatelliteIds = [user.satellite_ids];
            }

            if (parsedSatelliteIds.length > 0) {
              const firstSatelliteId = parsedSatelliteIds[0];
              const [satelliteRows] = await connection.execute(
                'SELECT token FROM satellites WHERE id = ?',
                [firstSatelliteId]
              );
              if (satelliteRows.length && satelliteRows[0].token) {
                satelliteToken = satelliteRows[0].token;
              }
            }
          } catch (error) {
            console.error('拠点トークン取得エラー:', error);
          }
        }

        // 拠点トークンが取得できない場合は、企業の最初の拠点を取得
        if (!satelliteToken && user.company_id) {
          try {
            const [fallbackSatellites] = await connection.execute(
              'SELECT token FROM satellites WHERE company_id = ? AND status = 1 ORDER BY id LIMIT 1',
              [user.company_id]
            );
            if (fallbackSatellites.length && fallbackSatellites[0].token) {
              satelliteToken = fallbackSatellites[0].token;
            }
          } catch (error) {
            console.error('フォールバック拠点トークン取得エラー:', error);
          }
        }

        return res.status(200).json({
          valid: true,
          recipient: user.company_id,
          name: user.name,
          role: user.role,
          companyName: user.company_name,
          locationNames: locationNames, // 拠点名の配列
          expiresAt: user.token_expiry_at || null,
          userId: user.id,
          companyId: user.company_id,
          companyToken: companyToken,
          satelliteToken: satelliteToken
        });

      } finally {
        connection.release();
      }

    } catch (error) {
      console.error('❌ findjob ログインコード検証エラー:', error);
      return res.status(500).json({
        valid: false,
        message: 'サーバー内部エラーが発生しました'
      });
    }
  }

  // 通常の管理者ログイン処理
  console.log('=== Login Route Debug ===');
  console.log('Request body:', req.body);
  console.log('Username:', req.body.username);
  console.log('Password provided:', req.body.password ? 'Yes' : 'No');
  
  const { username, password } = req.body;
  
  // バリデーション
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'ユーザー名とパスワードを入力してください'
    });
  }
  
  try {
    const result = await adminLogin(username, password);
    console.log('Login result:', result);
    
    res.status(result.statusCode || 200).json({
      success: result.success,
      message: result.message,
      ...(result.data && { data: result.data }),
      ...(result.error && { error: result.error }),
    });
  } catch (error) {
    console.error('Login route error:', error);
    res.status(500).json({
      success: false,
      message: 'ログイン処理中にエラーが発生しました',
      error: error.message
    });
  }
});

// 指導員ログイン（企業・拠点選択）
router.post('/instructor-login', loginValidation, handleValidationErrors, async (req, res) => {
  const { username, password, companyId, satelliteId } = req.body;
  const result = await instructorLogin(username, password, companyId, satelliteId);
  res.status(result.statusCode || 200).json({
    success: result.success,
    message: result.message,
    ...(result.data && { data: result.data }),
    ...(result.error && { error: result.error }),
  });
});

// ユーザーの企業・拠点情報取得
router.get('/user-companies/:username', async (req, res) => {
  const { username } = req.params;
  const result = await getUserCompaniesAndSatellites(username);
  res.status(result.statusCode || 200).json({
    success: result.success,
    message: result.message,
    ...(result.data && { data: result.data }),
    ...(result.error && { error: result.error }),
  });
});

// 現在のユーザーの企業・拠点情報取得
router.get('/user-info', authenticateToken, async (req, res) => {
  const userId = req.user.user_id;
  const result = await getUserCompanySatelliteInfo(userId);
  res.status(result.success ? 200 : 400).json({
    success: result.success,
    message: result.message,
    ...(result.data && { data: result.data }),
    ...(result.error && { error: result.error }),
  });
});

router.post('/refresh', async (req, res) => {
  const { refresh_token } = req.body;
  const result = await refreshToken(refresh_token);
  res.status(result.statusCode || 200).json({
    success: result.success,
    message: result.message,
    ...(result.data && { data: result.data }),
    ...(result.error && { error: result.error }),
  });
});

router.post('/logout', async (req, res) => {
  const { refresh_token } = req.body;
  const result = await logout(refresh_token);
  res.status(result.statusCode || 200).json({
    success: result.success,
    message: result.message,
    ...(result.error && { error: result.error }),
  });
});

// マスターユーザー復旧エンドポイント
router.post('/restore-master-user', async (req, res) => {
  try {
    const result = await restoreMasterUser();
    res.status(result.success ? 200 : 500).json({
      success: result.success,
      message: result.message,
      ...(result.data && { data: result.data }),
      ...(result.error && { error: result.error }),
    });
  } catch (error) {
    console.error('Restore master user route error:', error);
    res.status(500).json({
      success: false,
      message: 'マスターユーザー復旧処理中にエラーが発生しました',
      error: error.message
    });
  }
});

// 拠点管理者設定エンドポイント
router.post('/set-satellite-manager', async (req, res) => {
  try {
    const { satelliteId, userId } = req.body;
    
    if (!satelliteId || !userId) {
      return res.status(400).json({
        success: false,
        message: '拠点IDとユーザーIDは必須です'
      });
    }
    
    const result = await setSatelliteManager(satelliteId, userId);
    res.status(result.success ? 200 : 400).json({
      success: result.success,
      message: result.message,
      ...(result.data && { data: result.data }),
      ...(result.error && { error: result.error }),
    });
  } catch (error) {
    console.error('Set satellite manager route error:', error);
    res.status(500).json({
      success: false,
      message: '拠点管理者設定処理中にエラーが発生しました',
      error: error.message
    });
  }
});

// 拠点変更時の再認証
router.post('/reauthenticate-satellite', authenticateToken, async (req, res) => {
  const { satelliteId, userId } = req.body;
  const tokenUserId = req.user.user_id;
  
  if (!satelliteId) {
    return res.status(400).json({
      success: false,
      message: '拠点IDは必須です'
    });
  }
  
  // userIdが提供されている場合はそれを使用、そうでなければトークンから取得
  const targetUserId = userId || tokenUserId;
  
  const result = await reauthenticateForSatellite(targetUserId, satelliteId);
  res.status(result.success ? 200 : 400).json({
    success: result.success,
    message: result.message,
    ...(result.data && { data: result.data }),
    ...(result.error && { error: result.error }),
  });
});

// 設定用認証エンドポイント（ロール4以上）
router.post('/config', loginValidation, handleValidationErrors, async (req, res) => {
  console.log('=== Config Auth Route Debug ===');
  console.log('Request received at:', new Date().toISOString());
  console.log('Request body:', req.body);
  console.log('Request headers:', req.headers);
  
  const { username, password } = req.body;
  
  if (!username || !password) {
    console.log('Config auth: ユーザー名またはパスワードが未入力');
    return res.status(400).json({
      success: false,
      message: 'ユーザー名とパスワードを入力してください'
    });
  }
  
  console.log('Config auth: 認証開始 - username:', username);
  
  try {
    const result = await adminLogin(username, password);
    console.log('Config auth result:', result);
    
    console.log('Config auth result details:', {
      success: result.success,
      hasData: !!result.data,
      role: result.data?.role,
      roleType: typeof result.data?.role,
      user_id: result.data?.user_id,
      user_name: result.data?.user_name
    });
    
    // ロールを数値型に変換して比較（データベースから文字列型で取得される可能性があるため）
    const userRole = result.data?.role ? parseInt(result.data.role, 10) : 0;
    console.log('Config auth: 変換後のロール:', userRole, 'type:', typeof userRole);
    
    if (result.success && result.data && userRole >= 4) {
      console.log('Config auth: 認証成功、ロール:', userRole);
      res.status(200).json({
        success: true,
        message: '認証に成功しました',
        role: userRole,
        data: {
          userId: result.data.user_id,
          userName: result.data.user_name,
          role: userRole
        }
      });
    } else {
      console.log('Config auth: 認証失敗', {
        success: result.success,
        hasData: !!result.data,
        role: result.data?.role,
        roleType: typeof result.data?.role,
        parsedRole: userRole
      });
      res.status(403).json({
        success: false,
        message: 'ロール4以上の権限が必要です',
        role: result.data ? userRole : null
      });
    }
  } catch (error) {
    console.error('Config auth route error:', error);
    console.error('Config auth route error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: '認証処理中にエラーが発生しました',
      error: process.env.NODE_ENV === 'development' ? error.message : '内部サーバーエラー'
    });
  }
});

module.exports = router;


