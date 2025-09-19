const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { pool } = require('../utils/database');
const AWS = require('aws-sdk');

// 指導員用：拠点内の未承認提出物一覧取得
router.get('/instructor/pending-submissions/:satelliteId', authenticateToken, async (req, res) => {
  try {
    const { satelliteId } = req.params;
    const instructorId = req.user.user_id;
    
    // 指導員権限チェック
    if (req.user.role < 4) {
      return res.status(403).json({
        success: false,
        message: '指導員以上の権限が必要です'
      });
    }

    const connection = await pool.getConnection();
    
    try {
      // 拠点内の未承認提出物を取得
      const [submissions] = await connection.execute(`
        SELECT 
          d.id as submission_id,
          d.user_id,
          d.lesson_id,
          d.file_url,
          d.file_name,
          d.file_size,
          d.file_type,
          d.uploaded_at,
          d.instructor_approved,
          d.instructor_id,
          ua.name as student_name,
          ua.login_code as student_login_code,
          l.title as lesson_name,
          c.title as course_title,
          s.name as satellite_name
        FROM deliverables d
        JOIN user_accounts ua ON d.user_id = ua.id
        JOIN lessons l ON d.lesson_id = l.id
        JOIN courses c ON l.course_id = c.id
        JOIN satellites s ON (
          JSON_CONTAINS(ua.satellite_ids, JSON_QUOTE(CAST(s.id AS CHAR))) OR 
          JSON_CONTAINS(ua.satellite_ids, CAST(s.id AS JSON)) OR
          JSON_SEARCH(ua.satellite_ids, 'one', CAST(s.id AS CHAR)) IS NOT NULL
        )
        WHERE s.id = ? 
        AND d.instructor_approved = FALSE
        AND ua.role = 1
        ORDER BY d.uploaded_at DESC
      `, [satelliteId]);

      res.json({
        success: true,
        data: submissions,
        message: '未承認提出物一覧を取得しました'
      });

    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('未承認提出物取得エラー:', error);
    console.error('エラー詳細:', {
      message: error.message,
      stack: error.stack,
      satelliteId: req.params.satelliteId,
      instructorId: req.user?.user_id
    });
    res.status(500).json({
      success: false,
      message: '未承認提出物の取得に失敗しました',
      error: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        stack: error.stack,
        satelliteId: req.params.satelliteId
      } : undefined
    });
  }
});

// 指導員用：特定学生の提出物一覧取得
router.get('/instructor/student/:studentId/submissions', authenticateToken, async (req, res) => {
  try {
    const { studentId } = req.params;
    const instructorId = req.user.user_id;
    
    // 指導員権限チェック
    if (req.user.role < 4) {
      return res.status(403).json({
        success: false,
        message: '指導員以上の権限が必要です'
      });
    }

    const connection = await pool.getConnection();
    
    try {
      // 学生の提出物一覧を取得
      const [submissions] = await connection.execute(`
        SELECT 
          d.id as submission_id,
          d.user_id,
          d.lesson_id,
          d.file_url,
          d.file_name,
          d.file_size,
          d.file_type,
          d.uploaded_at,
          d.instructor_approved,
          d.instructor_approved_at,
          d.instructor_comment,
          d.instructor_id,
          ua.name as student_name,
          ua.login_code as student_login_code,
          l.title as lesson_name,
          c.title as course_title,
          approver.name as approver_name
        FROM deliverables d
        JOIN user_accounts ua ON d.user_id = ua.id
        JOIN lessons l ON d.lesson_id = l.id
        JOIN courses c ON l.course_id = c.id
        LEFT JOIN user_accounts approver ON d.instructor_id = approver.id
        WHERE d.user_id = ?
        ORDER BY d.uploaded_at DESC
      `, [studentId]);

      res.json({
        success: true,
        data: submissions,
        message: '学生の提出物一覧を取得しました'
      });

    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('学生提出物取得エラー:', error);
    console.error('エラー詳細:', {
      message: error.message,
      stack: error.stack,
      studentId: req.params.studentId,
      instructorId: req.user?.user_id
    });
    res.status(500).json({
      success: false,
      message: '学生の提出物取得に失敗しました',
      error: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        stack: error.stack,
        studentId: req.params.studentId
      } : undefined
    });
  }
});

// 指導員用：提出物ダウンロード
router.get('/instructor/download/:submissionId', authenticateToken, async (req, res) => {
  try {
    const { submissionId } = req.params;
    const instructorId = req.user.user_id;
    
    // 指導員権限チェック
    if (req.user.role < 4) {
      return res.status(403).json({
        success: false,
        message: '指導員以上の権限が必要です'
      });
    }

    const connection = await pool.getConnection();
    
    try {
      // 提出物情報を取得
      const [submissions] = await connection.execute(`
        SELECT 
          d.file_url,
          d.file_name,
          d.file_type,
          d.uploaded_at,
          ua.name as student_name,
          l.title as lesson_name
        FROM deliverables d
        JOIN user_accounts ua ON d.user_id = ua.id
        JOIN lessons l ON d.lesson_id = l.id
        WHERE d.id = ?
      `, [submissionId]);

      if (submissions.length === 0) {
        return res.status(404).json({
          success: false,
          message: '提出物が見つかりません'
        });
      }

      const submission = submissions[0];
      
      // S3からファイルをダウンロード
      const { s3 } = require('../config/s3');
      
      try {
        const downloadParams = {
          Bucket: process.env.AWS_S3_BUCKET || 'studysphere',
          Key: submission.file_url
        };

        const s3Object = await s3.getObject(downloadParams).promise();
        
        // ファイル名をエンコード（日本語対応）
        const encodedFileName = Buffer.from(submission.file_name, 'utf8').toString('base64');
        
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(submission.file_name)}`);
        res.setHeader('Content-Length', s3Object.ContentLength);
        
        res.send(s3Object.Body);

      } catch (s3Error) {
        console.error('S3ダウンロードエラー:', s3Error);
        res.status(500).json({
          success: false,
          message: 'ファイルのダウンロードに失敗しました',
          error: process.env.NODE_ENV === 'development' ? s3Error.message : undefined
        });
      }

    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('提出物ダウンロードエラー:', error);
    res.status(500).json({
      success: false,
      message: '提出物のダウンロードに失敗しました',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 指導員用：提出物承認
router.post('/instructor/approve-submission', authenticateToken, async (req, res) => {
  try {
    const { submissionId, studentId, lessonId, comment } = req.body;
    const instructorId = req.user.user_id;
    
    // 指導員権限チェック
    if (req.user.role < 4) {
      return res.status(403).json({
        success: false,
        message: '指導員以上の権限が必要です'
      });
    }

    if (!submissionId || !studentId || !lessonId) {
      return res.status(400).json({
        success: false,
        message: '必要なパラメータが不足しています'
      });
    }

    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // 提出物を承認
      const [approveResult] = await connection.execute(`
        UPDATE deliverables 
        SET instructor_approved = TRUE,
            instructor_approved_at = NOW(),
            instructor_id = ?,
            instructor_comment = ?,
            updated_at = NOW()
        WHERE id = ? AND user_id = ? AND lesson_id = ?
      `, [instructorId, comment || null, submissionId, studentId, lessonId]);

      if (approveResult.affectedRows === 0) {
        throw new Error('提出物の承認に失敗しました');
      }

      // レッスン進捗の承認フラグも更新
      const [progressResult] = await connection.execute(`
        UPDATE user_lesson_progress 
        SET instructor_approved = TRUE,
            instructor_approved_at = NOW(),
            instructor_id = ?,
            updated_at = NOW()
        WHERE user_id = ? AND lesson_id = ?
      `, [instructorId, studentId, lessonId]);

      await connection.commit();

      res.json({
        success: true,
        message: '提出物の承認が完了しました',
        data: {
          submissionId,
          studentId,
          lessonId,
          approvedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('提出物承認エラー:', error);
    res.status(500).json({
      success: false,
      message: '提出物の承認に失敗しました',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 指導員用：拠点内の未承認提出物件数取得（アラート用）
router.get('/instructor/pending-count/:satelliteId', authenticateToken, async (req, res) => {
  try {
    const { satelliteId } = req.params;
    
    // 指導員権限チェック
    if (req.user.role < 4) {
      return res.status(403).json({
        success: false,
        message: '指導員以上の権限が必要です'
      });
    }

    const connection = await pool.getConnection();
    
    try {
      // 拠点内の未承認提出物件数を取得
      const [countResult] = await connection.execute(`
        SELECT COUNT(*) as count
        FROM deliverables d
        JOIN user_accounts ua ON d.user_id = ua.id
        JOIN satellites s ON (
          s.id IS NOT NULL AND ua.satellite_ids IS NOT NULL AND (
            JSON_CONTAINS(ua.satellite_ids, JSON_QUOTE(s.id)) OR 
            JSON_CONTAINS(ua.satellite_ids, CAST(s.id AS JSON)) OR
            JSON_SEARCH(ua.satellite_ids, 'one', CAST(s.id AS CHAR)) IS NOT NULL
          )
        )
        WHERE s.id = ? 
        AND d.instructor_approved = FALSE
        AND ua.role = 1
      `, [satelliteId]);

      const count = countResult[0].count;

      res.json({
        success: true,
        data: { count },
        message: '未承認提出物件数を取得しました'
      });

    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('未承認提出物件数取得エラー:', error);
    console.error('エラー詳細:', {
      message: error.message,
      stack: error.stack,
      satelliteId: req.params.satelliteId,
      instructorId: req.user?.user_id
    });
    res.status(500).json({
      success: false,
      message: '未承認提出物件数の取得に失敗しました',
      error: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        stack: error.stack,
        satelliteId: req.params.satelliteId
      } : undefined
    });
  }
});

module.exports = router;
