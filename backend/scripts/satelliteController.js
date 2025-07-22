const { pool } = require('../utils/database');

/**
 * 企業の拠点一覧を取得
 * @param {number} companyId - 企業ID
 * @returns {Object} 結果オブジェクト
 */
const getSatellitesByCompany = async (companyId) => {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        s.id,
        s.name,
        s.address,
        s.max_users,
        s.status,
        s.created_at,
        s.updated_at,
        COUNT(ua.id) as current_users
      FROM satellites s
      LEFT JOIN user_accounts ua ON s.id = ua.satellite_id AND ua.role = 1 AND ua.status = 1
      WHERE s.company_id = ?
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `, [companyId]);

    return {
      success: true,
      data: rows
    };
  } catch (error) {
    console.error('Get satellites error:', error);
    return {
      success: false,
      message: '拠点一覧の取得に失敗しました',
      error: error.message
    };
  }
};

/**
 * 拠点詳細を取得
 * @param {number} satelliteId - 拠点ID
 * @returns {Object} 結果オブジェクト
 */
const getSatelliteById = async (satelliteId) => {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        s.*,
        c.name as company_name,
        COUNT(ua.id) as current_users
      FROM satellites s
      JOIN companies c ON s.company_id = c.id
      LEFT JOIN user_accounts ua ON s.id = ua.satellite_id AND ua.role = 1 AND ua.status = 1
      WHERE s.id = ?
      GROUP BY s.id
    `, [satelliteId]);

    if (rows.length === 0) {
      return {
        success: false,
        message: '拠点が見つかりません'
      };
    }

    return {
      success: true,
      data: rows[0]
    };
  } catch (error) {
    console.error('Get satellite error:', error);
    return {
      success: false,
      message: '拠点詳細の取得に失敗しました',
      error: error.message
    };
  }
};

/**
 * 拠点を作成
 * @param {Object} satelliteData - 拠点データ
 * @param {number} satelliteData.company_id - 企業ID
 * @param {string} satelliteData.name - 拠点名
 * @param {string} satelliteData.address - 拠点住所
 * @param {number} satelliteData.max_users - 利用者上限数
 * @returns {Object} 結果オブジェクト
 */
const createSatellite = async (satelliteData) => {
  try {
    const { company_id, name, address, max_users } = satelliteData;

    // 企業の存在確認
    const [companyRows] = await pool.execute(
      'SELECT id FROM companies WHERE id = ?',
      [company_id]
    );

    if (companyRows.length === 0) {
      return {
        success: false,
        message: '指定された企業が見つかりません'
      };
    }

    // 拠点作成
    const [result] = await pool.execute(`
      INSERT INTO satellites (company_id, name, address, max_users)
      VALUES (?, ?, ?, ?)
    `, [company_id, name, address, max_users]);

    return {
      success: true,
      message: '拠点が作成されました',
      data: { id: result.insertId }
    };
  } catch (error) {
    console.error('Create satellite error:', error);
    return {
      success: false,
      message: '拠点の作成に失敗しました',
      error: error.message
    };
  }
};

/**
 * 拠点を更新
 * @param {number} satelliteId - 拠点ID
 * @param {Object} satelliteData - 更新データ
 * @returns {Object} 結果オブジェクト
 */
const updateSatellite = async (satelliteId, satelliteData) => {
  try {
    const { name, address, max_users, status } = satelliteData;

    // 拠点の存在確認
    const [existingRows] = await pool.execute(
      'SELECT id FROM satellites WHERE id = ?',
      [satelliteId]
    );

    if (existingRows.length === 0) {
      return {
        success: false,
        message: '拠点が見つかりません'
      };
    }

    // 拠点更新
    await pool.execute(`
      UPDATE satellites 
      SET name = ?, address = ?, max_users = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [name, address, max_users, status, satelliteId]);

    return {
      success: true,
      message: '拠点が更新されました'
    };
  } catch (error) {
    console.error('Update satellite error:', error);
    return {
      success: false,
      message: '拠点の更新に失敗しました',
      error: error.message
    };
  }
};

/**
 * 拠点を削除
 * @param {number} satelliteId - 拠点ID
 * @returns {Object} 結果オブジェクト
 */
const deleteSatellite = async (satelliteId) => {
  try {
    // 拠点に所属する利用者がいるかチェック
    const [userRows] = await pool.execute(
      'SELECT COUNT(*) as count FROM user_accounts WHERE satellite_id = ? AND role = 1',
      [satelliteId]
    );

    if (userRows[0].count > 0) {
      return {
        success: false,
        message: '拠点に所属する利用者がいるため削除できません'
      };
    }

    // 拠点削除
    const [result] = await pool.execute(
      'DELETE FROM satellites WHERE id = ?',
      [satelliteId]
    );

    if (result.affectedRows === 0) {
      return {
        success: false,
        message: '拠点が見つかりません'
      };
    }

    return {
      success: true,
      message: '拠点が削除されました'
    };
  } catch (error) {
    console.error('Delete satellite error:', error);
    return {
      success: false,
      message: '拠点の削除に失敗しました',
      error: error.message
    };
  }
};

/**
 * 拠点の利用者数を取得
 * @param {number} satelliteId - 拠点ID
 * @returns {Object} 結果オブジェクト
 */
const getSatelliteUserCount = async (satelliteId) => {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        s.max_users,
        COUNT(ua.id) as current_users
      FROM satellites s
      LEFT JOIN user_accounts ua ON s.id = ua.satellite_id AND ua.role = 1 AND ua.status = 1
      WHERE s.id = ?
      GROUP BY s.id
    `, [satelliteId]);

    if (rows.length === 0) {
      return {
        success: false,
        message: '拠点が見つかりません'
      };
    }

    const data = rows[0];
    const availableSlots = data.max_users - data.current_users;

    return {
      success: true,
      data: {
        max_users: data.max_users,
        current_users: data.current_users,
        available_slots: availableSlots,
        is_full: availableSlots <= 0
      }
    };
  } catch (error) {
    console.error('Get satellite user count error:', error);
    return {
      success: false,
      message: '利用者数の取得に失敗しました',
      error: error.message
    };
  }
};

module.exports = {
  getSatellitesByCompany,
  getSatelliteById,
  createSatellite,
  updateSatellite,
  deleteSatellite,
  getSatelliteUserCount
}; 