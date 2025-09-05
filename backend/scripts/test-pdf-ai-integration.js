#!/usr/bin/env node

/**
 * PDF処理とAIサポート制御の統合テストスクリプト
 * PDF→TXT変換完了までAIサポート送信を制限する機能をテスト
 */

const PDFProcessor = require('./pdfProcessor');

// テスト用のモックPDFバッファ
const createMockPdfBuffer = (size = 1024 * 1024) => {
  return Buffer.alloc(size, 'A'); // 1MBのテストデータ
};

// テスト実行
async function runIntegrationTest() {
  console.log('=== PDF処理とAIサポート制御の統合テスト開始 ===\n');
  
  try {
    // テスト1: PDF処理開始
    console.log('テスト1: PDF処理開始');
    const userId = 'test_user_123';
    const mockPdfBuffer = createMockPdfBuffer();
    const fileName = 'test-document.pdf';
    
    const startResult = await PDFProcessor.startProcessing(userId, mockPdfBuffer, fileName);
    console.log('✓ PDF処理開始結果:', startResult);
    
    if (!startResult.success) {
      throw new Error('PDF処理開始に失敗しました');
    }
    
    const processId = startResult.processId;
    
    // テスト2: 処理状態確認
    console.log('\nテスト2: 処理状態確認');
    const status = PDFProcessor.getProcessingStatus(processId);
    console.log('✓ 処理状態:', status);
    
    if (!status) {
      throw new Error('処理状態が取得できませんでした');
    }
    
    // テスト3: AIサポート送信可否チェック（処理中）
    console.log('\nテスト3: AIサポート送信可否チェック（処理中）');
    const userStatuses = PDFProcessor.getUserProcessingStatus(userId);
    const hasUncompletedProcessing = userStatuses.some(s => 
      s.status === 'processing' || s.status === 'error'
    );
    
    console.log('✓ ユーザー処理状態:', userStatuses);
    console.log('✓ 未完了処理あり:', hasUncompletedProcessing);
    console.log('✓ AIサポート送信可否:', !hasUncompletedProcessing ? '可能' : '不可');
    
    if (!hasUncompletedProcessing) {
      throw new Error('処理中状態が正しく検出されませんでした');
    }
    
    // テスト4: 処理完了まで待機
    console.log('\nテスト4: 処理完了まで待機');
    let attempts = 0;
    const maxAttempts = 30; // 最大30回試行（約30秒）
    
    while (attempts < maxAttempts) {
      const currentStatus = PDFProcessor.getProcessingStatus(processId);
      
      if (currentStatus && currentStatus.status === 'completed') {
        console.log('✓ PDF処理完了:', currentStatus);
        break;
      } else if (currentStatus && currentStatus.status === 'error') {
        throw new Error(`PDF処理でエラーが発生しました: ${currentStatus.error}`);
      }
      
      console.log(`  処理中... 進捗: ${currentStatus?.progress || 0}% (試行 ${attempts + 1}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1秒待機
      attempts++;
    }
    
    if (attempts >= maxAttempts) {
      throw new Error('PDF処理がタイムアウトしました');
    }
    
    // テスト5: AIサポート送信可否チェック（完了後）
    console.log('\nテスト5: AIサポート送信可否チェック（完了後）');
    const finalUserStatuses = PDFProcessor.getUserProcessingStatus(userId);
    const finalHasUncompletedProcessing = finalUserStatuses.some(s => 
      s.status === 'processing' || s.status === 'error'
    );
    
    console.log('✓ 最終ユーザー処理状態:', finalUserStatuses);
    console.log('✓ 未完了処理あり:', finalHasUncompletedProcessing);
    console.log('✓ AIサポート送信可否:', !finalHasUncompletedProcessing ? '可能' : '不可');
    
    if (finalHasUncompletedProcessing) {
      throw new Error('処理完了後も未完了状態が検出されています');
    }
    
    // テスト6: 処理結果取得
    console.log('\nテスト6: 処理結果取得');
    const completedStatus = PDFProcessor.getProcessingStatus(processId);
    
    if (completedStatus && completedStatus.result) {
      console.log('✓ 処理結果:', {
        textLength: completedStatus.result.textLength,
        completedAt: completedStatus.result.completedAt
      });
      console.log('✓ テキストサンプル:', completedStatus.result.text.substring(0, 100) + '...');
    } else {
      throw new Error('処理結果が取得できませんでした');
    }
    
    // テスト7: 統計情報確認
    console.log('\nテスト7: 統計情報確認');
    const stats = PDFProcessor.getProcessingStats();
    console.log('✓ 処理統計:', stats);
    
    // テスト8: 複数ユーザーの処理状態管理
    console.log('\nテスト8: 複数ユーザーの処理状態管理');
    const userId2 = 'test_user_456';
    const mockPdfBuffer2 = createMockPdfBuffer(512 * 1024); // 512KB
    
    const startResult2 = await PDFProcessor.startProcessing(userId2, mockPdfBuffer2, 'test-document-2.pdf');
    console.log('✓ 2番目のユーザー処理開始:', startResult2);
    
    const user1Statuses = PDFProcessor.getUserProcessingStatus(userId);
    const user2Statuses = PDFProcessor.getUserProcessingStatus(userId2);
    
    console.log('✓ ユーザー1の処理状態数:', user1Statuses.length);
    console.log('✓ ユーザー2の処理状態数:', user2Statuses.length);
    
    if (user1Statuses.length === 0 || user2Statuses.length === 0) {
      throw new Error('ユーザー別処理状態の分離が正しく動作していません');
    }
    
    console.log('\n=== すべてのテストが完了しました ===');
    console.log('✓ PDF処理とAIサポート制御の統合テスト成功');
    
  } catch (error) {
    console.error('\n✗ テストが失敗しました:', error.message);
    console.error('エラー詳細:', error);
    process.exit(1);
  }
}

// スクリプトが直接実行された場合の処理
if (require.main === module) {
  runIntegrationTest().then(() => {
    console.log('\n統合テストが正常に完了しました');
    process.exit(0);
  }).catch((error) => {
    console.error('\n統合テストが失敗しました:', error);
    process.exit(1);
  });
}

module.exports = { runIntegrationTest };
