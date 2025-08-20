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
        ua.email,
        ua.login_code,
        ua.role,
        ua.company_id,
        ua.satellite_ids,
        ua.status,
        ua.password_reset_required,
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

    // 拠点管理者判定: ロール4の場合は拠点管理者かどうかをチェック
    let effectiveRole = admin.role;
    if (admin.role === 4) {
      // ユーザーの所属拠点を取得
      const [userRows] = await connection.execute(`
        SELECT satellite_ids
        FROM user_accounts
        WHERE id = ?
      `, [admin.user_id]);

      if (userRows.length > 0 && userRows[0].satellite_ids) {
        let satelliteIds = [];
        try {
          satelliteIds = JSON.parse(userRows[0].satellite_ids);
          if (!Array.isArray(satelliteIds)) {
            satelliteIds = [];
          }
        } catch (error) {
          console.error('satellite_ids parse error:', error);
          satelliteIds = [];
        }

        if (satelliteIds.length > 0) {
          const placeholders = satelliteIds.map(() => '?').join(',');
          const [satelliteRows] = await connection.execute(`
            SELECT s.id, s.name, s.manager_ids
            FROM satellites s
            WHERE s.id IN (${placeholders})
          `, satelliteIds);

          // 拠点管理者判定
          for (const satellite of satelliteRows) {
            let managerIds = [];
            try {
              if (satellite.manager_ids) {
                const parsed = JSON.parse(satellite.manager_ids);
                managerIds = Array.isArray(parsed) ? parsed : [];
              }
            } catch (error) {
              console.error('manager_ids parse error:', error);
              managerIds = [];
            }

            const userIdNum = parseInt(admin.user_id);
            const isManager = managerIds.some(managerId => {
              const managerIdNum = parseInt(managerId);
              return managerIdNum === userIdNum;
            });

            if (isManager) {
              console.log(`拠点管理者としてロールを更新: user_id=${admin.user_id}, role=${admin.role} → 5`);
              effectiveRole = 5;
              break;
            }
          }
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

    // 有効なロールでユーザーオブジェクトを更新
    const adminWithEffectiveRole = { ...admin, role: effectiveRole };

    // トークン生成
    const accessToken = generateAccessToken(adminWithEffectiveRole);
    const refreshToken = generateRefreshToken(adminWithEffectiveRole);

    // リフレッシュトークンをデータベースに保存
    await saveRefreshToken(admin.user_id, refreshToken);

    // レスポンスデータ（パスワードハッシュは除外）
    const responseData = {
      user_id: admin.user_id,
      user_name: admin.user_name,
      email: admin.email,
      login_code: admin.login_code,
      role: effectiveRole, // 有効なロールを使用
      company_id: admin.company_id,
      company_name: admin.company_name,
      password_reset_required: admin.password_reset_required === 1,
      satellite_ids: (() => {
        try {
          if (!admin.satellite_ids) return [];
          if (typeof admin.satellite_ids === 'string') {
            const parsed = JSON.parse(admin.satellite_ids);
            // 1つの値でも配列として扱う
            return Array.isArray(parsed) ? parsed : [parsed];
          }
          if (Array.isArray(admin.satellite_ids)) {
            return admin.satellite_ids;
          }
          // 単一の値の場合も配列として扱う
          return [admin.satellite_ids];
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
        ua.email,
        ua.login_code,
        ua.role,
        ua.company_id,
        ua.satellite_ids,
        ua.status,
        ua.password_reset_required,
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
    console.log('=== 拠点権限チェックデバッグ ===');
    console.log('admin.satellite_ids (raw):', admin.satellite_ids);
    console.log('admin.satellite_ids type:', typeof admin.satellite_ids);
    
    const satelliteIds = (() => {
      try {
        if (!admin.satellite_ids) {
          console.log('satellite_ids is null or empty, returning empty array');
          return [];
        }
        if (typeof admin.satellite_ids === 'string') {
          console.log('Parsing satellite_ids as string...');
          const parsed = JSON.parse(admin.satellite_ids);
          console.log('JSON.parse result:', parsed);
          console.log('Parsed type:', typeof parsed);
          console.log('Is array:', Array.isArray(parsed));
          // 1つの値でも配列として扱う
          const result = Array.isArray(parsed) ? parsed : [parsed];
          console.log('Final result:', result);
          return result;
        }
        if (Array.isArray(admin.satellite_ids)) {
          console.log('satellite_ids is already array:', admin.satellite_ids);
          return admin.satellite_ids;
        }
        // 単一の値の場合も配列として扱う
        console.log('satellite_ids is single value, wrapping in array:', [admin.satellite_ids]);
        return [admin.satellite_ids];
      } catch (error) {
        console.error('satellite_ids parse error in instructorLogin:', error);
        return [];
      }
    })();
    
    console.log('Final satelliteIds:', satelliteIds);
    console.log('Final satelliteIds type:', typeof satelliteIds);
    console.log('Final satelliteIds is array:', Array.isArray(satelliteIds));
    
    // ロール9（システム管理者）の場合はすべての拠点にアクセス可能
    if (admin.role >= 9) {
      console.log('Role 9+ user, allowing access to all satellites');
    } else {
      // 指定された拠点にアクセス権限があるかチェック
      console.log('=== 権限チェック詳細 ===');
      console.log('Requested satelliteId:', satelliteId);
      console.log('Requested satelliteId type:', typeof satelliteId);
      console.log('Available satelliteIds:', satelliteIds);
      console.log('Available satelliteIds type:', typeof satelliteIds);
      
      if (satelliteId) {
        const satelliteIdStr = satelliteId.toString();
        console.log('Converted satelliteIdStr:', satelliteIdStr);
        console.log('Checking if', satelliteIdStr, 'is included in', satelliteIds);
        
        // 型を統一して比較（数値と文字列の両方に対応）
        const hasAccess = satelliteIds.some(id => id.toString() === satelliteIdStr);
        console.log('includes result:', hasAccess);
        
        if (!hasAccess) {
          console.log('Access denied - satelliteId:', satelliteIdStr, 'available satellites:', satelliteIds);
          return {
            success: false,
            statusCode: 403,
            message: '指定された拠点へのアクセス権限がありません'
          };
        } else {
          console.log('Access granted - satelliteId:', satelliteIdStr, 'found in available satellites');
        }
      } else {
        console.log('No satelliteId provided, skipping permission check');
      }
    }

    // 拠点情報を取得
    let satelliteInfo = null;
    console.log('拠点IDが指定されています:', satelliteId);
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
      
      console.log('拠点情報取得結果:', satelliteRows.length, '件');
      if (satelliteRows.length > 0) {
        satelliteInfo = satelliteRows[0];
        console.log('取得した拠点情報:', satelliteInfo);
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
        
        console.log('拠点管理者判定詳細:', {
          userId: admin.user_id,
          satelliteId: satelliteId,
          satelliteName: satelliteInfo.satellite_name,
          managerIds: managerIds,
          currentRole: admin.role,
          managerIdsType: typeof managerIds,
          managerIdsLength: managerIds.length
        });
        
        // 拠点管理者かどうかを判定（数値として比較）
        const userIdNum = parseInt(admin.user_id);
        const isManager = managerIds.some(id => {
          const managerIdNum = parseInt(id);
          const isMatch = managerIdNum === userIdNum;
          console.log(`管理者ID比較: ${id} (${typeof id}) == ${admin.user_id} (${typeof admin.user_id}) = ${isMatch}`, {
            managerIdNum,
            userIdNum,
            isMatch
          });
          return isMatch;
        });
        
        console.log('拠点管理者判定結果:', {
          isManager: isManager,
          currentRole: admin.role,
          willUpdate: isManager && admin.role === 4
        });
        
        // 拠点管理者の場合はレスポンスでロール5を返す（DBは更新しない）
        if (isManager && admin.role === 4) {
          console.log(`拠点管理者としてレスポンスでロール5を返す: user_id=${admin.user_id}, satellite_id=${satelliteId}`);
          // レスポンス用のロールを5に設定（DBは更新しない）
          admin.role = 5;
          console.log('レスポンスロール設定: 4 → 5');
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

    // トークン生成用のデータを準備
    const tokenData = {
      user_id: admin.user_id,
      user_name: admin.user_name,
      role: admin.role,
      company_id: satelliteInfo ? satelliteInfo.company_id : admin.company_id
    };
    
    console.log('=== JWTトークン生成デバッグ ===');
    console.log('admin.role (最終):', admin.role);
    console.log('tokenData:', tokenData);
    
    // トークン生成
    const accessToken = generateAccessToken(tokenData);
    const refreshToken = generateRefreshToken(tokenData);
    
    console.log('JWTトークン生成完了');

    // リフレッシュトークンをデータベースに保存
    await saveRefreshToken(admin.user_id, refreshToken);

    // レスポンスデータ
    const responseData = {
      user_id: admin.user_id,
      user_name: admin.user_name,
      email: admin.email,
      login_code: admin.login_code,
      role: admin.role,
      company_id: satelliteInfo ? satelliteInfo.company_id : admin.company_id,
      company_name: satelliteInfo ? satelliteInfo.company_name : admin.company_name,
      satellite_id: satelliteId ? parseInt(satelliteId) : null,
      satellite_name: satelliteInfo ? satelliteInfo.satellite_name : null,
      password_reset_required: admin.password_reset_required === 1,
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
        ua.email,
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

    // 拠点管理者判定: ユーザーが拠点管理者かどうかをチェック
    let effectiveRole = user.role;
    if (user.role === 4) {
      // ユーザーの所属拠点を取得
      const [userRows] = await connection.execute(`
        SELECT satellite_ids
        FROM user_accounts
        WHERE id = ?
      `, [user.user_id]);

      if (userRows.length > 0 && userRows[0].satellite_ids) {
        let satelliteIds = [];
        try {
          satelliteIds = JSON.parse(userRows[0].satellite_ids);
          if (!Array.isArray(satelliteIds)) {
            satelliteIds = [];
          }
        } catch (error) {
          console.error('satellite_ids parse error:', error);
          satelliteIds = [];
        }

        if (satelliteIds.length > 0) {
          const placeholders = satelliteIds.map(() => '?').join(',');
          const [satelliteRows] = await connection.execute(`
            SELECT s.id, s.name, s.manager_ids
            FROM satellites s
            WHERE s.id IN (${placeholders})
          `, satelliteIds);

          // 拠点管理者判定
          for (const satellite of satelliteRows) {
            let managerIds = [];
            try {
              if (satellite.manager_ids) {
                const parsed = JSON.parse(satellite.manager_ids);
                managerIds = Array.isArray(parsed) ? parsed : [];
              }
            } catch (error) {
              console.error('manager_ids parse error:', error);
              managerIds = [];
            }

            const userIdNum = parseInt(user.user_id);
            const isManager = managerIds.some(managerId => {
              const managerIdNum = parseInt(managerId);
              return managerIdNum === userIdNum;
            });

            if (isManager) {
              console.log(`拠点管理者としてロールを更新: user_id=${user.user_id}, role=${user.role} → 5`);
              effectiveRole = 5;
              break;
            }
          }
        }
      }
    }

    // 有効なロールでユーザーオブジェクトを更新
    const userWithEffectiveRole = { ...user, role: effectiveRole };

    // 新しいトークンを生成
    const newAccessToken = generateAccessToken(userWithEffectiveRole);
    const newRefreshToken = generateRefreshToken(userWithEffectiveRole);
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
        
        // 数値として比較
        const userIdNum = parseInt(user.id);
        const isManager = managerIds.some(managerId => {
          const managerIdNum = parseInt(managerId);
          return managerIdNum === userIdNum;
        });
        
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
        
        // 数値として比較
        const userIdNum = parseInt(user.id);
        const isManager = managerIds.some(managerId => {
          const managerIdNum = parseInt(managerId);
          return managerIdNum === userIdNum;
        });
        
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
              s.manager_ids,
              ot.type as office_type_name
            FROM satellites s
            LEFT JOIN office_types ot ON s.office_type_id = ot.id
            WHERE s.id IN (${placeholders})
            ORDER BY s.name
          `, satelliteIds);
          
          // 拠点管理者の判定を追加
          satellites = satelliteRows.map(satellite => {
            let isManager = false;
            try {
              if (satellite.manager_ids) {
                const managerIds = JSON.parse(satellite.manager_ids);
                console.log(`拠点管理者判定詳細: ${satellite.name}`, {
                  userId: user.id,
                  userIdType: typeof user.id,
                  managerIds: managerIds,
                  managerIdsType: typeof managerIds,
                  isArray: Array.isArray(managerIds)
                });
                
                if (Array.isArray(managerIds)) {
                  // 数値として比較（より確実な方法）
                  const userIdNum = parseInt(user.id);
                  isManager = managerIds.some(managerId => {
                    const managerIdNum = parseInt(managerId);
                    const isMatch = managerIdNum === userIdNum;
                    
                    console.log(`管理者ID比較: ${managerId} (${typeof managerId}) == ${user.id} (${typeof user.id})`, {
                      managerIdNum,
                      userIdNum,
                      isMatch
                    });
                    
                    return isMatch;
                  });
                }
                
                console.log(`拠点管理者判定結果: ${satellite.name}`, {
                  userId: user.id,
                  managerIds: managerIds,
                  isManager: isManager
                });
              }
            } catch (error) {
              console.error('manager_ids parse error:', error);
            }
            
            return {
              ...satellite,
              is_manager: isManager,
              manager_ids: satellite.manager_ids // デバッグ用にmanager_idsも含める
            };
          });
        }
      } catch (error) {
        console.error('拠点情報の解析エラー:', error);
      }
    }
    
    // 拠点管理者判定: この関数では管理者判定を行わない（拠点変更時の再認証処理で行う）
    let effectiveRole = user.role;
    
    return {
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          role: effectiveRole,
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

/**
 * 拠点管理者を設定する関数
 */
const setSatelliteManager = async (satelliteId, userId) => {
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
    
    console.log(`拠点管理者設定開始: ${satellite.name} (ID: ${satelliteId})`);
    console.log(`設定対象ユーザーID: ${userId} (型: ${typeof userId})`);
    console.log(`現在のmanager_ids: ${satellite.manager_ids} (型: ${typeof satellite.manager_ids})`);
    
    // 現在の管理者IDを取得
    let currentManagerIds = [];
    if (satellite.manager_ids) {
      try {
        const parsed = JSON.parse(satellite.manager_ids);
        // 配列の場合はそのまま、数値の場合は配列に変換
        currentManagerIds = Array.isArray(parsed) ? parsed : [parsed];
        console.log(`パース後の管理者IDs: ${JSON.stringify(currentManagerIds)} (型: ${typeof currentManagerIds})`);
      } catch (error) {
        console.error('manager_ids parse error:', error);
        currentManagerIds = [];
      }
    }

    // IDの型を統一（数値として比較）
    const userIdNum = Number(userId);
    const currentManagerIdsNum = currentManagerIds.map(id => Number(id));
    
    console.log(`型統一後の比較: ユーザーID=${userIdNum}, 現在の管理者IDs=${JSON.stringify(currentManagerIdsNum)}`);

    // 既に管理者として設定されているかチェック
    if (currentManagerIdsNum.includes(userIdNum)) {
      console.log(`ユーザーID ${userId} は既に管理者として設定されています`);
      return {
        success: true,
        message: '既に管理者として設定されています',
        data: { manager_ids: currentManagerIds }
      };
    }

    // 新しい管理者IDを追加
    currentManagerIds.push(userIdNum);
    const managerIdsJson = JSON.stringify(currentManagerIds);
    
    console.log(`更新後の管理者IDs: ${managerIdsJson}`);

    await connection.execute(`
      UPDATE satellites 
      SET manager_ids = ?, updated_at = NOW()
      WHERE id = ?
    `, [managerIdsJson, satelliteId]);

    console.log(`拠点 ${satellite.name} (ID: ${satelliteId}) にユーザーID ${userId} を管理者として設定しました`);

    return {
      success: true,
      message: '拠点管理者が正常に設定されました',
      data: { manager_ids: currentManagerIds }
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

// マスターユーザー復旧機能
const restoreMasterUser = async () => {
  let connection;
  try {
    console.log('=== Master User Restoration Started ===');
    
    connection = await pool.getConnection();
    
    // マスターユーザー情報
    const masterUserId = 'admin001';
    const masterPassword = 'admin123';
    const masterRole = 10;
    const masterUserName = 'マスターユーザー';
    
    // パスワードのハッシュ化
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(masterPassword, saltRounds);
    
    // トランザクション開始
    await connection.beginTransaction();
    
    try {
      // 1. user_accountsテーブルにマスターユーザーが存在するかチェック
      const [existingUserRows] = await connection.execute(`
        SELECT id FROM user_accounts WHERE login_code = ?
      `, [masterUserId]);
      
      let userId;
      
      if (existingUserRows.length === 0) {
        // マスターユーザーが存在しない場合は作成
        console.log('Creating master user in user_accounts table');
        const [userResult] = await connection.execute(`
          INSERT INTO user_accounts (login_code, name, role, status, created_at, updated_at)
          VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [masterUserId, masterUserName, masterRole]);
        
        userId = userResult.insertId;
        console.log('Master user created with ID:', userId);
      } else {
        // 既存のマスターユーザーを更新
        userId = existingUserRows[0].id;
        console.log('Updating existing master user with ID:', userId);
        
        await connection.execute(`
          UPDATE user_accounts 
          SET name = ?, role = ?, status = 1, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [masterUserName, masterRole, userId]);
      }
      
      // 2. admin_credentialsテーブルにマスターユーザーが存在するかチェック
      const [existingCredRows] = await connection.execute(`
        SELECT id FROM admin_credentials WHERE user_id = ?
      `, [userId]);
      
      if (existingCredRows.length === 0) {
        // 認証情報が存在しない場合は作成
        console.log('Creating master user credentials');
        await connection.execute(`
          INSERT INTO admin_credentials (user_id, username, password_hash, created_at, updated_at)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [userId, masterUserId, passwordHash]);
      } else {
        // 既存の認証情報を更新
        console.log('Updating existing master user credentials');
        await connection.execute(`
          UPDATE admin_credentials 
          SET username = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ?
        `, [masterUserId, passwordHash, userId]);
      }
      
      // トランザクションコミット
      await connection.commit();
      
      console.log('=== Master User Restoration Completed Successfully ===');
      
      return {
        success: true,
        message: 'マスターユーザーが正常に復旧されました',
        data: {
          user_id: masterUserId,
          username: masterUserId,
          password: masterPassword,
          role: masterRole,
          name: masterUserName
        }
      };
      
    } catch (error) {
      // エラーが発生した場合はロールバック
      await connection.rollback();
      throw error;
    }
    
  } catch (error) {
    console.error('Master user restoration error:', error);
    return {
      success: false,
      message: 'マスターユーザーの復旧に失敗しました',
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
 * 拠点変更時の再認証処理
 */
const reauthenticateForSatellite = async (userId, satelliteId) => {
  console.log('=== 拠点変更時再認証処理開始 ===');
  console.log('ユーザーID:', userId);
  console.log('拠点ID:', satelliteId);
  
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
        c.name as company_name
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
    
    // 指定された拠点の情報を取得
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
    
    if (satelliteRows.length === 0) {
      return {
        success: false,
        message: '拠点が見つかりません'
      };
    }
    
    const satellite = satelliteRows[0];
    
    // 拠点管理者判定
    let effectiveRole = user.role;
    console.log('拠点管理者判定開始:', {
      userId: user.id,
      userRole: user.role,
      satelliteId: satellite.id,
      satelliteName: satellite.satellite_name,
      managerIds: satellite.manager_ids
    });
    
    if (user.role === 4) {
      let managerIds = [];
      try {
        if (satellite.manager_ids) {
          const parsed = JSON.parse(satellite.manager_ids);
          managerIds = Array.isArray(parsed) ? parsed : [];
        }
      } catch (error) {
        console.error('manager_ids parse error:', error);
        managerIds = [];
      }
      
      console.log('管理者ID解析結果:', {
        originalManagerIds: satellite.manager_ids,
        parsedManagerIds: managerIds,
        isArray: Array.isArray(managerIds)
      });
      
      const userIdNum = parseInt(user.id);
      const isManager = managerIds.some(managerId => {
        const managerIdNum = parseInt(managerId);
        const isMatch = managerIdNum === userIdNum;
        console.log(`管理者ID比較: ${managerId} (${typeof managerId}) == ${user.id} (${typeof user.id}) = ${isMatch}`);
        return isMatch;
      });
      
      console.log('拠点管理者判定結果:', {
        userId: user.id,
        userIdNum: userIdNum,
        managerIds: managerIds,
        isManager: isManager
      });
      
      if (isManager) {
        console.log(`拠点管理者としてロールを更新: user_id=${user.id}, role=${user.role} → 5`);
        effectiveRole = 5;
      }
    }
    
    console.log('最終的なロール:', effectiveRole);
    
    // 新しいトークンを生成
    const userWithEffectiveRole = { 
      user_id: user.id,
      user_name: user.name,
      role: effectiveRole,
      company_id: satellite.company_id
    };
    
    const newAccessToken = generateAccessToken(userWithEffectiveRole);
    const newRefreshToken = generateRefreshToken(userWithEffectiveRole);
    
    // 古いリフレッシュトークンを削除
    await deleteAllUserRefreshTokens(user.id);
    
    // 新しいリフレッシュトークンを保存
    await saveRefreshToken(user.id, newRefreshToken);
    
    return {
      success: true,
      message: '拠点変更時の再認証が完了しました',
      data: {
        user: {
          id: user.id,
          name: user.name,
          role: effectiveRole,
          company_id: satellite.company_id,
          company_name: satellite.company_name,
          satellite_id: satellite.id,
          satellite_name: satellite.satellite_name
        },
        access_token: newAccessToken,
        refresh_token: newRefreshToken
      }
    };
    
  } catch (error) {
    console.error('拠点変更時再認証エラー:', error);
    return {
      success: false,
      message: '拠点変更時の再認証に失敗しました',
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
  getUserCompanySatelliteInfo,
  restoreMasterUser,
  setSatelliteManager,
  reauthenticateForSatellite
}; 