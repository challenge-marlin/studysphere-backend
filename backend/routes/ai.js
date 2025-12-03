const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const OpenAI = require('openai');
const { pool } = require('../utils/database');
const { s3Utils } = require('../config/s3');
const { customLogger } = require('../utils/logger');

// OpenAIクライアントの初期化
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * PDFからテキストを抽出する関数（learningRoutes.jsと同じロジック）
 * @param {Buffer} pdfBuffer - PDFファイルのバッファ
 * @param {string} requestId - リクエストID
 * @returns {Promise<string>} 抽出されたテキスト
 */
async function extractTextFromPdf(pdfBuffer, requestId) {
  const startTime = Date.now();
  const maxProcessingTime = 10 * 60 * 1000; // 10分のタイムアウト
  
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

    // PDF処理ライブラリの読み込み確認
    let pdfProcessor;
    let processorType = '';
    
    try {
      // まずpdf-parseを試行
      pdfProcessor = require('pdf-parse');
      processorType = 'pdf-parse';
      customLogger.debug('pdf-parseライブラリ読み込み成功', { requestId });
    } catch (parseError) {
      try {
        // pdf-parseが失敗した場合、pdfjs-distを試行
        pdfProcessor = require('pdfjs-dist');
        processorType = 'pdfjs-dist';
        customLogger.debug('pdfjs-distライブラリ読み込み成功', { requestId });
      } catch (jsError) {
        customLogger.error('すべてのPDF解析ライブラリの読み込みに失敗', { 
          requestId,
          pdfParseError: parseError.message,
          pdfjsError: jsError.message
        });
        throw new Error('PDF解析ライブラリの読み込みに失敗しました');
      }
    }

    customLogger.debug('PDF処理開始', { 
      requestId,
      fileSize: pdfBuffer.length,
      fileSizeMB: Math.round(pdfBuffer.length / 1024 / 1024 * 100) / 100,
      processorType
    });

    let data;
    
    if (processorType === 'pdf-parse') {
      // pdf-parseライブラリでの処理
      const pdfParsePromise = pdfProcessor(pdfBuffer);
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('PDF処理がタイムアウトしました'));
        }, maxProcessingTime);
      });

      data = await Promise.race([pdfParsePromise, timeoutPromise]);
      
    } else if (processorType === 'pdfjs-dist') {
      // pdfjs-distライブラリでの処理
      try {
        const pdfjsLib = pdfProcessor;
        const loadingTask = pdfjsLib.getDocument({ data: pdfBuffer });
        const pdfDocument = await loadingTask.promise;
        const numPages = pdfDocument.numPages;
        
        let fullText = '';
        const maxPagesPerBatch = 5;
        
        for (let pageNum = 1; pageNum <= numPages; pageNum += maxPagesPerBatch) {
          const endPage = Math.min(pageNum + maxPagesPerBatch - 1, numPages);
          
          for (let i = pageNum; i <= endPage; i++) {
            try {
              const page = await pdfDocument.getPage(i);
              const textContent = await page.getTextContent();
              const pageText = textContent.items.map(item => item.str).join(' ');
              fullText += pageText + '\n\n';
            } catch (pageError) {
              customLogger.warn(`ページ ${i} の処理でエラーが発生`, { 
                requestId,
                pageNum: i,
                error: pageError.message
              });
              fullText += `[ページ ${i} の処理でエラーが発生]\n\n`;
            }
          }
          
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
    }
    
    // 処理時間をチェック
    const processingTime = Date.now() - startTime;
    if (processingTime > maxProcessingTime) {
      throw new Error('PDF処理がタイムアウトしました');
    }
    
    if (!data || !data.text) {
      throw new Error('PDFからテキストを抽出できませんでした');
    }
    
    // テキストを整形
    let text = data.text
      .replace(/\n\s*\n/g, '\n\n')
      .replace(/\s+/g, ' ')
      .trim();
    
    // テキスト長の制限（1MB制限）
    const maxTextLength = 1024 * 1024;
    if (text.length > maxTextLength) {
      text = text.substring(0, maxTextLength) + '\n\n... (テキストが長すぎるため切り詰められました)';
    }
    
    return text;
  } catch (error) {
    customLogger.error('PDFパースエラー', {
      requestId,
      error: error.message,
      stack: error.stack,
      fileSize: pdfBuffer.length
    });
    
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
  }
}

/**
 * 現在のセクションのテキスト内容を取得（PDFの場合はTXTに変換）
 * @param {string} lessonId - レッスンID
 * @returns {Promise<string>} テキスト内容
 */
async function getCurrentSectionText(lessonId) {
  const requestId = `section-text-${lessonId}-${Date.now()}`;
  
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
      customLogger.info('PDFテキスト抽出開始', {
        requestId,
        lessonId,
        fileName: lesson.title
      });
      
      const textContent = await extractTextFromPdf(fileData.data, requestId);
      
      if (!textContent || textContent.trim().length === 0) {
        throw new Error('PDFからテキストを抽出できませんでした');
      }
      
      customLogger.info('PDFテキスト抽出完了', {
        requestId,
        lessonId,
        textLength: textContent.length
      });
      
      return textContent;
      
    } else if (lesson.file_type === 'text/plain' || lesson.file_type === 'text/markdown' || lesson.file_type === 'md') {
      // テキストファイルの場合はそのまま返す
      return fileData.data.toString('utf-8');
      
    } else {
      // その他のファイル形式はサポート外
      throw new Error(`サポートされていないファイル形式です: ${lesson.file_type}`);
    }
    
  } catch (error) {
    customLogger.error('セクションテキスト取得エラー', {
      requestId,
      lessonId,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

// AIアシスタントAPI - GPT-4oモデルを使用
router.post('/assist', authenticateToken, async (req, res) => {
  try {
    const { question, context, lessonTitle, model = 'gpt-4o', maxTokens = 2000, temperature = 0.3, systemPrompt, userId, lessonId, conversationHistory = [] } = req.body;

    // 入力値の検証（questionは必須）
    if (!question) {
      return res.status(400).json({
        success: false,
        message: '質問が必要です'
      });
    }

    // レッスンIDが指定されている場合、現在のセクションのPDFファイルをTXTに変換
    let processedContext = context;
    if (lessonId && !context) {
      try {
        const sectionText = await getCurrentSectionText(lessonId);
        if (sectionText && sectionText.trim().length > 0) {
          processedContext = sectionText;
        } else {
          customLogger.warn('セクションテキストが空です', { lessonId });
          return res.status(400).json({
            success: false,
            message: 'セクションテキストが空です。PDF処理が完了していない可能性があります。',
            error: 'SECTION_TEXT_EMPTY'
          });
        }
      } catch (error) {
        customLogger.error('セクションテキスト取得エラー', {
          lessonId,
          error: error.message,
          stack: error.stack
        });
        return res.status(400).json({
          success: false,
          message: `セクションテキストの取得に失敗しました: ${error.message}`,
          error: 'SECTION_TEXT_FETCH_ERROR'
        });
      }
    }

    // コンテキストの検証（contextまたはlessonIdのいずれかが必要）
    if (!processedContext) {
      return res.status(400).json({
        success: false,
        message: 'コンテキストまたはレッスンIDが必要です'
      });
    }

    // システムプロンプトの設定
    const defaultSystemPrompt = `あなたは学習支援AIアシスタントです。以下の指示に厳密に従ってください：

1. **中学生レベルの語彙で説明**: 
   - 専門用語は必ず中学生でも理解できる言葉に言い換えて説明してください
   - 難しい概念は、身近な例え話や具体例を使って説明してください
   - 「つまり」「例えば」「たとえば」などの接続詞を使って、段階的に理解できるようにしてください

2. **例を交えた説明（簡潔に）**: 
   - 参考テキストの内容をそのまま抜粋するのではなく、必ず具体例や身近な例を交えて説明してください
   - 抽象的な説明の後には、必ず「例えば」で始まる具体例を1つだけ含めてください（複数の例は不要）
   - 例は、中学生が日常的に経験するような身近なものを使ってください
   - 例は簡潔に、1〜2文程度に留めてください

3. **かみ砕いた説明**: 
   - 参考テキストの内容をそのまま引用するのではなく、自分の言葉で分かりやすくかみ砕いて説明してください
   - 複雑な内容は、小さなステップに分けて順番に説明してください
   - 「これは、簡単に言うと...」のような表現を使って、要点を明確にしてください

4. **抜粋の要約**: 
   - 参考テキストから抜粋が必要な場合は、必ず要約してから使用してください
   - 長い文章は短くまとめ、要点だけを抽出してください
   - 抜粋は最小限に留め、自分の言葉での説明を優先してください

5. **回答の範囲**: 提供されたテキスト内容をベースに回答してください
6. **推論の活用**: テキストに明記されていない内容についても、関連する知識を活用して推論し、有益な回答を提供してください
7. **情報の補完**: テキストの内容に基づき、足りない情報はAIの知識を活用して補完してください
8. **簡潔さ**: 回答は端的に、要点を簡潔に伝えてください。冗長な表現や繰り返しは避けてください
9. **明確性**: 分かりやすく、構造化された回答を心がけてください
10. **引用**: 可能であれば、テキストの該当部分を引用して回答してください（引用する場合は必ず要約してください）
11. **情報源の明示**: テキスト以外の知識を使用した場合は、その旨を明記してください
12. **対話形式での対応**: 
   - 過去の会話履歴を考慮して、文脈に応じた柔軟な回答をしてください
   - ユーザーが前の回答について追加質問をしている場合は、前の回答を参照して説明してください
   - 「先ほどの説明について...」のような質問には、前の会話内容を踏まえて回答してください
   - 会話の流れを理解し、自然な対話を心がけてください

**重要な注意事項**:
- 参考テキストの抜粋のみを返すのではなく、必ず中学生レベルの語彙でかみ砕き、具体例を交えて説明してください
- 抜粋が必要な場合は、必ず要約してから使用してください（長い文章は短くまとめ、要点だけを抽出）
- 専門用語を使う場合は、必ずその後に「これは、簡単に言うと...」のような説明を追加してください（ただし簡潔に）
- 各説明には、必ず1つの具体例を含めてください（複数の例は不要）
- **回答は簡潔に、要点を端的に伝えてください。長い説明や繰り返しは避けてください**

テキストに含まれていない質問についても、関連する知識を活用して可能な限り回答してください。完全に回答できない場合は、「この内容についてはDiscordサーバーにてご相談ください。」と回答してください。`;

    const finalSystemPrompt = systemPrompt || defaultSystemPrompt;

    // ユーザープロンプトの構築
    const userPrompt = `レッスン: ${lessonTitle || '学習内容'}

テキスト内容:
${processedContext}

質問: ${question}

上記のテキスト内容をベースに、質問に回答してください。

**重要な指示**:
- 参考テキストの内容をそのまま抜粋するのではなく、中学生レベルの語彙でかみ砕いて説明してください
- 抜粋が必要な場合は、必ず要約してから使用してください（長い文章は短くまとめ、要点だけを抽出）
- 必ず具体例や身近な例を交えて説明してください（「例えば」で始まる例を1つだけ含めてください、1〜2文程度に留める）
- 専門用語を使う場合は、必ずその後に「これは、簡単に言うと...」のような説明を追加してください
- 複雑な内容は、小さなステップに分けて順番に説明してください
- 過去の会話履歴がある場合は、その文脈を考慮して回答してください

テキストに含まれていない内容についても、関連する知識を活用して可能な限り回答してください。完全に回答できない場合のみ、「この内容についてはDiscordサーバーにてご相談ください。」と回答してください。`;

    // メッセージ配列を構築（会話履歴 + 現在の質問）
    const messages = [
      {
        role: 'system',
        content: finalSystemPrompt
      }
    ];

    // 会話履歴を追加（形式: [{role: 'user'|'assistant', content: string}]
    if (conversationHistory && Array.isArray(conversationHistory) && conversationHistory.length > 0) {
      // 会話履歴を追加
      conversationHistory.forEach(msg => {
        if (msg.role && msg.content && (msg.role === 'user' || msg.role === 'assistant')) {
          messages.push({
            role: msg.role,
            content: msg.content
          });
        }
      });
    }

    // 現在の質問を追加
    messages.push({
      role: 'user',
      content: userPrompt
    });

    console.log('AIアシスタント呼び出し:', {
      model,
      maxTokens,
      temperature,
      questionLength: question.length,
      contextLength: processedContext.length,
      conversationHistoryLength: conversationHistory.length,
      totalMessages: messages.length
    });

    // OpenAI APIを呼び出し
    const completion = await openai.chat.completions.create({
      model: model,
      messages: messages,
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

    // 回答の要約を生成（会話履歴用、フロントエンドには表示しない）
    let summary = '';
    try {
      // 回答が短い場合は要約をスキップ（100文字以下）
      if (answer.length <= 100) {
        summary = answer.replace(/[#*\[\]()_`]/g, '').trim();
      } else {
        const summaryPrompt = `以下のAIアシスタントの回答を、会話履歴として使用するための簡潔な要約に変換してください。

【回答】
${answer}

【指示】
- 要点だけを抽出して、100文字以内の簡潔な要約にしてください
- 会話の文脈を理解するために必要な情報だけを残してください
- マークダウン形式（**太字**、#見出し、リスト記号など）は削除して、平文で記述してください
- 「要約:」などの接頭辞や説明文は不要です
- 回答の核心となる情報だけを残してください

要約のみを出力してください。`;

        const summaryCompletion = await openai.chat.completions.create({
          model: 'gpt-4o-mini', // 要約には軽量モデルを使用
          messages: [
            {
              role: 'system',
              content: 'あなたは回答を簡潔に要約する専門家です。要点だけを抽出して100文字以内の要約を生成してください。'
            },
            {
              role: 'user',
              content: summaryPrompt
            }
          ],
          max_tokens: 100,
          temperature: 0.2 // 要約は低温度で一貫性を保つ
        });

        summary = summaryCompletion.choices[0]?.message?.content?.trim() || '';
        
        // マークダウン記号を削除
        summary = summary.replace(/[#*\[\]()_`-]/g, '').trim();
        
        // 要約が長すぎる場合は手動で切り詰め
        if (summary.length > 120) {
          summary = summary.substring(0, 117).trim() + '...';
        }
      }
      
      // 要約が空の場合はフォールバック
      if (!summary || summary.length === 0) {
        summary = answer.replace(/[#*\[\]()_`-]/g, '').substring(0, 100).trim();
        if (answer.length > 100) {
          summary += '...';
        }
      }
    } catch (summaryError) {
      console.error('要約生成エラー:', summaryError);
      // 要約生成に失敗した場合は、回答からマークダウンを除去して最初の100文字を要約として使用
      summary = answer.replace(/[#*\[\]()_`-]/g, '').substring(0, 100).trim();
      if (answer.length > 100) {
        summary += '...';
      }
    }

    res.json({
      success: true,
      answer,
      summary, // 会話履歴用の要約
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

// 作業内容のAI提案
router.post('/suggest-work-content', authenticateToken, async (req, res) => {
  try {
    const { work_note } = req.body;

    if (!work_note || work_note.trim() === '') {
      return res.status(400).json({
        success: false,
        message: '作業記録が必要です'
      });
    }

    const systemPrompt = `あなたは在宅就労支援の専門家です。利用者の作業記録を基に、専門的で具体的な作業・訓練内容の記録を作成してください。`;

    const userPrompt = `以下の作業記録を基に、「作業・訓練内容」欄に記録する内容を生成してください。

【作業記録】
${work_note}

【指示】
1. 作業記録の内容を整理し、専門的で具体的な表現に変換してください
2. 実施した作業や訓練の内容を明確に記述してください
3. 箇条書きで整理してください
4. 在宅就労支援の文脈に適した内容にしてください

作業・訓練内容の記録を生成してください。`;

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
      max_tokens: 1000,
      temperature: 0.7
    });

    const suggestion = completion.choices[0]?.message?.content || '提案を生成できませんでした';

    res.json({
      success: true,
      suggestion,
      usage: {
        promptTokens: completion.usage?.prompt_tokens,
        completionTokens: completion.usage?.completion_tokens,
        totalTokens: completion.usage?.total_tokens
      }
    });

  } catch (error) {
    console.error('作業内容AI提案エラー:', error);
    res.status(500).json({
      success: false,
      message: 'AI提案の生成に失敗しました',
      error: process.env.NODE_ENV === 'development' ? error.message : '内部エラー'
    });
  }
});

// 支援内容のAI提案
router.post('/suggest-support-content', authenticateToken, async (req, res) => {
  try {
    const { start_time, end_time, support_method, work_result, daily_report, support_plan } = req.body;

    if (!start_time || !end_time || !support_method) {
      return res.status(400).json({
        success: false,
        message: '開始時刻、終了時刻、支援方法が必要です'
      });
    }

    const systemPrompt = `あなたは在宅就労支援の専門家です。支援の実施状況を基に、時系列で複数回（2回以上）の支援・連絡内容を記録してください。`;

    const userPrompt = `以下の情報を基に、「支援内容（1日2回以上）」欄に記録する内容を生成してください。

【実施時間】
開始: ${start_time}
終了: ${end_time}

【支援方法】
${support_method}

【作業結果】
${work_result || '未記録'}

【日報】
${daily_report || '未記録'}

【個別支援計画】
${support_plan || '未記録'}

【指示】
1. 時系列で複数回（2回以上）の支援・連絡内容を記録してください
2. 具体的な時刻と内容を記述してください
3. 箇条書きで整理してください
4. 在宅就労支援の文脈に適した内容にしてください
5. 支援の流れが分かるように記述してください

支援内容の記録を生成してください。`;

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
      max_tokens: 2000,
      temperature: 0.7
    });

    const suggestion = completion.choices[0]?.message?.content || '提案を生成できませんでした';

    res.json({
      success: true,
      suggestion,
      usage: {
        promptTokens: completion.usage?.prompt_tokens,
        completionTokens: completion.usage?.completion_tokens,
        totalTokens: completion.usage?.total_tokens
      }
    });

  } catch (error) {
    console.error('支援内容AI提案エラー:', error);
    res.status(500).json({
      success: false,
      message: 'AI提案の生成に失敗しました',
      error: process.env.NODE_ENV === 'development' ? error.message : '内部エラー'
    });
  }
});

// 心身の状況・助言のAI提案
router.post('/suggest-advice', authenticateToken, async (req, res) => {
  try {
    const { temperature, condition, sleep_hours, daily_report, start_time, end_time } = req.body;

    if (!condition || !daily_report) {
      return res.status(400).json({
        success: false,
        message: '体調と日報が必要です'
      });
    }

    const systemPrompt = `あなたは在宅就労支援の専門家です。利用者の体調情報と日報を基に、心身の状況及びそれに対する助言の内容を記録してください。`;

    const userPrompt = `以下の情報を基に、「対象者の心身の状況及びそれに対する助言の内容」欄に記録する内容を生成してください。

【実施時間】
開始: ${start_time || '未記録'}
終了: ${end_time || '未記録'}

【体温】
${temperature || '未記録'}℃

【体調】
${condition}

【睡眠時間】
${sleep_hours || '未記録'}時間

【日報】
${daily_report}

【指示】
1. 時系列で体調確認と助言内容を記録してください
2. 具体的な時刻と内容を記述してください
3. 箇条書きで整理してください
4. 在宅就労支援の文脈に適した内容にしてください
5. 体調管理に関する適切な助言を含めてください

心身の状況・助言の記録を生成してください。`;

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
      max_tokens: 1500,
      temperature: 0.7
    });

    const suggestion = completion.choices[0]?.message?.content || '提案を生成できませんでした';

    res.json({
      success: true,
      suggestion,
      usage: {
        promptTokens: completion.usage?.prompt_tokens,
        completionTokens: completion.usage?.completion_tokens,
        totalTokens: completion.usage?.total_tokens
      }
    });

  } catch (error) {
    console.error('心身の状況・助言AI提案エラー:', error);
    res.status(500).json({
      success: false,
      message: 'AI提案の生成に失敗しました',
      error: process.env.NODE_ENV === 'development' ? error.message : '内部エラー'
    });
  }
});

module.exports = router;
