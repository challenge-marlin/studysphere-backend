const { pool } = require('../utils/database');

/**
 * システム概要の統計情報を取得
 */
const getSystemOverview = async () => {
  let connection;
  try {
    console.log('システム概要取得開始');
    
    // データベース接続テスト
    console.log('データベース接続テスト開始');
    connection = await pool.getConnection();
    console.log('データベース接続成功');
    
    // テーブル存在確認
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME IN ('companies', 'satellites', 'user_accounts', 'office_types')
    `);
    
    const existingTables = tables.map(table => table.TABLE_NAME);
    console.log('Existing tables:', existingTables);
    
    if (existingTables.length === 0) {
      console.log('テーブルが見つかりません。データベースが初期化されていない可能性があります。');
    }
    
    // 企業数
    let companyCount = [{ count: 0 }];
    if (existingTables.includes('companies')) {
      [companyCount] = await connection.execute('SELECT COUNT(*) as count FROM companies');
    }
    
    // 拠点数
    let satelliteCount = [{ count: 0 }];
    if (existingTables.includes('satellites')) {
      [satelliteCount] = await connection.execute('SELECT COUNT(*) as count FROM satellites');
    }
    
    // ユーザー数（ロール別）
    let userStats = [];
    if (existingTables.includes('user_accounts')) {
      [userStats] = await connection.execute(`
        SELECT 
          role,
          COUNT(*) as count
        FROM user_accounts 
        WHERE status = 1
        GROUP BY role
      `);
    }
    
    // 企業別ユーザー数
    let companyUserStats = [];
    if (existingTables.includes('companies') && existingTables.includes('user_accounts')) {
      try {
        [companyUserStats] = await connection.execute(`
          SELECT 
            c.id,
            c.name as company_name,
            COUNT(DISTINCT ua.id) as user_count,
            COUNT(DISTINCT CASE WHEN ua.role = 1 THEN ua.id END) as student_count,
            COUNT(DISTINCT CASE WHEN ua.role = 5 THEN ua.id END) as instructor_count
          FROM companies c
          LEFT JOIN user_accounts ua ON (
            (ua.role >= 4 AND c.id = ua.company_id AND ua.status = 1) OR
            (ua.role = 1 AND ua.satellite_ids IS NOT NULL AND ua.satellite_ids != 'null' AND ua.satellite_ids != '[]' AND EXISTS (
              SELECT 1 FROM satellites s 
              WHERE s.company_id = c.id 
              AND s.status = 1 
              AND (
                CASE 
                  WHEN ua.satellite_ids LIKE '[%]' THEN (
                    s.id IS NOT NULL AND ua.satellite_ids IS NOT NULL AND (
                      JSON_CONTAINS(ua.satellite_ids, JSON_QUOTE(s.id)) OR 
                      JSON_CONTAINS(ua.satellite_ids, CAST(s.id AS JSON)) OR
                      JSON_SEARCH(ua.satellite_ids, 'one', CAST(s.id AS CHAR)) IS NOT NULL
                    )
                  )
                  ELSE ua.satellite_ids = s.id
                END
              )
            ) AND ua.status = 1)
          )
          GROUP BY c.id, c.name
          ORDER BY c.id
        `);
      } catch (error) {
        console.log('companyUserStatsクエリエラー:', error.message);
        // 簡易クエリを使用
        [companyUserStats] = await connection.execute(`
          SELECT 
            c.id,
            c.name as company_name,
            COUNT(DISTINCT ua.id) as user_count
          FROM companies c
          LEFT JOIN user_accounts ua ON (
            (ua.role >= 4 AND c.id = ua.company_id AND ua.status = 1) OR
            (ua.role = 1 AND ua.satellite_ids IS NOT NULL AND ua.satellite_ids != 'null' AND ua.satellite_ids != '[]' AND EXISTS (
              SELECT 1 FROM satellites s 
              WHERE s.company_id = c.id 
              AND s.status = 1 
              AND (
                CASE 
                  WHEN ua.satellite_ids LIKE '[%]' THEN (
                    s.id IS NOT NULL AND ua.satellite_ids IS NOT NULL AND (
                      JSON_CONTAINS(ua.satellite_ids, JSON_QUOTE(s.id)) OR 
                      JSON_CONTAINS(ua.satellite_ids, CAST(s.id AS JSON)) OR
                      JSON_SEARCH(ua.satellite_ids, 'one', CAST(s.id AS CHAR)) IS NOT NULL
                    )
                  )
                  ELSE ua.satellite_ids = s.id
                END
              )
            ) AND ua.status = 1)
          )
          GROUP BY c.id, c.name
          ORDER BY c.id
        `);
      }
    }
    
    // 拠点別ユーザー数
    let satelliteUserStats = [];
    if (existingTables.includes('satellites') && existingTables.includes('companies') && existingTables.includes('user_accounts')) {
      try {
        [satelliteUserStats] = await connection.execute(`
          SELECT 
            s.id,
            s.name as satellite_name,
            c.name as company_name,
            COUNT(DISTINCT ua.id) as user_count,
            s.max_users,
            ROUND((COUNT(DISTINCT ua.id) / s.max_users) * 100, 1) as utilization_rate
          FROM satellites s
          JOIN companies c ON s.company_id = c.id
          LEFT JOIN user_accounts ua ON (
            (ua.role = 1 AND ua.satellite_ids IS NOT NULL AND ua.satellite_ids != 'null' AND ua.satellite_ids != '[]' AND (
              CASE 
                WHEN ua.satellite_ids LIKE '[%]' THEN (
                JSON_CONTAINS(ua.satellite_ids, JSON_QUOTE(s.id)) OR 
                JSON_CONTAINS(ua.satellite_ids, CAST(s.id AS JSON)) OR
                JSON_SEARCH(ua.satellite_ids, 'one', CAST(s.id AS CHAR)) IS NOT NULL
              )
                ELSE ua.satellite_ids = s.id
              END
            ) AND ua.status = 1) OR
            (ua.role >= 4 AND ua.satellite_ids IS NOT NULL AND ua.satellite_ids != 'null' AND ua.satellite_ids != '[]' AND (
              CASE 
                WHEN ua.satellite_ids LIKE '[%]' THEN (
                JSON_CONTAINS(ua.satellite_ids, JSON_QUOTE(s.id)) OR 
                JSON_CONTAINS(ua.satellite_ids, CAST(s.id AS JSON)) OR
                JSON_SEARCH(ua.satellite_ids, 'one', CAST(s.id AS CHAR)) IS NOT NULL
              )
                ELSE ua.satellite_ids = s.id
              END
            ) AND ua.status = 1)
          )
          WHERE s.status = 1
          GROUP BY s.id, s.name, c.name, s.max_users
          ORDER BY c.id, s.id
        `);
      } catch (error) {
        console.log('satelliteUserStatsクエリエラー:', error.message);
        // 簡易クエリを使用
        [satelliteUserStats] = await connection.execute(`
          SELECT 
            s.id,
            s.name as satellite_name,
            c.name as company_name,
            COUNT(DISTINCT ua.id) as user_count
          FROM satellites s
          JOIN companies c ON s.company_id = c.id
          LEFT JOIN user_accounts ua ON (
            (ua.role = 1 AND ua.satellite_ids IS NOT NULL AND ua.satellite_ids != 'null' AND ua.satellite_ids != '[]' AND (
              CASE 
                WHEN ua.satellite_ids LIKE '[%]' THEN (
                JSON_CONTAINS(ua.satellite_ids, JSON_QUOTE(s.id)) OR 
                JSON_CONTAINS(ua.satellite_ids, CAST(s.id AS JSON)) OR
                JSON_SEARCH(ua.satellite_ids, 'one', CAST(s.id AS CHAR)) IS NOT NULL
              )
                ELSE ua.satellite_ids = s.id
              END
            ) AND ua.status = 1) OR
            (ua.role >= 4 AND ua.satellite_ids IS NOT NULL AND ua.satellite_ids != 'null' AND ua.satellite_ids != '[]' AND (
              CASE 
                WHEN ua.satellite_ids LIKE '[%]' THEN (
                JSON_CONTAINS(ua.satellite_ids, JSON_QUOTE(s.id)) OR 
                JSON_CONTAINS(ua.satellite_ids, CAST(s.id AS JSON)) OR
                JSON_SEARCH(ua.satellite_ids, 'one', CAST(s.id AS CHAR)) IS NOT NULL
              )
                ELSE ua.satellite_ids = s.id
              END
            ) AND ua.status = 1)
          )
          WHERE s.status = 1
          GROUP BY s.id, s.name, c.name
          ORDER BY c.id, s.id
        `);
      }
    }
    
    // 在宅支援ユーザー数
    let remoteUserCount = [{ count: 0 }];
    if (existingTables.includes('user_accounts')) {
      [remoteUserCount] = await connection.execute(`
        SELECT COUNT(*) as count 
        FROM user_accounts 
        WHERE is_remote_user = 1 AND status = 1
      `);
    }
    
    // 最近のアクティビティ（ユーザー作成日時）
    let recentActivity = [];
    if (existingTables.includes('user_accounts') && existingTables.includes('companies')) {
      try {
        [recentActivity] = await connection.execute(`
          SELECT 
            ua.id,
            ua.name,
            ua.role,
            c.name as company_name,
            ua.created_at
          FROM user_accounts ua
          LEFT JOIN companies c ON ua.company_id = c.id
          WHERE ua.status = 1
          ORDER BY ua.created_at DESC
          LIMIT 10
        `);
      } catch (error) {
        console.log('recentActivityクエリエラー:', error.message);
        // フィールドが存在しない場合は簡易クエリを使用
        [recentActivity] = await connection.execute(`
          SELECT 
            ua.id,
            ua.name,
            ua.role
          FROM user_accounts ua
          WHERE ua.status = 1
          ORDER BY ua.id DESC
          LIMIT 10
        `);
      }
    }
    
    // 統計情報を整理
    const stats = {
      totalCompanies: companyCount[0].count,
      totalSatellites: satelliteCount[0].count,
      totalUsers: userStats.reduce((sum, stat) => sum + stat.count, 0),
      userByRole: userStats.reduce((acc, stat) => {
        acc[stat.role] = stat.count;
        return acc;
      }, {}),
      remoteUserCount: remoteUserCount[0].count,
      companyUserStats,
      satelliteUserStats,
      recentActivity
    };
    
    console.log('統計情報取得成功:', stats);
    return {
      success: true,
      data: stats
    };
  } catch (error) {
    console.error('システム概要取得エラー:', error);
    console.error('エラー詳細:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    return {
      success: false,
      message: 'システム概要の取得に失敗しました',
      error: error.message
    };
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('接続の解放に失敗:', releaseError);
      }
    }
  }
};

/**
 * 企業詳細統計を取得
 */
const getCompanyStats = async (companyId) => {
  let connection;
  try {
    // データベース接続テスト
    connection = await pool.getConnection();
    
    // テーブル存在確認
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME IN ('companies', 'satellites', 'user_accounts', 'office_types')
    `);
    
    const existingTables = tables.map(table => table.TABLE_NAME);
    
    // 企業情報
    let companyInfo = [];
    if (existingTables.includes('companies')) {
      if (existingTables.includes('office_types')) {
        [companyInfo] = await connection.execute(`
          SELECT 
            c.*,
            ot.type as office_type_name
          FROM companies c
          LEFT JOIN office_types ot ON c.office_type_id = ot.id
          WHERE c.id = ?
        `, [companyId]);
      } else {
        [companyInfo] = await connection.execute(`
          SELECT c.*
          FROM companies c
          WHERE c.id = ?
        `, [companyId]);
      }
    }
    
    if (companyInfo.length === 0) {
      return {
        success: false,
        message: '企業が見つかりません',
        statusCode: 404
      };
    }
    
    // 企業の拠点情報
    let satellites = [];
    if (existingTables.includes('satellites') && existingTables.includes('user_accounts')) {
      [satellites] = await connection.execute(`
        SELECT 
          s.*,
          COUNT(ua.id) as user_count,
          COUNT(CASE WHEN ua.role = 1 THEN 1 END) as student_count,
          COUNT(CASE WHEN ua.role = 5 THEN 1 END) as instructor_count,
          ROUND((COUNT(ua.id) / s.max_users) * 100, 1) as utilization_rate
        FROM satellites s
        LEFT JOIN user_accounts ua ON (
          (ua.role = 1 AND ua.satellite_ids IS NOT NULL AND ua.satellite_ids != 'null' AND ua.satellite_ids != '[]' AND (
            CASE 
              WHEN ua.satellite_ids LIKE '[%]' THEN (
                JSON_CONTAINS(ua.satellite_ids, JSON_QUOTE(s.id)) OR 
                JSON_CONTAINS(ua.satellite_ids, CAST(s.id AS JSON)) OR
                JSON_SEARCH(ua.satellite_ids, 'one', CAST(s.id AS CHAR)) IS NOT NULL
              )
              ELSE ua.satellite_ids = s.id
            END
          ) AND ua.status = 1) OR
          (ua.role >= 4 AND ua.satellite_ids IS NOT NULL AND ua.satellite_ids != 'null' AND ua.satellite_ids != '[]' AND (
            CASE 
              WHEN ua.satellite_ids LIKE '[%]' THEN (
                JSON_CONTAINS(ua.satellite_ids, JSON_QUOTE(s.id)) OR 
                JSON_CONTAINS(ua.satellite_ids, CAST(s.id AS JSON)) OR
                JSON_SEARCH(ua.satellite_ids, 'one', CAST(s.id AS CHAR)) IS NOT NULL
              )
              ELSE ua.satellite_ids = s.id
            END
          ) AND ua.status = 1)
        )
        WHERE s.company_id = ?
        GROUP BY s.id
        ORDER BY s.id
      `, [companyId]);
    }
    
    // 企業のユーザー統計
    let userStats = [];
    if (existingTables.includes('user_accounts')) {
      [userStats] = await connection.execute(`
        SELECT 
          role,
          COUNT(*) as count
        FROM user_accounts 
        WHERE company_id = ? AND status = 1
        GROUP BY role
      `, [companyId]);
    }
    
    // 在宅支援ユーザー数
    let remoteUserCount = [{ count: 0 }];
    if (existingTables.includes('user_accounts')) {
      [remoteUserCount] = await connection.execute(`
        SELECT COUNT(*) as count 
        FROM user_accounts 
        WHERE company_id = ? AND is_remote_user = 1 AND status = 1
      `, [companyId]);
    }
    
    const stats = {
      company: companyInfo[0],
      satellites,
      userStats: userStats.reduce((acc, stat) => {
        acc[stat.role] = stat.count;
        return acc;
      }, {}),
      remoteUserCount: remoteUserCount[0].count
    };
    
    return {
      success: true,
      data: stats
    };
  } catch (error) {
    console.error('企業統計取得エラー:', error);
    return {
      success: false,
      message: '企業統計の取得に失敗しました',
      error: error.message
    };
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('接続の解放に失敗:', releaseError);
      }
    }
  }
};

/**
 * アラート情報を取得
 */
const getAlerts = async () => {
  let connection;
  try {
    const alerts = [];
    
    // データベース接続テスト
    connection = await pool.getConnection();
    
    // テーブル存在確認
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME IN ('companies', 'satellites', 'user_accounts')
    `);
    
    const existingTables = tables.map(table => table.TABLE_NAME);
    
    // 必要なテーブルが存在する場合のみアラートを生成
    if (existingTables.includes('satellites') && existingTables.includes('companies') && existingTables.includes('user_accounts')) {
      // 利用率が高い拠点（80%以上）
      const [highUtilization] = await connection.execute(`
        SELECT 
          s.name as satellite_name,
          c.name as company_name,
          COUNT(ua.id) as user_count,
          s.max_users,
          ROUND((COUNT(ua.id) / s.max_users) * 100, 1) as utilization_rate
        FROM satellites s
        JOIN companies c ON s.company_id = c.id
        LEFT JOIN user_accounts ua ON (
          (ua.role = 1 AND ua.satellite_ids IS NOT NULL AND ua.satellite_ids != 'null' AND ua.satellite_ids != '[]' AND (
            CASE 
              WHEN ua.satellite_ids LIKE '[%]' THEN (
                JSON_CONTAINS(ua.satellite_ids, JSON_QUOTE(s.id)) OR 
                JSON_CONTAINS(ua.satellite_ids, CAST(s.id AS JSON)) OR
                JSON_SEARCH(ua.satellite_ids, 'one', CAST(s.id AS CHAR)) IS NOT NULL
              )
              ELSE ua.satellite_ids = s.id
            END
          ) AND ua.status = 1) OR
          (ua.role >= 4 AND ua.satellite_ids IS NOT NULL AND ua.satellite_ids != 'null' AND ua.satellite_ids != '[]' AND (
            CASE 
              WHEN ua.satellite_ids LIKE '[%]' THEN (
                JSON_CONTAINS(ua.satellite_ids, JSON_QUOTE(s.id)) OR 
                JSON_CONTAINS(ua.satellite_ids, CAST(s.id AS JSON)) OR
                JSON_SEARCH(ua.satellite_ids, 'one', CAST(s.id AS CHAR)) IS NOT NULL
              )
              ELSE ua.satellite_ids = s.id
            END
          ) AND ua.status = 1)
        )
        WHERE s.status = 1
        GROUP BY s.id, s.name, c.name, s.max_users
        HAVING utilization_rate >= 80
        ORDER BY utilization_rate DESC
      `);
      
      highUtilization.forEach(satellite => {
        alerts.push({
          type: 'warning',
          title: `${satellite.satellite_name}の稼働率が高い`,
          message: `利用率${satellite.utilization_rate}%となっています`,
          priority: 'high',
          time: '最近',
          data: satellite
        });
      });
      
      // 利用者数が少ない拠点（20%以下）
      const [lowUtilization] = await connection.execute(`
        SELECT 
          s.name as satellite_name,
          c.name as company_name,
          COUNT(ua.id) as user_count,
          s.max_users,
          ROUND((COUNT(ua.id) / s.max_users) * 100, 1) as utilization_rate
        FROM satellites s
        JOIN companies c ON s.company_id = c.id
        LEFT JOIN user_accounts ua ON (
          (ua.role = 1 AND ua.satellite_ids IS NOT NULL AND ua.satellite_ids != 'null' AND ua.satellite_ids != '[]' AND (
            CASE 
              WHEN ua.satellite_ids LIKE '[%]' THEN (
                JSON_CONTAINS(ua.satellite_ids, JSON_QUOTE(s.id)) OR 
                JSON_CONTAINS(ua.satellite_ids, CAST(s.id AS JSON)) OR
                JSON_SEARCH(ua.satellite_ids, 'one', CAST(s.id AS CHAR)) IS NOT NULL
              )
              ELSE ua.satellite_ids = s.id
            END
          ) AND ua.status = 1) OR
          (ua.role >= 4 AND ua.satellite_ids IS NOT NULL AND ua.satellite_ids != 'null' AND ua.satellite_ids != '[]' AND (
            CASE 
              WHEN ua.satellite_ids LIKE '[%]' THEN (
                JSON_CONTAINS(ua.satellite_ids, JSON_QUOTE(s.id)) OR 
                JSON_CONTAINS(ua.satellite_ids, CAST(s.id AS JSON)) OR
                JSON_SEARCH(ua.satellite_ids, 'one', CAST(s.id AS CHAR)) IS NOT NULL
              )
              ELSE ua.satellite_ids = s.id
            END
          ) AND ua.status = 1)
        )
        WHERE s.status = 1
        GROUP BY s.id, s.name, c.name, s.max_users
        HAVING utilization_rate <= 20 AND s.max_users > 1
        ORDER BY utilization_rate ASC
      `);
      
      lowUtilization.forEach(satellite => {
        alerts.push({
          type: 'info',
          title: `${satellite.satellite_name}の稼働率が低い`,
          message: `利用率${satellite.utilization_rate}%となっています`,
          priority: 'medium',
          time: '最近',
          data: satellite
        });
      });
    }
    
    return {
      success: true,
      data: alerts
    };
  } catch (error) {
    console.error('アラート取得エラー:', error);
    return {
      success: false,
      message: 'アラートの取得に失敗しました',
      error: error.message
    };
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('接続の解放に失敗:', releaseError);
      }
    }
  }
};

module.exports = {
  getSystemOverview,
  getCompanyStats,
  getAlerts
}; 