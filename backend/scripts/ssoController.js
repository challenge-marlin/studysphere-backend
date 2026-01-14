const { pool } = require('../utils/database');
const crypto = require('crypto');
const { customLogger } = require('../utils/logger');
const { getCurrentJapanTime, convertJapanTimeToUTC, formatMySQLDateTime } = require('../utils/dateUtils');

// チケット有効期限（秒） - 環境変数から取得、デフォルトは30秒
const TICKET_EXPIRY_SECONDS = parseInt(process.env.SSO_TICKET_EXPIRY_SECONDS) || 30;
const TICKET_LENGTH = parseInt(process.env.SSO_TICKET_LENGTH) || 32;

/**
 * ランダムなチケット文字列を生成
 * @returns {string} art-{ランダム文字列}形式のチケット
 */
function generateTicket() {
  const randomBytes = crypto.randomBytes(TICKET_LENGTH);
  const randomString = randomBytes.toString('hex');
  return `art-${randomString}`;
}

/**
 * 信頼システムを取得
 * @param {string} systemKey - システム識別子
 * @returns {Promise<Object|null>} 信頼システム情報
 */
async function getTrustedSystem(systemKey) {
  try {
    const [rows] = await pool.execute(
      `SELECT * FROM sso_trusted_systems WHERE system_key = ? AND enabled = TRUE`,
      [systemKey]
    );
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    customLogger.error('信頼システム取得エラー:', error);
    throw error;
  }
}

/**
 * チケットを生成
 * @param {number} userId - ユーザーID
 * @param {string} targetSystem - 遷移先システム識別子
 * @param {string} sourceSystem - 遷移元システム識別子（オプション）
 * @param {string} context - 生成コンテキスト（オプション）
 * @param {string} ipAddress - IPアドレス（オプション）
 * @param {string} userAgent - User-Agent（オプション）
 * @returns {Promise<Object>} 生成されたチケット情報
 */
async function generateTicketRecord(userId, targetSystem, sourceSystem = null, context = null, ipAddress = null, userAgent = null) {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // インバウンドの場合（targetSystem === 'studysphere'）、信頼システムチェックをスキップ
    // 自分自身へのリダイレクトなので、信頼システムとして登録する必要はない
    if (targetSystem !== 'studysphere') {
      // 外部システムへのアウトバウンド/トランスミットの場合のみ信頼システムチェック
      const trustedSystem = await getTrustedSystem(targetSystem);
      if (!trustedSystem) {
        throw new Error(`信頼システムが見つかりません: ${targetSystem}`);
      }
    }

    // チケット生成
    const ticket = generateTicket();
    const now = getCurrentJapanTime();
    const expiresAt = new Date(now.getTime() + TICKET_EXPIRY_SECONDS * 1000);
    const expiresAtMySQL = formatMySQLDateTime(expiresAt);

    // チケットをデータベースに保存
    const [result] = await connection.execute(
      `INSERT INTO sso_tickets 
        (ticket, user_id, source_system, target_system, context, expires_at, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [ticket, userId, sourceSystem, targetSystem, context, expiresAtMySQL, ipAddress, userAgent]
    );

    const ticketId = result.insertId;

    // 監査ログを記録
    await connection.execute(
      `INSERT INTO sso_audit_logs 
        (user_id, ticket_id, source_system, target_system, action, ip_address, user_agent, success)
       VALUES (?, ?, ?, ?, 'generate', ?, ?, TRUE)`,
      [userId, ticketId, sourceSystem, targetSystem, ipAddress, userAgent]
    );

    await connection.commit();

    customLogger.info('SSOチケット生成成功', {
      ticketId,
      userId,
      sourceSystem,
      targetSystem
    });

    return {
      ticket,
      ticketId,
      expiresAt: expiresAt.toISOString(),
      expiresIn: TICKET_EXPIRY_SECONDS
    };
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    customLogger.error('SSOチケット生成エラー:', error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

/**
 * チケットを検証
 * @param {string} ticket - チケット文字列
 * @param {string} ipAddress - IPアドレス（オプション）
 * @param {string} userAgent - User-Agent（オプション）
 * @returns {Promise<Object>} 検証結果とユーザー情報
 */
async function verifyTicket(ticket, ipAddress = null, userAgent = null) {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // チケットを取得
    const [ticketRows] = await connection.execute(
      `SELECT * FROM sso_tickets WHERE ticket = ?`,
      [ticket]
    );

    if (ticketRows.length === 0) {
      // 監査ログを記録（失敗）
      await connection.execute(
        `INSERT INTO sso_audit_logs 
          (user_id, source_system, target_system, action, ip_address, user_agent, success, error_message)
         VALUES (?, ?, ?, 'verify', ?, ?, FALSE, ?)`,
        [null, null, null, ipAddress, userAgent, 'INVALID_TICKET']
      );
      await connection.commit();
      return {
        valid: false,
        error: 'INVALID_TICKET'
      };
    }

    const ticketRecord = ticketRows[0];

    // 有効期限チェック
    const now = getCurrentJapanTime();
    const expiresAt = new Date(ticketRecord.expires_at);
    if (now > expiresAt) {
      // 監査ログを記録（失敗）
      await connection.execute(
        `INSERT INTO sso_audit_logs 
          (user_id, ticket_id, source_system, target_system, action, ip_address, user_agent, success, error_message)
         VALUES (?, ?, ?, ?, 'verify', ?, ?, FALSE, ?)`,
        [ticketRecord.user_id, ticketRecord.id, ticketRecord.source_system, ticketRecord.target_system, ipAddress, userAgent, 'EXPIRED_TICKET']
      );
      await connection.commit();
      return {
        valid: false,
        error: 'EXPIRED_TICKET'
      };
    }

    // 使用済みチェック
    if (ticketRecord.used) {
      // 監査ログを記録（失敗）
      await connection.execute(
        `INSERT INTO sso_audit_logs 
          (user_id, ticket_id, source_system, target_system, action, ip_address, user_agent, success, error_message)
         VALUES (?, ?, ?, ?, 'verify', ?, ?, FALSE, ?)`,
        [ticketRecord.user_id, ticketRecord.id, ticketRecord.source_system, ticketRecord.target_system, ipAddress, userAgent, 'ALREADY_USED']
      );
      await connection.commit();
      return {
        valid: false,
        error: 'ALREADY_USED'
      };
    }

    // チケットを使用済みにマーク
    const nowMySQL = formatMySQLDateTime(now);
    await connection.execute(
      `UPDATE sso_tickets SET used = TRUE, used_at = ? WHERE id = ?`,
      [nowMySQL, ticketRecord.id]
    );

    // ユーザー情報を取得（企業情報、拠点情報も含む）
    const [userRows] = await connection.execute(
      `SELECT 
        u.id,
        u.login_code,
        u.name,
        u.role,
        u.status,
        u.company_id,
        u.satellite_ids,
        COALESCE(c.name, 'システム管理者') AS company_name
       FROM user_accounts u
       LEFT JOIN companies c ON u.company_id = c.id
       WHERE u.id = ? AND u.status = 1`,
      [ticketRecord.user_id]
    );

    if (userRows.length === 0) {
      // 監査ログを記録（失敗）
      await connection.execute(
        `INSERT INTO sso_audit_logs 
          (user_id, ticket_id, source_system, target_system, action, ip_address, user_agent, success, error_message)
         VALUES (?, ?, ?, ?, 'verify', ?, ?, FALSE, ?)`,
        [ticketRecord.user_id, ticketRecord.id, ticketRecord.source_system, ticketRecord.target_system, ipAddress, userAgent, 'USER_NOT_FOUND']
      );
      await connection.commit();
      return {
        valid: false,
        error: 'USER_NOT_FOUND'
      };
    }

    const user = userRows[0];

    // ログインコードの存在チェック
    // login_codeがNULLまたは空文字列の場合、StudySphereにログインできないため元システムに戻る
    if (!user.login_code || user.login_code.trim() === '') {
      // 元システムの情報を取得（リダイレクト用）
      let sourceSystemInfo = null;
      if (ticketRecord.source_system) {
        try {
          const sourceSystem = await getTrustedSystem(ticketRecord.source_system);
          if (sourceSystem) {
            sourceSystemInfo = {
              system_key: sourceSystem.system_key,
              system_name: sourceSystem.system_name,
              base_url: sourceSystem.base_url,
              landing_path: sourceSystem.landing_path || '/landing'
            };
          }
        } catch (error) {
          customLogger.error('元システム情報取得エラー:', error);
        }
      }

      // 監査ログを記録（失敗）
      await connection.execute(
        `INSERT INTO sso_audit_logs 
          (user_id, ticket_id, source_system, target_system, action, ip_address, user_agent, success, error_message)
         VALUES (?, ?, ?, ?, 'verify', ?, ?, FALSE, ?)`,
        [user.id, ticketRecord.id, ticketRecord.source_system, ticketRecord.target_system, ipAddress, userAgent, 'NO_LOGIN_CODE']
      );
      await connection.commit();
      
      return {
        valid: false,
        error: 'NO_LOGIN_CODE',
        source_system: sourceSystemInfo
      };
    }

    // ロール1（利用者）の場合、一時パスワードの存在チェック
    // SSOインバウンドで、ロール1のユーザの場合、一時パスワードが発行されていなければ元システムに戻る
    if (user.role === 1 && ticketRecord.target_system === 'studysphere') {
      // 有効な一時パスワードが存在するかチェック（未使用で有効期限内）
      const [tempPasswordRows] = await connection.execute(
        `SELECT id FROM user_temp_passwords 
         WHERE user_id = ? 
         AND is_used = 0 
         AND expires_at > NOW()
         ORDER BY issued_at DESC 
         LIMIT 1`,
        [user.id]
      );

      if (tempPasswordRows.length === 0) {
        // 一時パスワードが発行されていない場合、元システムに戻る
        let sourceSystemInfo = null;
        if (ticketRecord.source_system) {
          try {
            const sourceSystem = await getTrustedSystem(ticketRecord.source_system);
            if (sourceSystem) {
              sourceSystemInfo = {
                system_key: sourceSystem.system_key,
                system_name: sourceSystem.system_name,
                base_url: sourceSystem.base_url,
                landing_path: sourceSystem.landing_path || '/landing'
              };
            }
          } catch (error) {
            customLogger.error('元システム情報取得エラー:', error);
          }
        }

        // 監査ログを記録（失敗）
        await connection.execute(
          `INSERT INTO sso_audit_logs 
            (user_id, ticket_id, source_system, target_system, action, ip_address, user_agent, success, error_message)
           VALUES (?, ?, ?, ?, 'verify', ?, ?, FALSE, ?)`,
          [user.id, ticketRecord.id, ticketRecord.source_system, ticketRecord.target_system, ipAddress, userAgent, 'NO_TEMP_PASSWORD']
        );
        await connection.commit();
        
        customLogger.warn('SSOインバウンド: ロール1ユーザーの一時パスワードが発行されていません', {
          userId: user.id,
          loginCode: user.login_code,
          sourceSystem: ticketRecord.source_system
        });
        
        return {
          valid: false,
          error: 'NO_TEMP_PASSWORD',
          source_system: sourceSystemInfo,
          message: '一時パスワードが発行されていません。担当者に一時パスワードの発行を依頼してください'
        };
      }
    }

    // 拠点名を取得
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
        customLogger.error('拠点名取得エラー:', error);
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
        customLogger.error('企業拠点名取得エラー:', error);
      }
    }

    // 有効期限を取得（satellitesテーブルから）
    let tokenExpiryAt = null;
    try {
      if (user.satellite_ids) {
        const satelliteIds = typeof user.satellite_ids === 'string' 
          ? JSON.parse(user.satellite_ids) 
          : user.satellite_ids;
        
        if (Array.isArray(satelliteIds) && satelliteIds.length > 0) {
          const placeholders = satelliteIds.map(() => '?').join(',');
          const [expiryRows] = await connection.execute(
            `SELECT MIN(token_expiry_at) AS token_expiry_at
             FROM satellites 
             WHERE id IN (${placeholders}) AND status = 1`,
            satelliteIds
          );
          if (expiryRows.length && expiryRows[0].token_expiry_at) {
            tokenExpiryAt = expiryRows[0].token_expiry_at;
          }
        }
      }
      
      // 拠点IDがない場合は企業の最初の拠点の有効期限を取得
      if (!tokenExpiryAt && user.company_id) {
        const [expiryRows] = await connection.execute(
          `SELECT token_expiry_at
           FROM satellites 
           WHERE company_id = ? AND status = 1 
           ORDER BY id LIMIT 1`,
          [user.company_id]
        );
        if (expiryRows.length && expiryRows[0].token_expiry_at) {
          tokenExpiryAt = expiryRows[0].token_expiry_at;
        }
      }
    } catch (error) {
      customLogger.error('有効期限取得エラー:', error);
    }

    // 監査ログを記録（成功）
    await connection.execute(
      `INSERT INTO sso_audit_logs 
        (user_id, ticket_id, source_system, target_system, action, ip_address, user_agent, success)
       VALUES (?, ?, ?, ?, 'verify', ?, ?, TRUE)`,
      [user.id, ticketRecord.id, ticketRecord.source_system, ticketRecord.target_system, ipAddress, userAgent]
    );

    await connection.commit();

    customLogger.info('SSOチケット検証成功', {
      ticketId: ticketRecord.id,
      userId: user.id,
      sourceSystem: ticketRecord.source_system,
      targetSystem: ticketRecord.target_system
    });

    return {
      valid: true,
      data: {
        user_id: user.id,
        username: user.login_code, // login_codeをusernameとして返す
        name: user.name,
        role: user.role,
        company_id: user.company_id,
        company_name: user.company_name,
        locationNames: locationNames,
        expiresAt: tokenExpiryAt,
        source_system: ticketRecord.source_system,
        target_system: ticketRecord.target_system
      }
    };
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    customLogger.error('SSOチケット検証エラー:', error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

/**
 * 監査ログを記録（手動記録用）
 * @param {number} userId - ユーザーID
 * @param {number} ticketId - チケットID（オプション）
 * @param {string} sourceSystem - 遷移元システム（オプション）
 * @param {string} targetSystem - 遷移先システム
 * @param {string} action - アクション種別
 * @param {boolean} success - 成功フラグ
 * @param {string} errorMessage - エラーメッセージ（オプション）
 * @param {string} ipAddress - IPアドレス（オプション）
 * @param {string} userAgent - User-Agent（オプション）
 */
async function logAudit(userId, ticketId, sourceSystem, targetSystem, action, success, errorMessage = null, ipAddress = null, userAgent = null) {
  try {
    await pool.execute(
      `INSERT INTO sso_audit_logs 
        (user_id, ticket_id, source_system, target_system, action, ip_address, user_agent, success, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, ticketId, sourceSystem, targetSystem, action, ipAddress, userAgent, success, errorMessage]
    );
  } catch (error) {
    customLogger.error('SSO監査ログ記録エラー:', error);
    throw error;
  }
}

/**
 * 期限切れチケットのクリーンアップ
 * 使用済み・未使用問わず、期限切れのチケットをすべて削除
 */
async function cleanupExpiredTickets() {
  try {
    const now = formatMySQLDateTime(getCurrentJapanTime());
    const [result] = await pool.execute(
      `DELETE FROM sso_tickets WHERE expires_at < ?`,
      [now]
    );
    customLogger.info('期限切れチケットクリーンアップ完了', {
      deletedCount: result.affectedRows,
      cleanupTime: now
    });
    return result.affectedRows;
  } catch (error) {
    customLogger.error('期限切れチケットクリーンアップエラー:', error);
    throw error;
  }
}

module.exports = {
  generateTicketRecord,
  verifyTicket,
  getTrustedSystem,
  logAudit,
  cleanupExpiredTickets
};

