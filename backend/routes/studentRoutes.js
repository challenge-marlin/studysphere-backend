const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const {
  getStudentCourses,
  getStudentLessons,
  getStudentLessonProgress,
  updateStudentLessonProgress,
  getStudentDashboard
} = require('../scripts/studentController');

const router = express.Router();

// 利用者のコース一覧取得（認証を柔軟に処理）
router.get('/courses', async (req, res, next) => {
  const { customLogger } = require('../utils/logger');
  customLogger.info('=== /api/student/courses エンドポイントが呼ばれました ===');
  customLogger.info('認証ヘッダー:', { authorization: req.headers['authorization'] });
  customLogger.info('クエリパラメータ:', req.query);
  
  try {
    // 認証トークンがある場合は認証を試行
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      customLogger.info('JWTトークン認証を試行します');
      return authenticateToken(req, res, next);
    }
    
    // 認証トークンがない場合は、一時パスワード認証を試行
    const loginCode = req.query.loginCode || req.query.code;
    const tempPassword = req.query.tempPassword || req.query.password || req.query.temp_password;
    
    if (loginCode && tempPassword) {
      // 一時パスワード認証を試行
      const { verifyTemporaryPassword } = require('../scripts/userController');
      const authResult = await verifyTemporaryPassword(loginCode, tempPassword);
      
      if (authResult.success) {
        // 認証成功の場合、ユーザー情報をリクエストに追加
        req.user = {
          user_id: authResult.data.userId,
          role: 1, // 利用者ロール
          username: authResult.data.userName
        };
        return next();
      }
    }
    
    // ユーザーIDベースの認証を試行（フロントエンドからの認証済みユーザー情報）
    const userId = req.query.userId;
    if (userId) {
      // ユーザーIDの存在確認
      const { pool } = require('../utils/database');
      const connection = await pool.getConnection();
      try {
        const [users] = await connection.execute(
          'SELECT id, name, role FROM user_accounts WHERE id = ? AND role = 1 AND status = 1',
          [userId]
        );
        
        if (users.length > 0) {
          req.user = {
            user_id: parseInt(userId),
            role: 1, // 利用者ロール
            username: users[0].name
          };
          return next();
        }
      } finally {
        connection.release();
      }
    }
    
    // 認証に失敗した場合
    return res.status(401).json({
      success: false,
      message: '認証が必要です。ログインコードと一時パスワード、または有効なユーザーIDを提供してください。'
    });
  } catch (error) {
    console.error('利用者API認証エラー:', error);
    return res.status(500).json({
      success: false,
      message: '認証処理中にエラーが発生しました'
    });
  }
}, getStudentCourses);

// 利用者のレッスン一覧取得（認証を柔軟に処理）
router.get('/lessons', async (req, res, next) => {
  try {
    // 認証トークンがある場合は認証を試行
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authenticateToken(req, res, next);
    }
    
    // 認証トークンがない場合は、一時パスワード認証を試行
    const loginCode = req.query.loginCode || req.query.code;
    const tempPassword = req.query.tempPassword || req.query.password || req.query.temp_password;
    
    if (loginCode && tempPassword) {
      // 一時パスワード認証を試行
      const { verifyTemporaryPassword } = require('../scripts/userController');
      const authResult = await verifyTemporaryPassword(loginCode, tempPassword);
      
      if (authResult.success) {
        // 認証成功の場合、ユーザー情報をリクエストに追加
        req.user = {
          user_id: authResult.data.userId,
          role: 1, // 利用者ロール
          username: authResult.data.userName
        };
        return next();
      }
    }
    
    // ユーザーIDベースの認証を試行（フロントエンドからの認証済みユーザー情報）
    const userId = req.query.userId;
    if (userId) {
      // ユーザーIDの存在確認
      const { pool } = require('../utils/database');
      const connection = await pool.getConnection();
      try {
        const [users] = await connection.execute(
          'SELECT id, name, role FROM user_accounts WHERE id = ? AND role = 1 AND status = 1',
          [userId]
        );
        
        if (users.length > 0) {
          req.user = {
            user_id: parseInt(userId),
            role: 1, // 利用者ロール
            username: users[0].name
          };
          return next();
        }
      } finally {
        connection.release();
      }
    }
    
    // 認証に失敗した場合
    return res.status(401).json({
      success: false,
      message: '認証が必要です。ログインコードと一時パスワード、または有効なユーザーIDを提供してください。'
    });
  } catch (error) {
    console.error('利用者API認証エラー:', error);
    return res.status(500).json({
      success: false,
      message: '認証処理中にエラーが発生しました'
    });
  }
}, getStudentLessons);

// 利用者のレッスン進捗取得（認証を柔軟に処理）
router.get('/lessons/:lessonId/progress', async (req, res, next) => {
  try {
    // 認証トークンがある場合は認証を試行
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authenticateToken(req, res, next);
    }
    
    // 認証トークンがない場合は、一時パスワード認証を試行
    const loginCode = req.query.loginCode || req.query.code;
    const tempPassword = req.query.tempPassword || req.query.password || req.query.temp_password;
    
    if (loginCode && tempPassword) {
      // 一時パスワード認証を試行
      const { verifyTemporaryPassword } = require('../scripts/userController');
      const authResult = await verifyTemporaryPassword(loginCode, tempPassword);
      
      if (authResult.success) {
        // 認証成功の場合、ユーザー情報をリクエストに追加
        req.user = {
          user_id: authResult.data.userId,
          role: 1, // 利用者ロール
          username: authResult.data.userName
        };
        return next();
      }
    }
    
    // 認証に失敗した場合
    return res.status(401).json({
      success: false,
      message: '認証が必要です。ログインコードと一時パスワードを提供してください。'
    });
  } catch (error) {
    console.error('利用者API認証エラー:', error);
    return res.status(500).json({
      success: false,
      message: '認証処理中にエラーが発生しました'
    });
  }
}, getStudentLessonProgress);

// 利用者のレッスン進捗更新（認証を柔軟に処理）
router.put('/lessons/:lessonId/progress', async (req, res, next) => {
  try {
    // 認証トークンがある場合は認証を試行
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authenticateToken(req, res, next);
    }
    
    // 認証トークンがない場合は、一時パスワード認証を試行
    const loginCode = req.query.loginCode || req.query.code;
    const tempPassword = req.query.tempPassword || req.query.password || req.query.temp_password;
    
    if (loginCode && tempPassword) {
      // 一時パスワード認証を試行
      const { verifyTemporaryPassword } = require('../scripts/userController');
      const authResult = await verifyTemporaryPassword(loginCode, tempPassword);
      
      if (authResult.success) {
        // 認証成功の場合、ユーザー情報をリクエストに追加
        req.user = {
          user_id: authResult.data.userId,
          role: 1, // 利用者ロール
          username: authResult.data.userName
        };
        return next();
      }
    }
    
    // 認証に失敗した場合
    return res.status(401).json({
      success: false,
      message: '認証が必要です。ログインコードと一時パスワードを提供してください。'
    });
  } catch (error) {
    console.error('利用者API認証エラー:', error);
    return res.status(500).json({
      success: false,
      message: '認証処理中にエラーが発生しました'
    });
  }
}, updateStudentLessonProgress);

// 利用者のダッシュボード情報取得（認証を柔軟に処理）
router.get('/dashboard', async (req, res, next) => {
  try {
    // 認証トークンがある場合は認証を試行
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authenticateToken(req, res, next);
    }
    
    // 認証トークンがない場合は、一時パスワード認証を試行
    const loginCode = req.query.loginCode || req.query.code;
    const tempPassword = req.query.tempPassword || req.query.password || req.query.temp_password;
    
    if (loginCode && tempPassword) {
      // 一時パスワード認証を試行
      const { verifyTemporaryPassword } = require('../scripts/userController');
      const authResult = await verifyTemporaryPassword(loginCode, tempPassword);
      
      if (authResult.success) {
        // 認証成功の場合、ユーザー情報をリクエストに追加
        req.user = {
          user_id: authResult.data.userId,
          role: 1, // 利用者ロール
          username: authResult.data.userName
        };
        return next();
      }
    }
    
    // 認証に失敗した場合
    return res.status(401).json({
      success: false,
      message: '認証が必要です。ログインコードと一時パスワードを提供してください。'
    });
  } catch (error) {
    console.error('利用者API認証エラー:', error);
    return res.status(500).json({
      success: false,
      message: '認証処理中にエラーが発生しました'
    });
  }
}, getStudentDashboard);

module.exports = router;
