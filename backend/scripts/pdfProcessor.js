#!/usr/bin/env node

/**
 * PDF処理スクリプト
 * PDF→TXT変換処理と処理状態管理を行う
 */

const fs = require('fs');
const path = require('path');
const { customLogger } = require('../utils/logger');

// PDF処理状態を管理するMap
const processingStatus = new Map();

// PDF処理ライブラリ
const pdfParse = require('pdf-parse');

class PDFProcessor {
  /**
   * PDF処理を開始
   * @param {string} userId - ユーザーID
   * @param {Buffer} pdfBuffer - PDFファイルのバッファ
   * @param {string} originalFileName - 元のファイル名
   * @returns {Promise<Object>} 処理結果
   */
  static async startProcessing(userId, pdfBuffer, originalFileName) {
    const processId = `pdf_${userId}_${Date.now()}`;
    
    try {
      // 処理状態を初期化
      processingStatus.set(processId, {
        userId,
        status: 'processing',
        progress: 0,
        startTime: new Date(),
        fileName: originalFileName,
        error: null,
        result: null
      });

      customLogger.info(`PDF処理開始: ${processId}`, {
        userId,
        fileName: originalFileName,
        fileSize: pdfBuffer.length
      });

      // 非同期でPDF処理を実行
      this.processPDFAsync(processId, pdfBuffer);

      return {
        success: true,
        processId,
        message: 'PDF処理を開始しました'
      };

    } catch (error) {
      customLogger.error(`PDF処理開始エラー: ${processId}`, error);
      
      // エラー状態を設定
      processingStatus.set(processId, {
        userId,
        status: 'error',
        progress: 0,
        startTime: new Date(),
        fileName: originalFileName,
        error: error.message,
        result: null
      });

      return {
        success: false,
        processId,
        message: 'PDF処理の開始に失敗しました',
        error: error.message
      };
    }
  }

  /**
   * PDF処理を非同期で実行
   * @param {string} processId - 処理ID
   * @param {Buffer} pdfBuffer - PDFファイルのバッファ
   */
  static async processPDFAsync(processId, pdfBuffer) {
    try {
      const status = processingStatus.get(processId);
      if (!status) {
        throw new Error('処理状態が見つかりません');
      }

      // ファイルサイズチェック（100MB制限）
      const maxFileSize = 100 * 1024 * 1024;
      if (pdfBuffer.length > maxFileSize) {
        throw new Error('PDFファイルサイズが大きすぎます（100MB以下にしてください）');
      }

      // 処理開始
      status.progress = 10;
      processingStatus.set(processId, status);

      // PDFテキスト抽出
      const text = await this.extractTextFromPDF(pdfBuffer);
      
      status.progress = 80;
      processingStatus.set(processId, status);

      // テキストの後処理
      const processedText = this.postProcessText(text);
      
      status.progress = 100;
      status.status = 'completed';
      status.result = {
        text: processedText,
        textLength: processedText.length,
        completedAt: new Date()
      };
      
      processingStatus.set(processId, status);

      customLogger.info(`PDF処理完了: ${processId}`, {
        userId: status.userId,
        fileName: status.fileName,
        textLength: processedText.length
      });

    } catch (error) {
      customLogger.error(`PDF処理エラー: ${processId}`, error);
      
      const status = processingStatus.get(processId);
      if (status) {
        status.status = 'error';
        status.error = error.message;
        status.progress = 0;
        processingStatus.set(processId, status);
      }
    }
  }

  /**
   * PDFからテキストを抽出
   * @param {Buffer} pdfBuffer - PDFファイルのバッファ
   * @returns {Promise<string>} 抽出されたテキスト
   */
  static async extractTextFromPDF(pdfBuffer) {
    return new Promise((resolve, reject) => {
      const maxProcessingTime = 4 * 60 * 1000; // 4分のタイムアウト
      
      try {
        // タイムアウト処理を設定
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error('PDF処理がタイムアウトしました'));
          }, maxProcessingTime);
        });

        // PDF処理（実際の実装では適切なライブラリを使用）
        const pdfParsePromise = this.parsePDFWithLibrary(pdfBuffer);
        
        // 競合処理（タイムアウトまたは完了）
        Promise.race([pdfParsePromise, timeoutPromise])
          .then(resolve)
          .catch(reject);

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * PDFライブラリを使用してPDFを解析
   * @param {Buffer} pdfBuffer - PDFファイルのバッファ
   * @returns {Promise<string>} 抽出されたテキスト
   */
  static async parsePDFWithLibrary(pdfBuffer) {
    try {
      console.log('pdf-parseライブラリを使用してPDFを解析中...', {
        bufferSize: pdfBuffer.length,
        bufferType: typeof pdfBuffer
      });
      
      // pdf-parseライブラリを使用してPDFを解析
      const data = await pdfParse(pdfBuffer);
      
      console.log('pdf-parse解析結果:', {
        hasData: !!data,
        hasText: !!data?.text,
        textLength: data?.text?.length || 0,
        textPreview: data?.text?.substring(0, 100) + '...'
      });
      
      if (!data || !data.text) {
        throw new Error('PDFからテキストを抽出できませんでした');
      }
      
      return data.text;
    } catch (error) {
      console.error('pdf-parse解析エラー:', {
        error: error.message,
        stack: error.stack
      });
      
      // pdf-parseで失敗した場合は、エラーをそのまま投げる
      throw new Error(`PDF解析エラー: ${error.message}`);
    }
  }


  /**
   * 抽出されたテキストを後処理
   * @param {string} text - 抽出されたテキスト
   * @returns {string} 後処理されたテキスト
   */
  static postProcessText(text) {
    if (!text) {
      throw new Error('テキストが抽出されませんでした');
    }

    // 不要な改行や空白を整理
    let processedText = text
      .replace(/\n\s*\n/g, '\n\n')
      .replace(/\s+/g, ' ')
      .trim();

    // テキスト長の制限（1MB制限）
    const maxTextLength = 1024 * 1024;
    if (processedText.length > maxTextLength) {
      processedText = processedText.substring(0, maxTextLength) + 
        '\n\n... (テキストが長すぎるため切り詰められました)';
    }

    return processedText;
  }

  /**
   * 処理状態を取得
   * @param {string} processId - 処理ID
   * @returns {Object|null} 処理状態
   */
  static getProcessingStatus(processId) {
    return processingStatus.get(processId) || null;
  }

  /**
   * ユーザーの処理状態を取得
   * @param {string} userId - ユーザーID
   * @returns {Array} 処理状態の配列
   */
  static getUserProcessingStatus(userId) {
    const userStatuses = [];
    for (const [processId, status] of processingStatus.entries()) {
      if (status.userId === userId) {
        userStatuses.push({
          processId,
          ...status
        });
      }
    }
    return userStatuses;
  }

  /**
   * 処理完了をチェック
   * @param {string} processId - 処理ID
   * @returns {boolean} 完了しているかどうか
   */
  static isProcessingComplete(processId) {
    const status = processingStatus.get(processId);
    return status && status.status === 'completed';
  }

  /**
   * 処理エラーをチェック
   * @param {string} processId - 処理ID
   * @returns {boolean} エラーが発生しているかどうか
   */
  static hasProcessingError(processId) {
    const status = processingStatus.get(processId);
    return status && status.status === 'error';
  }

  /**
   * 古い処理状態をクリーンアップ
   * @param {number} maxAge - 最大保持時間（ミリ秒）
   */
  static cleanupOldStatuses(maxAge = 24 * 60 * 60 * 1000) { // 24時間
    const now = new Date();
    for (const [processId, status] of processingStatus.entries()) {
      if (now - status.startTime > maxAge) {
        processingStatus.delete(processId);
        customLogger.info(`古い処理状態を削除: ${processId}`);
      }
    }
  }

  /**
   * 処理状態の統計を取得
   * @returns {Object} 統計情報
   */
  static getProcessingStats() {
    const stats = {
      total: 0,
      processing: 0,
      completed: 0,
      error: 0
    };

    for (const status of processingStatus.values()) {
      stats.total++;
      stats[status.status]++;
    }

    return stats;
  }
}

// 定期的なクリーンアップを実行
setInterval(() => {
  PDFProcessor.cleanupOldStatuses();
}, 60 * 60 * 1000); // 1時間ごと

// スクリプトが直接実行された場合の処理
if (require.main === module) {
  console.log('PDF Processor Module');
  console.log('Available methods:');
  console.log('- startProcessing(userId, pdfBuffer, fileName)');
  console.log('- getProcessingStatus(processId)');
  console.log('- getUserProcessingStatus(userId)');
  console.log('- isProcessingComplete(processId)');
  console.log('- hasProcessingError(processId)');
  console.log('- getProcessingStats()');
}

module.exports = PDFProcessor;
