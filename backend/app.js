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
  removeSatelliteFromUser
} = require('./scripts/userController');
const { 
  getSatellites, 
  getSatelliteById, 
  createSatellite, 
  updateSatellite, 
  deleteSatellite,
  getSatelliteUserCount,
  getSatelliteManagers,
  getManagerSatellites,
  addManagerToSatellite,
  removeManagerFromSatellite,
  regenerateToken
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

// ログ管理コントローラーのインポート
const {
  getLogFiles,
  getLogContent,
  downloadLogFile,
  deleteLogFile,
  cleanupOldLogs,
  getLogStats
} = require('./scripts/logController');

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

// パースミドルウェア
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ルート定義

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
    
    // 管理者ユーザーアカウントを作成
    const userResult = await executeQuery(`
      INSERT INTO user_accounts (name, role, status, login_code, company_id) 
      VALUES ('admin001', 9, 1, 'CGA8-CH0R-QVEC', NULL)
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
app.get('/users', async (req, res) => {
  const result = await getUsers();
  
  if (result.success) {
    res.json(result.data);
  } else {
    res.status(500).json({
      message: result.message,
      error: result.error
    });
  }
});

// ユーザー作成エンドポイント
app.post('/users', async (req, res) => {
  try {
    const { pool } = require('./utils/database');
    const { name, role, status, login_code, company_id, satellite_ids, is_remote_user, recipient_number } = req.body;

    // 必須フィールドの検証
    if (!name || !role || !login_code) {
      return res.status(400).json({
        success: false,
        message: '名前、ロール、ログインコードは必須です'
      });
    }

    // ユーザー作成
    const [result] = await pool.execute(`
      INSERT INTO user_accounts (name, role, status, login_code, company_id, satellite_ids, is_remote_user, recipient_number)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [name, role, status || 1, login_code, company_id, satellite_ids ? JSON.stringify(satellite_ids) : null, is_remote_user || false, recipient_number]);

    res.status(201).json({
      success: true,
      message: 'ユーザーが作成されました',
      data: { id: result.insertId }
    });
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
app.get('/users/top-by-company', async (req, res) => {
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
app.get('/users/teachers-by-company', async (req, res) => {
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

// 企業管理エンドポイント

// 企業一覧取得
app.get('/companies', async (req, res) => {
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
app.get('/companies/:id', async (req, res) => {
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
app.post('/companies', companyValidation, handleValidationErrors, async (req, res) => {
  const result = await createCompany(req.body);
  
  res.status(result.success ? 201 : 400).json({
    success: result.success,
    message: result.message,
    ...(result.data && { data: result.data }),
    ...(result.error && { error: result.error })
  });
});

// 企業更新
app.put('/companies/:id', companyUpdateValidation, handleValidationErrors, async (req, res) => {
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
app.delete('/companies/:id', async (req, res) => {
  const companyId = parseInt(req.params.id);
  const result = await deleteCompany(companyId);
  
  res.status(result.success ? 200 : (result.statusCode || 400)).json({
    success: result.success,
    message: result.message,
    ...(result.error && { error: result.error })
  });
});

// 企業トークン再生成
app.post('/companies/:id/regenerate-token', async (req, res) => {
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
app.get('/office-types', async (req, res) => {
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
app.post('/office-types', officeTypeValidation, handleValidationErrors, async (req, res) => {
  const result = await createOfficeType(req.body);
  
  res.status(result.success ? 201 : 400).json({
    success: result.success,
    message: result.message,
    ...(result.data && { data: result.data }),
    ...(result.error && { error: result.error })
  });
});

// 事業所タイプ削除
app.delete('/office-types/:id', async (req, res) => {
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
app.get('/dashboard/overview', async (req, res) => {
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
app.get('/dashboard/company/:id', async (req, res) => {
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
app.get('/dashboard/alerts', async (req, res) => {
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
app.get('/satellites', async (req, res) => {
  const result = await getSatellites();
  
  res.status(result.success ? 200 : 400).json({
    success: result.success,
    message: result.message,
    ...(result.data && { data: result.data }),
    ...(result.error && { error: result.error })
  });
});

// 拠点詳細取得
app.get('/satellites/:id', async (req, res) => {
  const satelliteId = parseInt(req.params.id);
  const result = await getSatelliteById(satelliteId);
  
  res.status(result.success ? 200 : (result.statusCode || 400)).json({
    success: result.success,
    message: result.message,
    ...(result.data && { data: result.data }),
    ...(result.error && { error: result.error })
  });
});

// 拠点作成
app.post('/satellites', satelliteValidation, handleValidationErrors, async (req, res) => {
  const result = await createSatellite(req.body);
  
  res.status(result.success ? 201 : 400).json({
    success: result.success,
    message: result.message,
    ...(result.data && { data: result.data }),
    ...(result.error && { error: result.error })
  });
});

// 拠点更新
app.put('/satellites/:id', satelliteUpdateValidation, handleValidationErrors, async (req, res) => {
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
app.delete('/satellites/:id', async (req, res) => {
  const satelliteId = parseInt(req.params.id);
  const result = await deleteSatellite(satelliteId);
  
  res.status(result.success ? 200 : (result.statusCode || 400)).json({
    success: result.success,
    message: result.message,
    ...(result.error && { error: result.error })
  });
});

// トークン再生成
app.post('/satellites/:id/regenerate-token', async (req, res) => {
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
app.get('/satellites/:id/users/count', async (req, res) => {
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
app.get('/satellites/:id/managers', async (req, res) => {
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
app.get('/managers/:managerId/satellites', async (req, res) => {
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
app.post('/satellites/:id/managers', async (req, res) => {
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
app.delete('/satellites/:id/managers/:managerId', async (req, res) => {
  const satelliteId = parseInt(req.params.id);
  const managerId = parseInt(req.params.managerId);
  const result = await removeManagerFromSatellite(satelliteId, managerId);
  
  res.status(result.success ? 200 : 400).json({
    success: result.success,
    message: result.message,
    ...(result.error && { error: result.error })
  });
});

// ユーザーの所属拠点一覧取得
app.get('/users/:userId/satellites', async (req, res) => {
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
app.get('/satellites/:id/users', async (req, res) => {
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
app.post('/users/:userId/satellites', async (req, res) => {
  const userId = parseInt(req.params.userId);
  const { satellite_id } = req.body;
  const result = await addSatelliteToUser(userId, satellite_id);
  
  res.status(result.success ? 200 : 400).json({
    success: result.success,
    message: result.message,
    ...(result.error && { error: result.error })
  });
});

// ユーザーから拠点を削除
app.delete('/users/:userId/satellites/:satelliteId', async (req, res) => {
  const userId = parseInt(req.params.userId);
  const satelliteId = parseInt(req.params.satelliteId);
  const result = await removeSatelliteFromUser(userId, satelliteId);
  
  res.status(result.success ? 200 : 400).json({
    success: result.success,
    message: result.message,
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

// エラーログミドルウェア
app.use(errorLogger);

// エラーハンドリングミドルウェア
app.use(errorHandler);

// 404ハンドラー
app.use(notFoundHandler);

module.exports = app; 