const express = require('express');
const multer = require('multer');
const router = express.Router();
const PDFController = require('../scripts/pdfController');

// multer設定（メモリ上でファイルを処理）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB制限
  },
  fileFilter: (req, file, cb) => {
    // PDFファイルのみ許可
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('PDFファイルのみアップロード可能です'), false);
    }
  }
});

// ヘルスチェックエンドポイント
router.get('/health', (req, res) => {
  res.status(200).json({ 
    success: true, 
    message: 'PDF Processing API is running',
    timestamp: new Date().toISOString()
  });
});

// PDFファイルアップロード・処理開始
router.post('/upload', upload.single('pdf'), PDFController.uploadPDF);

// PDF処理状態確認
router.get('/status/:processId', PDFController.getProcessingStatus);

// ユーザーのPDF処理状態一覧取得
router.get('/user-status', PDFController.getUserProcessingStatus);

// PDF処理結果取得
router.get('/result/:processId', PDFController.getProcessingResult);

// PDF処理統計取得（管理者用）
router.get('/stats', PDFController.getProcessingStats);

// PDF処理キャンセル
router.post('/cancel/:processId', PDFController.cancelProcessing);

// エラーハンドリングミドルウェア
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'ファイルサイズが大きすぎます（100MB以下にしてください）'
      });
    }
  }
  
  if (error.message.includes('PDFファイルのみ')) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
  
  // その他のエラー
  res.status(500).json({
    success: false,
    message: 'ファイルアップロードエラーが発生しました',
    error: error.message
  });
});

module.exports = router;
