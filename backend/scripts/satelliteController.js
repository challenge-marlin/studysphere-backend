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
        s.disabled_course_ids,
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
        s.phone,
        s.office_type_id,
        s.token,
        s.token_issued_at,
        s.token_expiry_at,
        s.contract_type,
        s.max_users,
        s.status,
        s.manager_ids,
        s.disabled_course_ids,
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
        s.phone,
        s.office_type_id,
        s.token,
        s.token_issued_at,
        s.token_expiry_at,
        s.contract_type,
        s.max_users,
        s.status,
        s.manager_ids,
        s.disabled_course_ids,
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
  const { name, address, phone, office_type_id, contract_type, max_users, status, token_expiry_at, disabled_course_ids } = satelliteData;
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
    if (disabled_course_ids !== undefined) {
      let jsonValue = null;
      try {
        if (disabled_course_ids === null) {
          jsonValue = null;
        } else if (Array.isArray(disabled_course_ids)) {
          jsonValue = JSON.stringify(disabled_course_ids);
        } else if (typeof disabled_course_ids === 'string') {
          // 既にJSON文字列が渡ってきた場合
          jsonValue = disabled_course_ids;
        } else {
          jsonValue = JSON.stringify([]);
        }
      } catch (e) {
        return {
          success: false,
          message: 'disabled_course_ids の形式が不正です',
          error: e.message
        };
      }
      updateFields.push('disabled_course_ids = ?');
      updateValues.push(jsonValue);
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
        s.disabled_course_ids,
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

// 無効化コースID一覧を取得
const getSatelliteDisabledCourses = async (id) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.execute('SELECT disabled_course_ids FROM satellites WHERE id = ?', [id]);
    if (rows.length === 0) {
      return { success: false, message: '拠点が見つかりません', statusCode: 404 };
    }
    let ids = [];
    if (rows[0].disabled_course_ids) {
      try {
        ids = Array.isArray(rows[0].disabled_course_ids)
          ? rows[0].disabled_course_ids
          : JSON.parse(rows[0].disabled_course_ids);
      } catch (e) {
        ids = [];
      }
    }
    return { success: true, data: ids };
  } catch (error) {
    return { success: false, message: '無効コースの取得に失敗しました', error: error.message };
  } finally {
    if (connection) {
      try { connection.release(); } catch {}
    }
  }
};

// 無効化コースID一覧を設定
const setSatelliteDisabledCourses = async (id, courseIds) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [exists] = await connection.execute('SELECT id FROM satellites WHERE id = ?', [id]);
    if (exists.length === 0) {
      return { success: false, message: '拠点が見つかりません', statusCode: 404 };
    }
    const jsonValue = JSON.stringify(Array.isArray(courseIds) ? courseIds : []);
    await connection.execute('UPDATE satellites SET disabled_course_ids = ?, updated_at = NOW() WHERE id = ?', [jsonValue, id]);
    return { success: true, message: '無効コース設定を更新しました', data: { disabled_course_ids: JSON.parse(jsonValue) } };
  } catch (error) {
    return { success: false, message: '無効コース設定の更新に失敗しました', error: error.message };
  } finally {
    if (connection) {
      try { connection.release(); } catch {}
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
 * 拠点管理者を設定（既存の管理者情報を保持）
 */
const setSatelliteManagers = async (id, managerIds) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // 拠点の存在確認と現在の管理者情報を取得
    const [existingRows] = await connection.execute(
      'SELECT id, manager_ids FROM satellites WHERE id = ?',
      [id]
    );

    if (existingRows.length === 0) {
      return {
        success: false,
        message: '拠点が見つかりません',
        statusCode: 404
      };
    }

    // 現在の管理者IDを取得
    let currentManagerIds = [];
    if (existingRows[0].manager_ids) {
      try {
        currentManagerIds = JSON.parse(existingRows[0].manager_ids);
        if (!Array.isArray(currentManagerIds)) {
          currentManagerIds = [currentManagerIds];
        }
      } catch (e) {
        console.error('管理者IDのパースエラー:', e);
        currentManagerIds = [];
      }
    }

    console.log(`拠点ID ${id} の現在の管理者IDs:`, currentManagerIds);
    console.log(`設定しようとしている管理者IDs:`, managerIds);
    console.log(`現在の管理者IDsの型:`, typeof currentManagerIds);
    console.log(`設定しようとしている管理者IDsの型:`, typeof managerIds);
    console.log(`現在の管理者IDsが配列か:`, Array.isArray(currentManagerIds));
    console.log(`設定しようとしている管理者IDsが配列か:`, Array.isArray(managerIds));

    // 新しい管理者IDを既存のリストに追加（重複を避ける）
    const updatedManagerIds = [...new Set([...currentManagerIds, ...managerIds])];
    
    console.log(`更新後の管理者IDs:`, updatedManagerIds);
    console.log(`更新後の管理者IDsの型:`, typeof updatedManagerIds);
    console.log(`更新後の管理者IDsが配列か:`, Array.isArray(updatedManagerIds));

    // 管理者IDの配列をJSON形式で保存
    const managerIdsJson = JSON.stringify(updatedManagerIds);

    await connection.execute(`
      UPDATE satellites 
      SET manager_ids = ?, updated_at = NOW()
      WHERE id = ?
    `, [managerIdsJson, id]);

    return {
      success: true,
      message: '拠点管理者が正常に設定されました',
      data: { manager_ids: updatedManagerIds }
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

/**
 * 拠点に管理者を追加
 */
const addSatelliteManager = async (id, managerId) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // 拠点の存在確認
    const [existingRows] = await connection.execute(
      'SELECT id, manager_ids FROM satellites WHERE id = ?',
      [id]
    );

    if (existingRows.length === 0) {
      return {
        success: false,
        message: '拠点が見つかりません',
        statusCode: 404
      };
    }

    // 現在の管理者IDを取得
    let currentManagerIds = [];
    if (existingRows[0].manager_ids) {
      try {
        currentManagerIds = JSON.parse(existingRows[0].manager_ids);
        if (!Array.isArray(currentManagerIds)) {
          currentManagerIds = [currentManagerIds];
        }
      } catch (e) {
        console.error('管理者IDのパースエラー:', e);
        currentManagerIds = [];
      }
    }

    // 既に管理者として設定されているかチェック
    if (currentManagerIds.includes(managerId)) {
      return {
        success: true,
        message: '既に管理者として設定されています',
        data: { manager_ids: currentManagerIds }
      };
    }

    // 新しい管理者IDを追加
    currentManagerIds.push(managerId);
    const managerIdsJson = JSON.stringify(currentManagerIds);

    await connection.execute(`
      UPDATE satellites 
      SET manager_ids = ?, updated_at = NOW()
      WHERE id = ?
    `, [managerIdsJson, id]);

    return {
      success: true,
      message: '拠点管理者が正常に追加されました',
      data: { manager_ids: currentManagerIds }
    };
  } catch (error) {
    console.error('拠点管理者追加エラー:', error);
    return {
      success: false,
      message: '拠点管理者の追加に失敗しました',
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
 * 拠点管理者一覧を取得
 */
const getSatelliteManagers = async (id) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // 拠点の存在確認と管理者情報を取得
    const [existingRows] = await connection.execute(
      'SELECT id, manager_ids FROM satellites WHERE id = ?',
      [id]
    );

    if (existingRows.length === 0) {
      return {
        success: false,
        message: '拠点が見つかりません',
        statusCode: 404
      };
    }

    // 管理者IDを取得
    let managerIds = [];
    if (existingRows[0].manager_ids) {
      try {
        const parsed = JSON.parse(existingRows[0].manager_ids);
        // 配列の場合はそのまま、数値の場合は配列に変換
        managerIds = Array.isArray(parsed) ? parsed : [parsed];
      } catch (e) {
        console.error('管理者IDのパースエラー:', e);
        managerIds = [];
      }
    }

    console.log(`拠点ID ${id} の管理者IDs:`, managerIds);

    return {
      success: true,
      data: { manager_ids: managerIds }
    };
  } catch (error) {
    console.error('拠点管理者取得エラー:', error);
    return {
      success: false,
      message: '拠点管理者の取得に失敗しました',
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
 * 拠点から管理者を削除
 */
const removeSatelliteManager = async (id, managerId) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // 拠点の存在確認
    const [existingRows] = await connection.execute(
      'SELECT id, manager_ids FROM satellites WHERE id = ?',
      [id]
    );

    if (existingRows.length === 0) {
      return {
        success: false,
        message: '拠点が見つかりません',
        statusCode: 404
      };
    }

    // 現在の管理者IDを取得
    let currentManagerIds = [];
    if (existingRows[0].manager_ids) {
      try {
        const parsed = JSON.parse(existingRows[0].manager_ids);
        // 配列の場合はそのまま、数値の場合は配列に変換
        currentManagerIds = Array.isArray(parsed) ? parsed : [parsed];
      } catch (e) {
        console.error('管理者IDのパースエラー:', e);
        currentManagerIds = [];
      }
    }

    console.log(`拠点ID ${id} の現在の管理者IDs:`, currentManagerIds);
    console.log(`削除しようとしている管理者ID:`, managerId);

    // IDの型を統一（数値として比較）
    const managerIdNum = Number(managerId);
    const currentManagerIdsNum = currentManagerIds.map(id => Number(id));

    // 管理者として設定されているかチェック
    if (!currentManagerIdsNum.includes(managerIdNum)) {
      return {
        success: true,
        message: '既に管理者権限が解除されています',
        data: { manager_ids: currentManagerIds }
      };
    }

    // 管理者IDを削除
    const updatedManagerIds = currentManagerIdsNum.filter(id => id !== managerIdNum);
    const managerIdsJson = JSON.stringify(updatedManagerIds);

    console.log(`更新後の管理者IDs:`, updatedManagerIds);

    await connection.execute(`
      UPDATE satellites 
      SET manager_ids = ?, updated_at = NOW()
      WHERE id = ?
    `, [managerIdsJson, id]);

    return {
      success: true,
      message: '拠点管理者が正常に削除されました',
      data: { manager_ids: updatedManagerIds }
    };
  } catch (error) {
    console.error('拠点管理者削除エラー:', error);
    return {
      success: false,
      message: '拠点管理者の削除に失敗しました',
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
  getSatelliteManagers,
  setSatelliteManagers,
  addSatelliteManager,
  removeSatelliteManager,
  getSatelliteDisabledCourses,
  setSatelliteDisabledCourses
}; 