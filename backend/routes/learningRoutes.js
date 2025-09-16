const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const AWS = require('aws-sdk');
const { customLogger } = require('../utils/logger');
const {
  getUserProgress,
  updateLessonProgress,
  submitTestResult,
  getTestResults,
  getLessonContent,
  getCourseProgress,
  assignCourseToUser,
  getCurrentLesson,
  approveLessonCompletion,
  getCertificateData,
  getUserCertificates
} = require('../scripts/learningController');
const multer = require('multer');
const { pool } = require('../utils/database');

// Multer設定
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const router = express.Router();

// ファイル読み込み確認
console.log('=== Learning Routes File Loaded ===');
console.log('Timestamp:', new Date().toISOString());


// テスト用エンドポイント（削除 - 競合の原因）
// router.get('/test', (req, res) => {
//   console.log('=== テストエンドポイント呼び出し ===');
//   res.json({ message: 'Learning routes are working!', timestamp: new Date().toISOString() });
// });


// 基本的なヘルスチェック
router.get('/', (req, res) => {
  console.log('=== Learning Routes Root ===');
  res.json({ message: 'Learning routes are active', timestamp: new Date().toISOString() });
});

// 成果物アップロード（リクエストボディベース）
router.post('/upload-assignment', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    console.log('=== アップロードエンドポイント呼び出し ===');
    console.log('URL:', req.url);
    console.log('Method:', req.method);
    console.log('Body keys:', Object.keys(req.body || {}));
    console.log('File:', req.file ? 'Present' : 'Not present');
    
    const { lessonId } = req.body;
    const userId = req.user.user_id;
    const file = req.file;

    // lessonIdの検証
    if (!lessonId) {
      return res.status(400).json({
        success: false,
        message: 'レッスンIDが指定されていません'
      });
    }

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'ファイルがアップロードされていません'
      });
    }

    // ZIPファイルのみ許可
    if (!file.mimetype.includes('zip') && !file.originalname.toLowerCase().endsWith('.zip')) {
      return res.status(400).json({
        success: false,
        message: 'ZIPファイルのみアップロード可能です'
      });
    }

    const connection = await pool.getConnection();
    
    try {
      // トランザクション開始
      await connection.beginTransaction();
      
      // レッスンの課題設定を確認
      const [lessonRows] = await connection.execute(`
        SELECT l.has_assignment, l.title, c.title as course_title 
        FROM lessons l 
        JOIN courses c ON l.course_id = c.id 
        WHERE l.id = ? AND l.status = 'active'
      `, [lessonId]);

      if (lessonRows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'レッスンが見つかりません'
        });
      }

      const lesson = lessonRows[0];
      if (!lesson.has_assignment) {
        return res.status(400).json({
          success: false,
          message: 'このレッスンには課題が設定されていません'
        });
      }

      // ユーザー情報を取得（企業・拠点・ユーザートークン）
      console.log('=== ユーザー情報取得開始 ===');
      console.log('userId:', userId);
      
      // まずユーザーアカウント情報を取得
      const [userAccountRows] = await connection.execute(`
        SELECT id, login_code, company_id, satellite_ids FROM user_accounts WHERE id = ?
      `, [userId]);

      console.log('ユーザーアカウント情報:', userAccountRows);

      if (userAccountRows.length === 0) {
        console.log('=== ユーザーアカウントが見つからない場合の詳細調査 ===');
        
        // 全ユーザーアカウントの確認
        const [allUsers] = await connection.execute('SELECT id, name, login_code FROM user_accounts LIMIT 10');
        console.log('利用可能なユーザーアカウント（最初の10件）:', allUsers);
        
        return res.status(404).json({
          success: false,
          message: 'ユーザーアカウントが見つかりません'
        });
      }

      const userAccount = userAccountRows[0];
      
      // 企業情報を取得
      console.log('企業ID:', userAccount.company_id);
      const [companyRows] = await connection.execute(`
        SELECT id, token FROM companies WHERE id = ?
      `, [userAccount.company_id]);

      console.log('企業情報クエリ結果:', companyRows);

      if (companyRows.length === 0) {
        console.log('=== 企業情報が見つからない場合の詳細調査 ===');
        
        // 全企業の確認
        const [allCompanies] = await connection.execute('SELECT id, name, token FROM companies LIMIT 10');
        console.log('利用可能な企業（最初の10件）:', allCompanies);
        
        return res.status(404).json({
          success: false,
          message: '企業情報が見つかりません'
        });
      }

      const company = companyRows[0];
      
      // 拠点情報を取得（最初の拠点を使用）
      console.log('satellite_ids:', userAccount.satellite_ids);
      let satelliteRows = [];
      if (userAccount.satellite_ids) {
        try {
          // JSON配列として解析を試行
          let satelliteIds;
          if (typeof userAccount.satellite_ids === 'string') {
            satelliteIds = JSON.parse(userAccount.satellite_ids);
          } else {
            satelliteIds = userAccount.satellite_ids;
          }
          
          console.log('解析されたsatellite_ids:', satelliteIds);
          
          // 配列でない場合は配列に変換
          if (!Array.isArray(satelliteIds)) {
            satelliteIds = [satelliteIds];
          }
          
          if (satelliteIds.length > 0) {
            console.log('最初の拠点ID:', satelliteIds[0]);
            const [rows] = await connection.execute(`
              SELECT id, token FROM satellites WHERE id = ?
            `, [satelliteIds[0]]);
            satelliteRows = rows;
            console.log('拠点情報クエリ結果:', satelliteRows);
          }
        } catch (parseError) {
          console.log('satellite_idsのJSON解析エラー:', parseError);
          // フォールバック: FIND_IN_SETを使用
          const [rows] = await connection.execute(`
            SELECT id, token FROM satellites WHERE FIND_IN_SET(id, ?)
            LIMIT 1
          `, [userAccount.satellite_ids]);
          satelliteRows = rows;
          console.log('FIND_IN_SET拠点情報クエリ結果:', satelliteRows);
        }
      } else {
        console.log('satellite_idsがnullまたはundefinedです');
      }

      if (satelliteRows.length === 0) {
        console.log('=== 拠点情報が見つからない場合の詳細調査 ===');
        
        // 全拠点の確認
        const [allSatellites] = await connection.execute('SELECT id, name, token, company_id FROM satellites LIMIT 10');
        console.log('利用可能な拠点（最初の10件）:', allSatellites);
        
        return res.status(404).json({
          success: false,
          message: '拠点情報が見つかりません'
        });
      }

      const satellite = satelliteRows[0];
      
      const user = {
        login_code: userAccount.login_code,
        company_token: company.token,
        satellite_token: satellite.token
      };
      
      // 現在の日時からファイル名を生成（YYYY_MMDD_HHMMSS.zip形式）- JST時刻を使用
      const { getCurrentJapanTime } = require('../utils/dateUtils');
      const now = getCurrentJapanTime();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      
      const fileName = `${year}_${month}${day}_${hours}${minutes}${seconds}.zip`;
      
      // S3パスを構築: doc/{企業トークン}/{拠点トークン}/{利用者トークン}/{レッスンID}/
      const s3Key = `doc/${user.company_token}/${user.satellite_token}/${user.login_code}/${lessonId}/${fileName}`;

      // S3にアップロード
      const s3Config = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || 'ap-northeast-1',
        bucketName: process.env.AWS_S3_BUCKET || 'studysphere'
      };

      const s3 = new AWS.S3({
        accessKeyId: s3Config.accessKeyId,
        secretAccessKey: s3Config.secretAccessKey,
        region: s3Config.region
      });

      const uploadParams = {
        Bucket: s3Config.bucketName,
        Key: s3Key,
        Body: file.buffer,
        ContentType: file.mimetype,
        Metadata: {
          'original-name': Buffer.from(file.originalname, 'utf8').toString('base64'),
          'upload-date': new Date().toISOString(),
          'lesson-id': lessonId,
          'user-id': userId.toString(),
          'course-title': Buffer.from(lesson.course_title, 'utf8').toString('base64'),
          'lesson-title': Buffer.from(lesson.title, 'utf8').toString('base64')
        }
      };

      await s3.upload(uploadParams).promise();

      // データベースに提出記録を保存
      const [existingProgress] = await connection.execute(`
        SELECT id FROM user_lesson_progress 
        WHERE user_id = ? AND lesson_id = ?
      `, [userId, lessonId]);

      if (existingProgress.length > 0) {
        // 既存の進捗を更新
        await connection.execute(`
          UPDATE user_lesson_progress 
          SET assignment_submitted = 1, assignment_submitted_at = NOW(), updated_at = NOW()
          WHERE user_id = ? AND lesson_id = ?
        `, [userId, lessonId]);
      } else {
        // 新しい進捗を作成
        await connection.execute(`
          INSERT INTO user_lesson_progress 
          (user_id, lesson_id, status, assignment_submitted, assignment_submitted_at, created_at, updated_at)
          VALUES (?, ?, 'in_progress', 1, NOW(), NOW(), NOW())
        `, [userId, lessonId]);
      }

      // deliverablesテーブルにファイル情報を保存
      try {
        console.log('=== deliverablesテーブル挿入開始 ===');
        console.log('挿入データ:', {
          userId: userId,
          curriculumName: lesson.course_title,
          sessionNumber: lessonId,
          fileUrl: s3Key,
          fileType: 'other'
        });
        
        const [deliverableResult] = await connection.execute(`
          INSERT INTO deliverables 
          (user_id, lesson_id, curriculum_name, session_number, file_url, file_type, file_name, file_size, uploaded_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `, [userId, lessonId, lesson.course_title, lessonId, s3Key, 'other', file.originalname, file.size]);
        
        console.log('=== deliverablesテーブル挿入成功 ===');
        console.log('挿入結果:', deliverableResult);
        
        // 挿入確認のためのクエリ
        const [verifyRows] = await connection.execute(`
          SELECT * FROM deliverables WHERE id = ?
        `, [deliverableResult.insertId]);
        console.log('挿入確認:', verifyRows);
        
      } catch (deliverableError) {
        console.error('=== deliverablesテーブル挿入エラー ===');
        console.error('エラー詳細:', deliverableError);
        console.error('エラーメッセージ:', deliverableError.message);
        console.error('エラーコード:', deliverableError.code);
        console.error('エラースタック:', deliverableError.stack);
        
        // deliverablesテーブル挿入エラーでも処理を継続（既存の進捗更新は成功しているため）
        console.log('deliverablesテーブル挿入エラーが発生しましたが、処理を継続します');
      }

      // トランザクションコミット
      await connection.commit();
      console.log('=== トランザクションコミット完了 ===');

      res.json({
        success: true,
        message: '成果物のアップロードが完了しました',
        data: {
          fileName: fileName,
          originalFileName: file.originalname,
          fileSize: file.size,
          s3Key,
          lessonId: parseInt(lessonId),
          userId: parseInt(userId)
        }
      });

    } catch (transactionError) {
      // トランザクションロールバック
      console.error('=== トランザクションエラー、ロールバック実行 ===');
      console.error('エラー詳細:', transactionError);
      await connection.rollback();
      throw transactionError;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('成果物アップロードエラー:', error);
    console.error('エラースタック:', error.stack);
    
    // データベース接続エラーの場合
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return res.status(503).json({
        success: false,
        message: 'データベース接続エラーが発生しました。しばらく時間をおいてから再試行してください。',
        error: 'DATABASE_CONNECTION_ERROR'
      });
    }
    
    // その他のエラー
    res.status(500).json({
      success: false,
      message: '成果物のアップロードに失敗しました',
      error: process.env.NODE_ENV === 'development' ? error.message : 'INTERNAL_SERVER_ERROR'
    });
  }
});

// アップロード済みファイル取得
router.get('/lesson/:lessonId/uploaded-files', authenticateToken, async (req, res) => {
  try {
    const { lessonId } = req.params;
    const userId = req.user.user_id;

    console.log('=== アップロード済みファイル取得 ===');
    console.log('lessonId:', lessonId);
    console.log('userId:', userId);

    const connection = await pool.getConnection();
    
    try {
      // deliverablesテーブルからファイル情報を取得（承認状態も含む）
      const [fileRows] = await connection.execute(`
        SELECT id, curriculum_name, session_number, file_url, file_type, uploaded_at, instructor_approved, instructor_approved_at
        FROM deliverables 
        WHERE user_id = ? AND session_number = ?
        ORDER BY uploaded_at DESC
      `, [userId, lessonId]);

      console.log('取得されたファイル数:', fileRows.length);

      const uploadedFiles = fileRows.map(file => ({
        id: file.id,
        name: file.file_url.split('/').pop(), // S3キーからファイル名を抽出
        type: file.file_type,
        uploadDate: file.uploaded_at, // JST時刻をUTC扱いでそのまま表示
        status: 'uploaded',
        s3Key: file.file_url,
        curriculumName: file.curriculum_name,
        sessionNumber: file.session_number,
        instructorApproved: file.instructor_approved, // 承認状態を追加
        instructorApprovedAt: file.instructor_approved_at // 承認日時を追加
      }));

      res.json({
        success: true,
        data: uploadedFiles
      });

    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('アップロード済みファイル取得エラー:', error);
    res.status(500).json({
      success: false,
      message: 'アップロード済みファイルの取得に失敗しました',
      error: process.env.NODE_ENV === 'development' ? error.message : 'INTERNAL_SERVER_ERROR'
    });
  }
});

// アップロード済みファイル削除
router.delete('/lesson/:lessonId/uploaded-files/:fileId', authenticateToken, async (req, res) => {
  try {
    const { lessonId, fileId } = req.params;
    const userId = req.user.user_id;

    console.log('=== アップロード済みファイル削除 ===');
    console.log('lessonId:', lessonId);
    console.log('fileId:', fileId);
    console.log('userId:', userId);

    const connection = await pool.getConnection();
    
    try {
      // トランザクション開始
      await connection.beginTransaction();

      // 削除対象のファイル情報を取得
      const [fileRows] = await connection.execute(`
        SELECT id, file_url, user_id, session_number
        FROM deliverables 
        WHERE id = ? AND user_id = ? AND session_number = ?
      `, [fileId, userId, lessonId]);

      if (fileRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          message: 'ファイルが見つかりません'
        });
      }

      const file = fileRows[0];

      // S3からファイルを削除
      if (file.file_url) {
        try {
          const AWS = require('aws-sdk');
          const s3Config = {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            region: process.env.AWS_REGION || 'ap-northeast-1',
            bucketName: process.env.AWS_S3_BUCKET || 'studysphere'
          };

          const s3 = new AWS.S3({
            accessKeyId: s3Config.accessKeyId,
            secretAccessKey: s3Config.secretAccessKey,
            region: s3Config.region
          });

          await s3.deleteObject({
            Bucket: s3Config.bucketName,
            Key: file.file_url
          }).promise();

          console.log('S3ファイル削除成功:', file.file_url);
        } catch (s3Error) {
          console.error('S3ファイル削除エラー:', s3Error);
          // S3削除エラーでも処理を継続
        }
      }

      // deliverablesテーブルからファイル情報を削除
      await connection.execute(`
        DELETE FROM deliverables 
        WHERE id = ? AND user_id = ? AND session_number = ?
      `, [fileId, userId, lessonId]);

      // 同じレッスンで他のファイルが残っているかチェック
      const [remainingFiles] = await connection.execute(`
        SELECT COUNT(*) as count
        FROM deliverables 
        WHERE user_id = ? AND session_number = ?
      `, [userId, lessonId]);

      // ファイルが0件になった場合、課題提出状況をfalseに戻す
      if (remainingFiles[0].count === 0) {
        console.log('ファイルが0件になったため、課題提出状況をfalseに戻します');
        
        await connection.execute(`
          UPDATE user_lesson_progress 
          SET assignment_submitted = 0, assignment_submitted_at = NULL, updated_at = NOW()
          WHERE user_id = ? AND lesson_id = ?
        `, [userId, lessonId]);
      }

      // トランザクションコミット
      await connection.commit();
      console.log('=== ファイル削除完了 ===');

      res.json({
        success: true,
        message: 'ファイルが削除されました',
        data: {
          fileId: fileId,
          lessonId: lessonId,
          assignmentStatusReset: remainingFiles[0].count === 0
        }
      });

    } catch (transactionError) {
      // トランザクションロールバック
      console.error('=== トランザクションエラー、ロールバック実行 ===');
      console.error('エラー詳細:', transactionError);
      await connection.rollback();
      throw transactionError;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('アップロード済みファイル削除エラー:', error);
    res.status(500).json({
      success: false,
      message: 'ファイルの削除に失敗しました',
      error: process.env.NODE_ENV === 'development' ? error.message : 'INTERNAL_SERVER_ERROR'
    });
  }
});

// 学習進捗関連
router.get('/progress/:userId', authenticateToken, getUserProgress);
router.get('/progress/:userId/course/:courseId', authenticateToken, getCourseProgress);
router.put('/progress/lesson', authenticateToken, updateLessonProgress);

// 現在受講中レッスン関連
router.get('/current-lesson', authenticateToken, getCurrentLesson);


// 合格証明書関連
router.get('/certificate/:userId/:lessonId', authenticateToken, getCertificateData);
router.get('/certificate/:userId/:lessonId/:examResultId', authenticateToken, getCertificateData);
router.get('/certificates/:userId', authenticateToken, (req, res, next) => {
  console.log('=== Certificates route hit ===');
  console.log('URL:', req.url);
  console.log('Params:', req.params);
  console.log('User ID:', req.params.userId);
  next();
}, getUserCertificates);

// テスト結果関連
router.post('/test/submit', authenticateToken, submitTestResult);
router.get('/test/results/:userId', authenticateToken, getTestResults);

// 指導員承認関連
router.post('/approve-completion', authenticateToken, approveLessonCompletion);

// レッスンコンテンツ取得
router.get('/lesson/:lessonId/content', authenticateToken, getLessonContent);

// 課題提出状況確認
router.get('/lesson/:lessonId/assignment-status', authenticateToken, async (req, res) => {
  try {
    const { lessonId } = req.params;
    const userId = req.user.user_id;
    
    console.log(`課題提出状況確認: レッスンID ${lessonId}, ユーザーID ${userId}`);
    
    const connection = await pool.getConnection();
    
    try {
      // レッスンの課題設定を確認
      const [lessonRows] = await connection.execute(`
        SELECT l.has_assignment, l.title
        FROM lessons l
        WHERE l.id = ? AND l.status = 'active'
      `, [lessonId]);

      if (lessonRows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'レッスンが見つかりません'
        });
      }

      const lesson = lessonRows[0];
      
      // 課題が設定されていない場合
      if (!lesson.has_assignment) {
        return res.json({
          success: true,
          data: {
            hasAssignment: false,
            assignmentSubmitted: false
          }
        });
      }

      // ユーザーの課題提出状況を確認
      const [progressRows] = await connection.execute(`
        SELECT assignment_submitted, assignment_submitted_at
        FROM user_lesson_progress
        WHERE user_id = ? AND lesson_id = ?
      `, [userId, lessonId]);

      const assignmentSubmitted = progressRows.length > 0 && progressRows[0].assignment_submitted === 1;

      console.log(`課題提出状況: レッスンID ${lessonId}, 課題設定=${lesson.has_assignment}, 提出済み=${assignmentSubmitted}`);

      res.json({
        success: true,
        data: {
          hasAssignment: lesson.has_assignment,
          assignmentSubmitted: assignmentSubmitted,
          submittedAt: progressRows.length > 0 ? progressRows[0].assignment_submitted_at : null
        }
      });

    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('課題提出状況確認エラー:', error);
    res.status(500).json({
      success: false,
      message: '課題提出状況の確認に失敗しました',
      error: error.message
    });
  }
});

// 利用者とコースの関連付け作成
router.post('/assign-course', authenticateToken, assignCourseToUser);

// PDFテキスト抽出API
router.post('/extract-pdf-text', authenticateToken, async (req, res) => {
  // リクエストの開始時刻を記録
  const requestStartTime = Date.now();
  const maxRequestTime = 15 * 60 * 1000; // 15分のリクエストタイムアウト（延長）
  
  // リクエストIDを生成
  const requestId = `pdf-extract-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // リクエスト開始ログ
  customLogger.info('PDFテキスト抽出リクエスト開始', {
    requestId,
    s3Key: req.body?.s3Key,
    lessonId: req.body?.lessonId,
    startTime: new Date(requestStartTime).toISOString(),
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });
  
  // リクエストタイムアウト処理
  const requestTimeout = setTimeout(() => {
    customLogger.error('PDFテキスト抽出: リクエストがタイムアウトしました', {
      requestId,
      s3Key: req.body?.s3Key,
      lessonId: req.body?.lessonId,
      elapsedTime: Date.now() - requestStartTime
    });
    
    // レスポンスがまだ送信されていない場合のみエラーレスポンスを送信
    if (!res.headersSent) {
      res.status(408).json({
        success: false,
        message: 'リクエストがタイムアウトしました',
        error: 'Request timeout',
        requestId
      });
    }
  }, maxRequestTime);

  try {
    const { s3Key, lessonId } = req.body;
    
    if (!s3Key) {
      customLogger.warn('PDFテキスト抽出: S3キーが提供されていません', { 
        requestId,
        lessonId 
      });
      clearTimeout(requestTimeout);
      return res.status(400).json({
        success: false,
        message: 'S3キーが必要です',
        requestId
      });
    }

    customLogger.info('PDFテキスト抽出開始', { 
      requestId,
      s3Key: s3Key, 
      lessonId: lessonId,
      startTime: new Date(requestStartTime).toISOString()
    });

    // S3設定の確認
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_S3_BUCKET) {
      customLogger.error('PDFテキスト抽出: S3設定が不完全です', {
        requestId,
        hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
        hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
        hasBucket: !!process.env.AWS_S3_BUCKET,
        lessonId,
        s3Key
      });
      clearTimeout(requestTimeout);
      return res.status(500).json({
        success: false,
        message: 'S3設定が不完全です。管理者に連絡してください。',
        error: 'S3 configuration incomplete',
        requestId
      });
    }

    // PDFファイルをS3からダウンロード
    const s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'ap-northeast-1'
    });

    customLogger.debug('PDFテキスト抽出: S3からファイル取得開始', { 
      requestId,
      s3Key, 
      lessonId 
    });

    // まず、S3ファイルの存在確認
    try {
      await s3.headObject({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: s3Key
      }).promise();
      
      customLogger.debug('PDFテキスト抽出: S3ファイル存在確認完了', { 
        requestId,
        s3Key, 
        lessonId 
      });
    } catch (headError) {
      if (headError.code === 'NotFound') {
        customLogger.error('PDFテキスト抽出: S3ファイルが存在しません', {
          requestId,
          s3Key,
          lessonId,
          bucket: process.env.AWS_S3_BUCKET,
          error: headError.message
        });
        clearTimeout(requestTimeout);
        return res.status(404).json({
          success: false,
          message: '指定されたPDFファイルが見つかりません',
          error: 'The specified key does not exist.',
          s3Key: s3Key,
          bucket: process.env.AWS_S3_BUCKET,
          requestId
        });
      } else {
        customLogger.error('PDFテキスト抽出: S3ファイル存在確認エラー', {
          requestId,
          s3Key,
          lessonId,
          error: headError.message,
          code: headError.code
        });
        clearTimeout(requestTimeout);
        return res.status(500).json({
          success: false,
          message: 'S3ファイルの確認に失敗しました',
          error: headError.message,
          requestId
        });
      }
    }

    // S3ダウンロードのタイムアウト処理（2分）
    const s3DownloadPromise = s3.getObject({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: s3Key
    }).promise();

    const s3TimeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('S3ダウンロードがタイムアウトしました'));
      }, 5 * 60 * 1000); // 5分（延長）
    });

    // S3ダウンロードの競合処理
    const pdfObject = await Promise.race([s3DownloadPromise, s3TimeoutPromise]);

    const pdfBuffer = pdfObject.Body;
    const downloadTime = Date.now() - requestStartTime;
    
    customLogger.debug('PDFテキスト抽出: S3からファイル取得成功', { 
      requestId,
      s3Key, 
      lessonId, 
      fileSize: pdfBuffer.length,
      downloadTime,
      downloadTimeSeconds: Math.round(downloadTime / 1000)
    });
    
    // PDFからテキストを抽出
    customLogger.info('PDFテキスト抽出処理開始', {
      requestId,
      s3Key,
      lessonId,
      fileSizeMB: Math.round(pdfBuffer.length / 1024 / 1024 * 100) / 100
    });
    
    const textContent = await extractTextFromPdf(pdfBuffer, requestId);
    
    if (!textContent || textContent.trim().length === 0) {
      customLogger.warn('PDFテキスト抽出: テキスト内容が空です', { 
        requestId,
        s3Key, 
        lessonId 
      });
      clearTimeout(requestTimeout);
      return res.json({
        success: false,
        message: 'PDFからテキストを抽出できませんでした',
        textContent: '',
        requestId
      });
    }

    const totalProcessingTime = Date.now() - requestStartTime;
    customLogger.info('PDFテキスト抽出完了', { 
      requestId,
      s3Key, 
      lessonId, 
      textLength: textContent.length,
      totalProcessingTime,
      totalProcessingTimeSeconds: Math.round(totalProcessingTime / 1000),
      startTime: new Date(requestStartTime).toISOString(),
      endTime: new Date().toISOString()
    });

    // タイムアウトタイマーをクリア
    clearTimeout(requestTimeout);

    res.json({
      success: true,
      textContent: textContent,
      lessonId: lessonId,
      extractedAt: new Date().toISOString(),
      processingTime: totalProcessingTime,
      requestId
    });

  } catch (error) {
    // タイムアウトタイマーをクリア
    clearTimeout(requestTimeout);
    
    const totalProcessingTime = Date.now() - requestStartTime;
    customLogger.error('PDFテキスト抽出エラー', {
      requestId,
      error: error.message,
      stack: error.stack,
      s3Key: req.body?.s3Key,
      lessonId: req.body?.lessonId,
      totalProcessingTime,
      totalProcessingTimeSeconds: Math.round(totalProcessingTime / 1000),
      startTime: new Date(requestStartTime).toISOString(),
      endTime: new Date().toISOString()
    });
    
    // レスポンスがまだ送信されていない場合のみエラーレスポンスを送信
    if (!res.headersSent) {
      let errorMessage = 'PDFテキスト抽出に失敗しました';
      let statusCode = 500;
      
      // エラータイプに応じて適切なレスポンスを設定
      if (error.message.includes('タイムアウト')) {
        errorMessage = 'PDF処理がタイムアウトしました';
        statusCode = 408;
      } else if (error.message.includes('ファイルサイズ')) {
        errorMessage = 'PDFファイルサイズが大きすぎます';
        statusCode = 413;
      } else if (error.message.includes('S3ダウンロード')) {
        errorMessage = 'ファイルのダウンロードに失敗しました';
        statusCode = 503;
      } else if (error.message.includes('The specified key does not exist')) {
        errorMessage = '指定されたPDFファイルが見つかりません';
        statusCode = 404;
      }
      
      res.status(statusCode).json({
        success: false,
        message: errorMessage,
        error: process.env.NODE_ENV === 'development' ? error.message : '内部エラー',
        processingTime: totalProcessingTime,
        requestId
      });
    }
  }
});

// PDFからテキストを抽出する関数
async function extractTextFromPdf(pdfBuffer, requestId) {
  // 処理の開始時刻を記録
  const startTime = Date.now();
  const maxProcessingTime = 10 * 60 * 1000; // 10分のタイムアウト（延長）
  
  try {
    // ファイルサイズチェック（100MB制限）
    const maxFileSize = 100 * 1024 * 1024; // 100MB
    if (pdfBuffer.length > maxFileSize) {
      customLogger.warn('PDFファイルサイズが制限を超えています', { 
        requestId,
        fileSize: pdfBuffer.length, 
        maxSize: maxFileSize 
      });
      throw new Error('PDFファイルサイズが大きすぎます（100MB以下にしてください）');
    }

    // PDF処理ライブラリの読み込み確認（複数のライブラリを試行）
    let pdfProcessor;
    let processorType = '';
    
    try {
      // まずpdf-parseを試行
      pdfProcessor = require('pdf-parse');
      processorType = 'pdf-parse';
      customLogger.debug('pdf-parseライブラリ読み込み成功');
    } catch (parseError) {
      try {
        // pdf-parseが失敗した場合、pdf2picを試行
        pdfProcessor = require('pdf2pic');
        processorType = 'pdf2pic';
        customLogger.debug('pdf2picライブラリ読み込み成功');
      } catch (picError) {
        try {
          // 最後にpdfjs-distを試行
          pdfProcessor = require('pdfjs-dist');
          processorType = 'pdfjs-dist';
          customLogger.debug('pdfjs-distライブラリ読み込み成功');
        } catch (jsError) {
          customLogger.error('すべてのPDF解析ライブラリの読み込みに失敗', { 
            requestId,
            pdfParseError: parseError.message,
            pdf2picError: picError.message,
            pdfjsError: jsError.message
          });
          throw new Error('PDF解析ライブラリの読み込みに失敗しました');
        }
      }
    }

    customLogger.debug('PDF処理開始', { 
      requestId,
      fileSize: pdfBuffer.length,
      fileSizeMB: Math.round(pdfBuffer.length / 1024 / 1024 * 100) / 100,
      processorType,
      startTime: new Date(startTime).toISOString()
    });

    // 段階的PDF処理の実装
    let data;
    
    if (processorType === 'pdf-parse') {
      // pdf-parseライブラリでの処理
      const pdfParsePromise = pdfProcessor(pdfBuffer);
      
      // タイムアウト処理
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('PDF処理がタイムアウトしました'));
        }, maxProcessingTime);
      });

      // 競合処理（タイムアウトまたは完了）
      data = await Promise.race([pdfParsePromise, timeoutPromise]);
      
    } else if (processorType === 'pdfjs-dist') {
      // pdfjs-distライブラリでの処理（より効率的）
      try {
        // pdfjs-distの正しい使用方法
        const pdfjsLib = pdfProcessor;
        
        // 最新のpdfjs-distでは、getDocumentの戻り値が異なる
        const loadingTask = pdfjsLib.getDocument({ data: pdfBuffer });
        const pdfDocument = await loadingTask.promise;
        const numPages = pdfDocument.numPages;
        
        let fullText = '';
        const maxPagesPerBatch = 5; // 一度に処理するページ数を減らしてメモリ効率化
        
        customLogger.debug(`PDF処理開始: ${numPages}ページ`, { 
          requestId,
          totalPages: numPages
        });
        
        // ページをバッチ処理で処理
        for (let pageNum = 1; pageNum <= numPages; pageNum += maxPagesPerBatch) {
          const endPage = Math.min(pageNum + maxPagesPerBatch - 1, numPages);
          
          customLogger.debug(`PDF処理: ページ ${pageNum}-${endPage} を処理中`, { 
            requestId,
            currentPage: pageNum,
            totalPages: numPages
          });
          
          // バッチ内のページを順次処理（並行処理はメモリ使用量が高くなるため）
          for (let i = pageNum; i <= endPage; i++) {
            try {
              const page = await pdfDocument.getPage(i);
              const textContent = await page.getTextContent();
              const pageText = textContent.items.map(item => item.str).join(' ');
              fullText += pageText + '\n\n';
              
              // 各ページ処理後にメモリクリーンアップ
              if (global.gc) {
                global.gc();
              }
            } catch (pageError) {
              customLogger.warn(`ページ ${i} の処理でエラーが発生`, { 
                requestId,
                pageNum: i,
                error: pageError.message
              });
              // ページエラーが発生しても処理を継続
              fullText += `[ページ ${i} の処理でエラーが発生]\n\n`;
            }
          }
          
          // 処理時間チェック
          const currentTime = Date.now() - startTime;
          if (currentTime > maxProcessingTime) {
            throw new Error('PDF処理がタイムアウトしました');
          }
        }
        
        data = { text: fullText, numpages: numPages };
        
      } catch (pdfjsError) {
        customLogger.error('pdfjs-dist処理エラー', { 
          requestId,
          error: pdfjsError.message 
        });
        // pdfjs-distが失敗した場合、pdf-parseにフォールバック
        try {
          const fallbackProcessor = require('pdf-parse');
          const fallbackData = await fallbackProcessor(pdfBuffer);
          data = fallbackData;
          customLogger.info('pdf-parseへのフォールバック成功', { requestId });
        } catch (fallbackError) {
          throw new Error(`PDF処理に失敗しました: ${pdfjsError.message}`);
        }
      }
      
    } else {
      // その他のライブラリでの処理
      const pdfProcessPromise = pdfProcessor(pdfBuffer);
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('PDF処理がタイムアウトしました'));
        }, maxProcessingTime);
      });

      data = await Promise.race([pdfProcessPromise, timeoutPromise]);
    }
    
    // 処理時間をチェック
    const processingTime = Date.now() - startTime;
    if (processingTime > maxProcessingTime) {
      customLogger.warn('PDF処理がタイムアウトしました', { 
        requestId,
        processingTime, 
        maxProcessingTime 
      });
      throw new Error('PDF処理がタイムアウトしました');
    }
    
    if (!data || !data.text) {
      customLogger.warn('PDFテキスト抽出: 解析結果が空です', { 
        requestId 
      });
      throw new Error('PDFからテキストを抽出できませんでした');
    }
    
    // テキストを整形
    let text = data.text;
    
    // 不要な改行や空白を整理
    text = text
      .replace(/\n\s*\n/g, '\n\n') // 複数の改行を2つに統一
      .replace(/\s+/g, ' ') // 複数の空白を1つに統一
      .trim();
    
    // テキスト長の制限（1MB制限）
    const maxTextLength = 1024 * 1024; // 1MB
    if (text.length > maxTextLength) {
      customLogger.warn('抽出されたテキストが長すぎます', { 
        requestId,
        textLength: text.length, 
        maxLength: maxTextLength 
      });
      text = text.substring(0, maxTextLength) + '\n\n... (テキストが長すぎるため切り詰められました)';
    }
    
    customLogger.debug('PDFパース完了', { 
      requestId,
      originalLength: data.text.length,
      processedLength: text.length,
      pages: data.numpages,
      processingTime,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date().toISOString()
    });
    
    // メモリクリーンアップ
    if (global.gc) {
      global.gc();
      customLogger.debug('ガベージコレクションを実行しました', { requestId });
    }
    
    return text;
  } catch (error) {
    const processingTime = Date.now() - startTime;
    customLogger.error('PDFパースエラー', {
      requestId,
      error: error.message,
      stack: error.stack,
      processingTime,
      processingTimeSeconds: Math.round(processingTime / 1000),
      fileSize: pdfBuffer.length,
      fileSizeMB: Math.round(pdfBuffer.length / 1024 / 1024 * 100) / 100
    });
    
    // エラーメッセージを適切に設定
    if (error.message.includes('PDF解析ライブラリ')) {
      throw new Error('PDF解析ライブラリの読み込みに失敗しました');
    } else if (error.message.includes('テキストを抽出できませんでした')) {
      throw new Error('PDFからテキストを抽出できませんでした');
    } else if (error.message.includes('タイムアウト')) {
      throw new Error('PDF処理がタイムアウトしました。ファイルサイズが大きすぎる可能性があります。');
    } else if (error.message.includes('ファイルサイズ')) {
      throw new Error('PDFファイルサイズが大きすぎます（100MB以下にしてください）');
    } else {
      throw new Error(`PDFファイルの解析に失敗しました: ${error.message}`);
    }
  } finally {
    // メモリクリーンアップ
    if (global.gc) {
      global.gc();
      customLogger.debug('ガベージコレクション完了', { requestId });
    }
  }
}

// PDFビューアー用エンドポイント
router.get('/pdf-viewer', async (req, res) => {
  try {
    const { key } = req.query;
    
    if (!key) {
      return res.status(400).json({
        success: false,
        message: 'S3キーが必要です'
      });
    }

    customLogger.info('PDFビューアー要求', { 
      s3Key: key,
      userAgent: req.get('User-Agent'),
      referer: req.get('Referer')
    });

    // S3設定の確認
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_S3_BUCKET) {
      customLogger.error('PDFビューアー: S3設定が不完全です', {
        hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
        hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
        hasBucket: !!process.env.AWS_S3_BUCKET
      });
      return res.status(500).json({
        success: false,
        message: 'S3設定が不完全です。管理者に連絡してください。',
        error: 'S3 configuration incomplete'
      });
    }

    // PDFファイルをS3からダウンロード
    const s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'ap-northeast-1'
    });

    customLogger.debug('PDFビューアー: S3からファイル取得開始', { s3Key: key });

    // PDFファイルを取得
    const pdfObject = await s3.getObject({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key
    }).promise();

    const pdfBuffer = pdfObject.Body;
    
    customLogger.info('PDFビューアー: ファイル取得成功', { 
      s3Key: key, 
      fileSize: pdfBuffer.length,
      contentType: pdfObject.ContentType
    });
    
    // PDFファイルのContent-Typeを設定
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // 1時間キャッシュ
    res.setHeader('X-Frame-Options', 'SAMEORIGIN'); // iframeでの表示を許可
    
    // PDFファイルを送信
    res.send(pdfBuffer);

  } catch (error) {
    customLogger.error('PDFビューアーエラー', {
      error: error.message,
      code: error.code,
      stack: error.stack,
      s3Key: req.query?.key
    });
    
    // S3関連のエラーの場合は詳細なメッセージを返す
    if (error.code === 'NoSuchKey') {
      return res.status(404).json({
        success: false,
        message: '指定されたPDFファイルが見つかりません',
        error: 'File not found in S3'
      });
    } else if (error.code === 'AccessDenied') {
      return res.status(403).json({
        success: false,
        message: 'S3アクセスが拒否されました',
        error: 'S3 access denied'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'PDFファイルの取得に失敗しました',
      error: process.env.NODE_ENV === 'development' ? error.message : '内部エラー'
    });
  }
});


module.exports = router;
