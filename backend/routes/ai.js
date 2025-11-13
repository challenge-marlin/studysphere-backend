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

// 作業内容推測API（在宅就労支援記録用）
router.post('/suggest-work-content', authenticateToken, async (req, res) => {
  try {
    const { work_note } = req.body;

    if (!work_note || work_note.trim() === '') {
      return res.status(400).json({
        success: false,
        message: '作業記録が必要です'
      });
    }

    // システムプロンプト
    const systemPrompt = `あなたは在宅就労支援の記録員です。作業記録を基に、正式な作業・訓練内容を生成してください。

指示：
1. 作業記録の内容を分析し、実施された作業・訓練内容を構造化された形式で記載してください
2. 箇条書きで記載し、各項目は「・」で始めてください
3. 専門用語は使用せず、わかりやすい表現を使用してください
4. 具体的な進捗や成果を含めてください
5. 簡潔で読みやすい文章にしてください

例：
・HTML/CSSの基礎学習を実施し、基本的なタグの使用方法を理解
・レスポンシブデザインの概念を学習し、簡単なWebページを作成
・プログラミングの基礎を学習し、変数と条件分岐の理解を深める`;

    // ユーザープロンプト
    const userPrompt = `以下の作業記録を基に、作業・訓練内容を生成してください：

作業記録：
${work_note}

上記の作業記録を分析し、実施された作業・訓練内容を構造化して出力してください。`;

    console.log('作業内容推測API呼び出し:', {
      model: 'gpt-4o',
      workNoteLength: work_note.length
    });

    // OpenAI APIを呼び出し
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      max_tokens: 500,
      temperature: 0.3,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0
    });

    const suggestion = completion.choices[0]?.message?.content || '提案を生成できませんでした';
    const usage = completion.usage;

    console.log('作業内容推測完了:', {
      model: 'gpt-4o',
      promptTokens: usage?.prompt_tokens,
      completionTokens: usage?.completion_tokens,
      totalTokens: usage?.total_tokens
    });

    res.json({
      success: true,
      suggestion,
      usage: {
        promptTokens: usage?.prompt_tokens,
        completionTokens: usage?.completion_tokens,
        totalTokens: usage?.total_tokens
      }
    });

  } catch (error) {
    console.error('作業内容推測エラー:', error);
    
    // OpenAI APIエラーの詳細をログに記録
    if (error.response) {
      console.error('OpenAI API エラー詳細:', {
        status: error.response.status,
        data: error.response.data
      });
    }

    res.status(500).json({
      success: false,
      message: '作業内容の推測に失敗しました',
      error: process.env.NODE_ENV === 'development' ? error.message : '内部エラー'
    });
  }
});

// 支援内容生成API（在宅就労支援記録用）
router.post('/suggest-support-content', authenticateToken, async (req, res) => {
  try {
    const { 
      start_time, 
      end_time, 
      support_method, 
      work_result, 
      daily_report,
      support_plan 
    } = req.body;

    if (!start_time || !end_time || !support_method) {
      return res.status(400).json({
        success: false,
        message: '開始時刻、終業時刻、支援方法が必要です'
      });
    }

    // システムプロンプト
    const systemPrompt = `あなたは在宅就労支援の記録員です。作業内容、日報、個別計画書を基に、具体的な支援内容を生成してください。

指示：
1. 開始時刻と終業時刻を考慮して、1日2回以上の支援内容を生成してください
2. 支援方法（訪問、電話、その他）に応じた適切な記録形式にしてください
3. 始業時は「利用者から作業開始の連絡を受け、体調や作業予定を確認した」という形式で記録してください
4. 終業時は「利用者から作業終了の連絡を受け、本日の作業内容や体調を確認した」という形式で記録してください
5. 作業内容と日報から、どのような支援を行ったかを推測して記載してください
6. 個別計画書の目標や課題も考慮してください
7. 時刻と支援内容を明確に分けて記載してください
8. 簡潔で具体的な文章にしてください

記録形式：
・始業時　支援方法で連絡を受け、作業内容と個別支援計画書の内容に沿って指導
・終業時　支援方法で連絡を受け、作業内容と個別支援計画書の内容に沿って指導`;

    // ユーザープロンプト
    const userPrompt = `以下の情報を基に、支援内容を生成してください：

【基本情報】
開始時刻: ${start_time}
終業時刻: ${end_time}
支援方法: ${support_method}

【作業内容】
${work_result || '記録なし'}

【日報】
${daily_report || '記録なし'}

【個別計画書の内容】
${support_plan || '記録なし'}

上記の情報を基に、開始時刻から終業時刻の間に実施した具体的な支援内容を、1日2回以上の頻度で時刻とともに記載してください。`;

    console.log('支援内容生成API呼び出し:', {
      model: 'gpt-4o',
      startTime: start_time,
      endTime: end_time,
      supportMethod: support_method
    });

    // OpenAI APIを呼び出し
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      max_tokens: 800,
      temperature: 0.3,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0
    });

    const suggestion = completion.choices[0]?.message?.content || '提案を生成できませんでした';
    const usage = completion.usage;

    console.log('支援内容生成完了:', {
      model: 'gpt-4o',
      promptTokens: usage?.prompt_tokens,
      completionTokens: usage?.completion_tokens,
      totalTokens: usage?.total_tokens
    });

    res.json({
      success: true,
      suggestion,
      usage: {
        promptTokens: usage?.prompt_tokens,
        completionTokens: usage?.completion_tokens,
        totalTokens: usage?.total_tokens
      }
    });

  } catch (error) {
    console.error('支援内容生成エラー:', error);
    
    // OpenAI APIエラーの詳細をログに記録
    if (error.response) {
      console.error('OpenAI API エラー詳細:', {
        status: error.response.status,
        data: error.response.data
      });
    }

    res.status(500).json({
      success: false,
      message: '支援内容の生成に失敗しました',
      error: process.env.NODE_ENV === 'development' ? error.message : '内部エラー'
    });
  }
});

// 心身の状況・助言内容生成API（在宅就労支援記録用）
router.post('/suggest-advice', authenticateToken, async (req, res) => {
  try {
    const { 
      temperature,
      condition,
      sleep_hours,
      daily_report,
      start_time,
      end_time
    } = req.body;

    if (!condition || !daily_report) {
      return res.status(400).json({
        success: false,
        message: '体調と日報が必要です'
      });
    }

    // システムプロンプト
    const systemPrompt = `あなたは在宅就労支援の専門スタッフです。対象者の心身の状況を観察し、適切な助言を行ってください。

指示：
1. 始業時：体温、体調、睡眠時間から体調の状態を推測し、アドバイスを提供してください
2. 終業時：日報の内容から疲れ具合を推測し、適切な助言を提供してください
3. その日の体調の変化や気になる点を特定してください
4. easyで実践的な助言を提供してください
5. 体調管理、生活リズム、メンタルヘルスなどを考慮してください
6. 専門的すぎる表現は避け、わかりやすい言葉で記載してください
7. 励ましの言葉も含めてください

記録形式：
【始業時の観察・助言】
・体温、体調、睡眠時間の確認結果と助言

【終業時の観察・助言】
・日報から読み取れる疲れ具合と助言`;

    // ユーザープロンプト
    const userPrompt = `以下の情報を基に、対象者の心身の状況と助言内容を生成してください：

【始業時の状況】
体温: ${temperature || '未記録'}
体調: ${condition}
睡眠時間: ${sleep_hours || '未記録'}

【日報の内容】
${daily_report}

【業務時間】
開始時刻: ${start_time || '未記録'}
終業時刻: ${end_time || '未記録'}

上記の情報を基に、対象者の心身の状況を観察し、適切な助言を行ってください。
始業時は体温、体調、睡眠時間から体調の状態を推測し、アドバイスを提供してください。
終業時は日報の内容から疲れ具合を推測し、適切な助言を提供してください。`;

    console.log('心身の状況・助言内容生成API呼び出し:', {
      model: 'gpt-4o',
      condition,
      dailyReportLength: daily_report.length
    });

    // OpenAI APIを呼び出し
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      max_tokens: 600,
      temperature: 0.3,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0
    });

    const suggestion = completion.choices[0]?.message?.content || '提案を生成できませんでした';
    const usage = completion.usage;

    console.log('心身の状況・助言内容生成完了:', {
      model: 'gpt-4o',
      promptTokens: usage?.prompt_tokens,
      completionTokens: usage?.completion_tokens,
      totalTokens: usage?.total_tokens
    });

    res.json({
      success: true,
      suggestion,
      usage: {
        promptTokens: usage?.prompt_tokens,
        completionTokens: usage?.completion_tokens,
        totalTokens: usage?.total_tokens
      }
    });

  } catch (error) {
    console.error('心身の状況・助言内容生成エラー:', error);
    
    // OpenAI APIエラーの詳細をログに記録
    if (error.response) {
      console.error('OpenAI API エラー詳細:', {
        status: error.response.status,
        data: error.response.data
      });
    }

    res.status(500).json({
      success: false,
      message: '心身の状況・助言内容の生成に失敗しました',
      error: process.env.NODE_ENV === 'development' ? error.message : '内部エラー'
    });
  }
});

module.exports = router;
