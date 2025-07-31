const { pool } = require('../utils/database');

/**
 * 事業所タイプ一覧を取得
 */
const getOfficeTypes = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.execute(`
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
 * 事業所タイプを作成
 */
const createOfficeType = async (typeData) => {
  const { type } = typeData;
  let connection;
  
  try {
    connection = await pool.getConnection();
    
    // 既存のタイプ名との重複チェック
    const [existingRows] = await connection.execute(
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

    // 新しい事業所タイプを作成
    const [insertResult] = await connection.execute(`
      INSERT INTO office_types (type)
      VALUES (?)
    `, [type]);

    const typeId = insertResult.insertId;
    
    // 作成された事業所タイプを取得
    const [rows] = await connection.execute(`
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
 * 事業所タイプを削除
 */
const deleteOfficeType = async (id) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // 事業所タイプの存在確認
    const [existingRows] = await connection.execute(
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

    // このタイプを使用している拠点がいるかチェック
    const [satelliteRows] = await connection.execute(
      'SELECT COUNT(*) as count FROM satellites WHERE office_type_id = ?',
      [id]
    );

    if (satelliteRows[0].count > 0) {
      return {
        success: false,
        message: 'この事業所タイプを使用している拠点が存在するため削除できません',
        statusCode: 400
      };
    }

    // 事業所タイプを削除
    await connection.execute('DELETE FROM office_types WHERE id = ?', [id]);

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
  getOfficeTypes,
  createOfficeType,
  deleteOfficeType
}; 