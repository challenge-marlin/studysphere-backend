const { pool } = require('../utils/database');
const bcrypt = require('bcryptjs');
const { customLogger } = require('../utils/logger');
const { generateAccessToken, generateRefreshToken, saveRefreshToken } = require('../utils/tokenManager');
const { 
  getCurrentJapanTime, 
  getTodayEndTime: getTodayEndTimeUtil, 
  convertUTCToJapanTime, 
  convertJapanTimeToUTC,
  isExpired,
  formatJapanTime 
} = require('../utils/dateUtils');

// ログインコード生成関数
const generateLoginCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const generatePart = () => {
    let result = '';
    for (let i = 0; i < 4; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };
  return `${generatePart()}-${generatePart()}-${generatePart()}`;
};

// パスワード生成関数（XXXX-XXXX形式）
const generateTemporaryPassword = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const generatePart = () => {
    let result = '';
    for (let i = 0; i < 4; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };
  return `${generatePart()}-${generatePart()}`;
};

// 日本時間の今日の23:59を取得（後方互換性のため残す）
const getTodayEndTime = () => {
  return getTodayEndTimeUtil();
};

// パスワード有効期限チェック
const isPasswordValid = (expiryTime) => {
  return !isExpired(expiryTime);
};



// ユーザー一覧取得
const getUsers = async () => {
  let connection;
  try {
    console.log('=== ユーザー一覧取得開始 ===');
    
    // データベース接続を取得
    try {
      connection = await pool.getConnection();
      console.log('データベース接続取得成功');
    } catch (connError) {
      console.error('データベース接続エラー:', connError);
      return {
        success: false,
        message: 'データベース接続に失敗しました',
        error: connError.message
      };
    }
    
    // 基本的なユーザー情報を取得（担当指導員名も含む）
    console.log('基本的なユーザー情報を取得中...');
    let rows;
    try {
      [rows] = await connection.execute(`
        SELECT 
          ua.id,
          ua.name,
          ua.email,
          ua.role,
          ua.status,
          ua.login_code,
          ua.company_id,
          ua.satellite_ids,
          ua.is_remote_user,
          ua.recipient_number,
          ua.password_reset_required,
          ua.instructor_id,
          instructor.name as instructor_name,
          ac.username
        FROM user_accounts ua
        LEFT JOIN user_accounts instructor ON ua.instructor_id = instructor.id
        LEFT JOIN admin_credentials ac ON ua.id = ac.user_id
        ORDER BY ua.id
      `);
      console.log('基本的なユーザー情報取得完了。ユーザー数:', rows.length);
    } catch (queryError) {
      console.error('SQLクエリエラー:', queryError);
      return {
        success: false,
        message: 'ユーザー情報の取得に失敗しました',
        error: queryError.message
      };
    }
    
    // 拠点情報を取得
    console.log('拠点情報を取得中...');
    let satellites = [];
    try {
      const [satelliteRows] = await connection.execute(`
        SELECT s.*, c.name as company_name, ot.type as office_type_name
        FROM satellites s
        LEFT JOIN companies c ON s.company_id = c.id
        LEFT JOIN office_types ot ON s.office_type_id = ot.id
      `);
      satellites = satelliteRows;
      console.log('拠点情報取得完了。拠点数:', satellites.length);
    } catch (satelliteError) {
      console.error('拠点情報取得エラー:', satelliteError);
      // 拠点情報が取得できなくても続行
    }
    
    // 拠点情報をマップ化
    const satelliteMap = {};
    satellites.forEach(sat => {
      satelliteMap[Number(sat.id)] = {
        id: sat.id,
        name: sat.name,
        address: sat.address,
        phone: sat.phone,
        company_name: sat.company_name,
        office_type_name: sat.office_type_name
      };
    });
    
    // 一時パスワード情報を取得
    console.log('一時パスワード情報を取得中...');
    let tempPasswords = [];
    try {
      const [tempPasswordRows] = await connection.execute(`
        SELECT user_id, temp_password, expires_at, is_used
        FROM user_temp_passwords 
        WHERE is_used = 0 AND expires_at > NOW()
        ORDER BY issued_at DESC
      `);
      tempPasswords = tempPasswordRows;
      console.log('一時パスワード情報取得完了。件数:', tempPasswords.length);
      console.log('一時パスワード情報サンプル:', tempPasswords.slice(0, 3));
    } catch (tempPasswordError) {
      console.error('一時パスワード情報取得エラー:', tempPasswordError);
      // 一時パスワード情報が取得できなくても続行
    }
    
    // 一時パスワード情報をマップ化
    const tempPasswordMap = {};
    tempPasswords.forEach(tp => {
      console.log(`一時パスワード情報をマップ化: ユーザー${tp.user_id}`, tp);
      tempPasswordMap[tp.user_id] = {
        temp_password: tp.temp_password,
        expires_at: tp.expires_at,
        is_used: tp.is_used
      };
    });
    console.log('一時パスワードマップ:', tempPasswordMap);
    
    // タグ情報を取得
    console.log('タグ情報を取得中...');
    let userTags = [];
    try {
      const [tagRows] = await connection.execute(`
        SELECT user_id, tag_name
        FROM user_tags
      `);
      userTags = tagRows;
      console.log('タグ情報取得完了。件数:', userTags.length);
    } catch (tagError) {
      console.error('タグ情報取得エラー:', tagError);
      // タグ情報が取得できなくても続行
    }
    
    // タグ情報をマップ化
    const tagMap = {};
    userTags.forEach(tag => {
      if (!tagMap[tag.user_id]) {
        tagMap[tag.user_id] = [];
      }
      tagMap[tag.user_id].push(tag.tag_name);
    });

    // コース情報を取得
    console.log('コース情報を取得中...');
    let userCourses = [];
    try {
      const [courseRows] = await connection.execute(`
        SELECT 
          uc.user_id,
          c.title as course_title,
          c.category as course_category
        FROM user_courses uc
        JOIN courses c ON uc.course_id = c.id
        WHERE uc.status = 'active' AND c.status = 'active'
      `);
      userCourses = courseRows;
      console.log('コース情報取得完了。件数:', userCourses.length);
      console.log('コース情報サンプル:', userCourses.slice(0, 3));
    } catch (courseError) {
      console.error('コース情報取得エラー:', courseError);
      // コース情報が取得できなくても続行
    }
    
    // コース情報をマップ化
    const courseMap = {};
    userCourses.forEach(course => {
      if (!courseMap[course.user_id]) {
        courseMap[course.user_id] = [];
      }
      courseMap[course.user_id].push({
        title: course.course_title,
        category: course.course_category
      });
    });
    
    console.log('コースマップサンプル:', Object.keys(courseMap).slice(0, 3).map(key => ({ user_id: key, courses: courseMap[key] })));
    
    // ユーザー情報を処理
    console.log('ユーザー情報を処理中...');
    const processedRows = [];
    
    for (const row of rows) {
      const user = { ...row };
      
      // 一時パスワード情報を追加
      if (tempPasswordMap[user.id]) {
        console.log(`ユーザー${user.id} (${user.name}) の一時パスワード情報:`, tempPasswordMap[user.id]);
        user.temp_password = tempPasswordMap[user.id].temp_password;
        user.expires_at = tempPasswordMap[user.id].expires_at;
        user.is_used = tempPasswordMap[user.id].is_used;
      } else {
        console.log(`ユーザー${user.id} (${user.name}) には一時パスワード情報がありません`);
      }
      
      // satellite_idsから拠点情報を取得
      let satelliteDetails = [];
      if (user.satellite_ids) {
        try {
          let satelliteIds;
          
          if (typeof user.satellite_ids === 'string') {
            satelliteIds = JSON.parse(user.satellite_ids);
          } else if (Array.isArray(user.satellite_ids)) {
            satelliteIds = user.satellite_ids;
          } else {
            satelliteIds = [user.satellite_ids];
          }
          
          const idsArray = Array.isArray(satelliteIds) ? satelliteIds : [satelliteIds];
          
          satelliteDetails = idsArray
            .map(id => satelliteMap[Number(id)])
            .filter(sat => sat);
        } catch (e) {
          console.error(`ユーザー${user.id}の拠点IDパースエラー:`, e);
          satelliteDetails = [];
        }
      }
      
      user.satellite_details = satelliteDetails;
      
      // タグ情報を処理
      let allTags = [];
      
      // 通常のタグ
      if (tagMap[user.id]) {
        allTags = [...allTags, ...tagMap[user.id]];
      }
      
      // 在宅支援タグ
      if (user.is_remote_user === 1) {
        allTags.push('在宅支援');
      }
      
      // 重複を除去してタグを設定
      user.tags = [...new Set(allTags)];
      
      // コース情報を追加
      user.courses = courseMap[user.id] || [];
      
      // 進捗率を計算（受講完了:1, 受講中:0.5, 未受講:0）
      try {
        // 利用者が受講しているコースの全レッスン数を取得
        const [totalLessonsResult] = await connection.execute(`
          SELECT COUNT(l.id) as total_lessons
          FROM user_courses uc
          JOIN courses c ON uc.course_id = c.id
          JOIN lessons l ON c.id = l.course_id
          WHERE uc.user_id = ? AND uc.status = 'active' AND c.status = 'active' AND l.status != 'deleted'
        `, [user.id]);

        const totalLessons = totalLessonsResult[0]?.total_lessons || 0;

        if (totalLessons > 0) {
          // 各レッスンの進捗状況を取得
          const [lessonProgress] = await connection.execute(`
            SELECT 
              l.id,
              COALESCE(ulp.status, 'not_started') as progress_status
            FROM user_courses uc
            JOIN courses c ON uc.course_id = c.id
            JOIN lessons l ON c.id = l.course_id
            LEFT JOIN user_lesson_progress ulp ON l.id = ulp.lesson_id AND ulp.user_id = uc.user_id
            WHERE uc.user_id = ? AND uc.status = 'active' AND c.status = 'active' AND l.status != 'deleted'
            ORDER BY l.order_index ASC
          `, [user.id]);

          // 進捗率を計算（受講完了:1, 受講中:0.5, 未受講:0）
          const completedLessons = lessonProgress.filter(l => l.progress_status === 'completed').length;
          const inProgressLessons = lessonProgress.filter(l => l.progress_status === 'in_progress').length;
          const weightedProgress = completedLessons + (inProgressLessons * 0.5);
          const progressPercentage = Math.round((weightedProgress / totalLessons) * 10000) / 100; // 小数点第2位まで

          user.progress = progressPercentage;
        } else {
          user.progress = 0;
        }
      } catch (error) {
        console.error(`利用者ID ${user.id} の進捗率計算エラー:`, error);
        user.progress = 0;
      }
      
      // 一時パスワードの有効期限を日本時間で返す
      if (user.expires_at) {
        const dateObj = new Date(user.expires_at);
        user.expires_at = dateObj.toLocaleString('ja-JP', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
      }
      
      processedRows.push(user);
    }
    
    console.log('=== ユーザー情報処理完了 ===');
    console.log('処理されたユーザー数:', processedRows.length);
    
    // 一時パスワード情報が含まれているユーザーを確認
    const usersWithTempPassword = processedRows.filter(user => user.temp_password);
    console.log('一時パスワードを持つユーザー数:', usersWithTempPassword.length);
    usersWithTempPassword.forEach(user => {
      console.log(`ユーザー${user.id} (${user.name}): パスワード=${user.temp_password}, 有効期限=${user.expires_at}`);
    });
    
    return {
      success: true,
      data: {
        users: processedRows,
        count: processedRows.length
      }
    };
  } catch (error) {
    console.error('=== ユーザー一覧取得エラー ===');
    console.error('エラーメッセージ:', error.message);
    console.error('エラースタック:', error.stack);
    console.error('エラーコード:', error.code);
    
    return {
      success: false,
      message: 'ユーザー一覧の取得に失敗しました',
      error: error.message
    };
  } finally {
    if (connection) {
      try {
        connection.release();
        console.log('データベース接続を解放しました');
      } catch (releaseError) {
        console.error('データベース接続の解放に失敗:', releaseError);
      }
    }
  }
};

// 企業別最上位ユーザー取得
const getTopUsersByCompany = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    const query = `
      SELECT 
        c.id as company_id,
        c.name as company_name,
        ua.id as user_id,
        ua.name as user_name,
        ua.role,
        ua.satellite_ids
      FROM companies c
      LEFT JOIN user_accounts ua ON c.id = ua.company_id
      WHERE ua.role = (
        SELECT MAX(role) 
        FROM user_accounts ua2 
        WHERE ua2.company_id = c.id
      )
      ORDER BY c.id, ua.role DESC, ua.id
    `;
    
    const [rows] = await connection.execute(query);
    return {
      success: true,
      data: rows
    };
  } catch (error) {
    console.error('Error fetching top users by company:', error);
    return {
      success: false,
      message: 'Failed to fetch top users by company',
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

// 企業別ロール4以上のユーザー数取得
const getTeachersByCompany = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    const query = `
      SELECT 
        c.id as company_id,
        c.name as company_name,
        COUNT(ua.id) as teacher_count
      FROM companies c
      LEFT JOIN user_accounts ua ON c.id = ua.company_id AND ua.role >= 4
      GROUP BY c.id, c.name
      ORDER BY c.id
    `;
    
    const [rows] = await connection.execute(query);
    return {
      success: true,
      data: rows
    };
  } catch (error) {
    console.error('Error fetching teachers by company:', error);
    return {
      success: false,
      message: 'Failed to fetch teachers by company',
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

// ヘルスチェック
const healthCheck = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.execute('SELECT NOW() as current_datetime');
    const currentTime = rows[0].current_datetime;
    
    return {
      success: true,
      data: {
        message: 'Express + MySQL Docker Compose Starter is running!',
        database: 'Connected successfully',
        currentTime: currentTime,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Health check error:', error);
    return {
      success: false,
      message: 'Database connection failed',
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

// ユーザーの所属拠点を取得
const getUserSatellites = async (userId) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.execute(`
      SELECT 
        s.id,
        s.name,
        s.address,
        s.max_users,
        s.status,
        c.name as company_name
      FROM user_accounts ua
      JOIN satellites s ON (
        s.id IS NOT NULL AND ua.satellite_ids IS NOT NULL AND (
          JSON_CONTAINS(ua.satellite_ids, JSON_QUOTE(s.id)) OR 
          JSON_CONTAINS(ua.satellite_ids, CAST(s.id AS JSON)) OR
          JSON_SEARCH(ua.satellite_ids, 'one', CAST(s.id AS CHAR)) IS NOT NULL
        )
      )
      JOIN companies c ON s.company_id = c.id
      WHERE ua.id = ?
    `, [userId]);

    return {
      success: true,
      data: rows
    };
  } catch (error) {
    console.error('Error fetching user satellites:', error);
    return {
      success: false,
      message: '所属拠点の取得に失敗しました',
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

// 拠点に所属するユーザー一覧を取得
const getSatelliteUsers = async (satelliteId, req = null) => {
  let connection;
  try {
    console.log('=== getSatelliteUsers デバッグ開始 ===');
    console.log('要求された拠点ID:', satelliteId);
    console.log('拠点IDの型:', typeof satelliteId);
    console.log('リクエスト情報:', req ? { user: req.user } : 'なし');
    
    // 拠点IDの妥当性チェック
    if (!satelliteId || satelliteId === 'null' || satelliteId === 'undefined') {
      console.log('無効な拠点IDが指定されました');
      return {
        success: false,
        message: '有効な拠点IDが指定されていません',
        error: 'Invalid satellite ID'
      };
    }
    
    // 数値に変換
    const numericSatelliteId = parseInt(satelliteId);
    if (isNaN(numericSatelliteId)) {
      console.log('拠点IDを数値に変換できませんでした:', satelliteId);
      return {
        success: false,
        message: '拠点IDが数値ではありません',
        error: 'Invalid satellite ID format'
      };
    }
    
    console.log('数値変換後の拠点ID:', numericSatelliteId);
    
    connection = await pool.getConnection();
    
    // まず拠点の存在確認
    const [satelliteCheck] = await connection.execute(
      'SELECT id, name FROM satellites WHERE id = ? AND status = 1',
      [numericSatelliteId]
    );
    
    if (satelliteCheck.length === 0) {
      console.log('指定された拠点が見つからないか、無効です:', numericSatelliteId);
      return {
        success: false,
        message: '指定された拠点が見つかりません',
        error: 'Satellite not found'
      };
    }
    
    console.log('拠点確認完了:', satelliteCheck[0]);
    
    // 認証情報がある場合は権限チェック
    if (req && req.user) {
      console.log('認証ユーザー情報:', req.user);
      
      // 管理者（ロール9）の場合は全拠点にアクセス可能
      if (req.user.role >= 9) {
        console.log('システム管理者のため、全拠点にアクセス可能');
      } else {
        // 一般管理者・指導員の場合は所属拠点のみアクセス可能
        const [userRows] = await connection.execute(
          'SELECT satellite_ids FROM user_accounts WHERE id = ?',
          [req.user.user_id]
        );
        
        if (userRows.length > 0 && userRows[0].satellite_ids) {
          let userSatelliteIds = [];
          try {
            userSatelliteIds = JSON.parse(userRows[0].satellite_ids);
            if (!Array.isArray(userSatelliteIds)) {
              userSatelliteIds = [userSatelliteIds];
            }
          } catch (error) {
            console.error('ユーザーの拠点IDパースエラー:', error);
            userSatelliteIds = [];
          }
          
          console.log('ユーザーの所属拠点:', userSatelliteIds);
          
          if (!userSatelliteIds.includes(numericSatelliteId)) {
            console.log('アクセス権限がありません');
            return {
              success: false,
              message: '指定された拠点へのアクセス権限がありません',
              error: 'Access denied'
            };
          }
        }
      }
    }
    
    // 拠点に所属するユーザーを取得
    const [rows] = await connection.execute(`
      SELECT 
        ua.id,
        ua.name,
        ua.role,
        ua.status,
        ua.login_code,
        ua.is_remote_user,
        ua.recipient_number,
        ua.instructor_id,
        instructor.name as instructor_name
      FROM user_accounts ua
      LEFT JOIN user_accounts instructor ON ua.instructor_id = instructor.id
      WHERE JSON_CONTAINS(ua.satellite_ids, ?) AND ua.status = 1
      ORDER BY ua.role DESC, ua.name
    `, [JSON.stringify(numericSatelliteId)]);
    
    console.log('取得したユーザー数:', rows.length);
    
    // タグ情報を取得（拠点に所属するユーザーのみ）
    let userTags = [];
    try {
      const [tagRows] = await connection.execute(`
        SELECT ut.user_id, ut.tag_name
        FROM user_tags ut
        JOIN user_accounts ua ON ut.user_id = ua.id
        WHERE JSON_CONTAINS(ua.satellite_ids, ?) AND ua.status = 1
      `, [JSON.stringify(numericSatelliteId)]);
      userTags = tagRows;
      console.log('拠点別タグ情報取得完了。件数:', userTags.length);
    } catch (tagError) {
      console.error('タグ情報取得エラー:', tagError);
    }
    
    // タグ情報をマップ化
    const tagMap = {};
    userTags.forEach(tag => {
      if (!tagMap[tag.user_id]) {
        tagMap[tag.user_id] = [];
      }
      tagMap[tag.user_id].push(tag.tag_name);
    });

    // コース情報を取得（拠点に所属するユーザーのみ）
    let userCourses = [];
    try {
      console.log('=== コース情報取得開始 ===');
      console.log('拠点ID:', numericSatelliteId);
      
      const [courseRows] = await connection.execute(`
        SELECT 
          uc.user_id,
          c.title as course_title,
          c.category as course_category
        FROM user_courses uc
        JOIN courses c ON uc.course_id = c.id
        JOIN user_accounts ua ON uc.user_id = ua.id
        WHERE uc.status = 'active' AND c.status = 'active'
          AND JSON_CONTAINS(ua.satellite_ids, ?) AND ua.status = 1
      `, [JSON.stringify(numericSatelliteId)]);
      userCourses = courseRows;
      console.log('拠点別コース情報取得完了。件数:', userCourses.length);
      console.log('拠点別コース情報サンプル:', userCourses.slice(0, 3));
      
      // 各ユーザーIDのコース数を確認
      const courseCountByUser = {};
      userCourses.forEach(course => {
        courseCountByUser[course.user_id] = (courseCountByUser[course.user_id] || 0) + 1;
      });
      console.log('ユーザー別コース数:', courseCountByUser);
    } catch (courseError) {
      console.error('コース情報取得エラー:', courseError);
    }
    
    // カリキュラムパス情報を取得（拠点に所属するユーザーのみ）
    let userCurriculumPaths = [];
    try {
      console.log('=== カリキュラムパス情報取得開始 ===');
      console.log('拠点ID:', numericSatelliteId);
      
      const [curriculumPathRows] = await connection.execute(`
        SELECT 
          ucp.user_id,
          cp.name as curriculum_path_name,
          cp.description as curriculum_path_description
        FROM user_curriculum_paths ucp
        JOIN curriculum_paths cp ON ucp.curriculum_path_id = cp.id
        JOIN user_accounts ua ON ucp.user_id = ua.id
        WHERE ucp.status = 'active'
          AND JSON_CONTAINS(ua.satellite_ids, ?) AND ua.status = 1
      `, [JSON.stringify(numericSatelliteId)]);
      userCurriculumPaths = curriculumPathRows;
      console.log('拠点別カリキュラムパス情報取得完了。件数:', userCurriculumPaths.length);
      console.log('拠点別カリキュラムパス情報サンプル:', userCurriculumPaths.slice(0, 3));
      
      // 各ユーザーIDのカリキュラムパス数を確認
      const curriculumPathCountByUser = {};
      userCurriculumPaths.forEach(path => {
        curriculumPathCountByUser[path.user_id] = (curriculumPathCountByUser[path.user_id] || 0) + 1;
      });
      console.log('ユーザー別カリキュラムパス数:', curriculumPathCountByUser);
    } catch (curriculumPathError) {
      console.error('カリキュラムパス情報取得エラー:', curriculumPathError);
    }
    
    // コース情報をマップ化
    const courseMap = {};
    userCourses.forEach(course => {
      if (!courseMap[course.user_id]) {
        courseMap[course.user_id] = [];
      }
      courseMap[course.user_id].push({
        title: course.course_title,
        category: course.course_category
      });
    });
    
    // カリキュラムパス情報をマップ化
    const curriculumPathMap = {};
    userCurriculumPaths.forEach(curriculumPath => {
      if (!curriculumPathMap[curriculumPath.user_id]) {
        curriculumPathMap[curriculumPath.user_id] = [];
      }
      curriculumPathMap[curriculumPath.user_id].push({
        title: curriculumPath.curriculum_path_name,
        category: 'カリキュラムパス',
        description: curriculumPath.curriculum_path_description
      });
    });
    
    console.log('拠点別コースマップサンプル:', Object.keys(courseMap).slice(0, 3).map(key => ({ user_id: key, courses: courseMap[key] })));
    
    // 一時パスワード情報を取得
    let tempPasswordMap = {};
    try {
      const [tempPasswordRows] = await connection.execute(`
        SELECT 
          tp.user_id,
          tp.temp_password,
          tp.expires_at,
          tp.is_used
        FROM user_temp_passwords tp
        JOIN user_accounts ua ON tp.user_id = ua.id
        WHERE JSON_CONTAINS(ua.satellite_ids, ?) AND ua.status = 1
          AND tp.is_used = 0 AND tp.expires_at > NOW()
        ORDER BY tp.issued_at DESC
      `, [JSON.stringify(numericSatelliteId)]);
      
      // 最新の一時パスワードのみを取得（ユーザーごと）
      tempPasswordRows.forEach(row => {
        if (!tempPasswordMap[row.user_id]) {
          tempPasswordMap[row.user_id] = {
            temp_password: row.temp_password,
            expires_at: row.expires_at,
            is_used: row.is_used
          };
        }
      });
      
      console.log('一時パスワード情報取得完了。件数:', Object.keys(tempPasswordMap).length);
    } catch (tempPasswordError) {
      console.error('一時パスワード情報取得エラー:', tempPasswordError);
    }
    
    // ユーザー情報にタグとコース情報を追加
    console.log('=== データ処理開始 ===');
    console.log('処理対象ユーザー数:', rows.length);
    console.log('コースマップ:', courseMap);
    console.log('カリキュラムパスマップ:', curriculumPathMap);
    
    const processedRows = [];
    for (const user of rows) {
      const processedUser = { ...user };
      
      // タグ情報を処理
      let allTags = [];
      
      // 通常のタグ
      if (tagMap[user.id]) {
        allTags = [...allTags, ...tagMap[user.id]];
      }
      
      // 在宅支援タグ
      if (user.is_remote_user === 1) {
        allTags.push('在宅支援');
      }
      
      // 重複を除去してタグを設定
      processedUser.tags = [...new Set(allTags)];
      
      // コース情報とカリキュラムパス情報を追加
      const userCourses = courseMap[user.id] || [];
      const userCurriculumPaths = curriculumPathMap[user.id] || [];
      processedUser.courses = [...userCourses, ...userCurriculumPaths];
      
      console.log(`ユーザー ${user.name} (ID: ${user.id}) の処理結果:`, {
        tags: processedUser.tags,
        courses: processedUser.courses,
        courseCount: processedUser.courses.length
      });
      
      // 一時パスワード情報を追加
      if (tempPasswordMap[user.id]) {
        console.log(`拠点別ユーザー${user.id} (${user.name}) の一時パスワード情報:`, tempPasswordMap[user.id]);
        processedUser.temp_password = tempPasswordMap[user.id].temp_password;
        processedUser.expires_at = tempPasswordMap[user.id].expires_at;
        processedUser.is_used = tempPasswordMap[user.id].is_used;
      } else {
        console.log(`拠点別ユーザー${user.id} (${user.name}) には一時パスワード情報がありません`);
      }
      
      // 進捗率を計算（受講完了:1, 受講中:0.5, 未受講:0）
      try {
        // 利用者が受講しているコースの全レッスン数を取得
        const [totalLessonsResult] = await connection.execute(`
          SELECT COUNT(l.id) as total_lessons
          FROM user_courses uc
          JOIN courses c ON uc.course_id = c.id
          JOIN lessons l ON c.id = l.course_id
          WHERE uc.user_id = ? AND uc.status = 'active' AND c.status = 'active' AND l.status != 'deleted'
        `, [user.id]);

        const totalLessons = totalLessonsResult[0]?.total_lessons || 0;

        if (totalLessons > 0) {
          // 各レッスンの進捗状況を取得
          const [lessonProgress] = await connection.execute(`
            SELECT 
              l.id,
              COALESCE(ulp.status, 'not_started') as progress_status
            FROM user_courses uc
            JOIN courses c ON uc.course_id = c.id
            JOIN lessons l ON c.id = l.course_id
            LEFT JOIN user_lesson_progress ulp ON l.id = ulp.lesson_id AND ulp.user_id = uc.user_id
            WHERE uc.user_id = ? AND uc.status = 'active' AND c.status = 'active' AND l.status != 'deleted'
            ORDER BY l.order_index ASC
          `, [user.id]);

          // 進捗率を計算（受講完了:1, 受講中:0.5, 未受講:0）
          const completedLessons = lessonProgress.filter(l => l.progress_status === 'completed').length;
          const inProgressLessons = lessonProgress.filter(l => l.progress_status === 'in_progress').length;
          const weightedProgress = completedLessons + (inProgressLessons * 0.5);
          const progressPercentage = Math.round((weightedProgress / totalLessons) * 10000) / 100; // 小数点第2位まで

          processedUser.progress = progressPercentage;
        } else {
          processedUser.progress = 0;
        }
      } catch (error) {
        console.error(`拠点別利用者ID ${user.id} の進捗率計算エラー:`, error);
        processedUser.progress = 0;
      }
      
      processedRows.push(processedUser);
    }
    
    const successResponse = {
      success: true,
      data: processedRows
    };
    
    console.log('=== getSatelliteUsers 成功レスポンス ===');
    console.log('返却する成功レスポンス:', successResponse);
    
    return successResponse;
  } catch (error) {
    console.error('=== getSatelliteUsers エラー発生 ===');
    console.error('拠点ユーザー取得エラー:', error);
    console.error('エラー詳細:', {
      satelliteId: satelliteId,
      errorMessage: error.message,
      errorStack: error.stack
    });
    
    const errorResponse = {
      success: false,
      message: '拠点ユーザーの取得に失敗しました',
      error: error.message
    };
    
    console.log('=== getSatelliteUsers エラーレスポンス ===');
    console.log('返却するエラーレスポンス:', errorResponse);
    
    return errorResponse;
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

// ユーザーに拠点を追加
const addSatelliteToUser = async (userId, satelliteId) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // ユーザーの存在確認
    const [userRows] = await connection.execute(
      'SELECT satellite_ids FROM user_accounts WHERE id = ?',
      [userId]
    );

    if (userRows.length === 0) {
      return {
        success: false,
        message: 'ユーザーが見つかりません'
      };
    }

    // 拠点の存在確認
    const [satelliteRows] = await connection.execute(
      'SELECT id FROM satellites WHERE id = ?',
      [satelliteId]
    );

    if (satelliteRows.length === 0) {
      return {
        success: false,
        message: '拠点が見つかりません'
      };
    }

    // 既存の拠点配列を取得
    const currentSatellites = userRows[0].satellite_ids ? JSON.parse(userRows[0].satellite_ids) : [];
    
    // 既に所属しているかチェック
    if (currentSatellites.includes(satelliteId)) {
      return {
        success: false,
        message: '既に拠点に所属しています'
      };
    }

    // 拠点を追加
    currentSatellites.push(satelliteId);
    await connection.execute(
      'UPDATE user_accounts SET satellite_ids = ? WHERE id = ?',
      [JSON.stringify(currentSatellites), userId]
    );

    return {
      success: true,
      message: '拠点が追加されました'
    };
  } catch (error) {
    console.error('Error adding satellite to user:', error);
    return {
      success: false,
      message: '拠点の追加に失敗しました',
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

// ユーザーから拠点を削除
const removeSatelliteFromUser = async (userId, satelliteId) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // ユーザーの存在確認
    const [userRows] = await connection.execute(
      'SELECT satellite_ids FROM user_accounts WHERE id = ?',
      [userId]
    );

    if (userRows.length === 0) {
      return {
        success: false,
        message: 'ユーザーが見つかりません'
      };
    }

    // 既存の拠点配列を取得
    const parsed = userRows[0].satellite_ids ? JSON.parse(userRows[0].satellite_ids) : [];
    const currentSatellites = Array.isArray(parsed) ? parsed : [parsed];
    
    // 拠点配列から削除
    const updatedSatellites = currentSatellites.filter(id => id !== satelliteId);

    if (currentSatellites.length === updatedSatellites.length) {
      return {
        success: false,
        message: '指定された拠点には所属していません'
      };
    }

    // 拠点を削除
    await connection.execute(
      'UPDATE user_accounts SET satellite_ids = ? WHERE id = ?',
      [JSON.stringify(updatedSatellites), userId]
    );

    return {
      success: true,
      message: '拠点が削除されました'
    };
  } catch (error) {
    console.error('Error removing satellite from user:', error);
    return {
      success: false,
      message: '拠点の削除に失敗しました',
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

// ユーザー作成
const createUser = async (userData) => {
  let connection;
  try {
    console.log('=== createUser Debug ===');
    console.log('受信データ:', userData);
    console.log('username:', userData.username);
    console.log('role:', userData.role);
    
    connection = await pool.getConnection();
    
    // トランザクション開始
    await connection.beginTransaction();
    
    // ロール4以上（指導員・管理者）の場合、usernameの一意性チェック
    if (userData.role >= 4 && userData.username) {
      console.log('username一意性チェック開始:', userData.username);
      
      // 文字種チェック
      if (!/^[a-zA-Z0-9_/.-]+$/.test(userData.username)) {
        console.log('username文字種エラー:', userData.username);
        return {
          success: false,
          message: 'ログインIDは半角英数字、アンダースコア、ハイフン、スラッシュ、ドットのみ使用可能です'
        };
      }
      
      // パスワードの長さチェック
      if (!userData.password || userData.password.length < 6) {
        console.log('password長さエラー:', userData.password);
        return {
          success: false,
          message: 'パスワードは6文字以上で入力してください'
        };
      }
      
      const [existingUsers] = await connection.execute(
        'SELECT id FROM admin_credentials WHERE username = ?',
        [userData.username]
      );
      
      if (existingUsers.length > 0) {
        console.log('username重複エラー:', userData.username);
        return {
          success: false,
          message: '指定されたログインIDは既に使用されています'
        };
      }
      console.log('username一意性チェックOK');
    }
    
    // ログインコードの自動生成
    // XXXX-XXXX-XXXX形式（英数大文字小文字交じり）
    const loginCode = generateLoginCode();
    
    // satellite_idを配列に変換
    let satelliteIds = [];
    if (userData.satellite_id) {
      satelliteIds = [userData.satellite_id];
    } else if (userData.satellite_ids && Array.isArray(userData.satellite_ids)) {
      satelliteIds = userData.satellite_ids;
    }

    // ユーザー作成
    const [result] = await connection.execute(
      `INSERT INTO user_accounts (
        name, 
        email,
        role, 
        status, 
        login_code, 
        company_id, 
        satellite_ids,
        instructor_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userData.name,
        userData.email || null,
        userData.role || 1,
        userData.status || 1,
        loginCode,
        userData.company_id || 4,
        JSON.stringify(satelliteIds),
        userData.instructor_id || null
      ]
    );

    const userId = result.insertId;

    // ロール4以上（指導員・管理者）の場合は認証情報も作成
    if (userData.role >= 4) {
      console.log('admin_credentials作成開始');
      console.log('userId:', userId);
      console.log('username:', userData.username);
      
      const hashedPassword = await bcrypt.hash(userData.password || 'defaultPassword123', 10);
      
      // usernameが指定されていない場合はエラー
      if (!userData.username) {
        console.log('username未指定エラー');
        return {
          success: false,
          message: 'ログインIDは必須です'
        };
      }
      
      console.log('admin_credentials INSERT実行:', {
        user_id: userId,
        username: userData.username,
        password_hash: hashedPassword.substring(0, 20) + '...'
      });
      
      await connection.execute(
        `INSERT INTO admin_credentials (
          user_id, 
          username, 
          password_hash
        ) VALUES (?, ?, ?)`,
        [
          userId,
          userData.username,
          hashedPassword
        ]
      );
      
      console.log('admin_credentials作成完了');
      
      // 保存確認のためのクエリ
      const [savedCredentials] = await connection.execute(
        'SELECT * FROM admin_credentials WHERE user_id = ?',
        [userId]
      );
      console.log('保存確認:', savedCredentials);
    }

    // 指導員の場合、専門分野を保存
    if (userData.role === 4 && userData.department && userData.department.trim()) {
      console.log('専門分野保存開始:', userData.department);
      await connection.execute(
        `INSERT INTO instructor_specializations (user_id, specialization)
         VALUES (?, ?)`,
        [userId, userData.department.trim()]
      );
      console.log('専門分野保存完了');
    }

    // トランザクションコミット
    await connection.commit();

    return {
      success: true,
      message: 'ユーザーが正常に作成されました',
      data: {
        id: userId,
        name: userData.name,
        role: userData.role,
        login_code: loginCode
      }
    };
  } catch (error) {
    // エラー時はロールバック
    if (connection) {
      await connection.rollback();
    }
    console.error('Error creating user:', error);
    
    // ユニーク制約エラーの場合
    if (error.code === 'ER_DUP_ENTRY') {
      return {
        success: false,
        message: '指定されたログインIDは既に使用されています',
        error: 'DUPLICATE_USERNAME'
      };
    }
    
    return {
      success: false,
      message: 'ユーザーの作成に失敗しました',
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

// ユーザー更新
const updateUser = async (userId, updateData) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // usernameの更新がある場合、一意性チェック
    if (updateData.username) {
      // 文字種チェック
      if (!/^[a-zA-Z0-9_/.-]+$/.test(updateData.username)) {
        return {
          success: false,
          message: 'ログインIDは半角英数字、アンダースコア、ハイフン、スラッシュ、ドットのみ使用可能です'
        };
      }
      
      // パスワードの長さチェック（パスワードが提供された場合のみ）
      if (updateData.password && updateData.password.length < 6) {
        return {
          success: false,
          message: 'パスワードは6文字以上で入力してください'
        };
      }
      
      const [existingUsers] = await connection.execute(
        'SELECT id FROM admin_credentials WHERE username = ? AND user_id != ?',
        [updateData.username, userId]
      );
      
      if (existingUsers.length > 0) {
        return {
          success: false,
          message: '指定されたログインIDは既に使用されています'
        };
      }
    }
    
    // 更新可能なフィールドを構築
    const updateFields = [];
    const updateValues = [];
    
    if (updateData.name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(updateData.name);
    }
    
    if (updateData.email !== undefined) {
      updateFields.push('email = ?');
      updateValues.push(updateData.email.trim() || null);
    }
    
    if (updateData.role !== undefined) {
      updateFields.push('role = ?');
      updateValues.push(updateData.role);
    }
    
    if (updateData.status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(updateData.status);
    }
    
    if (updateData.satellite_ids !== undefined) {
      updateFields.push('satellite_ids = ?');
      updateValues.push(JSON.stringify(updateData.satellite_ids));
    }
    
    if (updateData.instructor_id !== undefined) {
      updateFields.push('instructor_id = ?');
      updateValues.push(updateData.instructor_id);
    }
    

    
    // user_accountsテーブルの更新
    if (updateFields.length > 0) {
      updateValues.push(userId);
      
      const [result] = await connection.execute(
        `UPDATE user_accounts SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );

      if (result.affectedRows === 0) {
        return {
          success: false,
          message: '指定されたユーザーが見つかりません'
        };
      }
    }
    
    // admin_credentialsテーブルの更新（usernameがある場合）
    if (updateData.username) {
      // ユーザーがロール4以上かチェック
      const [userRows] = await connection.execute(
        'SELECT role FROM user_accounts WHERE id = ?',
        [userId]
      );
      
      if (userRows.length > 0 && userRows[0].role >= 4) {
        // admin_credentialsテーブルを更新
        await connection.execute(
          'UPDATE admin_credentials SET username = ? WHERE user_id = ?',
          [updateData.username, userId]
        );
      }
    }

    // 専門分野の更新（指導員の場合）
    if (updateData.specialization !== undefined) {
      // 既存の専門分野を削除
      await connection.execute(
        'DELETE FROM instructor_specializations WHERE user_id = ?',
        [userId]
      );
      
      // 新しい専門分野を追加（空でない場合のみ）
      if (updateData.specialization && updateData.specialization.trim()) {
        // カンマ区切りで複数の専門分野を分割
        const specializations = updateData.specialization
          .split(',')
          .map(spec => spec.trim())
          .filter(spec => spec.length > 0);
        
        for (const specialization of specializations) {
          await connection.execute(
            'INSERT INTO instructor_specializations (user_id, specialization) VALUES (?, ?)',
            [userId, specialization]
          );
        }
      }
    }

    // タグの更新（利用者の場合）
    if (updateData.tags !== undefined) {
      // 既存のタグを削除
      await connection.execute(
        'DELETE FROM user_tags WHERE user_id = ?',
        [userId]
      );
      
      // 新しいタグを追加（空でない場合のみ）
      if (updateData.tags && Array.isArray(updateData.tags) && updateData.tags.length > 0) {
        for (const tag of updateData.tags) {
          if (tag && tag.trim()) {
            await connection.execute(
              'INSERT INTO user_tags (user_id, tag_name) VALUES (?, ?)',
              [userId, tag.trim()]
            );
          }
        }
      }
    }

    return {
      success: true,
      message: 'ユーザーが正常に更新されました'
    };
  } catch (error) {
    console.error('Error updating user:', error);
    
    // ユニーク制約エラーの場合
    if (error.code === 'ER_DUP_ENTRY') {
      return {
        success: false,
        message: '指定されたログインIDは既に使用されています',
        error: 'DUPLICATE_USERNAME'
      };
    }
    
    return {
      success: false,
      message: 'ユーザーの更新に失敗しました',
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

// ユーザー削除
const deleteUser = async (userId) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // トランザクション開始
    await connection.beginTransaction();
    
    // ユーザーの存在確認
    const [userRows] = await connection.execute(
      'SELECT id, name, role FROM user_accounts WHERE id = ?',
      [userId]
    );

    if (userRows.length === 0) {
      return {
        success: false,
        message: '指定されたユーザーが見つかりません'
      };
    }

    const user = userRows[0];

    // 削除前のチェック
    // 1. このユーザーが他のユーザーの指導員として設定されていないかチェック
    const [instructorCheck] = await connection.execute(
      'SELECT COUNT(*) as count FROM user_accounts WHERE instructor_id = ?',
      [userId]
    );
    
    if (instructorCheck[0].count > 0) {
      return {
        success: false,
        message: 'このユーザーは他の利用者の指導員として設定されているため削除できません。先に指導員設定を変更してください。'
      };
    }

    // 関連するデータを削除（外部キー制約があるため、順序が重要）
    
    // 1. リフレッシュトークンを削除（外部キー制約なし）
    try {
      await connection.execute(
        'DELETE FROM refresh_tokens WHERE user_id = ?',
        [userId]
      );
    } catch (error) {
      console.log('refresh_tokensテーブルが存在しないか、削除に失敗:', error.message);
    }
    
    // 2. 一時パスワードを削除（外部キー制約あり）
    try {
      await connection.execute(
        'DELETE FROM user_temp_passwords WHERE user_id = ?',
        [userId]
      );
    } catch (error) {
      console.log('user_temp_passwordsテーブルが存在しないか、削除に失敗:', error.message);
    }
    
    // 3. カリキュラム進行状況を削除（外部キー制約あり）
    try {
      await connection.execute(
        'DELETE FROM curriculum_progress WHERE user_id = ?',
        [userId]
      );
    } catch (error) {
      console.log('curriculum_progressテーブルが存在しないか、削除に失敗:', error.message);
    }
    
    // 4. テスト結果を削除（外部キー制約あり）
    try {
      await connection.execute(
        'DELETE FROM test_results WHERE user_id = ?',
        [userId]
      );
    } catch (error) {
      console.log('test_resultsテーブルが存在しないか、削除に失敗:', error.message);
    }
    
    // 5. GATB診断スコアを削除（外部キー制約あり）
    try {
      await connection.execute(
        'DELETE FROM gatb_results WHERE user_id = ?',
        [userId]
      );
    } catch (error) {
      console.log('gatb_resultsテーブルが存在しないか、削除に失敗:', error.message);
    }
    
    // 6. ロール4以上（指導員・管理者）の場合は認証情報も削除（外部キー制約あり）
    if (user.role >= 4) {
      try {
        await connection.execute(
          'DELETE FROM admin_credentials WHERE user_id = ?',
          [userId]
        );
      } catch (error) {
        console.log('admin_credentialsテーブルが存在しないか、削除に失敗:', error.message);
      }
    }

    // 8. 最後にユーザーを削除
    await connection.execute(
      'DELETE FROM user_accounts WHERE id = ?',
      [userId]
    );

    // トランザクションコミット
    await connection.commit();

    return {
      success: true,
      message: 'ユーザーが正常に削除されました'
    };
  } catch (error) {
    // エラー時はロールバック
    if (connection) {
      await connection.rollback();
    }
    console.error('Error deleting user:', error);
    return {
      success: false,
      message: 'ユーザーの削除に失敗しました',
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

// パスワードリセット
const resetUserPassword = async (userId, resetData) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // ユーザーの存在確認
    const [userRows] = await connection.execute(
      'SELECT id, name FROM user_accounts WHERE id = ?',
      [userId]
    );

    if (userRows.length === 0) {
      return {
        success: false,
        message: '指定されたユーザーが見つかりません'
      };
    }

    const user = userRows[0];

    if (resetData.action === 'issue_temp_password') {
      // 一時パスワード発行
      const tempPassword = generateTemporaryPassword();
      const hashedPassword = await bcrypt.hash(tempPassword, 10);
      
      // admin_credentialsテーブルを更新
      const [result] = await connection.execute(
        'UPDATE admin_credentials SET password_hash = ?, updated_at = NOW() WHERE user_id = ?',
        [hashedPassword, userId]
      );

      if (result.affectedRows === 0) {
        // admin_credentialsにレコードがない場合は新規作成
        await connection.execute(
          'INSERT INTO admin_credentials (user_id, username, password_hash, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
          [userId, user.name, hashedPassword]
        );
      }

      // パスワード変更要求フラグを設定
      await connection.execute(
        'UPDATE user_accounts SET password_reset_required = 1 WHERE id = ?',
        [userId]
      );

      return {
        success: true,
        message: '一時パスワードが発行されました。指導員は次回ログイン時に新しいパスワードを設定する必要があります。',
        data: {
          tempPassword: tempPassword
        }
      };
    } else if (resetData.action === 'require_password_change') {
      // パスワード変更要求
      await connection.execute(
        'UPDATE user_accounts SET password_reset_required = 1 WHERE id = ?',
        [userId]
      );

      return {
        success: true,
        message: 'パスワード変更要求が送信されました。指導員は次回ログイン時にパスワードの変更が必要です。'
      };
    } else {
      return {
        success: false,
        message: '無効なアクションです'
      };
    }
  } catch (error) {
    console.error('Error resetting user password:', error);
    return {
      success: false,
      message: 'パスワードのリセットに失敗しました',
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

// 支援アプリへの通知送信
const notifySupportApp = async (loginCode, tempPassword, userName) => {
  try {
    // axiosを使用してHTTPリクエストを送信
    const axios = require('axios');
    
    // 正しいポート番号（5050）を使用
    const response = await axios.post('http://localhost:5050/api/remote-support/notify-temp-password', {
      loginCode,
      tempPassword,
      userName,
      timestamp: new Date().toISOString()
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 5000 // 5秒のタイムアウト
    });

    if (response.status === 200) {
      console.log('支援アプリへの通知送信成功');
      return true;
    } else {
      console.error('支援アプリへの通知送信失敗:', response.status);
      return false;
    }
  } catch (error) {
    console.error('支援アプリへの通知送信エラー:', error.message);
    return false;
  }
};

// 一時パスワード発行
const issueTemporaryPassword = async (userId) => {
  let connection;
  try {
    console.log('=== 一時パスワード発行開始 ===');
    console.log('userId:', userId);
    console.log('pool._allConnections.length:', pool._allConnections?.length);
    console.log('pool._freeConnections.length:', pool._freeConnections?.length);
    
    connection = await pool.getConnection();
    console.log('データベース接続取得成功');
    
    // ユーザーの存在確認
    const [userRows] = await connection.execute(
      'SELECT id, name, role, login_code FROM user_accounts WHERE id = ?',
      [userId]
    );

    if (userRows.length === 0) {
      return {
        success: false,
        message: '指定されたユーザーが見つかりません'
      };
    }

    const user = userRows[0];

    // 利用者（ロール1）のみ対象
    if (user.role !== 1) {
      return {
        success: false,
        message: '利用者のみ一時パスワードを発行できます'
      };
    }

    // 既存の一時パスワードを無効化
    const [updateResult] = await connection.execute(
      'UPDATE user_temp_passwords SET is_used = 1 WHERE user_id = ? AND is_used = 0',
      [userId]
    );
    console.log(`ユーザー${userId}の既存一時パスワード無効化: ${updateResult.affectedRows}件`);
    
    // 新しい一時パスワードを生成
    const tempPassword = generateTemporaryPassword();
    
    // 日本時間の今日の23:59:59を計算（UTC変換版を使用）
    const { getTodayEndTime, formatJapanTime, formatMySQLDateTime } = require('../utils/dateUtils');
    const utcEndTime = getTodayEndTime();
    
    console.log('=== 日本時間設定の詳細 ===');
    console.log('utcEndTime (UTC):', utcEndTime);
    console.log('utcEndTime.toISOString():', utcEndTime.toISOString());
    
    // 日本時間の文字列を生成（フロントエンド用）
    const japanTimeString = utcEndTime.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Asia/Tokyo'
    });
    console.log('japanTimeString:', japanTimeString);
    
    // データベース保存用のMySQL DATETIME形式を生成（YYYY-MM-DD HH:MM:SS）
    const expiryTimeString = formatMySQLDateTime(utcEndTime);
    console.log('保存するMySQL DATETIME文字列:', expiryTimeString);
    
    // 現在時刻も確認
    const now = new Date();
    console.log('現在時刻 (UTC):', now.toISOString());
    console.log('現在時刻 (日本時間):', now.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }));
    
    const [insertResult] = await connection.execute(
      'INSERT INTO user_temp_passwords (user_id, temp_password, expires_at) VALUES (?, ?, ?)',
      [userId, tempPassword, expiryTimeString]
    );
    console.log(`ユーザー${userId}の一時パスワード保存完了: ID=${insertResult.insertId}, パスワード=${tempPassword}, 有効期限=${expiryTimeString}`);

    // 支援アプリに通知を送信（非同期で実行）
    notifySupportApp(user.login_code, tempPassword, user.name)
      .then(success => {
        if (success) {
          console.log(`支援アプリへの通知送信完了: ${user.name}`);
        } else {
          console.warn(`支援アプリへの通知送信失敗: ${user.name}`);
        }
      })
      .catch(error => {
        console.error(`支援アプリへの通知送信エラー: ${user.name}`, error);
      });

    return {
      success: true,
      message: '一時パスワードが発行されました',
      data: {
        tempPassword,
        expiresAt: japanTimeString,
        expires_at: japanTimeString, // getUsers関数と同じ形式で返す
        loginUrl: process.env.NODE_ENV === 'production' 
          ? `https://studysphere-frontend.vercel.app/studysphere/student-login?code=${user.login_code}`
          : `http://localhost:3000/studysphere/student-login?code=${user.login_code}`,
        userName: user.name
      }
    };
  } catch (error) {
    console.error('=== 一時パスワード発行エラーの詳細 ===');
    console.error('Error issuing temporary password:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('userId:', userId);
    
    return {
      success: false,
      message: '一時パスワードの発行に失敗しました',
      error: error.message,
      details: {
        name: error.name,
        code: error.code
      }
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

// 一時パスワード検証
const verifyTemporaryPassword = async (loginCode, tempPassword) => {
  let connection;
  try {
    console.log('verifyTemporaryPassword: 開始', { loginCode, tempPassword: tempPassword ? '***' : 'なし' });
    
    // パラメータの検証
    if (!loginCode || !tempPassword) {
      console.error('verifyTemporaryPassword: パラメータ不足', { loginCode: !!loginCode, tempPassword: !!tempPassword });
      return {
        success: false,
        message: 'ログインコードとパスワードは必須です'
      };
    }
    
    connection = await pool.getConnection();
    console.log('verifyTemporaryPassword: データベース接続成功');
    
    // ユーザーと一時パスワードの存在確認（指導員名も取得）
    console.log('verifyTemporaryPassword: データベースクエリ実行開始');
    const [rows] = await connection.execute(`
      SELECT 
        ua.id, 
        ua.name, 
        ua.role,
        ua.company_id,
        utp.temp_password,
        utp.expires_at,
        utp.is_used,
        i.name as instructor_name
      FROM user_accounts ua
      JOIN user_temp_passwords utp ON ua.id = utp.user_id
      LEFT JOIN user_accounts i ON ua.instructor_id = i.id
      WHERE ua.login_code = ? AND utp.temp_password = ?
      ORDER BY utp.issued_at DESC
      LIMIT 1
    `, [loginCode, tempPassword]);
    
    console.log('verifyTemporaryPassword: データベースクエリ結果', { rowCount: rows.length });

    if (rows.length === 0) {
      return {
        success: false,
        message: 'ログインコードまたはパスワードが正しくありません'
      };
    }

    const user = rows[0];

    // 使用済みチェック
    if (user.is_used) {
      return {
        success: false,
        message: 'このパスワードは既に使用されています'
      };
    }

    // JWTトークンを生成
    const userData = {
      user_id: user.id,
      user_name: user.name,
      role: user.role,
      company_id: user.company_id
    };
    
    const accessToken = generateAccessToken(userData);
    const refreshToken = generateRefreshToken(userData);
    
    // リフレッシュトークンをデータベースに保存
    await saveRefreshToken(user.id, refreshToken);
    
    // ログイン時は使用済みフラグを更新しない（ログアウト時に更新）

    console.log('verifyTemporaryPassword: 指導員名デバッグ:', {
      instructor_name: user.instructor_name,
      type: typeof user.instructor_name,
      isTruthy: !!user.instructor_name,
      user: user
    });

    return {
      success: true,
      message: 'ログインに成功しました',
      data: {
        userId: user.id,
        userName: user.name,
        role: user.role,
        instructorName: user.instructor_name,
        expiresAt: user.expires_at,
        access_token: accessToken,
        refresh_token: refreshToken
      }
    };
  } catch (error) {
    console.error('verifyTemporaryPassword: エラー発生', {
      error: error.message,
      stack: error.stack,
      loginCode,
      tempPassword: tempPassword ? '***' : 'なし'
    });
    return {
      success: false,
      message: 'パスワード検証に失敗しました',
      error: error.message
    };
  } finally {
    if (connection) {
      try {
        connection.release();
        console.log('verifyTemporaryPassword: データベース接続を解放');
      } catch (releaseError) {
        console.error('verifyTemporaryPassword: 接続解放エラー:', releaseError);
      }
    }
  }
};

// 指導員のパスワード変更
const changeInstructorPassword = async (userId, currentPassword, newPassword) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // ユーザーの存在確認
    const [userRows] = await connection.execute(
      'SELECT id, name FROM user_accounts WHERE id = ?',
      [userId]
    );

    if (userRows.length === 0) {
      return {
        success: false,
        message: '指定されたユーザーが見つかりません'
      };
    }

    // 現在のパスワードを確認
    const [credentialRows] = await connection.execute(
      'SELECT password_hash FROM admin_credentials WHERE user_id = ?',
      [userId]
    );

    if (credentialRows.length === 0) {
      return {
        success: false,
        message: '認証情報が見つかりません'
      };
    }

    const isValidPassword = await bcrypt.compare(currentPassword, credentialRows[0].password_hash);
    if (!isValidPassword) {
      return {
        success: false,
        message: '現在のパスワードが正しくありません'
      };
    }

    // 新しいパスワードをハッシュ化
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    
    // パスワードを更新
    await connection.execute(
      'UPDATE admin_credentials SET password_hash = ?, updated_at = NOW() WHERE user_id = ?',
      [newPasswordHash, userId]
    );

    // パスワード変更要求フラグをクリア
    await connection.execute(
      'UPDATE user_accounts SET password_reset_required = 0 WHERE id = ?',
      [userId]
    );

    return {
      success: true,
      message: 'パスワードが正常に変更されました'
    };
  } catch (error) {
    console.error('Error changing instructor password:', error);
    return {
      success: false,
      message: 'パスワードの変更に失敗しました',
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

// ログアウト時に使用済みフラグを更新
const markTempPasswordAsUsed = async (userId) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // ユーザーの最新の未使用一時パスワードを使用済みにマーク
    const [result] = await connection.execute(
      'UPDATE user_temp_passwords SET is_used = 1, used_at = NOW() WHERE user_id = ? AND is_used = 0 ORDER BY issued_at DESC LIMIT 1',
      [userId]
    );

    if (result.affectedRows > 0) {
      console.log(`ユーザーID ${userId} の一時パスワードを使用済みにマークしました`);
      return {
        success: true,
        message: '一時パスワードを使用済みにマークしました'
      };
    } else {
      console.log(`ユーザーID ${userId} の未使用一時パスワードが見つかりませんでした`);
      return {
        success: true,
        message: '未使用の一時パスワードがありませんでした'
      };
    }
  } catch (error) {
    console.error('一時パスワード使用済みマークエラー:', error);
    return {
      success: false,
      message: '一時パスワードの使用済みマークに失敗しました',
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

// ログインコード更新
const updateLoginCodes = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    console.log('=== ログインコード更新開始 ===');
    
    // 古い形式のログインコードを持つユーザーを取得
    const [users] = await connection.execute(`
      SELECT id, name, login_code 
      FROM user_accounts 
      WHERE login_code LIKE 'token%' OR login_code NOT LIKE '%-%-%'
    `);
    
    console.log(`更新対象ユーザー数: ${users.length}`);
    
    const updatedUsers = [];
    
    if (users.length > 0) {
      // 各ユーザーのログインコードを更新
      for (const user of users) {
        const newLoginCode = generateLoginCode();
        
        console.log(`ユーザー ${user.name} (ID: ${user.id}) のログインコードを更新:`);
        console.log(`  古い形式: ${user.login_code}`);
        console.log(`  新しい形式: ${newLoginCode}`);
        
        await connection.execute(
          'UPDATE user_accounts SET login_code = ? WHERE id = ?',
          [newLoginCode, user.id]
        );
        
        updatedUsers.push({
          id: user.id,
          name: user.name,
          oldLoginCode: user.login_code,
          newLoginCode: newLoginCode
        });
        
        console.log(`  ✅ 更新完了`);
      }
    }
    
    console.log('=== ログインコード更新完了 ===');
    
    return {
      success: true,
      message: `${updatedUsers.length}件のログインコードを更新しました`,
      data: {
        updatedCount: updatedUsers.length,
        updatedUsers: updatedUsers
      }
    };
    
  } catch (error) {
    console.error('ログインコード更新エラー:', error);
    return {
      success: false,
      message: 'ログインコードの更新に失敗しました',
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

// 指導員の専門分野を取得
const getInstructorSpecializations = async (userId) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    const [rows] = await connection.execute(
      'SELECT id, specialization, created_at, updated_at FROM instructor_specializations WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );

    return {
      success: true,
      data: rows
    };
  } catch (error) {
    console.error('Error fetching instructor specializations:', error);
    return {
      success: false,
      message: '専門分野の取得に失敗しました',
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

// 指導員の専門分野を追加
const addInstructorSpecialization = async (userId, specialization) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    const [result] = await connection.execute(
      'INSERT INTO instructor_specializations (user_id, specialization) VALUES (?, ?)',
      [userId, specialization]
    );

    return {
      success: true,
      message: '専門分野が追加されました',
      data: {
        id: result.insertId
      }
    };
  } catch (error) {
    console.error('Error adding instructor specialization:', error);
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

// 指導員の専門分野を更新
const updateInstructorSpecialization = async (specializationId, specialization) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    const [result] = await connection.execute(
      'UPDATE instructor_specializations SET specialization = ?, updated_at = NOW() WHERE id = ?',
      [specialization, specializationId]
    );

    if (result.affectedRows === 0) {
      return {
        success: false,
        message: '指定された専門分野が見つかりません'
      };
    }

    return {
      success: true,
      message: '専門分野が更新されました'
    };
  } catch (error) {
    console.error('Error updating instructor specialization:', error);
    return {
      success: false,
      message: '専門分野の更新に失敗しました',
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

// 指導員の専門分野を削除
const deleteInstructorSpecialization = async (specializationId) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    const [result] = await connection.execute(
      'DELETE FROM instructor_specializations WHERE id = ?',
      [specializationId]
    );

    if (result.affectedRows === 0) {
      return {
        success: false,
        message: '指定された専門分野が見つかりません'
      };
    }

    return {
      success: true,
      message: '専門分野が削除されました'
    };
  } catch (error) {
    console.error('Error deleting instructor specialization:', error);
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
 * 拠点内の利用者と担当指導員の関係を取得
 */
const getSatelliteUserInstructorRelations = async (satelliteId) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    const [rows] = await connection.execute(`
      SELECT 
        u.id as user_id,
        u.name as user_name,
        u.instructor_id,
        i.name as instructor_name,
        u.status as user_status
      FROM user_accounts u
      LEFT JOIN user_accounts i ON u.instructor_id = i.id
      WHERE u.role = 1 
        AND JSON_CONTAINS(u.satellite_ids, ?)
        AND u.status = 1
      ORDER BY u.name
    `, [JSON.stringify(satelliteId)]);
    
    return {
      success: true,
      data: rows
    };
  } catch (error) {
    console.error('拠点利用者担当指導員関係取得エラー:', error);
    return {
      success: false,
      message: '拠点利用者担当指導員関係の取得に失敗しました',
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
 * 拠点内の指導員一覧を取得（担当指導員として選択可能）
 */
const getSatelliteAvailableInstructors = async (satelliteId) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    const [rows] = await connection.execute(`
      SELECT 
        u.id,
        u.name,
        u.role,
        u.status
      FROM user_accounts u
      WHERE (u.role = 4 OR u.role = 5)
        AND JSON_CONTAINS(u.satellite_ids, ?)
        AND u.status = 1
      ORDER BY u.name
    `, [JSON.stringify(satelliteId)]);
    
    return {
      success: true,
      data: rows
    };
  } catch (error) {
    console.error('拠点利用可能指導員取得エラー:', error);
    return {
      success: false,
      message: '拠点利用可能指導員の取得に失敗しました',
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
 * 個別利用者の担当指導員を変更
 */
const updateUserInstructor = async (userId, instructorId) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // 利用者の存在確認
    const [userRows] = await connection.execute(
      'SELECT id, name, role FROM user_accounts WHERE id = ? AND role = 1',
      [userId]
    );
    
    if (userRows.length === 0) {
      return {
        success: false,
        message: '指定された利用者が見つかりません'
      };
    }
    
    // 指導員の存在確認（instructorIdがnullの場合はスキップ）
    if (instructorId !== null) {
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
    }
    
    // 担当指導員を更新
    await connection.execute(
      'UPDATE user_accounts SET instructor_id = ? WHERE id = ?',
      [instructorId, userId]
    );
    
    return {
      success: true,
      message: '担当指導員を更新しました'
    };
  } catch (error) {
    console.error('担当指導員更新エラー:', error);
    return {
      success: false,
      message: '担当指導員の更新に失敗しました',
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
 * 一括で利用者の担当指導員を変更
 */
const bulkUpdateUserInstructors = async (satelliteId, assignments) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // トランザクション開始
    await connection.beginTransaction();
    
    // 拠点内の利用者一覧を取得
    const [userRows] = await connection.execute(`
      SELECT id, name FROM user_accounts 
      WHERE role = 1 
        AND JSON_CONTAINS(satellite_ids, ?)
        AND status = 1
    `, [JSON.stringify(satelliteId)]);
    
    const validUserIds = userRows.map(row => row.id);
    
    // 利用可能な指導員一覧を取得
    const [instructorRows] = await connection.execute(`
      SELECT id, name FROM user_accounts 
      WHERE (role = 4 OR role = 5)
        AND JSON_CONTAINS(satellite_ids, ?)
        AND status = 1
    `, [JSON.stringify(satelliteId)]);
    
    const validInstructorIds = instructorRows.map(row => row.id);
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    // 各割り当てを処理
    for (const assignment of assignments) {
      try {
        // 利用者IDの妥当性チェック
        if (!validUserIds.includes(assignment.userId)) {
          errors.push(`利用者ID ${assignment.userId} が見つかりません`);
          errorCount++;
          continue;
        }
        
        // 指導員IDの妥当性チェック（nullの場合はスキップ）
        if (assignment.instructorId !== null && !validInstructorIds.includes(assignment.instructorId)) {
          errors.push(`指導員ID ${assignment.instructorId} が見つかりません`);
          errorCount++;
          continue;
        }
        
        // 担当指導員を更新
        await connection.execute(
          'UPDATE user_accounts SET instructor_id = ? WHERE id = ?',
          [assignment.instructorId, assignment.userId]
        );
        
        successCount++;
      } catch (error) {
        errors.push(`利用者ID ${assignment.userId} の更新に失敗: ${error.message}`);
        errorCount++;
      }
    }
    
    // トランザクションをコミット
    await connection.commit();
    
    return {
      success: true,
      message: `一括更新が完了しました（成功: ${successCount}件、失敗: ${errorCount}件）`,
      data: {
        successCount,
        errorCount,
        errors: errors.length > 0 ? errors : undefined
      }
    };
  } catch (error) {
    // トランザクションをロールバック
    if (connection) {
      await connection.rollback();
    }
    
    console.error('一括担当指導員更新エラー:', error);
    return {
      success: false,
      message: '一括担当指導員更新に失敗しました',
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
 * 拠点内の全利用者の担当指導員を一括削除
 */
const bulkRemoveUserInstructors = async (satelliteId) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // 拠点内の利用者の担当指導員を一括削除
    const [result] = await connection.execute(`
      UPDATE user_accounts 
      SET instructor_id = NULL 
      WHERE role = 1 
        AND JSON_CONTAINS(satellite_ids, ?)
        AND status = 1
    `, [JSON.stringify(satelliteId)]);
    
    return {
      success: true,
      message: `${result.affectedRows}件の利用者の担当指導員を削除しました`,
      data: {
        affectedRows: result.affectedRows
      }
    };
  } catch (error) {
    console.error('一括担当指導員削除エラー:', error);
    return {
      success: false,
      message: '一括担当指導員削除に失敗しました',
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
 * 拠点内の通所利用者一覧を取得（在宅支援追加用）
 */
const getSatelliteUsersForHomeSupport = async (req, res) => {
  const { satelliteId } = req.params;
  const { instructorIds } = req.query;
  const connection = await pool.getConnection();
  
  try {
    let query = `
      SELECT 
        ua.id,
        ua.name,
        ua.login_code,
        CASE WHEN ua.is_remote_user = 1 THEN true ELSE false END as is_remote_user,
        ua.instructor_id,
        instructor.name as instructor_name,
        ua.company_id,
        c.name as company_name
      FROM user_accounts ua
      LEFT JOIN user_accounts instructor ON ua.instructor_id = instructor.id
      LEFT JOIN companies c ON ua.company_id = c.id
      WHERE ua.role = 1 
        AND JSON_CONTAINS(ua.satellite_ids, ?)
        AND ua.status = 1
        AND ua.is_remote_user = 0
    `;
    
    const params = [JSON.stringify(parseInt(satelliteId))];
    
    // 特定の指導員の利用者のみを取得する場合
    if (instructorIds) {
      const instructorIdArray = instructorIds.split(',').map(id => parseInt(id.trim()));
      query += ` AND (ua.instructor_id IN (${instructorIdArray.map(() => '?').join(',')}) OR ua.instructor_id IS NULL)`;
      params.push(...instructorIdArray);
    }
    
    query += ` ORDER BY ua.instructor_id, ua.name`;
    
    const [rows] = await connection.execute(query, params);
    
    customLogger.info('Satellite users for home support retrieved successfully', {
      satelliteId,
      instructorIds,
      count: rows.length,
      userId: req.user?.user_id
    });

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    customLogger.error('Error fetching satellite users for home support:', error);
    res.status(500).json({
      success: false,
      message: '拠点利用者の取得に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * 在宅支援フラグを一括更新
 */
const bulkUpdateHomeSupportFlag = async (req, res) => {
  const { userIds, isRemoteUser } = req.body;
  const connection = await pool.getConnection();
  
  try {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: '利用者IDの配列が必要です'
      });
    }
    
    const [result] = await connection.execute(`
      UPDATE user_accounts 
      SET is_remote_user = ?
      WHERE id IN (${userIds.map(() => '?').join(',')})
        AND role = 1
    `, [isRemoteUser ? 1 : 0, ...userIds]);
    
    customLogger.info('Home support flag updated successfully', {
      userIds,
      isRemoteUser,
      affectedRows: result.affectedRows,
      updatedBy: req.user?.user_id
    });

    res.json({
      success: true,
      message: `${result.affectedRows}名の利用者の在宅支援フラグを更新しました`,
      data: {
        affectedRows: result.affectedRows
      }
    });
  } catch (error) {
    customLogger.error('Error updating home support flag:', error);
    res.status(500).json({
      success: false,
      message: '在宅支援フラグの更新に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * 拠点内の在宅支援利用者一覧を取得
 */
const getSatelliteHomeSupportUsers = async (req, res) => {
  const { satelliteId } = req.params;
  const { instructorIds } = req.query;
  const connection = await pool.getConnection();
  
  try {
    let query = `
      SELECT 
        ua.id,
        ua.name,
        ua.login_code,
        CASE WHEN ua.is_remote_user = 1 THEN true ELSE false END as is_remote_user,
        ua.instructor_id,
        instructor.name as instructor_name,
        ua.company_id,
        c.name as company_name
      FROM user_accounts ua
      LEFT JOIN user_accounts instructor ON ua.instructor_id = instructor.id
      LEFT JOIN companies c ON ua.company_id = c.id
      WHERE ua.role = 1 
        AND JSON_CONTAINS(ua.satellite_ids, ?)
        AND ua.status = 1
        AND ua.is_remote_user = 1
    `;
    
    const params = [JSON.stringify(parseInt(satelliteId))];
    
    // 特定の指導員の利用者のみを取得する場合
    if (instructorIds) {
      const instructorIdArray = instructorIds.split(',').map(id => parseInt(id.trim()));
      query += ` AND (ua.instructor_id IN (${instructorIdArray.map(() => '?').join(',')}) OR ua.instructor_id IS NULL)`;
      params.push(...instructorIdArray);
    }
    
    query += ` ORDER BY ua.instructor_id, ua.name`;
    
    const [rows] = await connection.execute(query, params);
    
    customLogger.info('Satellite home support users retrieved successfully', {
      satelliteId,
      instructorIds,
      count: rows.length,
      userId: req.user?.user_id
    });

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    customLogger.error('Error fetching satellite home support users:', error);
    res.status(500).json({
      success: false,
      message: '在宅支援利用者の取得に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * 在宅支援解除（単一利用者）
 */
const removeHomeSupportFlag = async (req, res) => {
  const { userId } = req.params;
  const connection = await pool.getConnection();
  
  try {
    // 現在のタグを取得
    const [currentUser] = await connection.execute(`
      SELECT tags FROM user_accounts WHERE id = ? AND role = 1
    `, [userId]);
    
    if (currentUser.length === 0) {
      return res.status(404).json({
        success: false,
        message: '指定された利用者が見つからないか、在宅支援対象ではありません'
      });
    }
    
    // 現在のタグを解析
    let currentTags = [];
    if (currentUser[0].tags) {
      try {
        currentTags = JSON.parse(currentUser[0].tags);
      } catch (e) {
        currentTags = [];
      }
    }
    
    // 「在宅支援」タグを削除
    const updatedTags = currentTags.filter(tag => tag !== '在宅支援');
    
    // 在宅支援フラグを解除し、タグも更新
    const [result] = await connection.execute(`
      UPDATE user_accounts 
      SET is_remote_user = 0, tags = ?
      WHERE id = ? AND role = 1
    `, [JSON.stringify(updatedTags), userId]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: '指定された利用者が見つからないか、在宅支援対象ではありません'
      });
    }
    
    customLogger.info('Home support flag and tag removed successfully', {
      userId,
      affectedRows: result.affectedRows,
      updatedTags,
      updatedBy: req.user?.user_id
    });

    res.json({
      success: true,
      message: '在宅支援を解除しました',
      data: {
        affectedRows: result.affectedRows,
        updatedTags
      }
    });
  } catch (error) {
    customLogger.error('Error removing home support flag:', error);
    res.status(500).json({
      success: false,
      message: '在宅支援解除に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * 拠点内の指導員一覧を取得（在宅支援用）
 */
const getSatelliteInstructorsForHomeSupport = async (req, res) => {
  const { satelliteId } = req.params;
  const connection = await pool.getConnection();
  
  try {
    const [rows] = await connection.execute(`
      SELECT DISTINCT
        ua.id,
        ua.name,
        ua.login_code,
        COUNT(students.id) as student_count
      FROM user_accounts ua
      LEFT JOIN user_accounts students ON ua.id = students.instructor_id 
        AND students.role = 1 
        AND JSON_CONTAINS(students.satellite_ids, ?)
        AND students.status = 1
      WHERE ua.role = 4 
        AND JSON_CONTAINS(ua.satellite_ids, ?)
        AND ua.status = 1
      GROUP BY ua.id, ua.name, ua.login_code
      ORDER BY ua.name
    `, [JSON.stringify(parseInt(satelliteId)), JSON.stringify(parseInt(satelliteId))]);
    
    customLogger.info('Satellite instructors for home support retrieved successfully', {
      satelliteId,
      count: rows.length,
      userId: req.user?.user_id
    });

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    customLogger.error('Error fetching satellite instructors for home support:', error);
    res.status(500).json({
      success: false,
      message: '拠点指導員の取得に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * ユーザーのタグを一括追加
 */
const bulkAddUserTags = async (req, res) => {
  const { userIds, tags } = req.body;
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // 各ユーザーに対してタグを追加
    for (const userId of userIds) {
      for (const tag of tags) {
        try {
          await connection.execute(`
            INSERT IGNORE INTO user_tags (user_id, tag_name) 
            VALUES (?, ?)
          `, [userId, tag]);
        } catch (error) {
          console.error(`タグ追加エラー (user_id: ${userId}, tag: ${tag}):`, error);
        }
      }
    }
    
    await connection.commit();
    
    customLogger.info('User tags added successfully', {
      userIds,
      tags,
      userId: req.user?.user_id
    });

    res.json({
      success: true,
      message: 'タグが正常に追加されました',
      data: {
        affectedUsers: userIds.length,
        addedTags: tags
      }
    });
  } catch (error) {
    await connection.rollback();
    customLogger.error('Error adding user tags:', error);
    res.status(500).json({
      success: false,
      message: 'タグの追加に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * ユーザーのタグを削除
 */
const removeUserTag = async (req, res) => {
  const { userId, tagName } = req.params;
  const connection = await pool.getConnection();
  
  try {
    const [result] = await connection.execute(`
      DELETE FROM user_tags 
      WHERE user_id = ? AND tag_name = ?
    `, [userId, tagName]);
    
    customLogger.info('User tag removed successfully', {
      userId,
      tagName,
      affectedRows: result.affectedRows,
      userId: req.user?.user_id
    });

    res.json({
      success: true,
      message: 'タグが削除されました',
      data: {
        affectedRows: result.affectedRows
      }
    });
  } catch (error) {
    customLogger.error('Error removing user tag:', error);
    res.status(500).json({
      success: false,
      message: 'タグの削除に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * 全タグ一覧を取得
 */
const getAllTags = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const [rows] = await connection.execute(`
      SELECT DISTINCT tag_name, COUNT(*) as usage_count
      FROM user_tags
      GROUP BY tag_name
      ORDER BY usage_count DESC, tag_name
    `);
    
    const tags = rows.map(row => ({
      name: row.tag_name,
      usageCount: row.usage_count
    }));
    
    customLogger.info('All tags retrieved successfully', {
      count: tags.length,
      userId: req.user?.user_id
    });

    res.json({
      success: true,
      data: tags
    });
  } catch (error) {
    customLogger.error('Error fetching all tags:', error);
    res.status(500).json({
      success: false,
      message: 'タグ一覧の取得に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * 一括利用者追加
 */
const bulkCreateUsers = async (req, res) => {
  console.log('=== bulkCreateUsers関数開始 ===');
  console.log('リクエストボディ:', req.body);
  console.log('リクエストボディの型:', typeof req.body);
  console.log('usersプロパティ:', req.body.users);
  console.log('usersの型:', typeof req.body.users);
  console.log('usersの長さ:', req.body.users ? req.body.users.length : 'undefined');
  
  let connection;
  try {
    console.log('データベース接続を取得中...');
    connection = await pool.getConnection();
    console.log('データベース接続取得成功');
    
    // データベース接続テスト
    try {
      const [testResult] = await connection.execute('SELECT 1 as test');
      console.log('データベース接続テスト成功:', testResult);
    } catch (testError) {
      console.error('データベース接続テスト失敗:', testError);
      return res.status(500).json({
        success: false,
        message: 'データベース接続テストに失敗しました',
        error: testError.message
      });
    }
  } catch (connectionError) {
    console.error('データベース接続エラー:', connectionError);
    return res.status(500).json({
      success: false,
      message: 'データベース接続に失敗しました',
      error: connectionError.message
    });
  }
  
  try {
    const { users } = req.body;
    
    console.log('取得したusers:', users);
    
    if (!Array.isArray(users) || users.length === 0) {
      console.log('usersが配列でないか、空です');
      return res.status(400).json({
        success: false,
        message: '利用者データが正しく指定されていません'
      });
    }
    
    await connection.beginTransaction();
    
    const createdUsers = [];
    const errors = [];
    
    for (let i = 0; i < users.length; i++) {
      const userData = users[i];
      
      try {
        console.log(`処理中のユーザーデータ ${i + 1}:`, userData);
        console.log(`ユーザーデータ ${i + 1} の型:`, typeof userData);
        console.log(`ユーザーデータ ${i + 1} のname:`, userData.name);
        console.log(`ユーザーデータ ${i + 1} のemail:`, userData.email);
        
        // 必須フィールドのチェック
        if (!userData.name || userData.name.trim() === '') {
          console.log(`行${i + 1}: 名前が空です`);
          errors.push(`行${i + 1}: 利用者名は必須です`);
          continue;
        }
        
        // メールアドレスの形式チェック（指定されている場合のみ）
        if (userData.email && userData.email.trim() !== '') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(userData.email.trim())) {
            errors.push(`行${i + 1}: 有効なメールアドレス形式ではありません: ${userData.email}`);
            continue;
          }
        }
        
        // ログインコードの自動生成
        const loginCode = generateLoginCode();
        
        // ユーザー作成
        console.log(`行${i + 1}: データベース挿入開始`);
        console.log(`行${i + 1}: 挿入データ:`, {
          name: userData.name,
          email: userData.email || null,
          role: userData.role || 1,
          status: userData.status || 1,
          loginCode,
          company_id: userData.company_id || 4,
          satellite_id: userData.satellite_id,
          satellite_ids: JSON.stringify(userData.satellite_ids || []),
          instructor_id: userData.instructor_id || null
        });
        
        // company_idの検証
        if (!userData.company_id) {
          console.log(`行${i + 1}: company_idが指定されていません`);
          errors.push(`行${i + 1}: 所属企業の指定は必須です`);
          continue;
        }

        // satellite_idを配列に変換
        let satelliteIds = [];
        if (userData.satellite_id) {
          satelliteIds = [userData.satellite_id];
        } else if (userData.satellite_ids && Array.isArray(userData.satellite_ids)) {
          satelliteIds = userData.satellite_ids;
        }

        const [result] = await connection.execute(
          `INSERT INTO user_accounts (
            name, 
            email,
            role, 
            status, 
            login_code, 
            company_id, 
            satellite_ids,
            instructor_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userData.name,
            userData.email || null,
            userData.role || 1,
            userData.status || 1,
            loginCode,
            userData.company_id,
            JSON.stringify(satelliteIds),
            userData.instructor_id || null
          ]
        );
        
        console.log(`行${i + 1}: データベース挿入成功, userId:`, result.insertId);
        
        const userId = result.insertId;
        
        // タグの追加（指定されている場合）
        if (userData.tags && Array.isArray(userData.tags) && userData.tags.length > 0) {
          for (const tag of userData.tags) {
            if (tag.trim()) {
              await connection.execute(
                'INSERT INTO user_tags (user_id, tag_name) VALUES (?, ?)',
                [userId, tag.trim()]
              );
            }
          }
        }
        
        createdUsers.push({
          id: userId,
          name: userData.name,
          login_code: loginCode
        });
        
      } catch (error) {
        errors.push(`行${i + 1}: ${error.message}`);
      }
    }
    
    if (errors.length > 0) {
      await connection.rollback();
      console.log('一括利用者追加エラー:', errors);
      return res.status(400).json({
        success: false,
        message: `${errors.length}件のエラーが発生しました`,
        errors: errors,
        createdUsers: createdUsers,
        totalProcessed: users.length,
        successCount: createdUsers.length,
        errorCount: errors.length
      });
    }
    
    await connection.commit();
    
    customLogger.info('Bulk users created successfully', {
      count: createdUsers.length,
      userId: req.user?.user_id
    });
    
    console.log('一括利用者追加成功:', createdUsers);
    
    res.status(201).json({
      success: true,
      message: `${createdUsers.length}名の利用者が追加されました`,
      data: {
        createdUsers: createdUsers
      }
    });
    
  } catch (error) {
    await connection.rollback();
    customLogger.error('Error in bulk user creation:', error);
    res.status(500).json({
      success: false,
      message: '一括利用者追加に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

module.exports = {
  getUsers,
  getTopUsersByCompany,
  getTeachersByCompany,
  healthCheck,
  getUserSatellites,
  getSatelliteUsers,
  addSatelliteToUser,
  removeSatelliteFromUser,
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword,
  changeInstructorPassword,
  issueTemporaryPassword,
  verifyTemporaryPassword,
  markTempPasswordAsUsed,
  updateLoginCodes,
  generateLoginCode,
  getInstructorSpecializations,
  addInstructorSpecialization,
  updateInstructorSpecialization,
  deleteInstructorSpecialization,
  getSatelliteUserInstructorRelations,
  getSatelliteAvailableInstructors,
  updateUserInstructor,
  bulkUpdateUserInstructors,
  bulkRemoveUserInstructors,
  getSatelliteUsersForHomeSupport,
  getSatelliteHomeSupportUsers,
  bulkUpdateHomeSupportFlag,
  removeHomeSupportFlag,
  getSatelliteInstructorsForHomeSupport,
  bulkAddUserTags,
  removeUserTag,
  getAllTags,
  bulkCreateUsers
}; 