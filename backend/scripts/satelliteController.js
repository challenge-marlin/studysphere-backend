const { pool } = require('../utils/database');
const { generateToken, calculateExpiryDate } = require('../utils/tokenManager');

/**
 * 拠点情報を取得
 */
const getSatellites = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.execute(`
      SELECT 
        s.id,
        s.company_id,
        s.name,
        s.address,
        s.phone,
        s.office_type_id,
        s.token,
        s.token_issued_at,
        s.token_expiry_at,
        s.contract_type,
        s.max_users,
        s.status,
        s.manager_ids,
        s.created_at,
        s.updated_at,
        c.name as company_name,
        ot.type as office_type_name
      FROM satellites s
      LEFT JOIN companies c ON s.company_id = c.id
      LEFT JOIN office_types ot ON s.office_type_id = ot.id
      ORDER BY s.created_at DESC
    `);
    
    return {
      success: true,
      data: rows
    };
  } catch (error) {
    console.error('拠点一覧取得エラー:', error);
    return {
      success: false,
      message: '拠点一覧の取得に失敗しました',
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
 * 拠点情報をIDで取得
 */
const getSatelliteById = async (id) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.execute(`
      SELECT 
        s.id,
        s.company_id,
        s.name,
        s.address,
        s.office_type_id,
        s.token,
        s.token_issued_at,
        s.token_expiry_at,
        s.contract_type,
        s.max_users,
        s.status,
        s.manager_ids,
        s.created_at,
        s.updated_at,
        c.name as company_name,
        ot.type as office_type_name
      FROM satellites s
      LEFT JOIN companies c ON s.company_id = c.id
      LEFT JOIN office_types ot ON s.office_type_id = ot.id
      WHERE s.id = ?
    `, [id]);
    
    if (rows.length === 0) {
      return {
        success: false,
        message: '指定された拠点が見つかりません',
        error: 'Satellite not found'
      };
    }
    
    return {
      success: true,
      data: rows[0]
    };
  } catch (error) {
    console.error('拠点情報取得エラー:', error);
    return {
      success: false,
      message: '拠点情報の取得に失敗しました',
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
 * 複数の拠点情報をIDで取得
 */
const getSatellitesByIds = async (ids) => {
  let connection;
  try {
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return {
        success: true,
        data: []
      };
    }

    connection = await pool.getConnection();
    
    // IDを数値に変換してデバッグログを追加
    const numericIds = ids.map(id => Number(id));
    console.log('getSatellitesByIds 呼び出し:', { originalIds: ids, numericIds });
    
    // データベース内の全拠点IDを確認
    const [allSatellites] = await connection.execute('SELECT id, name FROM satellites ORDER BY id');
    console.log('データベース内の全拠点:', allSatellites);
    
    const placeholders = numericIds.map(() => '?').join(',');
    const [rows] = await connection.execute(`
      SELECT 
        s.id,
        s.company_id,
        s.name,
        s.address,
        s.office_type_id,
        s.token,
        s.token_issued_at,
        s.token_expiry_at,
        s.contract_type,
        s.max_users,
        s.status,
        s.manager_ids,
        s.created_at,
        s.updated_at,
        c.name as company_name,
        ot.type as office_type_name
      FROM satellites s
      LEFT JOIN companies c ON s.company_id = c.id
      LEFT JOIN office_types ot ON s.office_type_id = ot.id
      WHERE s.id IN (${placeholders})
      ORDER BY s.id
    `, numericIds);
    
    console.log('getSatellitesByIds 結果:', { foundCount: rows.length, data: rows });
    
    return {
      success: true,
      data: rows
    };
  } catch (error) {
    console.error('複数拠点情報取得エラー:', error);
    console.error('エラー詳細:', { ids, errorMessage: error.message, errorStack: error.stack });
    return {
      success: false,
      message: '拠点情報の取得に失敗しました',
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
 * 拠点情報を作成
 */
const createSatellite = async (satelliteData) => {
  const { company_id, name, address, phone, office_type_id, contract_type, max_users } = satelliteData;
  let connection;
  
  try {
    connection = await pool.getConnection();
    
    // トークン生成
    const token = generateToken();
    const tokenIssuedAt = new Date();
    const tokenExpiryAt = calculateExpiryDate(contract_type || '30days');
    
    // 日本時間として保存するため、UTCに変換
    const utcExpiryAt = new Date(tokenExpiryAt.getTime() - (9 * 60 * 60 * 1000)); // JSTからUTCに変換（-9時間）
    
    let officeTypeId = office_type_id;
    
    // office_type_idが文字列の場合、IDを取得
    if (office_type_id && typeof office_type_id === 'string' && isNaN(Number(office_type_id))) {
      const [typeRows] = await connection.execute(
        'SELECT id FROM office_types WHERE type = ?',
        [office_type_id]
      );
      
      if (typeRows.length === 0) {
        return {
          success: false,
          message: '指定された事業所タイプが見つかりません',
          error: 'Invalid office type'
        };
      }
      
      officeTypeId = typeRows[0].id;
    }
    
    const [result] = await connection.execute(`
      INSERT INTO satellites (company_id, name, address, phone, office_type_id, token, token_issued_at, token_expiry_at, contract_type, max_users)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [company_id, name, address, phone, officeTypeId, token, tokenIssuedAt, utcExpiryAt, contract_type || '30days', max_users || 10]);

    const satelliteId = result.insertId;
    
    // 作成された拠点情報を取得
    const [rows] = await connection.execute(`
      SELECT 
        s.id,
        s.company_id,
        s.name,
        s.address,
        s.phone,
        s.office_type_id,
        s.token,
        s.token_issued_at,
        s.token_expiry_at,
        s.contract_type,
        s.max_users,
        s.status,
        s.manager_ids,
        s.created_at,
        s.updated_at,
        c.name as company_name,
        ot.type as office_type_name
      FROM satellites s
      LEFT JOIN companies c ON s.company_id = c.id
      LEFT JOIN office_types ot ON s.office_type_id = ot.id
      WHERE s.id = ?
    `, [satelliteId]);

    return {
      success: true,
      message: '拠点情報が正常に作成されました',
      data: rows[0]
    };
  } catch (error) {
    console.error('拠点情報作成エラー:', error);
    return {
      success: false,
      message: '拠点情報の作成に失敗しました',
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
 * 拠点情報を更新
 */
const updateSatellite = async (id, satelliteData) => {
  const { name, address, phone, office_type_id, contract_type, max_users, status, token_expiry_at } = satelliteData;
  let connection;
  
  try {
    connection = await pool.getConnection();
    
    // 拠点の存在確認
    const [existingRows] = await connection.execute(
      'SELECT id FROM satellites WHERE id = ?',
      [id]
    );
    
    if (existingRows.length === 0) {
      return {
        success: false,
        message: '指定された拠点が見つかりません',
        error: 'Satellite not found'
      };
    }
    
    // 更新フィールドを動的に構築
    const updateFields = [];
    const updateValues = [];
    
    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    if (address !== undefined) {
      updateFields.push('address = ?');
      updateValues.push(address);
    }
    if (phone !== undefined) {
      updateFields.push('phone = ?');
      updateValues.push(phone);
    }
    if (office_type_id !== undefined) {
      let officeTypeId = office_type_id;
      
      // office_type_idが文字列の場合、IDを取得
      if (office_type_id && typeof office_type_id === 'string' && isNaN(Number(office_type_id))) {
        const [typeRows] = await connection.execute(
          'SELECT id FROM office_types WHERE type = ?',
          [office_type_id]
        );
        
        if (typeRows.length === 0) {
          return {
            success: false,
            message: '指定された事業所タイプが見つかりません',
            error: 'Invalid office type'
          };
        }
        
        officeTypeId = typeRows[0].id;
      }
      
      updateFields.push('office_type_id = ?');
      updateValues.push(officeTypeId);
    }
    if (contract_type !== undefined) {
      updateFields.push('contract_type = ?');
      updateValues.push(contract_type);
    }
    if (max_users !== undefined) {
      updateFields.push('max_users = ?');
      updateValues.push(max_users);
    }
    if (status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(status);
    }
    if (token_expiry_at !== undefined) {
      // 日本時間として保存するため、UTCに変換
      const japanDate = new Date(token_expiry_at);
      const utcDate = new Date(japanDate.getTime() - (9 * 60 * 60 * 1000)); // JSTからUTCに変換（-9時間）
      updateFields.push('token_expiry_at = ?');
      updateValues.push(utcDate.toISOString().slice(0, 19).replace('T', ' '));
    }
    
    if (updateFields.length === 0) {
      return {
        success: false,
        message: '更新するデータがありません',
        error: 'No data to update'
      };
    }
    
    updateValues.push(id);
    
    const [result] = await connection.execute(`
      UPDATE satellites 
      SET ${updateFields.join(', ')}, updated_at = NOW()
      WHERE id = ?
    `, updateValues);
    
    if (result.affectedRows === 0) {
      return {
        success: false,
        message: '拠点情報の更新に失敗しました',
        error: 'Update failed'
      };
    }
    
    // 更新された拠点情報を取得
    const [rows] = await connection.execute(`
      SELECT 
        s.id,
        s.company_id,
        s.name,
        s.address,
        s.phone,
        s.office_type_id,
        s.token,
        s.token_issued_at,
        s.token_expiry_at,
        s.contract_type,
        s.max_users,
        s.status,
        s.manager_ids,
        s.created_at,
        s.updated_at,
        c.name as company_name,
        ot.type as office_type_name
      FROM satellites s
      LEFT JOIN companies c ON s.company_id = c.id
      LEFT JOIN office_types ot ON s.office_type_id = ot.id
      WHERE s.id = ?
    `, [id]);
    
    return {
      success: true,
      message: '拠点情報が正常に更新されました',
      data: rows[0]
    };
  } catch (error) {
    console.error('拠点情報更新エラー:', error);
    return {
      success: false,
      message: '拠点情報の更新に失敗しました',
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
 * 拠点情報を削除
 */
const deleteSatellite = async (id) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // 拠点の存在確認
    const [existingRows] = await connection.execute(
      'SELECT id FROM satellites WHERE id = ?',
      [id]
    );

    if (existingRows.length === 0) {
      return {
        success: false,
        message: '拠点が見つかりません',
        statusCode: 404
      };
    }

    // 関連するユーザーがいるかチェック
    const [userRows] = await connection.execute(
      'SELECT COUNT(*) as count FROM user_accounts WHERE satellite_id = ?',
      [id]
    );

    if (userRows[0].count > 0) {
      return {
        success: false,
        message: 'この拠点に所属するユーザーが存在するため削除できません',
        statusCode: 400
      };
    }

    await connection.execute('DELETE FROM satellites WHERE id = ?', [id]);

    return {
      success: true,
      message: '拠点情報が正常に削除されました'
    };
  } catch (error) {
    console.error('拠点情報削除エラー:', error);
    return {
      success: false,
      message: '拠点情報の削除に失敗しました',
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
 * トークンを再生成
 */
const regenerateToken = async (id, contract_type) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // 拠点の存在確認
    const [existingRows] = await connection.execute(
      'SELECT id FROM satellites WHERE id = ?',
      [id]
    );

    if (existingRows.length === 0) {
      return {
        success: false,
        message: '拠点が見つかりません',
        statusCode: 404
      };
    }

    // 新しいトークンを生成
    const token = generateToken();
    const tokenIssuedAt = new Date();
    const tokenExpiryAt = calculateExpiryDate(contract_type || '30days');

    await connection.execute(`
      UPDATE satellites 
      SET token = ?, token_issued_at = ?, token_expiry_at = ?, contract_type = ?
      WHERE id = ?
    `, [token, tokenIssuedAt, tokenExpiryAt, contract_type || '30days', id]);

    return {
      success: true,
      message: 'トークンが正常に再生成されました',
      data: { token, token_issued_at: tokenIssuedAt, token_expiry_at: tokenExpiryAt }
    };
  } catch (error) {
    console.error('トークン再生成エラー:', error);
    return {
      success: false,
      message: 'トークンの再生成に失敗しました',
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
 * 拠点管理者を設定
 */
const setSatelliteManagers = async (id, managerIds) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // 拠点の存在確認
    const [existingRows] = await connection.execute(
      'SELECT id FROM satellites WHERE id = ?',
      [id]
    );

    if (existingRows.length === 0) {
      return {
        success: false,
        message: '拠点が見つかりません',
        statusCode: 404
      };
    }

    // 管理者IDの配列をJSON形式で保存
    const managerIdsJson = JSON.stringify(managerIds);

    await connection.execute(`
      UPDATE satellites 
      SET manager_ids = ?, updated_at = NOW()
      WHERE id = ?
    `, [managerIdsJson, id]);

    return {
      success: true,
      message: '拠点管理者が正常に設定されました',
      data: { manager_ids: managerIds }
    };
  } catch (error) {
    console.error('拠点管理者設定エラー:', error);
    return {
      success: false,
      message: '拠点管理者の設定に失敗しました',
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
  getSatellites,
  getSatelliteById,
  getSatellitesByIds,
  createSatellite,
  updateSatellite,
  deleteSatellite,
  regenerateToken,
  setSatelliteManagers
}; 