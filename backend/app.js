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
  addSatelliteManager,
  removeSatelliteManager
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
  getSatelliteStats,
  setInstructorAsManager,
  removeInstructorAsManager
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

// ルーターのインポート
const companyRoutes = require('./routes/companyRoutes');
const userRoutes = require('./routes/userRoutes');
const satelliteRoutes = require('./routes/satelliteRoutes');
const managerRoutes = require('./routes/managerRoutes');
const adminRoutes = require('./routes/adminRoutes');
const officeTypeRoutes = require('./routes/officeTypeRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const instructorRoutes = require('./routes/instructorRoutes');
const logRoutes = require('./routes/logRoutes');
const operationLogRoutes = require('./routes/operationLogRoutes');
const courseRoutes = require('./routes/courseRoutes');
const lessonRoutes = require('./routes/lessonRoutes');
const lessonVideoRoutes = require('./routes/lessonVideoRoutes');
const lessonTextVideoLinkRoutes = require('./routes/lessonTextVideoLinkRoutes');
const curriculumPathRoutes = require('./routes/curriculumPathRoutes');
const authRoutes = require('./routes/authRoutes');
const testRoutes = require('./routes/testRoutes');

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

// JSONパーサーを適用（FormDataエンドポイントを除く）
app.use((req, res, next) => {
  // FormDataを送信するエンドポイントの場合はJSONパーサーをスキップ
  if ((req.path === '/api/lessons' && req.method === 'POST') ||
      (req.path.match(/^\/api\/lessons\/\d+$/) && req.method === 'PUT')) {
    return next();
  }
  // その他のエンドポイントにはJSONパーサーを適用
  return express.json({ limit: '10mb' })(req, res, next);
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

// デバッグ用エンドポイント
app.get('/api/debug/routes', (req, res) => {
  const routes = [];
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      routes.push({
        path: middleware.route.path,
        methods: Object.keys(middleware.route.methods)
      });
    }
  });
  res.json({ routes });
});

// ルーターマウント（機能別に切り分け）
app.use('/api/companies', companyRoutes);
app.use('/api/users', userRoutes);
app.use('/api/satellites', satelliteRoutes);
app.use('/api/managers', managerRoutes);
app.use('/api/admins', adminRoutes);
app.use('/api/office-types', officeTypeRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/instructors', instructorRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/operation-logs', operationLogRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/lesson-videos', lessonVideoRoutes);
app.use('/api/lesson-text-video-links', lessonTextVideoLinkRoutes);
app.use('/api/curriculum-paths', curriculumPathRoutes);
app.use('/api', authRoutes);
app.use('/api/test', testRoutes);

// ルートエンドポイント
app.get('/', (req, res) => {
  res.json({
    message: 'StudySphere Backend API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    status: 'running'
  });
});

// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.version
  });
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



// 認証系エンドポイントは routes/authRoutes.js に移動

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

// Users routes are moved to routes/userRoutes.js



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

// Companies routes are moved to routes/companyRoutes.js

// 事業所タイプ管理エンドポイントは routes/officeTypeRoutes.js に移動

// ダッシュボード管理エンドポイントは routes/dashboardRoutes.js に移動

// Satellites routes are moved to routes/satelliteRoutes.js

// Users related association routes are moved to routes/userRoutes.js

// 指導者専門分野関連エンドポイントは routes/instructorRoutes.js に移動

// 拠点内指導者一覧や拠点統計は routes/satelliteRoutes.js に移動

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

// ログ管理エンドポイントは routes/logRoutes.js に移動

// 操作ログ管理エンドポイントは routes/operationLogRoutes.js に移動

// コース管理エンドポイントは routes/courseRoutes.js に移動
// テスト用エンドポイントは routes/testRoutes.js に移動

// レッスン管理エンドポイントは routes/lessonRoutes.js に移動

// エラーログミドルウェア
app.use(errorLogger);

// 404ハンドラー（最後に配置）
app.use(notFoundHandler);

// エラーハンドリングミドルウェア（最後に配置）
app.use(errorHandler);

// グローバルエラーハンドラー（最後に配置）
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  
  // データベース接続エラーの場合
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    return res.status(503).json({
      success: false,
      message: 'データベース接続エラーが発生しました。しばらく時間をおいてから再試行してください。',
      error: 'DATABASE_CONNECTION_ERROR'
    });
  }
  
  // その他の予期しないエラー
  res.status(500).json({
    success: false,
    message: 'サーバー内部エラーが発生しました。',
    error: process.env.NODE_ENV === 'development' ? err.message : 'INTERNAL_SERVER_ERROR'
  });
});

module.exports = app; 