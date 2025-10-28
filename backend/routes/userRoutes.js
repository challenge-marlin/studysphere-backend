const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const {
  getUsers,
  getTopUsersByCompany,
  getTeachersByCompany,
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
  getSatelliteHomeSupportUsersWithDailyRecords,
  bulkUpdateHomeSupportFlag,
  removeHomeSupportFlag,
  getSatelliteInstructorsForHomeSupport,
  bulkAddUserTags,
  removeUserTag,
  getAllTags,
  bulkCreateUsers,
  getSatelliteEvaluationStatus
} = require('../scripts/userController');

const router = express.Router();

// ユーザー一覧
router.get('/', async (req, res) => {
  try {
    console.log('=== 利用者一覧API呼び出し ===');
    console.log('リクエストURL:', req.url);
    console.log('リクエストメソッド:', req.method);
    
    const result = await getUsers();
    console.log('getUsers関数実行完了');
    
    if (result.success) {
      console.log('利用者一覧取得成功。件数:', result.data.count);
      res.json(result.data.users);
    } else {
      console.log('利用者一覧取得失敗:', result.message);
      res.status(500).json({
        message: result.message,
        error: result.error,
      });
    }
  } catch (error) {
    console.error('=== 利用者一覧APIエラー ===');
    console.error('エラーメッセージ:', error.message);
    console.error('エラースタック:', error.stack);
    res.status(500).json({
      message: '利用者一覧の取得中にエラーが発生しました',
      error: error.message,
    });
  }
});

// ユーザー作成
router.post('/create', async (req, res) => {
  try {
    const result = await createUser(req.body);
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'ユーザーの作成に失敗しました', error: error.message });
  }
});

// テスト用エンドポイント
router.get('/bulk-test', (req, res) => {
  res.json({ message: '一括利用者追加エンドポイントは利用可能です' });
});

// 一括利用者追加
router.post('/bulk-create', async (req, res) => {
  try {
    console.log('=== 一括利用者追加API呼び出し ===');
    console.log('リクエストボディ:', req.body);
    console.log('リクエストURL:', req.url);
    console.log('リクエストメソッド:', req.method);
    console.log('Content-Type:', req.headers['content-type']);
    
    if (!req.body || !req.body.users) {
      console.log('リクエストボディまたはusersプロパティが存在しません');
      return res.status(400).json({
        success: false,
        message: '利用者データが正しく指定されていません',
        receivedBody: req.body
      });
    }
    
    console.log('bulkCreateUsers関数を呼び出します');
    await bulkCreateUsers(req, res);
  } catch (error) {
    console.error('一括利用者追加エラー:', error);
    console.error('エラースタック:', error.stack);
    res.status(500).json({ 
      success: false, 
      message: '一括利用者追加に失敗しました', 
      error: error.message,
      stack: error.stack
    });
  }
});

// 企業別最上位ユーザー
router.get('/top-by-company', async (req, res) => {
  const result = await getTopUsersByCompany();
  if (result.success) {
    res.json(result.data);
  } else {
    res.status(500).json({ message: result.message, error: result.error });
  }
});

// 企業別教師数
router.get('/teachers-by-company', async (req, res) => {
  const result = await getTeachersByCompany();
  if (result.success) {
    res.json(result.data);
  } else {
    res.status(500).json({ message: result.message, error: result.error });
  }
});

// パスワードリセット
router.post('/:userId/reset-password', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const result = await resetUserPassword(userId, req.body);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: 'パスワードリセットに失敗しました', error: error.message });
  }
});

// 指導員のパスワード変更
router.post('/:userId/change-password', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: '現在のパスワードと新しいパスワードは必須です'
      });
    }
    
    const result = await changeInstructorPassword(userId, currentPassword, newPassword);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: 'パスワード変更に失敗しました', error: error.message });
  }
});

// 一時パスワード発行
router.post('/:userId/issue-temp-password', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const result = await issueTemporaryPassword(userId);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: '一時パスワード発行に失敗しました', error: error.message });
  }
});

// 一時パスワード検証
router.post('/verify-temp-password', async (req, res) => {
  try {
    console.log('verify-temp-password API: リクエスト受信', {
      body: req.body,
      headers: req.headers,
      method: req.method,
      url: req.url
    });
    
    const { loginCode, tempPassword } = req.body;
    
    if (!loginCode || !tempPassword) {
      console.error('verify-temp-password API: パラメータ不足', { loginCode: !!loginCode, tempPassword: !!tempPassword });
      return res.status(400).json({
        success: false,
        message: 'ログインコードとパスワードは必須です'
      });
    }
    
    console.log('verify-temp-password API: 認証処理開始', { loginCode, tempPassword: tempPassword ? '***' : 'なし' });
    const result = await verifyTemporaryPassword(loginCode, tempPassword);
    console.log('verify-temp-password API: 認証処理結果', { success: result.success, message: result.message });
    
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error('verify-temp-password API: エラー発生', {
      error: error.message,
      stack: error.stack,
      body: req.body
    });
    res.status(500).json({ success: false, message: 'パスワード検証に失敗しました', error: error.message });
  }
});

// ユーザー更新
router.put('/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const result = await updateUser(userId, req.body);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: 'ユーザーの更新に失敗しました', error: error.message });
  }
});

// 指導員の専門分野一覧取得
router.get('/:userId/specializations', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const result = await getInstructorSpecializations(userId);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: '専門分野の取得に失敗しました', error: error.message });
  }
});

// 指導員の専門分野追加
router.post('/:userId/specializations', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { specialization } = req.body;
    
    if (!specialization) {
      return res.status(400).json({
        success: false,
        message: '専門分野の内容は必須です'
      });
    }
    
    const result = await addInstructorSpecialization(userId, specialization);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: '専門分野の追加に失敗しました', error: error.message });
  }
});

// 指導員の専門分野更新
router.put('/:userId/specializations/:specializationId', async (req, res) => {
  try {
    const specializationId = parseInt(req.params.specializationId);
    const { specialization } = req.body;
    
    if (!specialization) {
      return res.status(400).json({
        success: false,
        message: '専門分野の内容は必須です'
      });
    }
    
    const result = await updateInstructorSpecialization(specializationId, specialization);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: '専門分野の更新に失敗しました', error: error.message });
  }
});

// 指導員の専門分野削除
router.delete('/:userId/specializations/:specializationId', async (req, res) => {
  try {
    const specializationId = parseInt(req.params.specializationId);
    const result = await deleteInstructorSpecialization(specializationId);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: '専門分野の削除に失敗しました', error: error.message });
  }
});

// 所属拠点一覧
router.get('/:userId/satellites', async (req, res) => {
  const userId = parseInt(req.params.userId);
  const result = await getUserSatellites(userId);
  if (result.success) {
    res.json(result.data);
  } else {
    res.status(404).json({ message: result.message, error: result.error });
  }
});

// 拠点にユーザーを追加
router.post('/:userId/satellites', async (req, res) => {
  const userId = parseInt(req.params.userId);
  const { satellite_id } = req.body;
  const result = await addSatelliteToUser(userId, satellite_id);
  res.status(result.success ? 200 : 400).json({
    success: result.success,
    message: result.message,
    ...(result.error && { error: result.error }),
  });
});

// ユーザーから拠点を削除
router.delete('/:userId/satellites/:satelliteId', async (req, res) => {
  const userId = parseInt(req.params.userId);
  const satelliteId = parseInt(req.params.satelliteId);
  const result = await removeSatelliteFromUser(userId, satelliteId);
  res.status(result.success ? 200 : 400).json({
    success: result.success,
    message: result.message,
    ...(result.error && { error: result.error }),
  });
});

// ユーザー削除
router.delete('/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (!userId || isNaN(userId)) {
      return res.status(400).json({ success: false, message: '有効なユーザーIDが指定されていません' });
    }
    const result = await deleteUser(userId);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: 'ユーザーの削除に失敗しました', error: error.message });
  }
});

// ログインコード更新
router.post('/update-login-codes', async (req, res) => {
  try {
    const result = await updateLoginCodes();
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: 'ログインコードの更新に失敗しました', error: error.message });
  }
});

// 拠点内の利用者と担当指導員の関係を取得
router.get('/satellite/:satelliteId/instructor-relations', async (req, res) => {
  try {
    const satelliteId = parseInt(req.params.satelliteId);
    const result = await getSatelliteUserInstructorRelations(satelliteId);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: '拠点利用者担当指導員関係の取得に失敗しました', 
      error: error.message 
    });
  }
});

// 拠点内の利用可能な指導員一覧を取得
router.get('/satellite/:satelliteId/available-instructors', async (req, res) => {
  try {
    const satelliteId = parseInt(req.params.satelliteId);
    const result = await getSatelliteAvailableInstructors(satelliteId);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: '拠点利用可能指導員の取得に失敗しました', 
      error: error.message 
    });
  }
});

// 個別利用者の担当指導員を変更
router.put('/:userId/instructor', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { instructorId } = req.body;
    
    const result = await updateUserInstructor(userId, instructorId);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: '担当指導員の更新に失敗しました', 
      error: error.message 
    });
  }
});

// 一括で利用者の担当指導員を変更
router.put('/satellite/:satelliteId/bulk-instructor-assignment', async (req, res) => {
  try {
    const satelliteId = parseInt(req.params.satelliteId);
    const { assignments } = req.body;
    
    if (!Array.isArray(assignments)) {
      return res.status(400).json({
        success: false,
        message: 'assignmentsは配列である必要があります'
      });
    }
    
    const result = await bulkUpdateUserInstructors(satelliteId, assignments);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: '一括担当指導員更新に失敗しました', 
      error: error.message 
    });
  }
});

// 拠点内の全利用者の担当指導員を一括削除
router.delete('/satellite/:satelliteId/instructors', async (req, res) => {
  try {
    const satelliteId = parseInt(req.params.satelliteId);
    const result = await bulkRemoveUserInstructors(satelliteId);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: '一括担当指導員削除に失敗しました', 
      error: error.message 
    });
  }
});

// 在宅支援関連のエンドポイント
// 拠点内の通所利用者一覧を取得（在宅支援追加用）
router.get('/satellite/:satelliteId/home-support-users', authenticateToken, getSatelliteUsersForHomeSupport);

// 拠点内の在宅支援利用者一覧を取得
router.get('/satellite/:satelliteId/home-support-users-list', authenticateToken, getSatelliteHomeSupportUsers);

// 拠点内の在宅支援利用者一覧を取得（日次記録情報を含む）
router.get('/satellite/:satelliteId/home-support-users-with-records', authenticateToken, getSatelliteHomeSupportUsersWithDailyRecords);

// 拠点内の指導員一覧を取得（在宅支援用）
router.get('/satellite/:satelliteId/home-support-instructors', authenticateToken, getSatelliteInstructorsForHomeSupport);

// 拠点内の指導員一覧を取得（週次評価記録者用）
router.get('/satellite/:satelliteId/weekly-evaluation-instructors', authenticateToken, async (req, res) => {
  try {
    const { satelliteId } = req.params;
    const result = await getSatelliteAvailableInstructors(satelliteId);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error('拠点指導員取得エラー:', error);
    res.status(500).json({
      success: false,
      message: '指導員の取得中にエラーが発生しました',
      error: error.message
    });
  }
});

// 拠点内の在宅支援利用者の評価状況を取得
router.get('/satellite/:satelliteId/evaluation-status', authenticateToken, getSatelliteEvaluationStatus);

// 在宅支援フラグを一括更新
router.post('/bulk-update-home-support', authenticateToken, bulkUpdateHomeSupportFlag);

// 在宅支援解除（単一利用者）
router.put('/:userId/remove-home-support', authenticateToken, removeHomeSupportFlag);

// 通所記録を作成
router.post('/office-visit', authenticateToken, async (req, res) => {
  try {
    const { userId, visitDate } = req.body;
    
    if (!userId || !visitDate) {
      return res.status(400).json({
        success: false,
        message: 'ユーザーIDと通所日は必須です'
      });
    }

    const { pool } = require('../utils/database');
    const connection = await pool.getConnection();
    
    try {
      // ユーザーが現在の拠点に所属しているか確認
      const currentUser = req.user;
      const [userSatellites] = await connection.execute(
        'SELECT satellite_id FROM user_satellites WHERE user_id = ?',
        [userId]
      );
      
      if (userSatellites.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ユーザーが見つかりません'
        });
      }

      // 既に同じ日の通所記録があるかチェック
      const [existingRecords] = await connection.execute(
        'SELECT id FROM office_visit_records WHERE user_id = ? AND visit_date = ?',
        [userId, visitDate]
      );

      if (existingRecords.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'この日の通所記録は既に存在します'
        });
      }

      // 通所記録を保存
      const [result] = await connection.execute(
        'INSERT INTO office_visit_records (user_id, visit_date, satellite_id) VALUES (?, ?, ?)',
        [userId, visitDate, currentUser.satellite_id || null]
      );

      res.json({
        success: true,
        message: '通所記録を保存しました',
        data: {
          id: result.insertId,
          userId,
          visitDate
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('通所記録保存エラー:', error);
    res.status(500).json({
      success: false,
      message: '通所記録の保存に失敗しました',
      error: error.message
    });
  }
});

// タグ管理関連のエンドポイント
// ユーザーのタグを一括追加
router.post('/bulk-add-tags', authenticateToken, bulkAddUserTags);

// ユーザーのタグを削除
router.delete('/:userId/tags/:tagName', authenticateToken, removeUserTag);

// 全タグ一覧を取得
router.get('/tags/all', authenticateToken, getAllTags);

// ログアウト時に一時パスワードを使用済みにマーク
router.post('/:userId/mark-temp-password-used', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const result = await markTempPasswordAsUsed(userId);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: '一時パスワードの使用済みマークに失敗しました', 
      error: error.message 
    });
  }
});

// 特定ユーザー情報取得（/:userId/*の後に配置して、より具体的なルートが優先されるようにする）
router.get('/:userId', authenticateToken, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const requestingUserId = req.user.user_id;
    const requestingUserRole = req.user.role;
    const { pool } = require('../utils/database');
    const connection = await pool.getConnection();
    
    try {
      // まず利用者情報を取得
      const [rows] = await connection.execute(`
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
          instructor.name as instructor_name
        FROM user_accounts ua
        LEFT JOIN user_accounts instructor ON ua.instructor_id = instructor.id
        WHERE ua.id = ?
      `, [userId]);
      
      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ユーザーが見つかりません'
        });
      }
      
      const user = rows[0];
      
      // アクセス権限チェック
      // システム管理者（ロール9以上）の場合は全利用者にアクセス可能
      if (requestingUserRole >= 9) {
        console.log(`システム管理者（ロール${requestingUserRole}）による利用者情報取得: ユーザーID ${userId}`);
      } else {
        // それ以外の場合は、同じ拠点に所属しているか、または担当指導員であるかをチェック
        let hasAccess = false;
        
        // 自身の情報へのアクセスは許可
        if (userId === requestingUserId) {
          hasAccess = true;
        } else {
          // 担当指導員かどうかをチェック
          if (user.instructor_id === requestingUserId) {
            hasAccess = true;
            console.log(`担当指導員による利用者情報取得: 指導員ID ${requestingUserId}, 利用者ID ${userId}`);
          } else {
            // 同じ拠点に所属しているかをチェック
            const [requestingUserRows] = await connection.execute(
              'SELECT satellite_ids FROM user_accounts WHERE id = ?',
              [requestingUserId]
            );
            
            if (requestingUserRows.length > 0 && requestingUserRows[0].satellite_ids && user.satellite_ids) {
              try {
                const requestingUserSatelliteIds = JSON.parse(requestingUserRows[0].satellite_ids);
                const targetUserSatelliteIds = JSON.parse(user.satellite_ids);
                
                // 配列でない場合は配列に変換
                const requestingIds = Array.isArray(requestingUserSatelliteIds) ? requestingUserSatelliteIds : [requestingUserSatelliteIds];
                const targetIds = Array.isArray(targetUserSatelliteIds) ? targetUserSatelliteIds : [targetUserSatelliteIds];
                
                // 共通の拠点IDがあるかチェック
                hasAccess = requestingIds.some(id => targetIds.includes(id));
                
                if (hasAccess) {
                  console.log(`同じ拠点に所属しているためアクセス許可: ユーザーID ${requestingUserId}, 利用者ID ${userId}`);
                }
              } catch (parseError) {
                console.error('拠点IDのパースエラー:', parseError);
              }
            }
          }
        }
        
        if (!hasAccess) {
          console.log(`アクセス拒否: ユーザーID ${requestingUserId}（ロール${requestingUserRole}）は利用者ID ${userId}へのアクセス権限がありません`);
          return res.status(403).json({
            success: false,
            message: 'この利用者情報へのアクセス権限がありません'
          });
        }
      }
      
      res.json({
        success: true,
        data: user
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('ユーザー取得エラー:', error);
    res.status(500).json({ 
      success: false, 
      message: 'ユーザー情報の取得に失敗しました', 
      error: error.message 
    });
  }
});

module.exports = router;


