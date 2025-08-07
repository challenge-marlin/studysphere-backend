const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

// ログシステムのインポート
const { customLogger } = require('./utils/logger');
const { 
  requestLogger, 
  detailedLogger, 
  errorLogger, 
  authLogger, 
  dbLogger 
} = require('./middleware/requestLogger');

// ミドルウェアのインポート
const { 
  loginValidation, 
  satelliteValidation, 
  satelliteUpdateValidation, 
  companyValidation,
  companyUpdateValidation,
  officeTypeValidation,
  officeTypeUpdateValidation,
  handleValidationErrors 
} = require('./middleware/validation');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { authenticateToken, requireAdmin } = require('./middleware/auth');

// コントローラーのインポート
const { adminLogin, refreshToken, logout } = require('./scripts/authController');
const { 
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
  resetUserPassword
} = require('./scripts/userController');
const { 
  getSatellites, 
  getSatelliteById, 
  getSatellitesByIds,
  createSatellite, 
  updateSatellite, 
  deleteSatellite,
  getSatelliteUserCount,
  getSatelliteManagers,
  getManagerSatellites,
  addManagerToSatellite,
  removeManagerFromSatellite,
  regenerateToken,
  setSatelliteManagers,
  addSatelliteManager
} = require('./scripts/satelliteController');
const {
  getCompanies,
  getCompanyById,
  createCompany,
  updateCompany,
  deleteCompany,
  regenerateCompanyToken 
} = require('./scripts/companyController');
const {
  getOfficeTypes,
  createOfficeType,
  deleteOfficeType
} = require('./scripts/officeTypeController');
const {
  getSystemOverview,
  getCompanyStats,
  getAlerts
} = require('./scripts/dashboardController');

// 指導者専門分野管理コントローラーのインポート
const {
  getInstructorSpecializations,
  addInstructorSpecialization,
  setInstructorSpecializations,
  deleteInstructorSpecialization,
  getSatelliteInstructors,
  getSatelliteStats
} = require('./scripts/instructorSpecializationController');

// ログ管理コントローラーのインポート
const {
  getLogFiles,
  getLogContent,
  downloadLogFile,
  deleteLogFile,
  cleanupOldLogs,
  getLogStats
} = require('./scripts/logController');

// 操作ログ管理コントローラーのインポート
const {
  recordOperationLog,
  getOperationLogs,
  getOperationLogStats,
  exportOperationLogs,
  clearOperationLogs
} = require('./scripts/operationLogController');

// 管理者管理コントローラーのインポート
const {
  getAdmins,
  createAdmin,
  updateAdmin,
  deleteAdmin,
  restoreAdmin,
  permanentlyDeleteAdmin
} = require('./scripts/adminController');

// コース管理コントローラーのインポート
const {
  getCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
  updateCourseOrder
} = require('./scripts/courseController');

// レッスン管理コントローラーのインポート
const {
  getLessons,
  getLessonById,
  createLesson,
  updateLesson,
  deleteLesson,
  updateLessonOrder,
  downloadLessonFile,
  downloadLessonFolder,
  getLessonFiles,
  downloadIndividualFile,
  upload
} = require('./scripts/lessonController');

const app = express();

// セキュリティミドルウェア
app.use(helmet());
app.use(cors({
  origin: [
    'http://localhost:3000',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true
}));

// ログミドルウェア（最初に配置）
app.use(requestLogger);
app.use(authLogger);
app.use(dbLogger);

// 開発環境でのみ詳細ログを有効化
if (process.env.NODE_ENV === 'development') {
  app.use(detailedLogger);
}

// パースミドルウェア（FormDataエンドポイントを除く）
app.use((req, res, next) => {
  // FormDataを送信するエンドポイントの場合はJSONパーサーをスキップ
  if (req.path === '/api/lessons' && req.method === 'POST') {
    return next();
  }
  if (req.path.match(/^\/api\/lessons\/\d+$/) && req.method === 'PUT') {
    return next();
  }
  express.json({ limit: '10mb' })(req, res, next);
});

app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// デバッグ用：すべてのリクエストをログ出力
app.use((req, res, next) => {
  if (req.method === 'DELETE' && req.url.includes('/api/users/')) {
    console.log('=== DEBUG: DELETE request detected ===');
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    console.log('Headers:', req.headers);
  }
  next();
});

// ルート定義

// テスト用DELETEエンドポイント
app.delete('/api/test-delete/:id', (req, res) => {
  console.log('=== TEST DELETE エンドポイントが呼び出されました ===');
  console.log('ID:', req.params.id);
  res.json({ success: true, message: 'DELETE test successful', id: req.params.id });
});

// ヘルスチェックエンドポイント
app.get('/health', async (req, res) => {
  try {
    const { testConnection } = require('./utils/database');
    const result = await testConnection();
    
    if (result.success) {
      res.json({
        status: 'healthy',
        message: 'バックエンドサーバーが正常に動作しています',
        database: 'connected',
        currentTime: result.currentTime
      });
    } else {
      res.status(500).json({
        status: 'unhealthy',
        message: 'データベース接続に問題があります',
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'ヘルスチェック中にエラーが発生しました',
      error: error.message
    });
  }
});

// メモリ監視エンドポイント
app.get('/memory', (req, res) => {
  try {
    const { memoryMonitor } = require('./utils/memoryMonitor');
    const stats = memoryMonitor.getMemoryStats();
    
    if (stats) {
      res.json({
        success: true,
        data: {
          current: stats.current,
          change: stats.change,
          timeSpan: stats.timeSpan,
          snapshots: memoryMonitor.memorySnapshots.length
        }
      });
    } else {
      res.json({
        success: false,
        message: 'メモリデータが利用できません'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'メモリ監視エラー',
      error: error.message
    });
  }
});

// メモリレポートエンドポイント
app.get('/memory/report', (req, res) => {
  try {
    const { memoryMonitor } = require('./utils/memoryMonitor');
    const report = memoryMonitor.generateReport();
    
    res.json({
      success: true,
      data: {
        report,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'メモリレポート生成エラー',
      error: error.message
    });
  }
});

// データベーステストエンドポイント
app.get('/test-db', async (req, res) => {
  try {
    const { executeQuery } = require('./utils/database');
    
    // 1. 基本的な接続テスト
    const connectionTest = await executeQuery('SELECT 1 as test');
    
    // 2. テーブル存在確認
    const tableTest = await executeQuery(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'curriculum-portal' 
      AND table_name = 'companies'
    `);
    
    // 3. シンプルなクエリテスト
    const simpleQuery = await executeQuery('SELECT COUNT(*) as count FROM companies');
    
    // 4. 全データ取得テスト
    const allData = await executeQuery('SELECT * FROM companies LIMIT 5');
    
    res.json({
      success: true,
      connectionTest,
      tableTest,
      simpleQuery,
      allData
    });
  } catch (error) {
    console.error('データベーステストエラー:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// 管理者アカウント復元エンドポイント
app.post('/restore-admin', async (req, res) => {
  try {
    const { executeQuery } = require('./utils/database');
    
    // 既存の管理者アカウントを削除
    await executeQuery("DELETE FROM admin_credentials WHERE username = 'admin001'");
    await executeQuery("DELETE FROM user_accounts WHERE name = 'admin001'");
    
    // 管理者ユーザーアカウントを作成（マスターユーザー：ロール10）
    const userResult = await executeQuery(`
      INSERT INTO user_accounts (name, role, status, login_code, company_id) 
      VALUES ('admin001', 10, 1, 'CGA8-CH0R-QVEC', NULL)
    `);
    
    if (!userResult.success) {
      throw new Error('管理者ユーザー作成失敗: ' + userResult.error);
    }
    
    // 管理者認証情報を作成
    const authResult = await executeQuery(`
      INSERT INTO admin_credentials (user_id, username, password_hash) 
      SELECT ua.id, 'admin001', '$2b$12$T7RyPTpZU1ZKivUyOgDNSu4PWByqEP7.GdhrQQ2ltwy3LmfaURLlO'
      FROM user_accounts ua 
      WHERE ua.name = 'admin001'
    `);
    
    if (!authResult.success) {
      throw new Error('管理者認証情報作成失敗: ' + authResult.error);
    }
    
    // 確認用クエリ
    const confirmResult = await executeQuery(`
      SELECT 
        ua.id,
        ua.name,
        ua.role,
        ua.status,
        ua.login_code,
        ac.username,
        ac.created_at
      FROM user_accounts ua
      LEFT JOIN admin_credentials ac ON ua.id = ac.user_id
      WHERE ua.role = 9
    `);
    
    res.json({
      success: true,
      message: '管理者アカウントが正常に復元されました',
      data: confirmResult.data
    });
  } catch (error) {
    console.error('管理者アカウント復元エラー:', error);
    res.status(500).json({
      success: false,
      message: '管理者アカウントの復元に失敗しました',
      error: error.message
    });
  }
});

// 管理者ログインエンドポイント
app.post('/login', loginValidation, handleValidationErrors, async (req, res) => {
  const { username, password } = req.body;
  const result = await adminLogin(username, password);
  
  res.status(result.statusCode || 200).json({
    success: result.success,
    message: result.message,
    ...(result.data && { data: result.data }),
    ...(result.error && { error: result.error })
  });
});

// リフレッシュトークンエンドポイント
app.post('/refresh', async (req, res) => {
  const { refresh_token } = req.body;
  const result = await refreshToken(refresh_token);
  
  res.status(result.statusCode || 200).json({
    success: result.success,
    message: result.message,
    ...(result.data && { data: result.data }),
    ...(result.error && { error: result.error })
  });
});

// ログアウトエンドポイント
app.post('/logout', async (req, res) => {
  const { refresh_token } = req.body;
  const result = await logout(refresh_token);
  
  res.status(result.statusCode || 200).json({
    success: result.success,
    message: result.message,
    ...(result.error && { error: result.error })
  });
});

// ヘルスチェックエンドポイント
app.get('/', async (req, res) => {
  const result = await healthCheck();
  
  if (result.success) {
    res.json(result.data);
  } else {
    res.status(500).json({
      message: result.message,
      error: result.error
    });
  }
});

// ユーザー一覧取得エンドポイント
app.get('/api/users', async (req, res) => {
  console.log('GET /api/users エンドポイントが呼び出されました');
  const result = await getUsers();
  console.log('getUsers の結果:', result);
  console.log('getUsers の結果の詳細:', JSON.stringify(result, null, 2));
  
  if (result.success) {
    res.json(result.data.users);
  } else {
    res.status(500).json({
      message: result.message,
      error: result.error
    });
  }
});

// ユーザー作成エンドポイント
app.post('/api/users', async (req, res) => {
  try {
    const result = await createUser(req.body);
    
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('ユーザー作成エラー:', error);
    res.status(500).json({
      success: false,
      message: 'ユーザーの作成に失敗しました',
      error: error.message
    });
  }
});

// 企業別最上位ユーザー取得エンドポイント
app.get('/api/users/top-by-company', async (req, res) => {
  const result = await getTopUsersByCompany();
  
  if (result.success) {
    res.json(result.data);
  } else {
    res.status(500).json({
      message: result.message,
      error: result.error
    });
  }
});

// 企業別教師数取得エンドポイント
app.get('/api/users/teachers-by-company', async (req, res) => {
  const result = await getTeachersByCompany();
  
  if (result.success) {
    res.json(result.data);
  } else {
    res.status(500).json({
      message: result.message,
      error: result.error
    });
  }
});

// ユーザーパスワードリセットエンドポイント
app.post('/api/users/:userId/reset-password', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const result = await resetUserPassword(userId, req.body);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('パスワードリセットエラー:', error);
    res.status(500).json({
      success: false,
      message: 'パスワードリセットに失敗しました',
      error: error.message
    });
  }
});

// ユーザー更新エンドポイント
app.put('/api/users/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const result = await updateUser(userId, req.body);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('ユーザー更新エラー:', error);
    res.status(500).json({
      success: false,
      message: 'ユーザーの更新に失敗しました',
      error: error.message
    });
  }
});



// 管理者管理エンドポイント

// 管理者一覧取得
app.get('/api/admins', async (req, res) => {
  try {
    const includeDeleted = req.query.includeDeleted === 'true';
    const result = await getAdmins(includeDeleted);
    
    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({
        success: false,
        message: result.message,
        error: result.error
      });
    }
  } catch (error) {
    console.error('管理者一覧取得エラー:', error);
    res.status(500).json({
      success: false,
      message: '管理者一覧の取得に失敗しました',
      error: error.message
    });
  }
});

// 管理者作成
app.post('/api/admins', async (req, res) => {
  try {
    const result = await createAdmin(req.body);
    
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('管理者作成エラー:', error);
    res.status(500).json({
      success: false,
      message: '管理者の作成に失敗しました',
      error: error.message
    });
  }
});

// 管理者更新
app.put('/api/admins/:adminId', async (req, res) => {
  try {
    const adminId = parseInt(req.params.adminId);
    const result = await updateAdmin(adminId, req.body);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('管理者更新エラー:', error);
    res.status(500).json({
      success: false,
      message: '管理者の更新に失敗しました',
      error: error.message
    });
  }
});

// 管理者削除（論理削除）
app.delete('/api/admins/:adminId', async (req, res) => {
  try {
    const adminId = parseInt(req.params.adminId);
    const result = await deleteAdmin(adminId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('管理者削除エラー:', error);
    res.status(500).json({
      success: false,
      message: '管理者の削除に失敗しました',
      error: error.message
    });
  }
});

// 管理者復元
app.post('/api/admins/:adminId/restore', async (req, res) => {
  try {
    const adminId = parseInt(req.params.adminId);
    const result = await restoreAdmin(adminId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('管理者復元エラー:', error);
    res.status(500).json({
      success: false,
      message: '管理者の復元に失敗しました',
      error: error.message
    });
  }
});

// 管理者物理削除
app.delete('/api/admins/:adminId/permanent', async (req, res) => {
  try {
    const adminId = parseInt(req.params.adminId);
    const result = await permanentlyDeleteAdmin(adminId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('管理者物理削除エラー:', error);
    res.status(500).json({
      success: false,
      message: '管理者の物理削除に失敗しました',
      error: error.message
    });
  }
});

// 企業管理エンドポイント

// 企業一覧取得
app.get('/api/companies', async (req, res) => {
  try {
    const result = await getCompanies();
    
    if (result.success) {
      res.json(result.data);
    } else {
      console.error('企業一覧取得エラー:', result.error);
      res.status(500).json({
        success: false,
        message: result.message,
        error: result.error,
        details: '企業一覧取得処理でエラーが発生しました'
      });
    }
  } catch (error) {
    console.error('企業一覧取得で予期しないエラー:', error);
    res.status(500).json({
      success: false,
      message: '企業一覧の取得中に予期しないエラーが発生しました',
      error: error.message,
      stack: error.stack
    });
  }
});

// 企業詳細取得
app.get('/api/companies/:id', async (req, res) => {
  const companyId = parseInt(req.params.id);
  const result = await getCompanyById(companyId);
  
  if (result.success) {
    res.json(result.data);
  } else {
    res.status(result.statusCode || 404).json({
      message: result.message,
      error: result.error
    });
  }
});

// 企業作成
app.post('/api/companies', companyValidation, handleValidationErrors, async (req, res) => {
  const result = await createCompany(req.body);
  
  res.status(result.success ? 201 : 400).json({
    success: result.success,
    message: result.message,
    ...(result.data && { data: result.data }),
    ...(result.error && { error: result.error })
  });
});

// 企業更新
app.put('/api/companies/:id', companyUpdateValidation, handleValidationErrors, async (req, res) => {
  const companyId = parseInt(req.params.id);
  const result = await updateCompany(companyId, req.body);
  
  res.status(result.success ? 200 : (result.statusCode || 400)).json({
    success: result.success,
    message: result.message,
    ...(result.data && { data: result.data }),
    ...(result.error && { error: result.error })
  });
});

// 企業削除
app.delete('/api/companies/:id', async (req, res) => {
  const companyId = parseInt(req.params.id);
  const result = await deleteCompany(companyId);
  
  res.status(result.success ? 200 : (result.statusCode || 400)).json({
    success: result.success,
    message: result.message,
    ...(result.error && { error: result.error })
  });
});

// 企業トークン再生成
app.post('/api/companies/:id/regenerate-token', async (req, res) => {
  const companyId = parseInt(req.params.id);
  const result = await regenerateCompanyToken(companyId);
  
  res.status(result.success ? 200 : (result.statusCode || 400)).json({
    success: result.success,
    message: result.message,
    ...(result.data && { data: result.data }),
    ...(result.error && { error: result.error })
  });
});

// 事業所タイプ管理エンドポイント

// 事業所タイプ一覧取得
app.get('/api/office-types', async (req, res) => {
  const result = await getOfficeTypes();
  
  if (result.success) {
    res.json(result.data);
  } else {
    res.status(500).json({
      message: result.message,
      error: result.error
    });
  }
});

// 事業所タイプ作成
app.post('/api/office-types', officeTypeValidation, handleValidationErrors, async (req, res) => {
  const result = await createOfficeType(req.body);
  
  res.status(result.success ? 201 : 400).json({
    success: result.success,
    message: result.message,
    ...(result.data && { data: result.data }),
    ...(result.error && { error: result.error })
  });
});

// 事業所タイプ削除
app.delete('/api/office-types/:id', async (req, res) => {
  const officeTypeId = parseInt(req.params.id);
  const result = await deleteOfficeType(officeTypeId);
  
  res.status(result.success ? 200 : (result.statusCode || 400)).json({
    success: result.success,
    message: result.message,
    ...(result.error && { error: result.error })
  });
});

// ダッシュボード管理エンドポイント

// システム概要取得
app.get('/api/dashboard/overview', async (req, res) => {
  const result = await getSystemOverview();
  
  if (result.success) {
    res.json(result.data);
  } else {
    res.status(500).json({
      message: result.message,
      error: result.error
    });
  }
});

// 企業統計取得
app.get('/api/dashboard/company/:id', async (req, res) => {
  const companyId = parseInt(req.params.id);
  const result = await getCompanyStats(companyId);
  
  if (result.success) {
    res.json(result.data);
  } else {
    res.status(result.statusCode || 500).json({
      message: result.message,
      error: result.error
    });
  }
});

// アラート情報取得
app.get('/api/dashboard/alerts', async (req, res) => {
  const result = await getAlerts();
  
  if (result.success) {
    res.json(result.data);
  } else {
    res.status(500).json({
      message: result.message,
      error: result.error
    });
  }
});

// 拠点管理エンドポイント

// 拠点一覧取得
app.get('/api/satellites', async (req, res) => {
  const result = await getSatellites();
  
  if (result.success) {
    res.json(result.data);
  } else {
    res.status(400).json({
      success: result.success,
      message: result.message,
      ...(result.error && { error: result.error })
    });
  }
});

// 拠点詳細取得
app.get('/api/satellites/:id', async (req, res) => {
  const satelliteId = parseInt(req.params.id);
  const result = await getSatelliteById(satelliteId);
  
  res.status(result.success ? 200 : (result.statusCode || 400)).json({
    success: result.success,
    message: result.message,
    ...(result.data && { data: result.data }),
    ...(result.error && { error: result.error })
  });
});

// 複数拠点情報取得
app.get('/api/satellites/by-ids', async (req, res) => {
  const { ids } = req.query;
  
  console.log('複数拠点情報取得API呼び出し:', { ids });
  
  if (!ids) {
    console.log('拠点IDパラメータが不足');
    return res.status(400).json({
      success: false,
      message: '拠点IDの配列が必要です',
      error: 'IDs parameter is required'
    });
  }
  
  try {
    const satelliteIds = JSON.parse(ids);
    console.log('パースされた拠点ID:', satelliteIds);
    
    if (!Array.isArray(satelliteIds)) {
      console.log('拠点IDが配列ではありません:', typeof satelliteIds);
      return res.status(400).json({
        success: false,
        message: '拠点IDは配列形式である必要があります',
        error: 'IDs must be an array'
      });
    }
    
    console.log('getSatellitesByIdsを呼び出し:', satelliteIds);
    const result = await getSatellitesByIds(satelliteIds);
    console.log('getSatellitesByIds結果:', result);
    
    res.status(result.success ? 200 : 400).json({
      success: result.success,
      message: result.message,
      data: result.data,
      ...(result.error && { error: result.error })
    });
  } catch (error) {
    console.error('複数拠点情報取得APIエラー:', error);
    res.status(400).json({
      success: false,
      message: '拠点IDの形式が正しくありません',
      error: 'Invalid IDs format'
    });
  }
});

// 拠点作成
app.post('/api/satellites', satelliteValidation, handleValidationErrors, async (req, res) => {
  const result = await createSatellite(req.body);
  
  res.status(result.success ? 201 : 400).json({
    success: result.success,
    message: result.message,
    ...(result.data && { data: result.data }),
    ...(result.error && { error: result.error })
  });
});

// 拠点更新
app.put('/api/satellites/:id', satelliteUpdateValidation, handleValidationErrors, async (req, res) => {
  const satelliteId = parseInt(req.params.id);
  const result = await updateSatellite(satelliteId, req.body);
  
  res.status(result.success ? 200 : (result.statusCode || 400)).json({
    success: result.success,
    message: result.message,
    ...(result.data && { data: result.data }),
    ...(result.error && { error: result.error })
  });
});

// 拠点削除
app.delete('/api/satellites/:id', async (req, res) => {
  const satelliteId = parseInt(req.params.id);
  const result = await deleteSatellite(satelliteId);
  
  res.status(result.success ? 200 : (result.statusCode || 400)).json({
    success: result.success,
    message: result.message,
    ...(result.error && { error: result.error })
  });
});

// トークン再生成
app.post('/api/satellites/:id/regenerate-token', async (req, res) => {
  const satelliteId = parseInt(req.params.id);
  const { contract_type } = req.body;
  
  const result = await regenerateToken(satelliteId, contract_type);
  
  res.status(result.success ? 200 : (result.statusCode || 400)).json({
    success: result.success,
    message: result.message,
    ...(result.data && { data: result.data }),
    ...(result.error && { error: result.error })
  });
});

// 拠点の利用者数取得
app.get('/api/satellites/:id/users/count', async (req, res) => {
  const satelliteId = parseInt(req.params.id);
  const result = await getSatelliteUserCount(satelliteId);
  
  if (result.success) {
    res.json(result.data);
  } else {
    res.status(404).json({
      message: result.message,
      error: result.error
    });
  }
});

// 拠点の管理者一覧取得
app.get('/api/satellites/:id/managers', async (req, res) => {
  const satelliteId = parseInt(req.params.id);
  const result = await getSatelliteManagers(satelliteId);
  
  if (result.success) {
    res.json(result.data);
  } else {
    res.status(404).json({
      message: result.message,
      error: result.error
    });
  }
});

// 管理者が管理する拠点一覧取得
app.get('/api/managers/:managerId/satellites', async (req, res) => {
  const managerId = parseInt(req.params.managerId);
  const result = await getManagerSatellites(managerId);
  
  if (result.success) {
    res.json(result.data);
  } else {
    res.status(404).json({
      message: result.message,
      error: result.error
    });
  }
});

// 拠点に管理者を追加
app.post('/api/satellites/:id/managers', async (req, res) => {
  const satelliteId = parseInt(req.params.id);
  const { manager_id } = req.body;
  const result = await addManagerToSatellite(satelliteId, manager_id);
  
  res.status(result.success ? 200 : 400).json({
    success: result.success,
    message: result.message,
    ...(result.error && { error: result.error })
  });
});

// 拠点から管理者を削除
app.delete('/api/satellites/:id/managers/:managerId', async (req, res) => {
  const satelliteId = parseInt(req.params.id);
  const managerId = parseInt(req.params.managerId);
  const result = await removeManagerFromSatellite(satelliteId, managerId);
  
  res.status(result.success ? 200 : 400).json({
    success: result.success,
    message: result.message,
    ...(result.error && { error: result.error })
  });
});

// 拠点管理者を一括設定
app.put('/api/satellites/:id/managers', async (req, res) => {
  const satelliteId = parseInt(req.params.id);
  const { manager_ids } = req.body;
  const result = await setSatelliteManagers(satelliteId, manager_ids);
  
  res.status(result.success ? 200 : 400).json({
    success: result.success,
    message: result.message,
    ...(result.error && { error: result.error })
  });
});

// 拠点に管理者を追加
app.put('/api/satellites/:id/add-manager', async (req, res) => {
  const satelliteId = parseInt(req.params.id);
  const { manager_id } = req.body;
  
  if (!manager_id) {
    return res.status(400).json({
      success: false,
      message: '管理者IDは必須です',
      error: 'Manager ID is required'
    });
  }
  
  const result = await addSatelliteManager(satelliteId, manager_id);
  
  res.status(result.success ? 200 : 400).json({
    success: result.success,
    message: result.message,
    data: result.data,
    ...(result.error && { error: result.error })
  });
});

// ユーザーの所属拠点一覧取得
app.get('/api/users/:userId/satellites', async (req, res) => {
  const userId = parseInt(req.params.userId);
  const result = await getUserSatellites(userId);
  
  if (result.success) {
    res.json(result.data);
  } else {
    res.status(404).json({
      message: result.message,
      error: result.error
    });
  }
});

// 拠点に所属するユーザー一覧取得
app.get('/api/satellites/:id/users', async (req, res) => {
  const satelliteId = parseInt(req.params.id);
  const result = await getSatelliteUsers(satelliteId);
  
  if (result.success) {
    res.json(result.data);
  } else {
    res.status(404).json({
      message: result.message,
      error: result.error
    });
  }
});

// ユーザーに拠点を追加
app.post('/api/users/:userId/satellites', async (req, res) => {
  const userId = parseInt(req.params.userId);
  const { satellite_id } = req.body;
  const result = await addSatelliteToUser(userId, satellite_id);
  
  res.status(result.success ? 200 : 400).json({
    success: result.success,
    message: result.message,
    ...(result.error && { error: result.error })
  });
});

// ユーザーから拠点を削除（具体的なルートを先に配置）
app.delete('/api/users/:userId/satellites/:satelliteId', async (req, res) => {
  const userId = parseInt(req.params.userId);
  const satelliteId = parseInt(req.params.satelliteId);
  const result = await removeSatelliteFromUser(userId, satelliteId);
  
  res.status(result.success ? 200 : 400).json({
    success: result.success,
    message: result.message,
    ...(result.error && { error: result.error })
  });
});

// ユーザー削除エンドポイント（一般的なルートを具体的なルートの後に配置）
app.delete('/api/users/:userId', async (req, res) => {
  console.log('=== DELETE /api/users/:userId エンドポイントが呼び出されました ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('URL パラメータ:', req.params);
  
  try {
    const { userId } = req.params;
    console.log('削除対象のユーザーID:', userId);
    
    if (!userId || isNaN(parseInt(userId))) {
      return res.status(400).json({
        success: false,
        message: '有効なユーザーIDが指定されていません'
      });
    }
    
    const result = await deleteUser(parseInt(userId));
    console.log('削除結果:', result);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('ユーザー削除エラー:', error);
    res.status(500).json({
      success: false,
      message: 'ユーザーの削除に失敗しました',
      error: error.message
    });
  }
});

// 指導者専門分野関連エンドポイント

// 指導者の専門分野一覧取得
app.get('/api/instructors/:userId/specializations', async (req, res) => {
  const userId = parseInt(req.params.userId);
  const result = await getInstructorSpecializations(userId);
  
  res.status(result.success ? 200 : 400).json({
    success: result.success,
    message: result.message,
    data: result.data,
    ...(result.error && { error: result.error })
  });
});

// 指導者専門分野一括設定
app.post('/api/instructors/:userId/specializations', async (req, res) => {
  const userId = parseInt(req.params.userId);
  const { specializations } = req.body;
  
  if (!specializations || !Array.isArray(specializations)) {
    return res.status(400).json({
      success: false,
      message: '専門分野の配列は必須です',
      error: 'Specializations array is required'
    });
  }
  
  const result = await setInstructorSpecializations(userId, specializations);
  
  res.status(result.success ? 200 : 400).json({
    success: result.success,
    message: result.message,
    data: result.data,
    ...(result.error && { error: result.error })
  });
});

// 指導者専門分野削除
app.delete('/api/instructors/:userId/specializations/:specializationId', async (req, res) => {
  const userId = parseInt(req.params.userId);
  const specializationId = parseInt(req.params.specializationId);
  const result = await deleteInstructorSpecialization(specializationId, userId);
  
  res.status(result.success ? 200 : 400).json({
    success: result.success,
    message: result.message,
    ...(result.error && { error: result.error })
  });
});

// 拠点内指導者一覧取得（専門分野含む）
app.get('/api/satellites/:satelliteId/instructors', async (req, res) => {
  const satelliteId = parseInt(req.params.satelliteId);
  const result = await getSatelliteInstructors(satelliteId);
  
  res.status(result.success ? 200 : 400).json({
    success: result.success,
    message: result.message,
    data: result.data,
    ...(result.error && { error: result.error })
  });
});

// 拠点統計情報取得
app.get('/api/satellites/:satelliteId/stats', async (req, res) => {
  const satelliteId = parseInt(req.params.satelliteId);
  const result = await getSatelliteStats(satelliteId);
  
  res.status(result.success ? 200 : 400).json({
    success: result.success,
    message: result.message,
    data: result.data,
    ...(result.error && { error: result.error })
  });
});

// ヘルスチェックエンドポイント
app.get('/health', async (req, res) => {
  try {
    const { testConnection, getPoolStatus } = require('./utils/database');
    const dbTest = await testConnection();
    const poolStatus = getPoolStatus();
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: {
        connected: dbTest.success,
        currentTime: dbTest.currentTime,
        error: dbTest.error
      },
      pool: poolStatus
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// ログ管理エンドポイント
app.get('/api/logs', getLogFiles);
app.get('/api/logs/:filename', getLogContent);
app.get('/api/logs/:filename/download', downloadLogFile);
app.delete('/api/logs/:filename', deleteLogFile);
app.post('/api/logs/cleanup', cleanupOldLogs);
app.get('/api/logs/stats', getLogStats);

// 操作ログ管理エンドポイント
app.post('/api/operation-logs', recordOperationLog);
app.get('/api/operation-logs', getOperationLogs);
app.get('/api/operation-logs/stats', getOperationLogStats);
app.get('/api/operation-logs/export', exportOperationLogs);
app.delete('/api/operation-logs', clearOperationLogs);

// コース管理エンドポイント
app.get('/api/courses', authenticateToken, getCourses);
app.get('/api/courses/:id', authenticateToken, getCourseById);
app.post('/api/courses', authenticateToken, requireAdmin, createCourse);
app.put('/api/courses/:id', authenticateToken, requireAdmin, updateCourse);
app.delete('/api/courses/:id', authenticateToken, requireAdmin, deleteCourse);
app.put('/api/courses/order', authenticateToken, requireAdmin, updateCourseOrder);

// テスト用エンドポイント（認証なし）
app.post('/api/test/courses', createCourse);
app.get('/api/test/courses', getCourses);

// レッスン管理エンドポイント（FormData用）
app.get('/api/lessons', authenticateToken, getLessons);
app.get('/api/lessons/:id', authenticateToken, getLessonById);
app.post('/api/lessons', authenticateToken, requireAdmin, upload.single('file'), createLesson);
app.put('/api/lessons/:id', authenticateToken, requireAdmin, upload.single('file'), updateLesson);
app.delete('/api/lessons/:id', authenticateToken, requireAdmin, deleteLesson);
app.put('/api/lessons/order', authenticateToken, requireAdmin, updateLessonOrder);
app.get('/api/lessons/:id/download', authenticateToken, downloadLessonFile);
app.get('/api/lessons/:id/download-folder', authenticateToken, downloadLessonFolder);
app.get('/api/lessons/:id/files', authenticateToken, getLessonFiles);
app.post('/api/lessons/download-file', authenticateToken, downloadIndividualFile);

// エラーログミドルウェア
app.use(errorLogger);

// エラーハンドリングミドルウェア
app.use(errorHandler);

// 404ハンドラー
app.use(notFoundHandler);

module.exports = app; 