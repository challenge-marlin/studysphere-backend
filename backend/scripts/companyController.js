const { pool } = require('../utils/database');
const { generateToken } = require('../utils/tokenManager');

/**
 * 企業情報を取得
 */
const getCompanies = async () => {
  let connection;
  try {
    console.log('getCompanies: クエリ実行開始');
    
    connection = await pool.getConnection();
    const [rows] = await connection.execute('SELECT * FROM companies');
    
    console.log('getCompanies: 取得成功, データ件数:', rows.length);
    return {
      success: true,
      data: rows
    };
  } catch (error) {
    console.error('getCompanies: 予期しないエラー:', error);
    return {
      success: false,
      message: '企業一覧の取得に失敗しました',
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
 * 企業情報をIDで取得
 */
const getCompanyById = async (id) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.execute(`
      SELECT 
        id, 
        name, 
        address,
        phone,
        token,
        token_issued_at,
        created_at,
        updated_at
      FROM companies
      WHERE id = ?
    `, [id]);
    
    if (rows.length === 0) {
      return {
        success: false,
        message: '指定された企業が見つかりません',
        error: 'Company not found'
      };
    }
    
    return {
      success: true,
      data: rows[0]
    };
  } catch (error) {
    console.error('企業情報取得エラー:', error);
    return {
      success: false,
      message: '企業情報の取得に失敗しました',
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
 * 企業情報を作成
 * @param {Object} companyData - 企業データ
 * @returns {Object} 作成結果
 */
const createCompany = async (companyData) => {
  const { name, address, phone } = companyData;
  let connection;
  
  try {
    connection = await pool.getConnection();
    
    // トークン生成
    const token = generateToken();
    const tokenIssuedAt = new Date();
    
    const [insertResult] = await connection.execute(`
      INSERT INTO companies (name, address, phone, token, token_issued_at)
      VALUES (?, ?, ?, ?, ?)
    `, [name, address, phone, token, tokenIssuedAt]);

    const companyId = insertResult.insertId;
    
    // 作成された企業情報を取得
    const [rows] = await connection.execute(`
      SELECT id, name, address, phone, token, token_issued_at, created_at, updated_at
      FROM companies
      WHERE id = ?
    `, [companyId]);

    return {
      success: true,
      message: '企業情報が正常に作成されました',
      data: rows[0]
    };
  } catch (error) {
    console.error('企業情報作成エラー:', error);
    return {
      success: false,
      message: '企業情報の作成に失敗しました',
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
 * 企業情報を更新
 */
const updateCompany = async (id, companyData) => {
  const { name, address, phone } = companyData;
  let connection;
  
  try {
    connection = await pool.getConnection();
    
    // 企業の存在確認
    const [existingRows] = await connection.execute(
      'SELECT id FROM companies WHERE id = ?',
      [id]
    );
    
    if (existingRows.length === 0) {
      return {
        success: false,
        message: '指定された企業が見つかりません',
        error: 'Company not found'
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
    
    if (updateFields.length === 0) {
      return {
        success: false,
        message: '更新するデータがありません',
        error: 'No data to update'
      };
    }
    
    updateValues.push(id);
    
    const [updateResult] = await connection.execute(`
      UPDATE companies 
      SET ${updateFields.join(', ')}, updated_at = NOW()
      WHERE id = ?
    `, updateValues);
    
    if (updateResult.affectedRows === 0) {
      return {
        success: false,
        message: '企業情報の更新に失敗しました',
        error: 'Update failed'
      };
    }
    
    // 更新された企業情報を取得
    const [rows] = await connection.execute(`
      SELECT id, name, address, phone, created_at, updated_at
      FROM companies
      WHERE id = ?
    `, [id]);
    
    return {
      success: true,
      message: '企業情報が正常に更新されました',
      data: rows[0]
    };
  } catch (error) {
    console.error('企業情報更新エラー:', error);
    return {
      success: false,
      message: '企業情報の更新に失敗しました',
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
 * 企業情報を削除
 */
const deleteCompany = async (id) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // 企業の存在確認
    const [existingRows] = await connection.execute(
      'SELECT id FROM companies WHERE id = ?',
      [id]
    );

    if (existingRows.length === 0) {
      return {
        success: false,
        message: '企業が見つかりません',
        statusCode: 404
      };
    }

    // 関連するユーザーがいるかチェック
    const [userRows] = await connection.execute(
      'SELECT COUNT(*) as count FROM user_accounts WHERE company_id = ?',
      [id]
    );

    if (userRows[0].count > 0) {
      return {
        success: false,
        message: 'この企業に所属するユーザーが存在するため削除できません',
        statusCode: 400
      };
    }

    await connection.execute('DELETE FROM companies WHERE id = ?', [id]);

    return {
      success: true,
      message: '企業情報が正常に削除されました'
    };
  } catch (error) {
    console.error('企業情報削除エラー:', error);
    return {
      success: false,
      message: '企業情報の削除に失敗しました',
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
 * 企業トークンを再生成
 * @param {number} id - 企業ID
 * @returns {Object} 再生成結果
 */
const regenerateCompanyToken = async (id) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // 企業の存在確認
    const [existingRows] = await connection.execute(
      'SELECT id FROM companies WHERE id = ?',
      [id]
    );
    
    if (existingRows.length === 0) {
      return {
        success: false,
        message: '指定された企業が見つかりません',
        error: 'Company not found'
      };
    }
    
    // 新しいトークンを生成
    const newToken = generateToken();
    const tokenIssuedAt = new Date();
    
    const [updateResult] = await connection.execute(`
      UPDATE companies 
      SET token = ?, token_issued_at = ?, updated_at = NOW()
      WHERE id = ?
    `, [newToken, tokenIssuedAt, id]);
    
    if (updateResult.affectedRows === 0) {
      return {
        success: false,
        message: '企業トークンの再生成に失敗しました',
        error: 'Token regeneration failed'
      };
    }
    
    // 更新された企業情報を取得
    const [rows] = await connection.execute(`
      SELECT id, name, address, phone, token, token_issued_at, created_at, updated_at
      FROM companies
      WHERE id = ?
    `, [id]);
    
    return {
      success: true,
      message: '企業トークンが正常に再生成されました',
      data: rows[0]
    };
  } catch (error) {
    console.error('企業トークン再生成エラー:', error);
    return {
      success: false,
      message: '企業トークンの再生成に失敗しました',
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
  getCompanies,
  getCompanyById,
  createCompany,
  updateCompany,
  deleteCompany,
  regenerateCompanyToken
}; 