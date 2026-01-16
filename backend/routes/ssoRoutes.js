const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const {
  generateTicketRecord,
  verifyTicket,
  getTrustedSystem
} = require('../scripts/ssoController');
const { pool } = require('../utils/database');
const { customLogger } = require('../utils/logger');
const { getCurrentJapanTime, formatMySQLDateTime, convertDateTimeLocalToMySQL } = require('../utils/dateUtils');
const {
  generateAccessToken,
  generateRefreshToken,
  saveRefreshToken,
  deleteAllUserRefreshTokens
} = require('../utils/tokenManager');

/**
 * リクエストからIPアドレスとUser-Agentを取得
 */
function getRequestInfo(req) {
  const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || null;
  const userAgent = req.headers['user-agent'] || null;
  return { ipAddress, userAgent };
}

/**
 * POST /api/sso/ticket/generate
 * チケット生成API（認証必須）
 */
router.post('/ticket/generate', authenticateToken, async (req, res) => {
  try {
    const { target_system, source_system, context } = req.body;
    const userId = req.user.user_id;
    const isServiceToken = req.user.is_service_token || false;

    customLogger.info('SSOチケット生成リクエスト', {
      userId,
      target_system,
      source_system,
      context,
      isServiceToken,
      ipAddress: req.ip || req.connection.remoteAddress
    });

    if (!target_system) {
      return res.status(400).json({
        success: false,
        message: 'target_systemは必須です'
      });
    }

    const { ipAddress, userAgent } = getRequestInfo(req);

    // 信頼システム情報を取得（リダイレクト先URL構築用）
    const trustedSystem = await getTrustedSystem(target_system);
    if (!trustedSystem) {
      return res.status(404).json({
        success: false,
        message: `信頼システムが見つかりません: ${target_system}`
      });
    }

    const result = await generateTicketRecord(
      userId,
      target_system,
      source_system || 'studysphere',
      context || 'menu_click',
      ipAddress,
      userAgent
    );

    res.json({
      success: true,
      data: {
        ticket: result.ticket,
        expires_in: result.expiresIn,
        expires_at: result.expiresAt,
        target_system: {
          system_key: trustedSystem.system_key,
          system_name: trustedSystem.system_name,
          base_url: trustedSystem.base_url,
          landing_path: trustedSystem.landing_path || '/landing'
        }
      }
    });
  } catch (error) {
    customLogger.error('チケット生成APIエラー:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'チケット生成に失敗しました'
    });
  }
});

/**
 * POST /api/sso/ticket/generate-by-logincode
 * loginCodeベースのチケット生成API（パブリック）
 * 外部システム（findjob等）からloginCodeを使ってSSOチケットを生成する際に使用
 */
router.post('/ticket/generate-by-logincode', async (req, res) => {
  let connection;
  try {
    const { login_code, target_system, source_system, context } = req.body;

    if (!login_code) {
      return res.status(400).json({
        success: false,
        message: 'login_codeは必須です'
      });
    }

    if (!target_system) {
      return res.status(400).json({
        success: false,
        message: 'target_systemは必須です'
      });
    }

    const { ipAddress, userAgent } = getRequestInfo(req);

    customLogger.info('loginCodeベースのSSOチケット生成リクエスト', {
      login_code: login_code.substring(0, 10) + '...',
      target_system,
      source_system,
      context,
      ipAddress
    });

    // loginCodeからユーザー情報を取得
    connection = await pool.getConnection();
    const [userRows] = await connection.execute(
      `SELECT 
        u.id, 
        u.name, 
        u.login_code, 
        u.role, 
        u.status,
        u.company_id,
        c.name as company_name
      FROM user_accounts u
      LEFT JOIN companies c ON u.company_id = c.id
      WHERE u.login_code = ? AND u.status = 1`,
      [login_code]
    );

    if (userRows.length === 0) {
      customLogger.warn('loginCodeベースのチケット生成: ユーザーが見つかりません', {
        login_code: login_code.substring(0, 10) + '...'
      });
      return res.status(404).json({
        success: false,
        message: 'ユーザーが見つかりません'
      });
    }

    const user = userRows[0];
    const userId = user.id;

    // インバウンドの場合（target_system === 'studysphere'）、信頼システムチェックをスキップ
    // 自分自身へのリダイレクトなので、信頼システムとして登録する必要はない
    let trustedSystem = null;
    if (target_system !== 'studysphere') {
      // 外部システムへのアウトバウンド/トランスミットの場合のみ信頼システムチェック
      trustedSystem = await getTrustedSystem(target_system);
      if (!trustedSystem) {
        return res.status(404).json({
          success: false,
          message: `信頼システムが見つかりません: ${target_system}`
        });
      }
    }

    // チケット生成
    const result = await generateTicketRecord(
      userId,
      target_system,
      source_system || 'findjob',
      context || 'portal_click',
      ipAddress,
      userAgent
    );

    customLogger.info('loginCodeベースのSSOチケット生成成功', {
      userId,
      ticket: result.ticket.substring(0, 10) + '...',
      target_system,
      source_system: source_system || 'findjob'
    });

    // レスポンスデータの構築
    const responseData = {
      ticket: result.ticket,
      expires_in: result.expiresIn,
      expires_at: result.expiresAt
    };

    // 信頼システム情報がある場合のみレスポンスに含める（インバウンドの場合はnull）
    if (trustedSystem) {
      responseData.target_system = {
        system_key: trustedSystem.system_key,
        system_name: trustedSystem.system_name,
        base_url: trustedSystem.base_url,
        landing_path: trustedSystem.landing_path || '/landing'
      };
    }

    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    customLogger.error('loginCodeベースのチケット生成APIエラー:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'チケット生成に失敗しました'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

/**
 * POST /api/sso/ticket/verify
 * チケット検証API（パブリック）
 */
router.post('/ticket/verify', async (req, res) => {
  try {
    const { ticket } = req.body;

    if (!ticket) {
      return res.status(400).json({
        valid: false,
        error: 'INVALID_TICKET',
        message: 'チケットが提供されていません'
      });
    }

    const { ipAddress, userAgent } = getRequestInfo(req);

    const result = await verifyTicket(ticket, ipAddress, userAgent);

    if (!result.valid) {
      const response = {
        valid: false,
        error: result.error
      };
      // NO_LOGIN_CODEエラーの場合、元システムの情報も返す
      if (result.error === 'NO_LOGIN_CODE' && result.source_system) {
        response.source_system = result.source_system;
      }
      // NO_TEMP_PASSWORDエラーの場合、元システムの情報とメッセージも返す
      if (result.error === 'NO_TEMP_PASSWORD') {
        if (result.source_system) {
          response.source_system = result.source_system;
        }
        if (result.message) {
          response.message = result.message;
        }
      }
      return res.status(200).json(response);
    }

    res.json({
      valid: true,
      data: result.data
    });
  } catch (error) {
    customLogger.error('チケット検証APIエラー:', error);
    res.status(500).json({
      valid: false,
      error: 'VERIFICATION_ERROR',
      message: error.message || 'チケット検証に失敗しました'
    });
  }
});

/**
 * POST /api/sso/login
 * SSOログインAPI（チケット検証 + JWTトークン生成）
 * 他のサイトからStudySphereへの自動ログイン用
 */
router.post('/login', async (req, res) => {
  try {
    const { ticket } = req.body;

    if (!ticket) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_TICKET',
        message: 'チケットが提供されていません'
      });
    }

    const { ipAddress, userAgent } = getRequestInfo(req);

    // チケット検証
    const verifyResult = await verifyTicket(ticket, ipAddress, userAgent);

    if (!verifyResult.valid) {
      const response = {
        success: false,
        error: verifyResult.error
      };
      // NO_LOGIN_CODEエラーの場合、元システムの情報も返す
      if (verifyResult.error === 'NO_LOGIN_CODE' && verifyResult.source_system) {
        response.source_system = verifyResult.source_system;
      }
      // NO_TEMP_PASSWORDエラーの場合、元システムの情報とメッセージも返す
      if (verifyResult.error === 'NO_TEMP_PASSWORD') {
        if (verifyResult.source_system) {
          response.source_system = verifyResult.source_system;
        }
        if (verifyResult.message) {
          response.message = verifyResult.message;
        }
      }
      return res.status(200).json(response);
    }

    const userData = verifyResult.data;

    // 既存のリフレッシュトークンを削除
    await deleteAllUserRefreshTokens(userData.user_id);

    // JWTトークンを生成
    const tokenData = {
      user_id: userData.user_id,
      user_name: userData.username, // verifyTicketはusernameとしてlogin_codeを返す
      role: userData.role,
      company_id: userData.company_id
    };

    const accessToken = generateAccessToken(tokenData);
    const refreshToken = generateRefreshToken(tokenData);

    // リフレッシュトークンをデータベースに保存
    await saveRefreshToken(userData.user_id, refreshToken);

    customLogger.info('SSOログイン成功', {
      userId: userData.user_id,
      username: userData.username,
      sourceSystem: userData.source_system
    });

    res.json({
      success: true,
      data: {
        user_id: userData.user_id,
        username: userData.username,
        name: userData.name,
        role: userData.role,
        company_id: userData.company_id,
        company_name: userData.company_name,
        locationNames: userData.locationNames,
        expiresAt: userData.expiresAt,
        access_token: accessToken,
        refresh_token: refreshToken
      }
    });
  } catch (error) {
    customLogger.error('SSOログインAPIエラー:', error);
    res.status(500).json({
      success: false,
      error: 'LOGIN_ERROR',
      message: error.message || 'SSOログインに失敗しました'
    });
  }
});

/**
 * GET /api/sso/systems
 * 信頼システム一覧取得（管理者のみ）
 */
router.get('/systems', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [systems] = await pool.execute(
      `SELECT * FROM sso_trusted_systems ORDER BY created_at DESC`
    );

    res.json({
      success: true,
      data: systems
    });
  } catch (error) {
    customLogger.error('信頼システム一覧取得エラー:', error);
    res.status(500).json({
      success: false,
      message: '信頼システム一覧の取得に失敗しました'
    });
  }
});

/**
 * POST /api/sso/systems
 * 信頼システム追加（管理者のみ）
 */
router.post('/systems', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { system_key, system_name, base_url, landing_path, description } = req.body;
    const userId = req.user.user_id;

    if (!system_key || !system_name || !base_url) {
      return res.status(400).json({
        success: false,
        message: 'system_key, system_name, base_urlは必須です'
      });
    }

    // URL形式のバリデーション
    try {
      new URL(base_url);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'base_urlは有効なURL形式である必要があります'
      });
    }

    // base_urlの正規化（末尾のスラッシュを削除）
    const normalizedBaseUrl = base_url.replace(/\/+$/, '');

    const [result] = await pool.execute(
      `INSERT INTO sso_trusted_systems 
        (system_key, system_name, base_url, landing_path, description, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        system_key,
        system_name,
        normalizedBaseUrl,
        landing_path || '/landing',
        description || null,
        userId
      ]
    );

    const [newSystem] = await pool.execute(
      `SELECT * FROM sso_trusted_systems WHERE id = ?`,
      [result.insertId]
    );

    res.json({
      success: true,
      data: newSystem[0]
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        message: 'system_keyが既に存在します'
      });
    }
    customLogger.error('信頼システム追加エラー:', error);
    res.status(500).json({
      success: false,
      message: '信頼システムの追加に失敗しました'
    });
  }
});

/**
 * PUT /api/sso/systems/:id
 * 信頼システム更新（管理者のみ）
 */
router.put('/systems/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { system_key, system_name, base_url, landing_path, description, enabled } = req.body;
    const userId = req.user.user_id;

    // 既存システムを取得
    const [existingSystems] = await pool.execute(
      `SELECT * FROM sso_trusted_systems WHERE id = ?`,
      [id]
    );

    if (existingSystems.length === 0) {
      return res.status(404).json({
        success: false,
        message: '信頼システムが見つかりません'
      });
    }

    const updateFields = [];
    const updateValues = [];

    if (system_key !== undefined) {
      updateFields.push('system_key = ?');
      updateValues.push(system_key);
    }
    if (system_name !== undefined) {
      updateFields.push('system_name = ?');
      updateValues.push(system_name);
    }
    if (base_url !== undefined) {
      // URL形式のバリデーション
      try {
        new URL(base_url);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: 'base_urlは有効なURL形式である必要があります'
        });
      }
      // base_urlの正規化
      const normalizedBaseUrl = base_url.replace(/\/+$/, '');
      updateFields.push('base_url = ?');
      updateValues.push(normalizedBaseUrl);
    }
    if (landing_path !== undefined) {
      updateFields.push('landing_path = ?');
      updateValues.push(landing_path);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description);
    }
    if (enabled !== undefined) {
      updateFields.push('enabled = ?');
      updateValues.push(enabled);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: '更新するフィールドが指定されていません'
      });
    }

    updateFields.push('updated_by = ?');
    updateValues.push(userId);
    updateValues.push(id);

    await pool.execute(
      `UPDATE sso_trusted_systems SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    const [updatedSystem] = await pool.execute(
      `SELECT * FROM sso_trusted_systems WHERE id = ?`,
      [id]
    );

    res.json({
      success: true,
      data: updatedSystem[0]
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        message: 'system_keyが既に存在します'
      });
    }
    customLogger.error('信頼システム更新エラー:', error);
    res.status(500).json({
      success: false,
      message: '信頼システムの更新に失敗しました'
    });
  }
});

/**
 * DELETE /api/sso/systems/:id
 * 信頼システム削除（論理削除、管理者のみ）
 */
router.delete('/systems/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.user_id;

    const [existingSystems] = await pool.execute(
      `SELECT * FROM sso_trusted_systems WHERE id = ?`,
      [id]
    );

    if (existingSystems.length === 0) {
      return res.status(404).json({
        success: false,
        message: '信頼システムが見つかりません'
      });
    }

    // 論理削除（enabled = false）
    await pool.execute(
      `UPDATE sso_trusted_systems SET enabled = FALSE, updated_by = ? WHERE id = ?`,
      [userId, id]
    );

    res.json({
      success: true,
      message: '信頼システムを無効化しました'
    });
  } catch (error) {
    customLogger.error('信頼システム削除エラー:', error);
    res.status(500).json({
      success: false,
      message: '信頼システムの削除に失敗しました'
    });
  }
});

/**
 * GET /api/sso/audit-logs
 * 監査ログ取得（管理者のみ、1ヶ月分）
 */
router.get('/audit-logs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const {
      user_id,
      source_system,
      target_system,
      action,
      start_date,
      end_date,
      page = 1,
      limit = 50
    } = req.query;

    // デフォルトで1ヶ月前から現在まで
    const now = getCurrentJapanTime();
    const oneMonthAgo = new Date(now);
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const defaultStartDate = formatMySQLDateTime(oneMonthAgo);
    const defaultEndDate = formatMySQLDateTime(now);

    const startDate = start_date || defaultStartDate;
    const endDate = end_date || defaultEndDate;

    // WHERE条件の構築
    const whereConditions = ['created_at >= ?', 'created_at <= ?'];
    const params = [startDate, endDate];

    if (user_id) {
      whereConditions.push('user_id = ?');
      params.push(user_id);
    }
    if (source_system) {
      whereConditions.push('source_system = ?');
      params.push(source_system);
    }
    if (target_system) {
      whereConditions.push('target_system = ?');
      params.push(target_system);
    }
    if (action) {
      whereConditions.push('action = ?');
      params.push(action);
    }

    const whereClause = whereConditions.join(' AND ');

    // 総件数を取得
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM sso_audit_logs WHERE ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    // ページネーション
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // ログを取得
    const [logs] = await pool.execute(
      `SELECT 
        sal.*,
        ua.login_code as username,
        ua.name as user_name
       FROM sso_audit_logs sal
       LEFT JOIN user_accounts ua ON sal.user_id = ua.id
       WHERE ${whereClause}
       ORDER BY sal.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    customLogger.error('監査ログ取得エラー:', error);
    // 開発環境では詳細なエラー情報を返す
    const errorMessage = process.env.NODE_ENV === 'development' 
      ? `監査ログの取得に失敗しました: ${error.message}`
      : '監査ログの取得に失敗しました';
    res.status(500).json({
      success: false,
      message: errorMessage,
      ...(process.env.NODE_ENV === 'development' && { error: error.stack })
    });
  }
});

module.exports = router;

