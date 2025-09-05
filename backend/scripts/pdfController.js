#!/usr/bin/env node

/**
 * PDF処理コントローラー
 * PDFアップロード、処理状態確認、結果取得のAPIを提供
 */

const { pool } = require('../utils/database');
const { customLogger } = require('../utils/logger');
const PDFProcessor = require('./pdfProcessor');

class PDFController {
  /**
   * PDFファイルをアップロードして処理を開始
   */
  static async uploadPDF(req, res) {
    try {
      const { userToken } = req.body;
      const pdfFile = req.files?.pdf?.[0];

      // バリデーション
      if (!userToken || userToken === 'undefined') {
        return res.status(400).json({
          success: false,
          message: 'ユーザートークンが無効です'
        });
      }

      if (!pdfFile) {
        return res.status(400).json({
          success: false,
          message: 'PDFファイルがアップロードされていません'
        });
      }

      // ファイル形式チェック
      if (!pdfFile.mimetype.includes('pdf')) {
        return res.status(400).json({
          success: false,
          message: 'PDFファイルのみアップロード可能です'
        });
      }

      // ファイルサイズチェック（100MB制限）
      const maxFileSize = 100 * 1024 * 1024;
      if (pdfFile.size > maxFileSize) {
        return res.status(400).json({
          success: false,
          message: 'ファイルサイズが大きすぎます（100MB以下にしてください）'
        });
      }

      // ログインコードからユーザー情報を取得
      const [users] = await pool.execute(
        'SELECT id, login_code, company_id, satellite_ids FROM user_accounts WHERE login_code = ?',
        [userToken]
      );

      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ユーザーが見つかりません'
        });
      }

      const user = users[0];

      // PDF処理を開始
      const result = await PDFProcessor.startProcessing(
        user.id.toString(),
        pdfFile.buffer,
        pdfFile.originalname
      );

      if (result.success) {
        customLogger.info('PDFアップロード成功', {
          userId: user.id,
          fileName: pdfFile.originalname,
          fileSize: pdfFile.size,
          processId: result.processId
        });

        res.json({
          success: true,
          message: result.message,
          data: {
            processId: result.processId,
            fileName: pdfFile.originalname,
            fileSize: pdfFile.size
          }
        });
      } else {
        res.status(500).json({
          success: false,
          message: result.message,
          error: result.error
        });
      }

    } catch (error) {
      customLogger.error('PDFアップロードエラー:', error);
      res.status(500).json({
        success: false,
        message: 'PDFアップロードに失敗しました',
        error: error.message
      });
    }
  }

  /**
   * PDF処理状態を確認
   */
  static async getProcessingStatus(req, res) {
    try {
      const { processId } = req.params;
      const { userToken } = req.query;

      if (!processId) {
        return res.status(400).json({
          success: false,
          message: '処理IDが必要です'
        });
      }

      // 処理状態を取得
      const status = PDFProcessor.getProcessingStatus(processId);
      
      if (!status) {
        return res.status(404).json({
          success: false,
          message: '処理が見つかりません'
        });
      }

      // ユーザー認証チェック（必要に応じて）
      if (userToken) {
        const [users] = await pool.execute(
          'SELECT id FROM user_accounts WHERE login_code = ?',
          [userToken]
        );

        if (users.length === 0 || users[0].id.toString() !== status.userId) {
          return res.status(403).json({
            success: false,
            message: 'この処理状態にアクセスする権限がありません'
          });
        }
      }

      res.json({
        success: true,
        data: {
          processId,
          status: status.status,
          progress: status.progress,
          startTime: status.startTime,
          fileName: status.fileName,
          error: status.error,
          result: status.result
        }
      });

    } catch (error) {
      customLogger.error('処理状態取得エラー:', error);
      res.status(500).json({
        success: false,
        message: '処理状態の取得に失敗しました',
        error: error.message
      });
    }
  }

  /**
   * ユーザーのPDF処理状態一覧を取得
   */
  static async getUserProcessingStatus(req, res) {
    try {
      const { userToken } = req.query;

      if (!userToken || userToken === 'undefined') {
        return res.status(400).json({
          success: false,
          message: 'ユーザートークンが無効です'
        });
      }

      // ログインコードからユーザー情報を取得
      const [users] = await pool.execute(
        'SELECT id FROM user_accounts WHERE login_code = ?',
        [userToken]
      );

      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ユーザーが見つかりません'
        });
      }

      const userId = users[0].id.toString();

      // ユーザーの処理状態を取得
      const userStatuses = PDFProcessor.getUserProcessingStatus(userId);

      res.json({
        success: true,
        data: {
          userId,
          processingCount: userStatuses.length,
          statuses: userStatuses
        }
      });

    } catch (error) {
      customLogger.error('ユーザー処理状態取得エラー:', error);
      res.status(500).json({
        success: false,
        message: 'ユーザー処理状態の取得に失敗しました',
        error: error.message
      });
    }
  }

  /**
   * PDF処理結果を取得
   */
  static async getProcessingResult(req, res) {
    try {
      const { processId } = req.params;
      const { userToken } = req.query;

      if (!processId) {
        return res.status(400).json({
          success: false,
          message: '処理IDが必要です'
        });
      }

      if (!userToken || userToken === 'undefined') {
        return res.status(400).json({
          success: false,
          message: 'ユーザートークンが無効です'
        });
      }

      // 処理状態を取得
      const status = PDFProcessor.getProcessingStatus(processId);
      
      if (!status) {
        return res.status(404).json({
          success: false,
          message: '処理が見つかりません'
        });
      }

      // ユーザー認証チェック
      const [users] = await pool.execute(
        'SELECT id FROM user_accounts WHERE login_code = ?',
        [userToken]
      );

      if (users.length === 0 || users[0].id.toString() !== status.userId) {
        return res.status(403).json({
          success: false,
          message: 'この処理結果にアクセスする権限がありません'
        });
      }

      // 処理が完了していない場合
      if (status.status !== 'completed') {
        return res.status(400).json({
          success: false,
          message: '処理が完了していません',
          data: {
            status: status.status,
            progress: status.progress,
            error: status.error
          }
        });
      }

      // 処理結果を返す
      res.json({
        success: true,
        data: {
          processId,
          fileName: status.fileName,
          text: status.result.text,
          textLength: status.result.textLength,
          completedAt: status.result.completedAt
        }
      });

    } catch (error) {
      customLogger.error('処理結果取得エラー:', error);
      res.status(500).json({
        success: false,
        message: '処理結果の取得に失敗しました',
        error: error.message
      });
    }
  }

  /**
   * PDF処理統計を取得（管理者用）
   */
  static async getProcessingStats(req, res) {
    try {
      const { userToken } = req.query;

      if (!userToken || userToken === 'undefined') {
        return res.status(400).json({
          success: false,
          message: 'ユーザートークンが無効です'
        });
      }

      // 管理者権限チェック
      const [users] = await pool.execute(
        'SELECT id, role FROM user_accounts WHERE login_code = ?',
        [userToken]
      );

      if (users.length === 0 || users[0].role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: '管理者権限が必要です'
        });
      }

      // 処理統計を取得
      const stats = PDFProcessor.getProcessingStats();

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      customLogger.error('処理統計取得エラー:', error);
      res.status(500).json({
        success: false,
        message: '処理統計の取得に失敗しました',
        error: error.message
      });
    }
  }

  /**
   * PDF処理のキャンセル
   */
  static async cancelProcessing(req, res) {
    try {
      const { processId } = req.params;
      const { userToken } = req.body;

      if (!processId) {
        return res.status(400).json({
          success: false,
          message: '処理IDが必要です'
        });
      }

      if (!userToken || userToken === 'undefined') {
        return res.status(400).json({
          success: false,
          message: 'ユーザートークンが無効です'
        });
      }

      // 処理状態を取得
      const status = PDFProcessor.getProcessingStatus(processId);
      
      if (!status) {
        return res.status(404).json({
          success: false,
          message: '処理が見つかりません'
        });
      }

      // ユーザー認証チェック
      const [users] = await pool.execute(
        'SELECT id FROM user_accounts WHERE login_code = ?',
        [userToken]
      );

      if (users.length === 0 || users[0].id.toString() !== status.userId) {
        return res.status(403).json({
          success: false,
          message: 'この処理をキャンセルする権限がありません'
        });
      }

      // 処理が既に完了またはエラーの場合
      if (status.status === 'completed' || status.status === 'error') {
        return res.status(400).json({
          success: false,
          message: 'この処理は既に終了しています',
          data: {
            status: status.status
          }
        });
      }

      // 処理をキャンセル状態に変更
      status.status = 'cancelled';
      status.progress = 0;
      status.error = 'ユーザーによってキャンセルされました';

      customLogger.info('PDF処理キャンセル', {
        processId,
        userId: status.userId,
        fileName: status.fileName
      });

      res.json({
        success: true,
        message: '処理がキャンセルされました',
        data: {
          processId,
          status: status.status
        }
      });

    } catch (error) {
      customLogger.error('処理キャンセルエラー:', error);
      res.status(500).json({
        success: false,
        message: '処理のキャンセルに失敗しました',
        error: error.message
      });
    }
  }
}

module.exports = PDFController;
