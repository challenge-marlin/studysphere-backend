const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

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
const { adminLogin } = require('./scripts/authController');
const { getUsers, getTopUsersByCompany, getTeachersByCompany, healthCheck } = require('./scripts/userController');
const { 
  getSatellitesByCompany, 
  getSatelliteById, 
  createSatellite, 
  updateSatellite, 
  deleteSatellite,
  getSatelliteUserCount 
} = require('./scripts/satelliteController');
const {
  getCompanies,
  getCompanyById,
  createCompany,
  updateCompany,
  deleteCompany
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

// パースミドルウェア
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ルート定義

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
  const result = await getCompanies();
  
  if (result.success) {
    res.json(result.data);
  } else {
    res.status(500).json({
      message: result.message,
      error: result.error
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

// 企業の拠点一覧取得
app.get('/satellites/company/:companyId', async (req, res) => {
  const companyId = parseInt(req.params.companyId);
  const result = await getSatellitesByCompany(companyId);
  
  if (result.success) {
    res.json(result.data);
  } else {
    res.status(500).json({
      message: result.message,
      error: result.error
    });
  }
});

// 拠点詳細取得
app.get('/satellites/:id', async (req, res) => {
  const satelliteId = parseInt(req.params.id);
  const result = await getSatelliteById(satelliteId);
  
  if (result.success) {
    res.json(result.data);
  } else {
    res.status(404).json({
      message: result.message,
      error: result.error
    });
  }
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
  
  res.status(result.success ? 200 : 400).json({
    success: result.success,
    message: result.message,
    ...(result.error && { error: result.error })
  });
});

// 拠点削除
app.delete('/satellites/:id', async (req, res) => {
  const satelliteId = parseInt(req.params.id);
  const result = await deleteSatellite(satelliteId);
  
  res.status(result.success ? 200 : 400).json({
    success: result.success,
    message: result.message,
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

// エラーハンドリングミドルウェア
app.use(errorHandler);

// 404ハンドラー
app.use(notFoundHandler);

module.exports = app; 