const { pool } = require('../utils/database');

/**
 * 指導者の専門分野一覧を取得
 */
const getInstructorSpecializations = async (userId) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.execute(`
      SELECT 
        id,
        user_id,
        specialization,
        created_at,
        updated_at
      FROM instructor_specializations
      WHERE user_id = ?
      ORDER BY created_at DESC
    `, [userId]);
    
    return {
      success: true,
      data: rows
    };
  } catch (error) {
    console.error('指導者専門分野取得エラー:', error);
    return {
      success: false,
      message: '指導者専門分野の取得に失敗しました',
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
 * 指導者専門分野を追加
 */
const addInstructorSpecialization = async (userId, specialization) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // 既存の専門分野との重複チェック
    const [existingRows] = await connection.execute(`
      SELECT id FROM instructor_specializations 
      WHERE user_id = ? AND specialization = ?
    `, [userId, specialization]);
    
    if (existingRows.length > 0) {
      return {
        success: false,
        message: 'この専門分野は既に登録されています',
        error: 'Duplicate specialization'
      };
    }
    
    const [result] = await connection.execute(`
      INSERT INTO instructor_specializations (user_id, specialization)
      VALUES (?, ?)
    `, [userId, specialization]);
    
    const specializationId = result.insertId;
    
    // 追加された専門分野を取得
    const [rows] = await connection.execute(`
      SELECT 
        id,
        user_id,
        specialization,
        created_at,
        updated_at
      FROM instructor_specializations
      WHERE id = ?
    `, [specializationId]);
    
    return {
      success: true,
      message: '専門分野が正常に追加されました',
      data: rows[0]
    };
  } catch (error) {
    console.error('指導者専門分野追加エラー:', error);
    return {
      success: false,
      message: '専門分野の追加に失敗しました',
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
 * 指導者専門分野を一括設定
 */
const setInstructorSpecializations = async (userId, specializations) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // トランザクション開始
    await connection.beginTransaction();
    
    // 既存の専門分野を削除
    await connection.execute(`
      DELETE FROM instructor_specializations 
      WHERE user_id = ?
    `, [userId]);
    
    // 新しい専門分野を追加
    if (specializations && specializations.length > 0) {
      for (const specialization of specializations) {
        if (specialization.trim()) {
          await connection.execute(`
            INSERT INTO instructor_specializations (user_id, specialization)
            VALUES (?, ?)
          `, [userId, specialization.trim()]);
        }
      }
    }
    
    // トランザクションコミット
    await connection.commit();
    
    // 更新された専門分野一覧を取得
    const [rows] = await connection.execute(`
      SELECT 
        id,
        user_id,
        specialization,
        created_at,
        updated_at
      FROM instructor_specializations
      WHERE user_id = ?
      ORDER BY created_at DESC
    `, [userId]);
    
    return {
      success: true,
      message: '専門分野が正常に設定されました',
      data: rows
    };
  } catch (error) {
    // エラー時はロールバック
    if (connection) {
      await connection.rollback();
    }
    console.error('指導者専門分野一括設定エラー:', error);
    return {
      success: false,
      message: '専門分野の設定に失敗しました',
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
 * 指導者専門分野を削除
 */
const deleteInstructorSpecialization = async (specializationId, userId) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // 専門分野の存在確認と所有者確認
    const [existingRows] = await connection.execute(`
      SELECT id FROM instructor_specializations 
      WHERE id = ? AND user_id = ?
    `, [specializationId, userId]);
    
    if (existingRows.length === 0) {
      return {
        success: false,
        message: '指定された専門分野が見つかりません',
        error: 'Specialization not found'
      };
    }
    
    await connection.execute(`
      DELETE FROM instructor_specializations 
      WHERE id = ? AND user_id = ?
    `, [specializationId, userId]);
    
    return {
      success: true,
      message: '専門分野が正常に削除されました'
    };
  } catch (error) {
    console.error('指導者専門分野削除エラー:', error);
    return {
      success: false,
      message: '専門分野の削除に失敗しました',
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
 * 拠点内の指導者一覧を取得（専門分野含む）
 */
const getSatelliteInstructors = async (satelliteId) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    console.log('拠点指導者一覧取得 - 拠点ID:', satelliteId);
    
    // 拠点に所属する指導者（ロール4、5）を取得
    const [instructors] = await connection.execute(`
      SELECT 
        ua.id,
        ua.name,
        ua.role,
        ua.status,
        ua.login_code,
        ua.satellite_ids,
        ua.email,
        c.name as company_name,
        ac.username
      FROM user_accounts ua
      LEFT JOIN companies c ON ua.company_id = c.id
      LEFT JOIN admin_credentials ac ON ua.id = ac.user_id
      WHERE ua.role >= 4 
        AND ua.role <= 5
        AND JSON_CONTAINS(ua.satellite_ids, ?)
      ORDER BY ua.name
    `, [JSON.stringify(satelliteId)]);
    
    console.log('拠点指導者一覧取得結果:', instructors);
    
    // 各指導者の専門分野を取得
    const instructorsWithSpecializations = await Promise.all(
      instructors.map(async (instructor) => {
        const [specializations] = await connection.execute(`
          SELECT 
            id,
            specialization,
            created_at
          FROM instructor_specializations
          WHERE user_id = ?
          ORDER BY created_at
        `, [instructor.id]);
        
        return {
          ...instructor,
          specializations: specializations
        };
      })
    );
    
    return {
      success: true,
      data: instructorsWithSpecializations
    };
  } catch (error) {
    console.error('拠点指導者一覧取得エラー:', error);
    return {
      success: false,
      message: '拠点指導者一覧の取得に失敗しました',
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
 * 拠点の統計情報を取得
 */
const getSatelliteStats = async (satelliteId) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // 拠点情報を取得
    const [satelliteRows] = await connection.execute(`
      SELECT 
        id,
        name,
        max_users,
        status
      FROM satellites
      WHERE id = ?
    `, [satelliteId]);
    
    if (satelliteRows.length === 0) {
      return {
        success: false,
        message: '指定された拠点が見つかりません',
        error: 'Satellite not found'
      };
    }
    
    const satellite = satelliteRows[0];
    
    console.log('拠点統計取得 - 拠点ID:', satelliteId);
    console.log('拠点情報:', satellite);
    
    // デバッグ用：実際のデータを確認
    const [debugRows] = await connection.execute(`
      SELECT id, name, role, satellite_ids, status
      FROM user_accounts
      WHERE role >= 4 AND role <= 5
    `);
    console.log('デバッグ - 指導者データ:', debugRows);
    
    // 現在の生徒数（ロール1）を取得
    const [studentRows] = await connection.execute(`
      SELECT COUNT(*) as count
      FROM user_accounts
      WHERE role = 1 
        AND JSON_CONTAINS(satellite_ids, ?)
        AND status = 1
    `, [JSON.stringify(satelliteId)]);
    
    console.log('生徒数クエリ結果:', studentRows);
    
    // 指導者数（ロール4、5）を取得
    const [instructorRows] = await connection.execute(`
      SELECT COUNT(*) as count
      FROM user_accounts
      WHERE role >= 4 
        AND role <= 5
        AND JSON_CONTAINS(satellite_ids, ?)
        AND status = 1
    `, [JSON.stringify(satelliteId)]);
    
    console.log('指導者数クエリ結果:', instructorRows);
    
    const currentStudents = studentRows[0].count;
    const instructorCount = instructorRows[0].count;
    
    console.log('計算結果 - 生徒数:', currentStudents, '指導者数:', instructorCount);
    
    const capacityPercentage = satellite.max_users > 0 ? (currentStudents / satellite.max_users) * 100 : 0;
    
    return {
      success: true,
      data: {
        satellite: {
          id: satellite.id,
          name: satellite.name,
          max_users: satellite.max_users,
          status: satellite.status
        },
        stats: {
          current_students: currentStudents,
          instructor_count: instructorCount,
          capacity_percentage: Math.round(capacityPercentage),
          is_over_capacity: currentStudents > satellite.max_users
        }
      }
    };
  } catch (error) {
    console.error('拠点統計取得エラー:', error);
    return {
      success: false,
      message: '拠点統計の取得に失敗しました',
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
  getInstructorSpecializations,
  addInstructorSpecialization,
  setInstructorSpecializations,
  deleteInstructorSpecialization,
  getSatelliteInstructors,
  getSatelliteStats
}; 