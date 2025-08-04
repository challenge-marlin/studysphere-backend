const { pool } = require('../utils/database');
const bcrypt = require('bcryptjs');
const { customLogger } = require('../utils/logger');

// 管理者一覧取得
const getAdmins = async (includeDeleted = false) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    let query = `
      SELECT 
        ua.id,
        ua.name,
        ua.email,
        ua.role,
        ua.status,
        ua.login_code,
        ua.company_id,
        ac.username,
        COALESCE(c.name, 'システム管理者') as company_name
      FROM user_accounts ua
      LEFT JOIN admin_credentials ac ON ua.id = ac.user_id
      LEFT JOIN companies c ON ua.company_id = c.id
      WHERE ua.role >= 9
    `;
    
    // 削除済みを含めるかどうかの条件を追加
    if (!includeDeleted) {
      query += ` AND ua.status = 1`;
    }
    
    query += ` ORDER BY ua.id DESC`;
    
    const [rows] = await connection.execute(query);

    return {
      success: true,
      data: {
                 admins: rows.map(row => ({
           id: row.id,
           name: row.name,
           email: row.email || '',
           username: row.username,
           role: row.role,
           status: row.status === 1 ? 'active' : 'inactive',
           login_code: row.login_code,
           company_id: row.company_id,
           company_name: row.company_name,
           isDeleted: row.status === 0
         }))
      }
    };
  } catch (error) {
    console.error('管理者一覧取得エラー:', error);
    return {
      success: false,
      message: '管理者一覧の取得に失敗しました',
      error: error.message
    };
  } finally {
    if (connection) connection.release();
  }
};

// 管理者作成
const createAdmin = async (adminData) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // パスワードのハッシュ化
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(adminData.password, saltRounds);

    // ログインコードの生成
    const generateLoginCode = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let result = '';
      for (let i = 0; i < 4; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      result += '-';
      for (let i = 0; i < 4; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      result += '-';
      for (let i = 0; i < 4; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };

    const loginCode = generateLoginCode();

         // ユーザーアカウントを作成
     const [userResult] = await connection.execute(`
       INSERT INTO user_accounts (name, email, role, status, login_code, company_id)
       VALUES (?, ?, ?, ?, ?, ?)
     `, [
       adminData.name,
       adminData.email,
       adminData.role || 9,
       adminData.status === 'active' ? 1 : 0,
       loginCode,
       adminData.company_id || null
     ]);

    const userId = userResult.insertId;

    // 管理者認証情報を作成
    await connection.execute(`
      INSERT INTO admin_credentials (user_id, username, password_hash)
      VALUES (?, ?, ?)
    `, [userId, adminData.username, hashedPassword]);

    await connection.commit();

         // 作成された管理者情報を取得
     const [newAdmin] = await connection.execute(`
       SELECT 
         ua.id,
         ua.name,
         ua.email,
         ua.role,
         ua.status,
         ua.login_code,
         ua.company_id,
         ac.username,
         COALESCE(c.name, 'システム管理者') as company_name
       FROM user_accounts ua
       LEFT JOIN admin_credentials ac ON ua.id = ac.user_id
       LEFT JOIN companies c ON ua.company_id = c.id
       WHERE ua.id = ?
     `, [userId]);

    return {
      success: true,
      message: '管理者が正常に作成されました',
      data: {
                 admin: {
           id: newAdmin[0].id,
           name: newAdmin[0].name,
           email: newAdmin[0].email,
           username: newAdmin[0].username,
           role: newAdmin[0].role,
           status: newAdmin[0].status === 1 ? 'active' : 'inactive',
           login_code: newAdmin[0].login_code,
           company_id: newAdmin[0].company_id,
           company_name: newAdmin[0].company_name
         }
      }
    };
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('管理者作成エラー:', error);
    return {
      success: false,
      message: '管理者の作成に失敗しました',
      error: error.message
    };
  } finally {
    if (connection) connection.release();
  }
};

// 管理者更新
const updateAdmin = async (adminId, updateData) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 更新するフィールドを準備
    const updateFields = [];
    const updateValues = [];

    if (updateData.name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(updateData.name);
    }
    if (updateData.email !== undefined) {
      updateFields.push('email = ?');
      updateValues.push(updateData.email);
    }
    if (updateData.role !== undefined) {
      updateFields.push('role = ?');
      updateValues.push(updateData.role);
    }
    if (updateData.status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(updateData.status === 'active' ? 1 : 0);
    }
    if (updateData.company_id !== undefined) {
      updateFields.push('company_id = ?');
      updateValues.push(updateData.company_id);
    }

         updateValues.push(adminId);

         // ユーザーアカウントを更新
     if (updateFields.length > 0) {
       await connection.execute(`
         UPDATE user_accounts 
         SET ${updateFields.join(', ')}
         WHERE id = ?
       `, updateValues);
     }

    // パスワードが提供された場合、認証情報も更新
    if (updateData.password) {
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(updateData.password, saltRounds);
      
      await connection.execute(`
        UPDATE admin_credentials 
        SET password_hash = ?
        WHERE user_id = ?
      `, [hashedPassword, adminId]);
    }

    // ユーザー名が提供された場合、認証情報も更新
    if (updateData.username) {
      await connection.execute(`
        UPDATE admin_credentials 
        SET username = ?
        WHERE user_id = ?
      `, [updateData.username, adminId]);
    }

    await connection.commit();

    return {
      success: true,
      message: '管理者情報が正常に更新されました'
    };
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('管理者更新エラー:', error);
    return {
      success: false,
      message: '管理者の更新に失敗しました',
      error: error.message
    };
  } finally {
    if (connection) connection.release();
  }
};

// 管理者削除（論理削除）
const deleteAdmin = async (adminId) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

         // ステータスを無効化（論理削除）
     await connection.execute(`
       UPDATE user_accounts 
       SET status = 0
       WHERE id = ?
     `, [adminId]);

    await connection.commit();

    return {
      success: true,
      message: '管理者が正常に削除されました'
    };
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('管理者削除エラー:', error);
    return {
      success: false,
      message: '管理者の削除に失敗しました',
      error: error.message
    };
  } finally {
    if (connection) connection.release();
  }
};

// 管理者復元
const restoreAdmin = async (adminId) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // ステータスを有効化
    await connection.execute(`
      UPDATE user_accounts 
      SET status = 1
      WHERE id = ?
    `, [adminId]);

    await connection.commit();

    return {
      success: true,
      message: '管理者が正常に復元されました'
    };
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('管理者復元エラー:', error);
    return {
      success: false,
      message: '管理者の復元に失敗しました',
      error: error.message
    };
  } finally {
    if (connection) connection.release();
  }
};

// 管理者物理削除
const permanentlyDeleteAdmin = async (adminId) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 管理者認証情報を削除
    await connection.execute(`
      DELETE FROM admin_credentials 
      WHERE user_id = ?
    `, [adminId]);

    // ユーザーアカウントを削除
    await connection.execute(`
      DELETE FROM user_accounts 
      WHERE id = ?
    `, [adminId]);

    await connection.commit();

    return {
      success: true,
      message: '管理者が完全に削除されました'
    };
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('管理者物理削除エラー:', error);
    return {
      success: false,
      message: '管理者の完全削除に失敗しました',
      error: error.message
    };
  } finally {
    if (connection) connection.release();
  }
};

module.exports = {
  getAdmins,
  createAdmin,
  updateAdmin,
  deleteAdmin,
  restoreAdmin,
  permanentlyDeleteAdmin
}; 