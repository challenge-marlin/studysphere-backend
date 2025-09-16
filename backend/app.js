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

// 指導員専門分野管理コントローラーのインポート
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
const userCourseRoutes = require('./routes/userCourseRoutes');
const supportPlanRoutes = require('./routes/supportPlanRoutes');
const tempPasswordRoutes = require('./routes/tempPasswordRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
const messageRoutes = require('./routes/messageRoutes');
const studentRoutes = require('./routes/studentRoutes');
const authRoutes = require('./routes/authRoutes');
const testRoutes = require('./routes/testRoutes');
const remoteSupportRoutes = require('./routes/remoteSupportRoutes');
const learningRoutes = require('./routes/learningRoutes');
const submissionRoutes = require('./routes/submissionRoutes');
const pdfRoutes = require('./routes/pdfRoutes');
// AIルートの条件付き読み込み（環境変数が設定されている場合のみ）
let aiRoutes;
try {
  if (process.env.OPENAI_API_KEY) {
    aiRoutes = require('./routes/ai');
  }
} catch (error) {
  console.warn('AIルートの読み込みに失敗しました:', error.message);
  aiRoutes = null;
}

const app = express();

// セキュリティミドルウェア
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      frameSrc: ["'self'", "http://localhost:5050", "http://localhost:3000"],
      frameAncestors: ["'self'", "http://localhost:3000", "http://localhost:5050", "http://localhost:3000/studysphere"],
      connectSrc: ["'self'", "http://localhost:5050", "http://localhost:3000"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin: function (origin, callback) {
    // 開発環境ではすべてのオリジンを許可
    if (process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      // 本番環境では特定のオリジンのみ許可
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:5000',
        process.env.FRONTEND_URL
      ].filter(Boolean);
      
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
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
  if (req.url.includes('/api/learning/certificates/')) {
    console.log('=== DEBUG: Certificates API request detected ===');
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    console.log('Headers:', req.headers);
  }
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
    } else if (middleware.name === 'router') {
      // ルーターの場合は、そのルーター内のルートも確認
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          routes.push({
            path: middleware.regexp.source + handler.route.path,
            methods: Object.keys(handler.route.methods)
          });
        }
      });
    }
  });
  res.json({ routes });
});

// 一括利用者追加エンドポイントのテスト
app.get('/api/debug/bulk-test', (req, res) => {
  res.json({ 
    message: '一括利用者追加エンドポイントのテスト',
    timestamp: new Date().toISOString(),
    available: true
  });
});

// ルーターマウント（機能別に切り分け）
// より具体的なパスを先に配置
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
app.use('/api/user-courses', userCourseRoutes);
app.use('/api/support-plans', supportPlanRoutes);
app.use('/api/temp-passwords', tempPasswordRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/learning', learningRoutes);
app.use('/api/submissions', submissionRoutes);

app.use('/api/remote-support', remoteSupportRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api/test', testRoutes);
// AIルートの条件付きマウント
if (aiRoutes) {
  app.use('/api/ai', aiRoutes);
} else {
  console.log('AIルートは無効化されています（OPENAI_API_KEYが設定されていません）');
}
// authRoutesを最後に配置（汎用的なパスのため）
app.use('/api', authRoutes);

// ルートエンドポイント
app.get('/', (req, res) => {
  res.json({
    message: 'StudySphere Backend API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    status: 'running'
  });
});

// APIヘルスチェックエンドポイント
app.get('/api/health', (req, res) => {
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

// Users routes are moved to routes/userRoutes.js



// 管理者管理エンドポイントは routes/adminRoutes.js に移動

// Companies routes are moved to routes/companyRoutes.js

// 事業所タイプ管理エンドポイントは routes/officeTypeRoutes.js に移動

// ダッシュボード管理エンドポイントは routes/dashboardRoutes.js に移動

// Satellites routes are moved to routes/satelliteRoutes.js

// Users related association routes are moved to routes/userRoutes.js

// 指導員専門分野関連エンドポイントは routes/instructorRoutes.js に移動

// 拠点内指導員一覧や拠点統計は routes/satelliteRoutes.js に移動

// ヘルスチェックエンドポイントは /api/health に統合済み

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

// 起動時のログ出力
console.log('=== StudySphere Backend Starting ===');
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Timestamp:', new Date().toISOString());

// 利用可能なルートの確認（安全な方法）
setTimeout(() => {
  try {
    console.log('=== Available Routes ===');
    if (app._router && app._router.stack) {
      app._router.stack.forEach((middleware) => {
        if (middleware.name === 'router') {
          console.log(`Router mounted at: ${middleware.regexp.source}`);
        }
      });
    }
    console.log('=== Routes Check Complete ===');
  } catch (error) {
    console.warn('ルート確認中にエラーが発生:', error.message);
  }
}, 1000);

module.exports = app; 