const express = require('express');
const {
  getCompanies,
  getCompanyById,
  createCompany,
  updateCompany,
  deleteCompany,
  regenerateCompanyToken,
} = require('../scripts/companyController');
const {
  companyValidation,
  companyUpdateValidation,
  handleValidationErrors,
} = require('../middleware/validation');

const router = express.Router();

// 企業一覧取得
router.get('/', async (req, res) => {
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
        details: '企業一覧取得処理でエラーが発生しました',
      });
    }
  } catch (error) {
    console.error('企業一覧取得で予期しないエラー:', error);
    res.status(500).json({
      success: false,
      message: '企業一覧の取得中に予期しないエラーが発生しました',
      error: error.message,
      stack: error.stack,
    });
  }
});

// 企業詳細取得
router.get('/:id', async (req, res) => {
  const companyId = parseInt(req.params.id);
  const result = await getCompanyById(companyId);
  if (result.success) {
    res.json(result.data);
  } else {
    res.status(result.statusCode || 404).json({
      message: result.message,
      error: result.error,
    });
  }
});

// 企業作成
router.post('/', companyValidation, handleValidationErrors, async (req, res) => {
  const result = await createCompany(req.body);
  res.status(result.success ? 201 : 400).json({
    success: result.success,
    message: result.message,
    ...(result.data && { data: result.data }),
    ...(result.error && { error: result.error }),
  });
});

// 企業更新
router.put('/:id', companyUpdateValidation, handleValidationErrors, async (req, res) => {
  const companyId = parseInt(req.params.id);
  const result = await updateCompany(companyId, req.body);
  res.status(result.success ? 200 : (result.statusCode || 400)).json({
    success: result.success,
    message: result.message,
    ...(result.data && { data: result.data }),
    ...(result.error && { error: result.error }),
  });
});

// 企業削除
router.delete('/:id', async (req, res) => {
  const companyId = parseInt(req.params.id);
  const result = await deleteCompany(companyId);
  res.status(result.success ? 200 : (result.statusCode || 400)).json({
    success: result.success,
    message: result.message,
    ...(result.error && { error: result.error }),
  });
});

// 企業トークン再生成
router.post('/:id/regenerate-token', async (req, res) => {
  const companyId = parseInt(req.params.id);
  const result = await regenerateCompanyToken(companyId);
  res.status(result.success ? 200 : (result.statusCode || 400)).json({
    success: result.success,
    message: result.message,
    ...(result.data && { data: result.data }),
    ...(result.error && { error: result.error }),
  });
});

module.exports = router;


