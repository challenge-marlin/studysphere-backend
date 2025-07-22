const { pool } = require('../utils/database');

/**
 * 企業情報を取得
 */
const getCompanies = async () => {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        c.id, 
        c.name, 
        c.address, 
        c.phone, 
        c.office_type_id,
        ot.type as office_type_name,
        c.token_issued_at, 
        c.token_expiry_at,
        u.name as contact_person_name,
        u.role as contact_person_role
      FROM companies c
      LEFT JOIN office_types ot ON c.office_type_id = ot.id
      LEFT JOIN (
        SELECT 
          ua.company_id,
          ua.name,
          ua.role,
          ROW_NUMBER() OVER (PARTITION BY ua.company_id ORDER BY ua.role DESC, ua.id ASC) as rn
        FROM user_accounts ua
        WHERE ua.company_id IS NOT NULL
      ) u ON c.id = u.company_id AND u.rn = 1
      ORDER BY c.id
    `);

    return {
      success: true,
      data: rows
    };
  } catch (error) {
    console.error('企業情報取得エラー:', error);
    return {
      success: false,
      message: '企業情報の取得に失敗しました',
      error: error.message
    };
  }
};

/**
 * 企業情報をIDで取得
 */
const getCompanyById = async (id) => {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        c.id, 
        c.name, 
        c.address, 
        c.phone, 
        c.office_type_id,
        ot.type as office_type_name,
        c.token_issued_at, 
        c.token_expiry_at,
        u.name as contact_person_name,
        u.role as contact_person_role
      FROM companies c
      LEFT JOIN office_types ot ON c.office_type_id = ot.id
      LEFT JOIN (
        SELECT 
          ua.company_id,
          ua.name,
          ua.role,
          ROW_NUMBER() OVER (PARTITION BY ua.company_id ORDER BY ua.role DESC, ua.id ASC) as rn
        FROM user_accounts ua
        WHERE ua.company_id IS NOT NULL
      ) u ON c.id = u.company_id AND u.rn = 1
      WHERE c.id = ?
    `, [id]);

    if (rows.length === 0) {
      return {
        success: false,
        message: '企業が見つかりません',
        statusCode: 404
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
  }
};

/**
 * 企業情報を作成
 */
const createCompany = async (companyData) => {
  const { name, address, phone, office_type_id } = companyData;
  
  try {
    const [result] = await pool.execute(`
      INSERT INTO companies (name, address, phone, office_type_id, token_issued_at, token_expiry_at)
      VALUES (?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 1 YEAR))
    `, [name, address, phone, office_type_id]);

    const companyId = result.insertId;
    
    // 作成された企業情報を取得
    const [rows] = await pool.execute(`
      SELECT 
        c.id, 
        c.name, 
        c.address, 
        c.phone, 
        c.office_type_id,
        ot.type as office_type_name,
        c.token_issued_at, 
        c.token_expiry_at,
        u.name as contact_person_name,
        u.role as contact_person_role
      FROM companies c
      LEFT JOIN office_types ot ON c.office_type_id = ot.id
      LEFT JOIN (
        SELECT 
          ua.company_id,
          ua.name,
          ua.role,
          ROW_NUMBER() OVER (PARTITION BY ua.company_id ORDER BY ua.role DESC, ua.id ASC) as rn
        FROM user_accounts ua
        WHERE ua.company_id IS NOT NULL
      ) u ON c.id = u.company_id AND u.rn = 1
      WHERE c.id = ?
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
  }
};

/**
 * 企業情報を更新
 */
const updateCompany = async (id, companyData) => {
  const { name, address, phone, office_type_id } = companyData;
  
  console.log('受信した企業更新データ:', { id, name, address, phone, office_type_id });
  
  try {
    // 企業の存在確認
    const [existingRows] = await pool.execute(
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

    // 更新用のSQLを動的に構築
    const updateFields = [];
    const updateValues = [];

    if (name !== undefined && name !== null && name !== '') {
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
      updateFields.push('office_type_id = ?');
      updateValues.push(office_type_id);
    }

    if (updateFields.length === 0) {
      return {
        success: false,
        message: '更新するデータが指定されていません'
      };
    }

    updateValues.push(id);
    
    await pool.execute(`
      UPDATE companies 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `, updateValues);

    // 更新された企業情報を取得
    const [rows] = await pool.execute(`
      SELECT 
        c.id, 
        c.name, 
        c.address, 
        c.phone, 
        c.office_type_id,
        ot.type as office_type_name,
        c.token_issued_at, 
        c.token_expiry_at,
        u.name as contact_person_name,
        u.role as contact_person_role
      FROM companies c
      LEFT JOIN office_types ot ON c.office_type_id = ot.id
      LEFT JOIN (
        SELECT 
          ua.company_id,
          ua.name,
          ua.role,
          ROW_NUMBER() OVER (PARTITION BY ua.company_id ORDER BY ua.role DESC, ua.id ASC) as rn
        FROM user_accounts ua
        WHERE ua.company_id IS NOT NULL
      ) u ON c.id = u.company_id AND u.rn = 1
      WHERE c.id = ?
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
  }
};

/**
 * 企業情報を削除
 */
const deleteCompany = async (id) => {
  try {
    // 企業の存在確認
    const [existingRows] = await pool.execute(
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
    const [userRows] = await pool.execute(
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

    await pool.execute('DELETE FROM companies WHERE id = ?', [id]);

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
  }
};

module.exports = {
  getCompanies,
  getCompanyById,
  createCompany,
  updateCompany,
  deleteCompany
}; 