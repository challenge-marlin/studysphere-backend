const bcrypt = require('bcryptjs');
const { pool } = require('../utils/database');
const { 
  generateAccessToken, 
  generateRefreshToken, 
  saveRefreshToken,
  verifyRefreshToken,
  deleteRefreshToken,
  deleteAllUserRefreshTokens
} = require('../utils/tokenManager');

// 管理者ログイン処理
const adminLogin = async (username, password) => {
  let connection;
  try {
    console.log('=== Login Debug Info ===');
    console.log('Attempting login with username:', username);
    console.log('Password provided:', password ? 'Yes' : 'No');
    
    connection = await pool.getConnection();
    
    // 管理者認証情報を取得
    const [adminRows] = await connection.execute(`
      SELECT 
        ac.id,
        ac.user_id,
        ac.username,
        ac.password_hash,
        ua.name as user_name,
        ua.login_code,
        ua.role,
        ua.company_id,
        ua.satellite_ids,
        ua.status,
        COALESCE(c.name, 'システム管理者') as company_name
      FROM admin_credentials ac
      JOIN user_accounts ua ON ac.user_id = ua.id
      LEFT JOIN companies c ON ua.company_id = c.id
      WHERE ac.username = ? 
        AND ua.status = 1
        AND ua.role >= 4
    `, [username]);
    
    console.log('Found admin rows:', adminRows.length);
    if (adminRows.length > 0) {
      console.log('Admin data:', {
        user_id: adminRows[0].user_id,
        username: adminRows[0].username,
        user_name: adminRows[0].user_name,
        role: adminRows[0].role,
        status: adminRows[0].status,
        has_password: adminRows[0].password_hash ? 'Yes' : 'No'
      });
    }

    if (adminRows.length === 0) {
      return {
        success: false,
        statusCode: 401,
        message: 'ユーザー名またはパスワードが正しくありません'
      };
    }

    const admin = adminRows[0];

    // パスワードの検証
    console.log('Password verification:');
    console.log('Input password:', password);
    console.log('Stored hash exists:', admin.password_hash ? 'Yes' : 'No');
    
    const isPasswordValid = await bcrypt.compare(password, admin.password_hash);
    console.log('Password valid:', isPasswordValid);
    
    if (!isPasswordValid) {
      console.log('Password verification failed');
      return {
        success: false,
        statusCode: 401,
        message: 'ユーザー名またはパスワードが正しくありません'
      };
    }

    // 最終ログイン日時を更新
    await connection.execute(
      'UPDATE admin_credentials SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?',
      [admin.id]
    );

    // 既存のリフレッシュトークンを削除
    await deleteAllUserRefreshTokens(admin.user_id);

    // トークン生成
    const accessToken = generateAccessToken(admin);
    const refreshToken = generateRefreshToken(admin);

    // リフレッシュトークンをデータベースに保存
    await saveRefreshToken(admin.user_id, refreshToken);

    // レスポンスデータ（パスワードハッシュは除外）
    const responseData = {
      user_id: admin.user_id,
      user_name: admin.user_name,
      login_code: admin.login_code,
      role: admin.role,
      company_id: admin.company_id,
      company_name: admin.company_name,
      satellite_ids: (() => {
        try {
          if (!admin.satellite_ids) return [];
          if (typeof admin.satellite_ids === 'string') {
            return JSON.parse(admin.satellite_ids);
          }
          if (Array.isArray(admin.satellite_ids)) {
            return admin.satellite_ids;
          }
          return [];
        } catch (error) {
          console.error('satellite_ids parse error:', error);
          return [];
        }
      })(),
      access_token: accessToken,
      refresh_token: refreshToken
    };

    return {
      success: true,
      statusCode: 200,
      message: 'ログインに成功しました',
      data: responseData
    };

  } catch (error) {
    console.error('Admin login error:', error);
    return {
      success: false,
      statusCode: 500,
      message: 'サーバーエラーが発生しました',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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

// 指導員ログイン処理（企業・拠点選択）
const instructorLogin = async (username, password, companyId, satelliteId) => {
  let connection;
  try {
    console.log('=== Instructor Login Debug Info ===');
    console.log('Attempting instructor login with username:', username);
    console.log('Company ID:', companyId);
    console.log('Satellite ID:', satelliteId);
    
    connection = await pool.getConnection();
    
    // 管理者認証情報を取得
    const [adminRows] = await connection.execute(`
      SELECT 
        ac.id,
        ac.user_id,
        ac.username,
        ac.password_hash,
        ua.name as user_name,
        ua.login_code,
        ua.role,
        ua.company_id,
        ua.satellite_ids,
        ua.status,
        COALESCE(c.name, 'システム管理者') as company_name
      FROM admin_credentials ac
      JOIN user_accounts ua ON ac.user_id = ua.id
      LEFT JOIN companies c ON ua.company_id = c.id
      WHERE ac.username = ? 
        AND ua.status = 1
        AND ua.role >= 4
    `, [username]);
    
    if (adminRows.length === 0) {
      console.log('ユーザーが見つかりません - username:', username);
      return {
        success: false,
        statusCode: 401,
        message: 'ユーザー名またはパスワードが正しくありません'
      };
    }

    const admin = adminRows[0];
    console.log('ユーザー認証成功 - パスワード検証開始');

    // パスワードの検証
    console.log('パスワード検証 - 入力パスワード:', password ? '入力済み' : '未入力');
    console.log('パスワード検証 - ハッシュ存在:', admin.password_hash ? 'Yes' : 'No');
    const isPasswordValid = await bcrypt.compare(password, admin.password_hash);
    console.log('パスワード検証結果:', isPasswordValid);
    
    if (!isPasswordValid) {
      console.log('パスワード検証失敗');
      return {
        success: false,
        statusCode: 401,
        message: 'ユーザー名またはパスワードが正しくありません'
      };
    }

    // 企業と拠点の権限チェック
    const satelliteIds = (() => {
      try {
        if (!admin.satellite_ids) return [];
        if (typeof admin.satellite_ids === 'string') {
          return JSON.parse(admin.satellite_ids);
        }
        if (Array.isArray(admin.satellite_ids)) {
          return admin.satellite_ids;
        }
        return [];
      } catch (error) {
        console.error('satellite_ids parse error in instructorLogin:', error);
        return [];
      }
    })();
    
    // ロール9（システム管理者）の場合はすべての拠点にアクセス可能
    if (admin.role >= 9) {
      console.log('Role 9+ user, allowing access to all satellites');
    } else {
      // 指定された拠点にアクセス権限があるかチェック
      // satelliteIdsは文字列の配列なので、文字列として比較
      const satelliteIdStr = satelliteId.toString();
      if (satelliteId && !satelliteIds.includes(satelliteIdStr)) {
        console.log('Access denied - satelliteId:', satelliteIdStr, 'available satellites:', satelliteIds);
        return {
          success: false,
          statusCode: 403,
          message: '指定された拠点へのアクセス権限がありません'
        };
      }
    }

    // 拠点情報を取得
    let satelliteInfo = null;
    if (satelliteId) {
      const [satelliteRows] = await connection.execute(`
        SELECT 
          s.id,
          s.name as satellite_name,
          s.manager_ids,
          c.id as company_id,
          c.name as company_name
        FROM satellites s
        JOIN companies c ON s.company_id = c.id
        WHERE s.id = ? AND s.status = 1
      `, [satelliteId]);
      
      if (satelliteRows.length > 0) {
        satelliteInfo = satelliteRows[0];
        // 拠点管理者かどうかを判定
        let managerIds = [];
        try {
          if (satelliteInfo.manager_ids) {
            const parsed = JSON.parse(satelliteInfo.manager_ids);
            managerIds = Array.isArray(parsed) ? parsed : [];
          }
        } catch (error) {
          console.error('Error parsing manager_ids in instructorLogin:', error);
          managerIds = [];
        }
        
        const isManager = managerIds.includes(admin.user_id);
        
        // 拠点管理者の場合はロールを5に変更
        if (isManager && admin.role === 4) {
          await connection.execute(
            'UPDATE user_accounts SET role = 5 WHERE id = ?',
            [admin.user_id]
          );
          admin.role = 5;
        }
      }
    }

    // 最終ログイン日時を更新
    await connection.execute(
      'UPDATE admin_credentials SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?',
      [admin.id]
    );

    // 既存のリフレッシュトークンを削除
    await deleteAllUserRefreshTokens(admin.user_id);

    // トークン生成
    const accessToken = generateAccessToken(admin);
    const refreshToken = generateRefreshToken(admin);

    // リフレッシュトークンをデータベースに保存
    await saveRefreshToken(admin.user_id, refreshToken);

    // レスポンスデータ
    const responseData = {
      user_id: admin.user_id,
      user_name: admin.user_name,
      login_code: admin.login_code,
      role: admin.role,
      company_id: satelliteInfo ? satelliteInfo.company_id : admin.company_id,
      company_name: satelliteInfo ? satelliteInfo.company_name : admin.company_name,
      satellite_id: satelliteId ? parseInt(satelliteId) : null,
      satellite_name: satelliteInfo ? satelliteInfo.satellite_name : null,
      access_token: accessToken,
      refresh_token: refreshToken
    };

    return {
      success: true,
      statusCode: 200,
      message: '指導員ログインに成功しました',
      data: responseData
    };

  } catch (error) {
    console.error('Instructor login error:', error);
    return {
      success: false,
      statusCode: 500,
      message: 'サーバーエラーが発生しました',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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

// リフレッシュトークン処理
const refreshToken = async (refreshToken) => {
  let connection;
  try {
    console.log('リフレッシュトークン更新開始:', { refreshToken: refreshToken ? '存在' : 'なし' });
    
    // リフレッシュトークンの検証
    const tokenData = await verifyRefreshToken(refreshToken);
    console.log('トークン検証結果:', { tokenData: tokenData ? '有効' : '無効' });
    
    if (!tokenData) {
      console.log('リフレッシュトークンが無効です');
      return {
        success: false,
        statusCode: 401,
        message: '無効なリフレッシュトークンです'
      };
    }

    connection = await pool.getConnection();
    
    // ユーザー情報を取得
    const [userRows] = await connection.execute(`
      SELECT 
        ua.id as user_id,
        ua.name as user_name,
        ua.login_code,
        ua.role,
        ua.company_id,
        COALESCE(c.name, 'システム管理者') as company_name
      FROM user_accounts ua
      LEFT JOIN companies c ON ua.company_id = c.id
      WHERE ua.id = ? AND ua.status = 1
    `, [tokenData.user_id]);

    if (userRows.length === 0) {
      return {
        success: false,
        statusCode: 401,
        message: 'ユーザーが見つかりません'
      };
    }

    const user = userRows[0];
    console.log('ユーザー情報取得完了:', { userId: user.user_id, userName: user.user_name });

    // 新しいトークンを生成
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);
    console.log('新しいトークン生成完了');

    // 古いリフレッシュトークンを削除
    const deleteResult = await deleteRefreshToken(refreshToken);
    console.log('古いトークン削除結果:', deleteResult);

    // 新しいリフレッシュトークンを保存
    const saveResult = await saveRefreshToken(user.user_id, newRefreshToken);
    console.log('新しいトークン保存結果:', saveResult);

    return {
      success: true,
      statusCode: 200,
      message: 'トークンが更新されました',
      data: {
        access_token: newAccessToken,
        refresh_token: newRefreshToken
      }
    };

  } catch (error) {
    console.error('Refresh token error:', error);
    return {
      success: false,
      statusCode: 500,
      message: 'サーバーエラーが発生しました',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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

// ログアウト処理
const logout = async (refreshToken) => {
  try {
    if (refreshToken) {
      await deleteRefreshToken(refreshToken);
    }

    return {
      success: true,
      statusCode: 200,
      message: 'ログアウトしました'
    };

  } catch (error) {
    console.error('Logout error:', error);
    return {
      success: false,
      statusCode: 500,
      message: 'サーバーエラーが発生しました',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    };
  }
};

// ユーザーの企業・拠点情報を取得
const getUserCompaniesAndSatellites = async (username) => {
  let connection;
  try {
    console.log('=== getUserCompaniesAndSatellites Debug ===');
    console.log('Username:', username);
    
    connection = await pool.getConnection();
    
    // ユーザー情報を取得
    const [userRows] = await connection.execute(`
      SELECT 
        ua.id,
        ua.name,
        ua.role,
        ua.company_id,
        ua.satellite_ids
      FROM user_accounts ua
      JOIN admin_credentials ac ON ua.id = ac.user_id
      WHERE ac.username = ? AND ua.status = 1 AND ua.role >= 4
    `, [username]);
    
    console.log('User rows found:', userRows.length);
    if (userRows.length > 0) {
      console.log('User data:', {
        id: userRows[0].id,
        name: userRows[0].name,
        role: userRows[0].role,
        company_id: userRows[0].company_id,
        satellite_ids: userRows[0].satellite_ids
      });
    }
    
    if (userRows.length === 0) {
      return {
        success: false,
        statusCode: 404,
        message: 'ユーザーが見つかりません'
      };
    }

    const user = userRows[0];
    const satelliteIds = (() => {
      try {
        if (!user.satellite_ids) return [];
        if (typeof user.satellite_ids === 'string') {
          return JSON.parse(user.satellite_ids);
        }
        if (Array.isArray(user.satellite_ids)) {
          return user.satellite_ids;
        }
        return [];
      } catch (error) {
        console.error('satellite_ids parse error in getUserCompaniesAndSatellites:', error);
        return [];
      }
    })();
    console.log('Satellite IDs:', satelliteIds);
    console.log('User role:', user.role);
    
    // 所属拠点の情報を取得
    const companies = new Map();
    
    // ロール9（システム管理者）の場合はすべての企業・拠点にアクセス可能
    if (user.role >= 9) {
      console.log('Role 9+ detected, fetching all companies and satellites');
      
      const [allSatelliteRows] = await connection.execute(`
        SELECT 
          s.id as satellite_id,
          s.name as satellite_name,
          s.manager_ids,
          c.id as company_id,
          c.name as company_name
        FROM satellites s
        JOIN companies c ON s.company_id = c.id
        WHERE s.status = 1
        ORDER BY c.name, s.name
      `);
      
      console.log('All satellite rows found:', allSatelliteRows.length);
      
      for (const satellite of allSatelliteRows) {
        const companyId = satellite.company_id;
        if (!companies.has(companyId)) {
          companies.set(companyId, {
            id: companyId,
            name: satellite.company_name,
            satellites: []
          });
        }
        
        // manager_idsの安全な処理
        let managerIds = [];
        try {
          if (satellite.manager_ids) {
            const parsed = JSON.parse(satellite.manager_ids);
            managerIds = Array.isArray(parsed) ? parsed : [];
          }
        } catch (error) {
          console.error('Error parsing manager_ids:', error);
          managerIds = [];
        }
        
        const isManager = managerIds.includes(user.id);
        
        companies.get(companyId).satellites.push({
          id: satellite.satellite_id,
          name: satellite.satellite_name,
          isManager: isManager
        });
      }
    } else if (satelliteIds.length > 0) {
      // ロール4-8のユーザーは割り当てられた拠点のみアクセス可能
      console.log('Role 4-8 detected, fetching assigned satellites');
      
      const [satelliteRows] = await connection.execute(`
        SELECT 
          s.id as satellite_id,
          s.name as satellite_name,
          s.manager_ids,
          c.id as company_id,
          c.name as company_name
        FROM satellites s
        JOIN companies c ON s.company_id = c.id
        WHERE s.id IN (${satelliteIds.map(() => '?').join(',')}) AND s.status = 1
        ORDER BY c.name, s.name
      `, satelliteIds);
      
      console.log('Assigned satellite rows found:', satelliteRows.length);
      
      for (const satellite of satelliteRows) {
        const companyId = satellite.company_id;
        if (!companies.has(companyId)) {
          companies.set(companyId, {
            id: companyId,
            name: satellite.company_name,
            satellites: []
          });
        }
        
        // manager_idsの安全な処理
        let managerIds = [];
        try {
          if (satellite.manager_ids) {
            const parsed = JSON.parse(satellite.manager_ids);
            managerIds = Array.isArray(parsed) ? parsed : [];
          }
        } catch (error) {
          console.error('Error parsing manager_ids:', error);
          managerIds = [];
        }
        
        const isManager = managerIds.includes(user.id);
        
        companies.get(companyId).satellites.push({
          id: satellite.satellite_id,
          name: satellite.satellite_name,
          isManager: isManager
        });
      }
    } else {
      console.log('No satellites assigned to user');
    }

    const companiesArray = Array.from(companies.values());
    console.log('Final companies array:', companiesArray);

    return {
      success: true,
      statusCode: 200,
      message: '企業・拠点情報を取得しました',
      data: {
        user_id: user.id,
        user_name: user.name,
        role: user.role,
        companies: companiesArray
      }
    };

  } catch (error) {
    console.error('Get user companies and satellites error:', error);
    return {
      success: false,
      statusCode: 500,
      message: 'サーバーエラーが発生しました',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
 * ユーザーの企業・拠点情報を取得
 */
const getUserCompanySatelliteInfo = async (userId) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // ユーザー情報を取得
    const [userRows] = await connection.execute(`
      SELECT 
        ua.id,
        ua.name,
        ua.role,
        ua.company_id,
        ua.satellite_ids,
        c.name as company_name,
        c.address as company_address,
        c.phone as company_phone
      FROM user_accounts ua
      LEFT JOIN companies c ON ua.company_id = c.id
      WHERE ua.id = ? AND ua.status = 1
    `, [userId]);
    
    if (userRows.length === 0) {
      return {
        success: false,
        message: 'ユーザーが見つかりません'
      };
    }
    
    const user = userRows[0];
    
    // アドミン権限（ロール9以上）の場合の特別処理
    if (user.role >= 9) {
      // アドミン権限の場合は全企業・拠点にアクセス可能
      const [allCompanies] = await connection.execute(`
        SELECT 
          id,
          name,
          address,
          phone
        FROM companies
        ORDER BY name
      `);
      
      const [allSatellites] = await connection.execute(`
        SELECT 
          s.id,
          s.company_id,
          s.name,
          s.address,
          s.phone,
          s.office_type_id,
          s.contract_type,
          s.max_users,
          s.status,
          ot.type as office_type_name
        FROM satellites s
        LEFT JOIN office_types ot ON s.office_type_id = ot.id
        ORDER BY s.name
      `);
      
      return {
        success: true,
        data: {
          user: {
            id: user.id,
            name: user.name,
            role: user.role,
            company_id: null, // アドミンは特定の企業に所属しない
            company_name: 'システム管理者',
            company_address: null,
            company_phone: null
          },
          satellites: allSatellites,
          companies: allCompanies // アドミン用に全企業情報も提供
        }
      };
    }
    
    // 通常のユーザー（ロール9未満）の処理
    let satellites = [];
    if (user.satellite_ids) {
      try {
        const satelliteIds = typeof user.satellite_ids === 'string' 
          ? JSON.parse(user.satellite_ids) 
          : user.satellite_ids;
        
        if (satelliteIds.length > 0) {
          const placeholders = satelliteIds.map(() => '?').join(',');
          const [satelliteRows] = await connection.execute(`
            SELECT 
              s.id,
              s.company_id,
              s.name,
              s.address,
              s.phone,
              s.office_type_id,
              s.contract_type,
              s.max_users,
              s.status,
              ot.type as office_type_name
            FROM satellites s
            LEFT JOIN office_types ot ON s.office_type_id = ot.id
            WHERE s.id IN (${placeholders})
            ORDER BY s.name
          `, satelliteIds);
          
          satellites = satelliteRows;
        }
      } catch (error) {
        console.error('拠点情報の解析エラー:', error);
      }
    }
    
    return {
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
          company_id: user.company_id,
          company_name: user.company_name,
          company_address: user.company_address,
          company_phone: user.company_phone
        },
        satellites: satellites
      }
    };
    
  } catch (error) {
    console.error('ユーザー企業・拠点情報取得エラー:', error);
    return {
      success: false,
      message: 'ユーザー情報の取得に失敗しました',
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

// 管理者アカウント作成（開発用）
const createAdminAccount = async (userData) => {
  let connection;
  try {
    const { user_id, username, password } = userData;
    
    connection = await pool.getConnection();
    
    // パスワードのハッシュ化
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // 管理者認証情報を登録
    const [result] = await connection.execute(`
      INSERT INTO admin_credentials (user_id, username, password_hash)
      VALUES (?, ?, ?)
    `, [user_id, username, passwordHash]);
    
    return {
      success: true,
      message: '管理者アカウントが作成されました',
      id: result.insertId
    };
    
  } catch (error) {
    console.error('Create admin account error:', error);
    return {
      success: false,
      message: '管理者アカウントの作成に失敗しました',
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
  adminLogin,
  refreshToken,
  logout,
  createAdminAccount,
  instructorLogin,
  getUserCompaniesAndSatellites,
  getUserCompanySatelliteInfo
}; 