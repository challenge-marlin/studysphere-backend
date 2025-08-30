const { pool } = require('../utils/database');
const { customLogger } = require('../utils/logger');

/**
 * 指導員の専門分野一覧を取得
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
    console.error('指導員専門分野取得エラー:', error);
    return {
      success: false,
      message: '指導員専門分野の取得に失敗しました',
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
 * 指導員専門分野を追加
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
    console.error('指導員専門分野追加エラー:', error);
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
 * 指導員専門分野を一括設定
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
    console.error('指導員専門分野一括設定エラー:', error);
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
 * 指導員専門分野を削除
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
    console.error('指導員専門分野削除エラー:', error);
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
 * 拠点内の指導員一覧を取得（専門分野含む）
 */
const getSatelliteInstructors = async (satelliteId) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    customLogger.debug('拠点指導員一覧取得 - 拠点ID:', { satelliteId });
    
          // 拠点に所属する指導員（ロール4、5）を取得
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
        AND ua.status = 1
      ORDER BY ua.id ASC
    `);
    
          customLogger.debug('拠点指導員一覧取得結果:', { instructors });
      customLogger.debug('取得された指導員の詳細:', { 
      instructors: instructors.map(instructor => ({
        id: instructor.id,
        name: instructor.name,
        role: instructor.role,
        satellite_ids: instructor.satellite_ids
      }))
    });
    
    // 追加のフィルタリング（JavaScript側）
    const filteredInstructors = instructors.filter(instructor => {
      if (!instructor.satellite_ids) return false;
      
      try {
        let satelliteIds = instructor.satellite_ids;
        if (typeof satelliteIds === 'string') {
          satelliteIds = JSON.parse(satelliteIds);
        }
        
        if (Array.isArray(satelliteIds)) {
          return satelliteIds.some(id => 
            id.toString() === satelliteId.toString() || 
            Number(id) === Number(satelliteId)
          );
        } else {
          return satelliteIds.toString() === satelliteId.toString() || 
                 Number(satelliteIds) === Number(satelliteId);
        }
      } catch (e) {
        customLogger.debug(`指導員 ${instructor.name} のsatellite_idsパースエラー:`, { error: e.message });
        return false;
      }
    });
    
          customLogger.debug('フィルタリング後の指導員数:', { count: filteredInstructors.length });
      customLogger.debug('フィルタリング後の指導員:', { filteredInstructors });
    
    // 拠点の管理者情報を取得
    customLogger.debug('=== 拠点管理者情報取得開始 ===');
    customLogger.debug('対象拠点ID:', { satelliteId, type: typeof satelliteId });
    
    const [satelliteRows] = await connection.execute(`
      SELECT id, name, manager_ids
      FROM satellites
      WHERE id = ?
    `, [satelliteId]);
    
    customLogger.debug('拠点情報取得結果:', { satelliteRows });
    
    let managerIds = [];
    if (satelliteRows.length > 0) {
      const satellite = satelliteRows[0];
      customLogger.debug('拠点詳細:', {
        id: satellite.id,
        name: satellite.name,
        manager_ids: satellite.manager_ids,
        manager_ids_type: typeof satellite.manager_ids
      });
      
            if (satellite.manager_ids) {
        try {
          const rawValue = satellite.manager_ids;
          customLogger.debug('拠点管理者IDs生データ:', { rawValue, type: typeof rawValue });
          customLogger.debug('生データの長さ:', { length: rawValue ? rawValue.length : 0 });
          
          // 既に配列の場合はそのまま使用
          if (Array.isArray(rawValue)) {
            managerIds = rawValue;
            customLogger.debug('既に配列として取得:', { managerIds });
          }
          // カンマ区切りの文字列の場合は配列に変換
          else if (typeof rawValue === 'string' && rawValue.includes(',')) {
            managerIds = rawValue.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
            customLogger.debug('カンマ区切り文字列から変換:', { managerIds });
          }
          // JSON文字列の場合はパース
          else if (typeof rawValue === 'string') {
            const parsed = JSON.parse(rawValue);
            // 配列の場合はそのまま、数値の場合は配列に変換
            managerIds = Array.isArray(parsed) ? parsed : [parsed];
            customLogger.debug('JSONパース結果:', { managerIds });
          }
          // 数値の場合は配列に変換
          else if (typeof rawValue === 'number') {
            managerIds = [rawValue];
            customLogger.debug('数値から配列に変換:', { managerIds });
          }
          // その他の場合は空配列
          else {
            managerIds = [];
            customLogger.debug('その他の型、空配列に設定:', { managerIds });
          }
        } catch (e) {
          customLogger.debug('拠点管理者IDsパースエラー:', { error: e.message });
          // パースに失敗した場合、数値として扱う
          const rawValue = satellite.manager_ids;
          if (typeof rawValue === 'number') {
            managerIds = [rawValue];
          } else if (typeof rawValue === 'string' && !isNaN(rawValue)) {
            managerIds = [parseInt(rawValue)];
          } else {
            managerIds = [];
          }
          customLogger.debug('フォールバック処理結果:', { managerIds });
        }
      } else {
        customLogger.debug('拠点に管理者IDsが設定されていません');
      }
    } else {
      customLogger.debug('指定された拠点が見つかりません');
    }
    
    customLogger.debug('最終的な拠点管理者IDs:', { managerIds });
    customLogger.debug('管理者IDsの型:', { type: typeof managerIds });
    customLogger.debug('管理者IDsが配列か:', { isArray: Array.isArray(managerIds) });
    customLogger.debug('=== 拠点管理者情報取得完了 ===');
    
          // 各指導員の専門分野を取得し、管理者判定も追加
    const instructorsWithSpecializations = await Promise.all(
      filteredInstructors.map(async (instructor) => {
        const [specializations] = await connection.execute(`
          SELECT 
            id,
            specialization,
            created_at
          FROM instructor_specializations
          WHERE user_id = ?
          ORDER BY created_at
        `, [instructor.id]);
        
        // 専門分野を文字列として結合
        const specializationText = specializations
          .map(spec => spec.specialization)
          .join(', ');
        
        // 拠点管理者かどうかを判定（IDの型を統一）
        customLogger.debug(`=== 指導員 ${instructor.name} (ID: ${instructor.id}) の管理者判定開始 ===`);
        customLogger.debug('判定対象指導員:', {
          id: instructor.id,
          id_type: typeof instructor.id,
          name: instructor.name,
          role: instructor.role
        });
        customLogger.debug('管理者IDs:', { managerIds });
        customLogger.debug('管理者IDsの型:', { type: typeof managerIds });
        customLogger.debug('管理者IDsが配列か:', { isArray: Array.isArray(managerIds) });
        
        let isManager = false;
        if (Array.isArray(managerIds)) {
          customLogger.debug('管理者判定の詳細比較開始');
          managerIds.forEach((managerId, index) => {
            const managerIdNum = Number(managerId);
            const instructorIdNum = Number(instructor.id);
            const isMatch = managerIdNum === instructorIdNum;
            customLogger.debug(`比較${index + 1}:`, {
              managerId,
              managerIdType: typeof managerId,
              instructorId: instructor.id,
              instructorIdType: typeof instructor.id,
              managerIdNum,
              instructorIdNum,
              isMatch
            });
            if (isMatch) {
              isManager = true;
            }
          });
        } else {
          customLogger.debug('管理者IDsが配列ではありません');
        }
        
        customLogger.debug(`指導員 ${instructor.name} (ID: ${instructor.id}) の管理者判定結果:`, {
          instructorId: instructor.id,
          managerIds: managerIds,
          isManager: isManager,
          managerIdsType: typeof managerIds,
          isArray: Array.isArray(managerIds)
        });
        customLogger.debug(`=== 指導員 ${instructor.name} の管理者判定完了 ===`);
        
        return {
          ...instructor,
          specializations: specializations,
          specialization: specializationText, // 専門分野を文字列として追加
          is_manager: isManager,
          // 拠点管理者の場合はロール5として返す
          role: isManager ? 5 : instructor.role
        };
      })
    );
    
    return {
      success: true,
      data: instructorsWithSpecializations
    };
  } catch (error) {
    customLogger.error('拠点指導員一覧取得エラー:', { error: error.message });
    return {
      success: false,
      message: '拠点指導員一覧の取得に失敗しました',
      error: error.message
    };
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        customLogger.error('接続の解放に失敗:', { error: releaseError.message });
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
        address,
        phone,
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
    console.log('デバッグ - 指導員データ:', debugRows);
    
          // 特定の拠点IDに関連する指導員を確認
    const [debugSatelliteRows] = await connection.execute(`
      SELECT id, name, role, satellite_ids, status
      FROM user_accounts
      WHERE role >= 4 AND role <= 5
        AND satellite_ids IS NOT NULL
        AND satellite_ids != 'null'
        AND satellite_ids != '[]'
    `);
          console.log('デバッグ - 拠点設定済み指導員データ:', debugSatelliteRows);
    debugSatelliteRows.forEach(row => {
              console.log(`指導員 ${row.name} (ID: ${row.id}) のsatellite_ids:`, row.satellite_ids, '型:', typeof row.satellite_ids);
    });
    
    // 現在の利用者数（ロール1）を取得
    const [studentRows] = await connection.execute(`
      SELECT COUNT(*) as count
      FROM user_accounts
      WHERE role = 1 
        AND satellite_ids IS NOT NULL 
        AND satellite_ids != 'null' 
        AND satellite_ids != '[]'
        AND JSON_CONTAINS(satellite_ids, ?)
        AND status = 1
    `, [JSON.stringify(satelliteId)]);
    
    console.log('利用者数クエリ結果:', studentRows);
    

    
    const currentStudents = studentRows[0].count;
    
    // 拠点の管理者情報を取得（統計用）
    const [satelliteManagerRows] = await connection.execute(`
      SELECT manager_ids
      FROM satellites
      WHERE id = ?
    `, [satelliteId]);
    
    let managerIds = [];
    if (satelliteManagerRows.length > 0 && satelliteManagerRows[0].manager_ids) {
      try {
        const parsed = JSON.parse(satelliteManagerRows[0].manager_ids);
        // 配列の場合はそのまま、数値の場合は配列に変換
        managerIds = Array.isArray(parsed) ? parsed : [parsed];
      } catch (e) {
        console.log('拠点管理者IDsパースエラー:', e);
        // パースに失敗した場合、数値として扱う
        const rawValue = satelliteManagerRows[0].manager_ids;
        if (typeof rawValue === 'number') {
          managerIds = [rawValue];
        } else if (typeof rawValue === 'string' && !isNaN(rawValue)) {
          managerIds = [parseInt(rawValue)];
        } else {
          managerIds = [];
        }
      }
    }
    
    console.log('拠点管理者IDs（統計用）:', managerIds);
    
          // 指導員数はJavaScript側で計算
    const [allInstructorRows] = await connection.execute(`
      SELECT id, name, role, satellite_ids, status
      FROM user_accounts
      WHERE role >= 4 AND role <= 5 AND status = 1
    `);
    
    const instructorCount = allInstructorRows.filter(instructor => {
      if (!instructor.satellite_ids) return false;
      
      try {
        let satelliteIds = instructor.satellite_ids;
        if (typeof satelliteIds === 'string') {
          satelliteIds = JSON.parse(satelliteIds);
        }
        
        if (Array.isArray(satelliteIds)) {
          return satelliteIds.some(id => 
            id.toString() === satelliteId.toString() || 
            Number(id) === Number(satelliteId)
          );
        } else {
          return satelliteIds.toString() === satelliteId.toString() || 
                 Number(satelliteIds) === Number(satelliteId);
        }
      } catch (e) {
        return false;
      }
    }).length;
    
          console.log('計算結果 - 利用者数:', currentStudents, '指導員数:', instructorCount);
    
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

/**
 * 指導員を拠点管理者に設定
 */
const setInstructorAsManager = async (satelliteId, instructorId) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // 拠点の存在確認
    const [satelliteRows] = await connection.execute(
      'SELECT id, name, manager_ids FROM satellites WHERE id = ?',
      [satelliteId]
    );

    if (satelliteRows.length === 0) {
      return {
        success: false,
        message: '拠点が見つかりません'
      };
    }

    const satellite = satelliteRows[0];
    
    // 指導員の存在確認
    const [instructorRows] = await connection.execute(
      'SELECT id, name, role FROM user_accounts WHERE id = ? AND (role = 4 OR role = 5)',
      [instructorId]
    );

    if (instructorRows.length === 0) {
      return {
        success: false,
        message: '指定された指導員が見つかりません'
      };
    }

    // 現在の管理者IDを取得
    let currentManagerIds = [];
    if (satellite.manager_ids) {
      // データの型と内容をログ出力
      console.log('manager_ids の生データ:', satellite.manager_ids);
      console.log('manager_ids の型:', typeof satellite.manager_ids);
      console.log('manager_ids が配列か:', Array.isArray(satellite.manager_ids));
      
      // 既に配列の場合はそのまま使用
      if (Array.isArray(satellite.manager_ids)) {
        currentManagerIds = satellite.manager_ids;
        console.log('既に配列形式です:', currentManagerIds);
      } else if (typeof satellite.manager_ids === 'string') {
        // 文字列の場合はJSONパースを試行
        try {
          const parsed = JSON.parse(satellite.manager_ids);
          // パース結果が配列の場合はそのまま、そうでなければ配列に変換
          currentManagerIds = Array.isArray(parsed) ? parsed : [parsed];
          console.log('文字列からパース成功:', currentManagerIds);
        } catch (error) {
          console.error('manager_ids parse error:', error);
          console.error('パースに失敗したデータ:', satellite.manager_ids);
          currentManagerIds = [];
        }
      } else if (satellite.manager_ids !== null && satellite.manager_ids !== undefined) {
        // その他の型（数値、オブジェクトなど）の場合は配列に変換
        currentManagerIds = [satellite.manager_ids];
        console.log('その他の型を配列に変換:', currentManagerIds);
      } else {
        // null や undefined の場合は空配列
        currentManagerIds = [];
        console.log('null/undefinedのため空配列に設定');
      }
    }

    console.log(`拠点 ${satellite.name} (ID: ${satelliteId}) の現在の管理者IDs:`, currentManagerIds);
    console.log(`設定しようとしている指導員ID: ${instructorId} (型: ${typeof instructorId})`);

    // IDの型を統一（数値として比較）
    const instructorIdNum = Number(instructorId);
    const currentManagerIdsNum = currentManagerIds.map(id => Number(id));

    // 既に管理者として設定されているかチェック
    if (currentManagerIdsNum.includes(instructorIdNum)) {
      console.log(`指導員ID ${instructorId} は既に管理者として設定されています`);
      return {
        success: true,
        message: '既に管理者として設定されています',
        data: { manager_ids: currentManagerIds }
      };
    }

    // 新しい管理者IDを追加
    currentManagerIds.push(instructorIdNum);
    const managerIdsJson = JSON.stringify(currentManagerIds);

    console.log(`更新後の管理者IDs:`, currentManagerIds);

    await connection.execute(`
      UPDATE satellites 
      SET manager_ids = ?, updated_at = NOW()
      WHERE id = ?
    `, [managerIdsJson, satelliteId]);

    console.log(`拠点 ${satellite.name} (ID: ${satelliteId}) に指導員ID ${instructorId} を管理者として設定しました`);

    return {
      success: true,
      message: '指導員を管理者として設定しました',
      data: { manager_ids: currentManagerIds }
    };
    
  } catch (error) {
    console.error('指導員管理者設定エラー:', error);
    return {
      success: false,
      message: '指導員の管理者設定に失敗しました',
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
 * 指導員の拠点管理者権限を解除
 */
const removeInstructorAsManager = async (satelliteId, instructorId) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // 拠点の存在確認
    const [satelliteRows] = await connection.execute(
      'SELECT id, name, manager_ids FROM satellites WHERE id = ?',
      [satelliteId]
    );

    if (satelliteRows.length === 0) {
      return {
        success: false,
        message: '拠点が見つかりません'
      };
    }

    const satellite = satelliteRows[0];
    
    // 現在の管理者IDを取得
    let currentManagerIds = [];
    if (satellite.manager_ids) {
      // データの型と内容をログ出力
      console.log('manager_ids の生データ:', satellite.manager_ids);
      console.log('manager_ids の型:', typeof satellite.manager_ids);
      console.log('manager_ids が配列か:', Array.isArray(satellite.manager_ids));
      
      // 既に配列の場合はそのまま使用
      if (Array.isArray(satellite.manager_ids)) {
        currentManagerIds = satellite.manager_ids;
        console.log('既に配列形式です:', currentManagerIds);
      } else if (typeof satellite.manager_ids === 'string') {
        // 文字列の場合はJSONパースを試行
        try {
          const parsed = JSON.parse(satellite.manager_ids);
          // パース結果が配列の場合はそのまま、そうでなければ配列に変換
          currentManagerIds = Array.isArray(parsed) ? parsed : [parsed];
          console.log('文字列からパース成功:', currentManagerIds);
        } catch (error) {
          console.error('manager_ids parse error:', error);
          console.error('パースに失敗したデータ:', satellite.manager_ids);
          currentManagerIds = [];
        }
      } else if (satellite.manager_ids !== null && satellite.manager_ids !== undefined) {
        // その他の型（数値、オブジェクトなど）の場合は配列に変換
        currentManagerIds = [satellite.manager_ids];
        console.log('その他の型を配列に変換:', currentManagerIds);
      } else {
        // null や undefined の場合は空配列
        currentManagerIds = [];
        console.log('null/undefinedのため空配列に設定');
      }
    }

    console.log(`拠点 ${satellite.name} (ID: ${satelliteId}) の現在の管理者IDs:`, currentManagerIds);
    console.log(`解除しようとしている指導員ID: ${instructorId} (型: ${typeof instructorId})`);

    // IDの型を統一（数値として比較）
    const instructorIdNum = Number(instructorId);
    const currentManagerIdsNum = currentManagerIds.map(id => Number(id));

    // 管理者として設定されているかチェック
    if (!currentManagerIdsNum.includes(instructorIdNum)) {
      console.log(`指導員ID ${instructorId} は既に管理者権限が解除されています`);
      return {
        success: true,
        message: '既に管理者権限が解除されています',
        data: { manager_ids: currentManagerIds }
      };
    }

    // 管理者IDを削除
    currentManagerIds = currentManagerIds.filter(id => Number(id) !== instructorIdNum);
    const managerIdsJson = JSON.stringify(currentManagerIds);

    console.log(`更新後の管理者IDs:`, currentManagerIds);

    await connection.execute(`
      UPDATE satellites 
      SET manager_ids = ?, updated_at = NOW()
      WHERE id = ?
    `, [managerIdsJson, satelliteId]);

    console.log(`拠点 ${satellite.name} (ID: ${satelliteId}) から指導員ID ${instructorId} の管理者権限を解除しました`);

    return {
      success: true,
      message: '指導員の管理者権限を解除しました',
      data: { manager_ids: currentManagerIds }
    };
    
  } catch (error) {
    console.error('指導員管理者解除エラー:', error);
    return {
      success: false,
      message: '指導員の管理者解除に失敗しました',
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
  getSatelliteStats,
  setInstructorAsManager,
  removeInstructorAsManager
}; 