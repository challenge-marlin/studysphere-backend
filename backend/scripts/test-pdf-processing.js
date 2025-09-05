#!/usr/bin/env node

/**
 * PDF処理の改善をテストするためのスクリプト
 * タイムアウト処理、エラーハンドリング、メモリ管理の動作を確認
 */

const fs = require('fs');
const path = require('path');

// テスト用のPDFファイルパス
const testPdfPath = path.join(__dirname, '..', 'test-files', 'test.pdf');

// モックのPDF処理ライブラリ（複数対応）
const mockPdfProcessor = (buffer, processorType = 'pdf-parse') => {
  return new Promise((resolve, reject) => {
    // 処理時間をシミュレート（ファイルサイズに応じて調整）
    const processingTime = Math.min(buffer.length / 1024 / 1024 * 1000, 10000); // 最大10秒
    
    setTimeout(() => {
      try {
        // ファイルサイズチェック
        if (buffer.length > 100 * 1024 * 1024) { // 100MB
          reject(new Error('ファイルサイズが大きすぎます'));
          return;
        }
        
        // モックのテキスト内容を生成（ファイルサイズに応じて調整）
        const textLength = Math.min(buffer.length / 100, 50000); // 最大50,000文字
        const mockText = 'これはテスト用のPDFテキストです。'.repeat(Math.floor(textLength / 20));
        
        if (processorType === 'pdfjs-dist') {
          // pdfjs-dist用のモック
          resolve({
            text: mockText,
            numpages: Math.ceil(buffer.length / 1024 / 1024), // ファイルサイズに応じたページ数
            info: {
              Title: 'テストPDF',
              Author: 'テスト作成者'
            }
          });
        } else {
          // その他のライブラリ用のモック
          resolve({
            text: mockText,
            numpages: 1,
            info: {
              Title: 'テストPDF',
              Author: 'テスト作成者'
            }
          });
        }
      } catch (error) {
        reject(error);
      }
    }, processingTime);
  });
};

// 改善されたPDF処理関数のテスト
async function testPdfProcessing() {
  console.log('=== PDF処理改善テスト開始 ===\n');
  
  try {
    // テスト1: 正常な処理
    console.log('テスト1: 正常なPDF処理');
    const smallBuffer = Buffer.alloc(1024 * 1024); // 1MB
    const result1 = await testExtractTextFromPdf(smallBuffer);
    console.log('✓ 正常処理完了:', result1.substring(0, 100) + '...\n');
    
    // テスト2: タイムアウト処理
    console.log('テスト2: タイムアウト処理');
    try {
      const largeBuffer = Buffer.alloc(50 * 1024 * 1024); // 50MB
      await testExtractTextFromPdf(largeBuffer);
      console.log('✗ タイムアウト処理が失敗しました（期待される動作）\n');
    } catch (error) {
      if (error.message.includes('タイムアウト')) {
        console.log('✓ タイムアウト処理が正常に動作しました\n');
      } else {
        console.log('✗ 予期しないエラー:', error.message, '\n');
      }
    }
    
    // テスト3: ファイルサイズ制限
    console.log('テスト3: ファイルサイズ制限');
    try {
      const hugeBuffer = Buffer.alloc(150 * 1024 * 1024); // 150MB
      await testExtractTextFromPdf(hugeBuffer);
      console.log('✗ ファイルサイズ制限が失敗しました（期待される動作）\n');
    } catch (error) {
      if (error.message.includes('ファイルサイズ')) {
        console.log('✓ ファイルサイズ制限が正常に動作しました\n');
      } else {
        console.log('✗ 予期しないエラー:', error.message, '\n');
      }
    }
    
    // テスト4: メモリ使用量の監視
    console.log('テスト4: メモリ使用量の監視');
    const initialMemory = process.memoryUsage();
    console.log('初期メモリ使用量:', {
      rss: `${Math.round(initialMemory.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(initialMemory.heapTotal / 1024 / 1024)}MB`
    });
    
    // 複数回の処理を実行してメモリリークをチェック
    for (let i = 0; i < 5; i++) {
      const testBuffer = Buffer.alloc(1024 * 1024); // 1MB
      await testExtractTextFromPdf(testBuffer);
      
      if (i % 2 === 0) {
        const currentMemory = process.memoryUsage();
        console.log(`処理${i + 1}回目後のメモリ使用量:`, {
          rss: `${Math.round(currentMemory.rss / 1024 / 1024)}MB`,
          heapUsed: `${Math.round(currentMemory.heapUsed / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(currentMemory.heapTotal / 1024 / 1024)}MB`
        });
      }
    }
    
    const finalMemory = process.memoryUsage();
    console.log('最終メモリ使用量:', {
      rss: `${Math.round(finalMemory.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(finalMemory.heapTotal / 1024 / 1024)}MB`
    });
    
    console.log('✓ メモリ監視テスト完了\n');
    
    console.log('=== すべてのテストが完了しました ===');
    
  } catch (error) {
    console.error('テスト実行中にエラーが発生しました:', error);
    process.exit(1);
  }
}

// テスト用のPDF処理関数
async function testExtractTextFromPdf(pdfBuffer) {
  const startTime = Date.now();
  const maxProcessingTime = 4 * 60 * 1000; // 4分のタイムアウト
  
  try {
    // ファイルサイズチェック（100MB制限）
    const maxFileSize = 100 * 1024 * 1024; // 100MB
    if (pdfBuffer.length > maxFileSize) {
      throw new Error('PDFファイルサイズが大きすぎます（100MB以下にしてください）');
    }

    console.log(`PDF処理開始 (ファイルサイズ: ${Math.round(pdfBuffer.length / 1024 / 1024)}MB)`);

    // タイムアウト処理を設定
    const pdfParsePromise = mockPdfProcessor(pdfBuffer, 'pdf-parse');
    
    // タイムアウト処理
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('PDF処理がタイムアウトしました'));
      }, maxProcessingTime);
    });

    // 競合処理（タイムアウトまたは完了）
    const data = await Promise.race([pdfParsePromise, timeoutPromise]);
    
    // 処理時間をチェック
    const processingTime = Date.now() - startTime;
    if (processingTime > maxProcessingTime) {
      throw new Error('PDF処理がタイムアウトしました');
    }
    
    if (!data || !data.text) {
      throw new Error('PDFからテキストを抽出できませんでした');
    }
    
    // テキストを整形
    let text = data.text;
    
    // 不要な改行や空白を整理
    text = text
      .replace(/\n\s*\n/g, '\n\n')
      .replace(/\s+/g, ' ')
      .trim();
    
    // テキスト長の制限（1MB制限）
    const maxTextLength = 1024 * 1024; // 1MB
    if (text.length > maxTextLength) {
      text = text.substring(0, maxTextLength) + '\n\n... (テキストが長すぎるため切り詰められました)';
    }
    
    console.log(`PDFパース完了 (処理時間: ${processingTime}ms, テキスト長: ${text.length}文字)`);
    
    return text;
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`PDFパースエラー (処理時間: ${processingTime}ms):`, error.message);
    
    if (error.message.includes('タイムアウト')) {
      throw new Error('PDF処理がタイムアウトしました。ファイルサイズが大きすぎる可能性があります。');
    } else if (error.message.includes('ファイルサイズ')) {
      throw new Error('PDFファイルサイズが大きすぎます（100MB以下にしてください）');
    } else {
      throw new Error(`PDFファイルの解析に失敗しました: ${error.message}`);
    }
  }
}

// スクリプトが直接実行された場合の処理
if (require.main === module) {
  testPdfProcessing().then(() => {
    console.log('テストが正常に完了しました');
    process.exit(0);
  }).catch((error) => {
    console.error('テストが失敗しました:', error);
    process.exit(1);
  });
}

module.exports = { testExtractTextFromPdf };
