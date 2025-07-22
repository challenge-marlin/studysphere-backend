const { pool } = require('../utils/database');

/**
 * 事業所タイプ一覧を取得
 */
const getOfficeTypes = async () => {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        id,
        type,
        created_at
      FROM office_types
      ORDER BY id
    `);

    return {
      success: true,
      data: rows
    };
  } catch (error) {
    console.error('事業所タイプ取得エラー:', error);
    return {
      success: false,
      message: '事業所タイプの取得に失敗しました',
      error: error.message
    };
  }
};

/**
 * 事業所タイプを作成
 */
const createOfficeType = async (typeData) => {
  const { type } = typeData;
  
  try {
    // 既存のタイプ名との重複チェック
    const [existingRows] = await pool.execute(
      'SELECT id FROM office_types WHERE type = ?',
      [type]
    );

    if (existingRows.length > 0) {
      return {
        success: false,
        message: '同じ名前の事業所タイプが既に存在します',
        statusCode: 400
      };
    }

    const [result] = await pool.execute(`
      INSERT INTO office_types (type)
      VALUES (?)
    `, [type]);

    const typeId = result.insertId;
    
    // 作成された事業所タイプを取得
    const [rows] = await pool.execute(`
      SELECT 
        id,
        type,
        created_at
      FROM office_types
      WHERE id = ?
    `, [typeId]);

    return {
      success: true,
      message: '事業所タイプが正常に作成されました',
      data: rows[0]
    };
  } catch (error) {
    console.error('事業所タイプ作成エラー:', error);
    return {
      success: false,
      message: '事業所タイプの作成に失敗しました',
      error: error.message
    };
  }
};

/**
 * 事業所タイプを削除
 */
const deleteOfficeType = async (id) => {
  try {
    // 事業所タイプの存在確認
    const [existingRows] = await pool.execute(
      'SELECT id FROM office_types WHERE id = ?',
      [id]
    );

    if (existingRows.length === 0) {
      return {
        success: false,
        message: '事業所タイプが見つかりません',
        statusCode: 404
      };
    }

    // このタイプを使用している企業がいるかチェック
    const [companyRows] = await pool.execute(
      'SELECT COUNT(*) as count FROM companies WHERE office_type_id = ?',
      [id]
    );

    if (companyRows[0].count > 0) {
      return {
        success: false,
        message: 'この事業所タイプを使用している企業が存在するため削除できません',
        statusCode: 400
      };
    }

    await pool.execute('DELETE FROM office_types WHERE id = ?', [id]);

    return {
      success: true,
      message: '事業所タイプが正常に削除されました'
    };
  } catch (error) {
    console.error('事業所タイプ削除エラー:', error);
    return {
      success: false,
      message: '事業所タイプの削除に失敗しました',
      error: error.message
    };
  }
};

module.exports = {
  getOfficeTypes,
  createOfficeType,
  deleteOfficeType
}; 