const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const OpenAI = require('openai');
const PDFProcessor = require('../scripts/pdfProcessor');
const { pool } = require('../utils/database');
const { s3Utils } = require('../config/s3');

// OpenAIクライアントの初期化
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * 現在のセクションのテキスト内容を取得（PDFの場合はTXTに変換）
 * @param {string} lessonId - レッスンID
 * @returns {Promise<string>} テキスト内容
 */
async function getCurrentSectionText(lessonId) {
  try {
    // レッスン情報を取得
    const [lessons] = await pool.execute(`
      SELECT l.*, c.title as course_title
      FROM lessons l
      JOIN courses c ON l.course_id = c.id
      WHERE l.id = ? AND l.status != 'deleted'
    `, [lessonId]);

    if (lessons.length === 0) {
      throw new Error('レッスンが見つかりません');
    }

    const lesson = lessons[0];
    
    // S3キーがない場合はエラー
    if (!lesson.s3_key) {
      throw new Error('レッスンファイルが設定されていません');
    }

    // S3からファイルを取得
    const fileData = await s3Utils.downloadFile(lesson.s3_key);
    
    if (!fileData || !fileData.data) {
      throw new Error('レッスンファイルの取得に失敗しました');
    }

    // ファイルタイプに応じて処理
    if (lesson.file_type === 'pdf') {
      // PDFファイルの場合、TXTに変換
      const processId = `section_${lessonId}_${Date.now()}`;
      
      // PDF処理を開始
      const result = await PDFProcessor.startProcessing(
        `section_${lessonId}`,
        fileData.data,
        lesson.title || 'section.pdf'
      );

      if (!result.success) {
        throw new Error('PDF処理の開始に失敗しました');
      }

      // 処理完了まで待機（最大30秒）
      let attempts = 0;
      const maxAttempts = 30;
      
      while (attempts < maxAttempts) {
        const status = PDFProcessor.getProcessingStatus(result.processId);
        
        if (status && status.status === 'completed') {
          return status.result.text;
        } else if (status && status.status === 'error') {
          throw new Error(`PDF処理でエラーが発生しました: ${status.error}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1秒待機
        attempts++;
      }
      
      throw new Error('PDF処理がタイムアウトしました');
      
    } else if (lesson.file_type === 'text/plain' || lesson.file_type === 'text/markdown' || lesson.file_type === 'md') {
      // テキストファイルの場合はそのまま返す
      return fileData.data.toString('utf-8');
      
    } else {
      // その他のファイル形式はサポート外
      throw new Error(`サポートされていないファイル形式です: ${lesson.file_type}`);
    }
    
  } catch (error) {
    console.error('セクションテキスト取得エラー:', error);
    throw error;
  }
}

// AIアシスタントAPI - GPT-4oモデルを使用
router.post('/assist', authenticateToken, async (req, res) => {
  try {
    const { question, context, lessonTitle, model = 'gpt-4o', maxTokens = 1000, temperature = 0.3, systemPrompt, userId, lessonId } = req.body;

    // レッスンIDが指定されている場合、現在のセクションのPDFファイルをTXTに変換
    let processedContext = context;
    if (lessonId && !context) {
      try {
        const sectionText = await getCurrentSectionText(lessonId);
        if (sectionText) {
          processedContext = sectionText;
        }
      } catch (error) {
        console.error('セクションテキスト取得エラー:', error);
        return res.status(400).json({
          success: false,
          message: 'セクションテキストの取得に失敗しました',
          error: 'SECTION_TEXT_FETCH_ERROR'
        });
      }
    }

    // 入力値の検証
    if (!question || !context) {
      return res.status(400).json({
        success: false,
        message: '質問とコンテキストが必要です'
      });
    }

    // システムプロンプトの設定
    const defaultSystemPrompt = `あなたは学習支援AIアシスタントです。以下の指示に厳密に従ってください：

1. **回答の範囲**: 提供されたテキスト内容をベースに回答してください
2. **推論の活用**: テキストに明記されていない内容についても、関連する知識を活用して推論し、有益な回答を提供してください
3. **情報の補完**: テキストの内容に基づき、足りない情報はAIの知識を活用して補完してください
4. **明確性**: 分かりやすく、構造化された回答を心がけてください
5. **引用**: 可能であれば、テキストの該当部分を引用して回答してください
6. **情報源の明示**: テキスト以外の知識を使用した場合は、その旨を明記してください

テキストに含まれていない質問についても、関連する知識を活用して可能な限り回答してください。完全に回答できない場合は、「この内容についてはDiscordサーバーにてご相談ください。」と回答してください。`;

    const finalSystemPrompt = systemPrompt || defaultSystemPrompt;

    // ユーザープロンプトの構築
    const userPrompt = `レッスン: ${lessonTitle || '学習内容'}

テキスト内容:
${processedContext}

質問: ${question}

上記のテキスト内容をベースに、質問に回答してください。テキストに含まれていない内容についても、関連する知識を活用して可能な限り回答してください。完全に回答できない場合のみ、「この内容についてはDiscordサーバーにてご相談ください。」と回答してください。`;

    console.log('AIアシスタント呼び出し:', {
      model,
      maxTokens,
      temperature,
      questionLength: question.length,
      contextLength: context.length
    });

    // OpenAI APIを呼び出し
    const completion = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'system',
          content: finalSystemPrompt
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      max_tokens: maxTokens,
      temperature: temperature,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0
    });

    const answer = completion.choices[0]?.message?.content || '回答を生成できませんでした';
    const usage = completion.usage;

    console.log('AIアシスタント応答完了:', {
      model,
      promptTokens: usage?.prompt_tokens,
      completionTokens: usage?.completion_tokens,
      totalTokens: usage?.total_tokens
    });

    res.json({
      success: true,
      answer,
      usage: {
        promptTokens: usage?.prompt_tokens,
        completionTokens: usage?.completion_tokens,
        totalTokens: usage?.total_tokens
      }
    });

  } catch (error) {
    console.error('AIアシスタントエラー:', error);
    
    // OpenAI APIエラーの詳細をログに記録
    if (error.response) {
      console.error('OpenAI API エラー詳細:', {
        status: error.response.status,
        data: error.response.data
      });
    }

    res.status(500).json({
      success: false,
      message: 'AIアシスタントの応答を取得できませんでした',
      error: process.env.NODE_ENV === 'development' ? error.message : '内部エラー'
    });
  }
});

// AIアシスタントの状態確認
router.get('/status', authenticateToken, (req, res) => {
  try {
    const hasApiKey = !!process.env.OPENAI_API_KEY;
    
    res.json({
      success: true,
      status: hasApiKey ? 'available' : 'unavailable',
      model: 'gpt-4o',
      hasApiKey,
      message: hasApiKey ? 'AIアシスタントが利用可能です' : 'OpenAI APIキーが設定されていません'
    });
  } catch (error) {
    console.error('AIステータス確認エラー:', error);
    res.status(500).json({
      success: false,
      message: 'AIステータスの確認に失敗しました'
    });
  }
});

// 現在のセクションテキスト取得（PDFの場合はTXTに変換）
router.get('/section-text/:lessonId', authenticateToken, async (req, res) => {
  try {
    const { lessonId } = req.params;
    
    if (!lessonId) {
      return res.status(400).json({
        success: false,
        message: 'レッスンIDが必要です'
      });
    }

    // セクションテキストを取得
    const sectionText = await getCurrentSectionText(lessonId);
    
    res.json({
      success: true,
      data: {
        lessonId,
        text: sectionText,
        textLength: sectionText.length
      }
    });

  } catch (error) {
    console.error('セクションテキスト取得エラー:', error);
    res.status(500).json({
      success: false,
      message: 'セクションテキストの取得に失敗しました',
      error: error.message
    });
  }
});

// PDF処理状態確認（AIサポート送信可否チェック）
router.get('/pdf-status/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'ユーザーIDが必要です'
      });
    }

    // ユーザーのPDF処理状態を取得
    const userProcessingStatuses = PDFProcessor.getUserProcessingStatus(userId);
    const hasUncompletedProcessing = userProcessingStatuses.some(status => 
      status.status === 'processing' || status.status === 'error'
    );
    
    // AIサポート送信可否の判定
    const canSendToAI = !hasUncompletedProcessing;
    
    res.json({
      success: true,
      data: {
        userId,
        canSendToAI,
        processingStatuses: userProcessingStatuses,
        message: canSendToAI 
          ? 'AIサポートへの送信が可能です' 
          : 'PDF処理が完了していません。処理完了までAIサポートへの送信はできません。'
      }
    });

  } catch (error) {
    console.error('PDF処理状態確認エラー:', error);
    res.status(500).json({
      success: false,
      message: 'PDF処理状態の確認に失敗しました',
      error: error.message
    });
  }
});

module.exports = router;
