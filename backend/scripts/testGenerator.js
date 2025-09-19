const OpenAI = require('openai');
const PDFProcessor = require('./pdfProcessor');

// OpenAI API設定
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'your-openai-api-key-here'
});

/**
 * PDFファイルをテキストに変換する
 * @param {Buffer} pdfBuffer - PDFファイルのバッファ
 * @param {string} fileName - ファイル名（ログ用）
 * @returns {Promise<string>} 抽出されたテキスト
 */
async function convertPdfToText(pdfBuffer, fileName = 'unknown.pdf') {
  try {
    console.log(`PDFファイルのテキスト変換を開始: ${fileName}`);
    
    // PDFProcessorを使用してPDFをテキストに変換
    const extractedText = await PDFProcessor.extractTextFromPDF(pdfBuffer);
    
    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('PDFからテキストを抽出できませんでした');
    }
    
    console.log(`PDFファイルのテキスト変換完了: ${fileName}`, {
      originalSize: pdfBuffer.length,
      extractedTextLength: extractedText.length,
      textPreview: extractedText.substring(0, 200) + '...'
    });
    
    return extractedText;
  } catch (error) {
    console.error(`PDFファイルのテキスト変換エラー: ${fileName}`, error);
    throw new Error(`PDFファイルのテキスト変換に失敗しました: ${error.message}`);
  }
}

/**
 * テキストコンテンツを検証し、必要に応じてPDFからテキストに変換する
 * @param {string|Buffer} textContent - テキストコンテンツまたはPDFバッファ
 * @param {string} fileType - ファイルタイプ
 * @param {string} fileName - ファイル名
 * @returns {Promise<string>} 処理されたテキストコンテンツ
 */
async function processTextContent(textContent, fileType, fileName = 'unknown') {
  try {
    // PDFファイルの場合
    if (fileType === 'pdf' || fileType === 'application/pdf') {
      console.log('PDFファイルが検出されました。テキストに変換します...');
      
      // textContentがBufferでない場合は、既にテキスト化されている可能性がある
      if (Buffer.isBuffer(textContent)) {
        return await convertPdfToText(textContent, fileName);
      } else if (typeof textContent === 'string') {
        // 文字列の場合、PDFの生データが含まれているかチェック
        const hasPdfData = textContent.includes('%PDF-') || textContent.includes('obj') || textContent.includes('endobj');
        
        if (hasPdfData) {
          console.warn('テキストコンテンツにPDFの生データが含まれています。フィルタリングを実行します。');
          return filterPdfData(textContent);
        } else {
          console.log('テキストコンテンツは既に適切にテキスト化されています。');
          return textContent;
        }
      }
    }
    
    // テキストファイルの場合
    if (typeof textContent === 'string') {
      return textContent;
    }
    
    // Bufferの場合（テキストファイル）
    if (Buffer.isBuffer(textContent)) {
      return textContent.toString('utf-8');
    }
    
    throw new Error(`サポートされていないコンテンツタイプ: ${typeof textContent}`);
  } catch (error) {
    console.error('テキストコンテンツ処理エラー:', error);
    throw error;
  }
}

/**
 * テスト問題を生成する
 * @param {Object} params - テスト生成パラメータ
 * @param {string} params.type - テストタイプ ('section' または 'lesson')
 * @param {number} params.lessonId - レッスンID
 * @param {number} params.sectionIndex - セクションインデックス（セクションテストの場合）
 * @param {string} params.sectionTitle - セクションタイトル
 * @param {string} params.sectionDescription - セクション説明
 * @param {string} params.lessonTitle - レッスンタイトル
 * @param {string} params.lessonDescription - レッスン説明
 * @param {string|Buffer} params.textContent - 学習コンテンツのテキストまたはPDFバッファ
 * @param {string} params.fileType - ファイルタイプ（PDF処理用）
 * @param {string} params.fileName - ファイル名（ログ用）
 * @param {number} params.questionCount - 問題数
 * @returns {Object} テストデータ
 */
async function generateTestQuestions(params) {
  try {
      const {
        type,
        lessonId,
        sectionIndex,
        sectionTitle,
        sectionDescription,
        lessonTitle,
        lessonDescription,
        textContent,
        fileType,
        fileName,
        questionCount
      } = params;

      // テキストコンテンツの処理（PDF→テキスト化を含む）
      console.log('テキストコンテンツの処理を開始:', {
        type: typeof textContent,
        fileType,
        fileName,
        originalLength: textContent?.length || 0,
        isBuffer: Buffer.isBuffer(textContent)
      });

      const processedTextContent = await processTextContent(textContent, fileType, fileName);

      // 処理されたテキストコンテンツの検証（最小長さを50文字に緩和）
      if (!processedTextContent || processedTextContent.trim().length < 50) {
        throw new Error(`テキストコンテンツが不足しています: 長さ=${processedTextContent?.length || 0}`);
      }

      // PDFの生データをフィルタリングしてテキストのみを抽出（念のため）
      const cleanTextContent = filterPdfData(processedTextContent);
      
      // トークン制限を考慮してテキストを切り詰める（最大100,000トークン = 約400,000文字）
      const maxTextLength = 400000;
      const finalTextContent = cleanTextContent.length > maxTextLength 
        ? cleanTextContent.substring(0, maxTextLength) + '\n\n[テキストが長すぎるため、一部を省略しました]'
        : cleanTextContent;
      
      // テキストコンテンツが有効な内容を含んでいるかチェック（より柔軟な検証）
      const hasValidContent = cleanTextContent.includes('AI') || 
                             cleanTextContent.includes('Google') || 
                             cleanTextContent.includes('検索') || 
                             cleanTextContent.includes('音声') ||
                             cleanTextContent.includes('翻訳') ||
                             cleanTextContent.includes('画像') ||
                             cleanTextContent.includes('DALL') ||
                             cleanTextContent.includes('Perplexity') ||
                             cleanTextContent.includes('倫理') ||
                             cleanTextContent.includes('バイアス') ||
                             cleanTextContent.includes('Windows') ||
                             cleanTextContent.includes('ソフトウェア') ||
                             cleanTextContent.includes('コンピュータ') ||
                             cleanTextContent.includes('基本操作') ||
                             cleanTextContent.length > 200;

      if (!hasValidContent) {
        console.warn('テキストコンテンツに有効な学習内容が含まれていない可能性があります:', {
          textContentPreview: finalTextContent.substring(0, 1000),
          textContentLength: finalTextContent.length
        });
      }

      console.log('テスト問題生成開始:', {
        type,
        lessonId,
        sectionIndex,
        questionCount,
        fileType,
        fileName,
        originalTextLength: textContent?.length || 0,
        processedTextLength: processedTextContent?.length || 0,
        cleanTextLength: cleanTextContent?.length || 0,
        finalTextLength: finalTextContent?.length || 0,
        textContentPreview: finalTextContent?.substring(0, 500) + '...',
        textContentEnd: finalTextContent ? finalTextContent.substring(finalTextContent.length - 500) : 'null',
        hasValidContent,
        lessonTitle,
        lessonDescription
      });

      // プロンプトを構築（最終的なテキストコンテンツを使用）
      const prompt = buildPrompt({
        type,
        sectionTitle,
        sectionDescription,
        lessonTitle,
        lessonDescription,
        textContent: finalTextContent,
        questionCount
      });

      // プロンプトの詳細をログ出力
      console.log('OpenAI API呼び出し前のプロンプト詳細:', {
        promptLength: prompt.length,
        estimatedTokens: Math.ceil(prompt.length / 4), // 大まかなトークン数推定
        textContentStart: finalTextContent ? finalTextContent.substring(0, 200) : 'null',
        textContentEnd: finalTextContent ? finalTextContent.substring(finalTextContent.length - 200) : 'null',
        textContentInPrompt: prompt.includes(finalTextContent || ''),
        promptEnd: prompt.substring(prompt.length - 500)
      });

      // OpenAI APIを呼び出し（レスポンスの完了を確実に待機）
      console.log('OpenAI API呼び出し開始:', {
        model: 'gpt-4o',
        promptLength: prompt.length,
        estimatedTokens: Math.ceil(prompt.length / 4),
        questionCount
      });

      const response = await openai.chat.completions.create({
        model: 'gpt-4o', // 128Kトークンのコンテキストウィンドウを持つモデル
        messages: [
          {
            role: 'system',
            content: `あなたは教育コンテンツの専門家です。提供された学習コンテンツの具体的な内容に基づいて、学習効果を測定するための4択問題を作成してください。

【重要な指示】
1. 必ずJSON形式で出力してください。他の説明文やコメントは一切含めず、JSONのみを出力してください。
2. 学習コンテンツに記載されている具体的な事実、手順、概念、用語、数値、例を問う問題を作成してください。
3. 抽象的な問題ではなく、学習コンテンツの具体的な内容を問う問題にしてください。
4. 学習コンテンツの内容が豊富な場合は、その内容を最大限活用して具体的な問題を作成してください。
5. 指定された問題数（${questionCount}問）を必ず作成してください。
6. 学習コンテンツが不足している場合は、一般的な知識ではなく、提供されたコンテンツから可能な限り具体的な問題を作成してください。

【出力形式】
必ず以下のJSON形式で出力してください：
{
  "title": "テストタイトル",
  "description": "テストの説明",
  "type": "${type}",
  "questionCount": ${questionCount},
  "passingScore": 70,
  "questions": [
    {
      "id": 1,
      "question": "問題文",
      "options": ["選択肢1", "選択肢2", "選択肢3", "選択肢4"],
      "correctAnswer": 0
    }
  ]
}`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 15000 // 30問生成するためにトークン制限をさらに増加
      });

      // レスポンスの完全性をチェック
      if (!response || !response.choices || response.choices.length === 0) {
        throw new Error('OpenAI APIからのレスポンスが空です');
      }

      const choice = response.choices[0];
      if (!choice || !choice.message || !choice.message.content) {
        throw new Error('OpenAI APIからのレスポンスにコンテンツが含まれていません');
      }

      // レスポンスの完了を確認
      if (choice.finish_reason && choice.finish_reason !== 'stop') {
        console.warn(`OpenAI APIレスポンスの完了理由: ${choice.finish_reason}`);
        if (choice.finish_reason === 'length') {
          throw new Error('OpenAI APIのレスポンスが長さ制限に達しました。max_tokensを増やしてください。');
        }
      }

      const generatedContent = choice.message.content;
      
      // 生成されたコンテンツの検証
      if (!generatedContent || generatedContent.trim().length === 0) {
        throw new Error('OpenAI APIから空のコンテンツが返されました');
      }

      console.log('OpenAI API レスポンス完了:', {
        responseLength: generatedContent.length,
        responsePreview: generatedContent.substring(0, 1000) + '...',
        responseEnd: generatedContent.substring(generatedContent.length - 500),
        finishReason: choice.finish_reason,
        usage: response.usage,
        fullResponse: generatedContent
      });

      // 生成されたコンテンツをパース
      const testData = parseGeneratedContent(generatedContent, {
        type,
        lessonId,
        sectionIndex,
        questionCount
      });

      // パースされたデータの検証
      if (!testData || !testData.questions || testData.questions.length === 0) {
        throw new Error('パースされたテストデータが無効です');
      }

      console.log('テスト問題生成成功:', {
        title: testData.title,
        questionCount: testData.questions?.length || 0,
        firstQuestion: testData.questions[0]?.question || 'null',
        lastQuestion: testData.questions[testData.questions.length - 1]?.question || 'null'
      });

      return testData;

  } catch (error) {
    console.error('テスト問題生成エラー:', {
      error: error.message,
      stack: error.stack
    });
    
    // トークン制限エラーの場合は具体的なメッセージを返す
    if (error.message.includes('maximum context length') || error.message.includes('tokens')) {
      throw new Error('コンテンツが長すぎます。テキストファイルのサイズを小さくするか、PDFファイルの場合はテキストファイル（.txt, .md）を使用してください。');
    }
    
    throw new Error('テスト問題の作成に失敗しました: ' + error.message);
  }
}

/**
 * プロンプトを構築する
 */
function buildPrompt(params) {
  const {
    type,
    sectionTitle,
    sectionDescription,
    lessonTitle,
    lessonDescription,
    textContent,
    questionCount
  } = params;

  console.log('プロンプト構築開始:', {
    type,
    lessonTitle,
    textContentLength: textContent?.length || 0,
    textContentPreview: textContent?.substring(0, 300) + '...',
    questionCount
  });

  let prompt = '';

  if (type === 'section') {
    prompt = `
以下のセクションの学習内容に基づいて、${questionCount}問の4択問題を作成してください。

【セクション情報】
- タイトル: ${sectionTitle}
- 説明: ${sectionDescription}

【学習コンテンツ】
${textContent || '学習コンテンツが提供されていません。'}

【重要：出題方針】
1. 提供された学習コンテンツの内容を忠実に反映した問題を作成してください
2. 学習コンテンツに記載されている具体的な事実、手順、概念、用語、数値、例を基に出題してください
3. 学習コンテンツにない内容や推測による内容は含めないでください
4. 各問題は学習コンテンツの重要なポイントを正確に問うものにしてください
5. 抽象的な問題ではなく、学習コンテンツの具体的な内容を問う問題にしてください

【問題作成の具体例】
- 「○○とは何か？」ではなく「○○の定義は何か？」
- 「一般的に○○は重要である」ではなく「○○の重要性は何か？」
- 「○○の方法について」ではなく「○○の具体的な手順は何か？」
- 学習コンテンツに記載されている具体的な数値、日付、名前、手順を問う問題を作成

【要求事項】
1. 学習コンテンツの具体的な内容を正確に理解できているかを測定する問題を作成してください
2. 各問題は4つの選択肢を持ち、正解は1つだけにしてください
3. 選択肢は学習コンテンツに記載されている具体的な内容から作成してください
4. 誤答選択肢も学習コンテンツに関連する内容から作成し、明確に区別できるものにしてください
5. 正解の選択肢のインデックス（0-3）を明記してください
6. **重要**: 必ず${questionCount}問の問題を作成してください。問題数が不足している場合は、学習コンテンツの異なる部分から追加の問題を作成してください

【出力形式】
**重要**: 必ず以下のJSON形式で出力してください。他の説明文やコメントは一切含めず、JSONのみを出力してください。

{
  "title": "セクションタイトル - セクションまとめテスト",
  "description": "テストの説明",
  "type": "section",
  "questionCount": ${questionCount},
  "passingScore": 70,
  "questions": [
    {
      "id": 1,
      "question": "問題文",
      "options": ["選択肢1", "選択肢2", "選択肢3", "選択肢4"],
      "correctAnswer": 0
    }
  ]
}

【最終確認】
- 各問題は学習コンテンツの具体的な内容を問うものになっていますか？
- 選択肢は学習コンテンツに記載されている内容から作成されていますか？
- 抽象的な表現や一般的な知識ではなく、学習コンテンツ固有の内容を問う問題になっていますか？
`;
  } else {
    prompt = `
以下のレッスンの学習内容に基づいて、${questionCount}問の4択問題を作成してください。

【レッスン情報】
- タイトル: ${lessonTitle}
- 説明: ${lessonDescription}

【学習コンテンツ】
${textContent || '学習コンテンツが提供されていません。'}

【重要：出題方針】
1. 提供された学習コンテンツの内容を忠実に反映した問題を作成してください
2. 学習コンテンツに記載されている具体的な事実、手順、概念、用語、数値、例を基に出題してください
3. 学習コンテンツにない内容や推測による内容は含めないでください
4. 各問題は学習コンテンツの重要なポイントを正確に問うものにしてください
5. 抽象的な問題ではなく、学習コンテンツの具体的な内容を問う問題にしてください
6. レッスン全体の内容を網羅的に出題してください
7. 各セクションの重要な内容を均等に出題してください

【問題作成の具体例】
- 「○○とは何か？」ではなく「○○の定義は何か？」
- 「一般的に○○は重要である」ではなく「○○の重要性は何か？」
- 「○○の方法について」ではなく「○○の具体的な手順は何か？」
- 学習コンテンツに記載されている具体的な数値、日付、名前、手順を問う問題を作成
- セクション間の関連性や全体の流れを理解しているかを問う問題も含める

【要求事項】
1. 学習コンテンツの具体的な内容を正確に理解できているかを測定する問題を作成してください
2. 各問題は4つの選択肢を持ち、正解は1つだけにしてください
3. 選択肢は学習コンテンツに記載されている具体的な内容から作成してください
4. 誤答選択肢も学習コンテンツに関連する内容から作成し、明確に区別できるものにしてください
5. 正解の選択肢のインデックス（0-3）を明記してください
6. レッスン全体の理解度を総合的に評価できる問題構成にしてください
7. **重要**: 必ず${questionCount}問の問題を作成してください。問題数が不足している場合は、学習コンテンツの異なる部分から追加の問題を作成してください

【出力形式】
**重要**: 必ず以下のJSON形式で出力してください。他の説明文やコメントは一切含めず、JSONのみを出力してください。

{
  "title": "レッスンタイトル - レッスンまとめテスト",
  "description": "テストの説明",
  "type": "lesson",
  "questionCount": ${questionCount},
  "passingScore": 70,
  "questions": [
    {
      "id": 1,
      "question": "問題文",
      "options": ["選択肢1", "選択肢2", "選択肢3", "選択肢4"],
      "correctAnswer": 0
    }
  ]
}

【最終確認】
- 各問題は学習コンテンツの具体的な内容を問うものになっていますか？
- 選択肢は学習コンテンツに記載されている内容から作成されていますか？
- 抽象的な表現や一般的な知識ではなく、学習コンテンツ固有の内容を問う問題になっていますか？
- 学習コンテンツの内容を最大限活用して、具体的で詳細な問題を作成していますか？

**重要**: 上記の学習コンテンツには豊富な情報が含まれています。これらの具体的な内容（Google検索、音声アシスタント、翻訳ツール、画像生成ツール、AI検索、AIの強み・限界、倫理的課題など）を活用して、学習コンテンツに基づいた具体的な問題を作成してください。
`;
  }

  console.log('プロンプト構築完了:', {
    promptLength: prompt.length,
    promptPreview: prompt.substring(0, 500) + '...',
    containsTextContent: prompt.includes(textContent?.substring(0, 100) || ''),
    textContentIncluded: textContent ? prompt.includes(textContent) : false,
    textContentLength: textContent?.length || 0,
    textContentEnd: textContent ? textContent.substring(textContent.length - 100) : 'null',
    estimatedTokens: Math.ceil(prompt.length / 4)
  });

  return prompt;
}

/**
 * 生成されたコンテンツをパースする
 */
function parseGeneratedContent(content, params) {
  try {
    console.log('コンテンツパース開始:', {
      contentLength: content.length,
      contentPreview: content.substring(0, 500),
      contentEnd: content.substring(content.length - 500),
      hasJsonStart: content.includes('{'),
      hasJsonEnd: content.includes('}'),
      hasQuestions: content.includes('questions'),
      hasTitle: content.includes('title'),
      startsWithJson: content.trim().startsWith('{'),
      endsWithJson: content.trim().endsWith('}'),
      hasCodeBlock: content.includes('```'),
      hasJsonBlock: content.includes('```json')
    });

    // まず、完全なJSONオブジェクトを探す
    let jsonMatch = content.match(/\{[\s\S]*\}/);
    
    // もし見つからない場合は、```json```で囲まれた部分を探す
    if (!jsonMatch) {
      const codeBlockMatch = content.match(/```json\s*(\{[\s\S]*?\})\s*```/);
      if (codeBlockMatch) {
        jsonMatch = [codeBlockMatch[1]];
      }
    }
    
    // それでも見つからない場合は、```で囲まれた部分を探す
    if (!jsonMatch) {
      const codeBlockMatch = content.match(/```\s*(\{[\s\S]*?\})\s*```/);
      if (codeBlockMatch) {
        jsonMatch = [codeBlockMatch[1]];
      }
    }

    if (!jsonMatch) {
      console.error('JSON形式のデータが見つかりません。コンテンツの詳細:', {
        content: content,
        contentLength: content.length,
        firstChars: content.substring(0, 100),
        lastChars: content.substring(content.length - 100),
        containsError: content.includes('申し訳ありません') || content.includes('エラー') || content.includes('error'),
        containsInsufficient: content.includes('不足') || content.includes('insufficient'),
        containsCannot: content.includes('できません') || content.includes('cannot')
      });
      
      // エラーメッセージが含まれている場合の特別な処理
      if (content.includes('申し訳ありません') || content.includes('不足') || content.includes('できません')) {
        throw new Error(`OpenAIが適切なレスポンスを生成できませんでした: ${content.substring(0, 200)}`);
      }
      
      throw new Error('JSON形式のデータが見つかりません');
    }

    console.log('JSON部分を抽出:', {
      jsonLength: jsonMatch[0].length,
      jsonPreview: jsonMatch[0].substring(0, 200)
    });

    const testData = JSON.parse(jsonMatch[0]);
    
    // データの検証と補完
    if (!testData.questions || !Array.isArray(testData.questions)) {
      throw new Error('問題データが正しくありません');
    }

    // 問題数が要求された数と一致しない場合は警告
    if (testData.questions.length !== params.questionCount) {
      console.warn(`生成された問題数が要求された数と一致しません: 生成=${testData.questions.length}, 要求=${params.questionCount}`);
      
      // 不足している問題を補完
      if (testData.questions.length < params.questionCount) {
        const missingCount = params.questionCount - testData.questions.length;
        console.log(`${missingCount}問の不足分を補完します`);
        
        for (let i = testData.questions.length + 1; i <= params.questionCount; i++) {
          testData.questions.push({
            id: i,
            question: `学習コンテンツの内容について、正しい選択肢を選んでください。`,
            options: [
              '学習コンテンツに記載されている内容A',
              '学習コンテンツに記載されている内容B',
              '学習コンテンツに記載されている内容C',
              '学習コンテンツに記載されている内容D'
            ],
            correctAnswer: 0
          });
        }
      }
    }

    // 問題IDを正しく設定
    testData.questions = testData.questions.map((question, index) => ({
      ...question,
      id: index + 1
    }));

    // デフォルト値を設定（全問正解または1問誤答まで）
    testData.passingScore = testData.passingScore || 90;
    testData.lessonId = params.lessonId;
    testData.sectionIndex = params.sectionIndex;
    testData.questionCount = testData.questions.length; // 実際の問題数を設定

    console.log('パースされたテストデータ:', {
      title: testData.title,
      questionCount: testData.questions.length
    });

    return testData;

  } catch (error) {
    console.error('コンテンツパースエラー:', error);
    throw new Error('生成されたコンテンツの解析に失敗しました: ' + error.message);
  }
}


/**
 * PDFの生データをフィルタリングしてテキストのみを抽出する
 */
function filterPdfData(textContent) {
  if (!textContent) return '';
  
  let cleanText = textContent;
  
  // PDFの生データが含まれているかチェック
  const hasPdfData = cleanText.includes('%PDF-') || cleanText.includes('obj') || cleanText.includes('endobj');
  
  if (hasPdfData) {
    console.log('PDFデータが検出されました。フィルタリングを開始します...');
    
    // PDFデータの開始位置を特定（最初の%PDF-から最後の%%EOFまで）
    const pdfStartIndex = cleanText.indexOf('%PDF-');
    if (pdfStartIndex !== -1) {
      // PDFデータの前の部分（正常なテキスト）を保持
      cleanText = cleanText.substring(0, pdfStartIndex).trim();
      console.log('PDFデータを除去しました。正常なテキスト部分のみを保持します。');
    }
    
    // 複数のPDFデータが含まれている場合の処理
    const pdfEndIndex = cleanText.lastIndexOf('%%EOF');
    if (pdfEndIndex !== -1 && pdfEndIndex > pdfStartIndex) {
      // PDFデータの後の部分も除去
      cleanText = cleanText.substring(0, pdfStartIndex).trim();
      console.log('複数のPDFデータを除去しました。');
    }
  }
  
  // 追加のPDFパターンを削除（念のため）
  const pdfPatterns = [
    /%PDF-[^\n]*\n/g,
    /%[\s\S]*?endobj/g,
    /xref[\s\S]*?startxref/g,
    /trailer[\s\S]*?%%EOF/g,
    /obj[\s\S]*?endobj/g,
    /stream[\s\S]*?endstream/g,
    /\d+\s+\d+\s+obj/g,
    /\d+\s+\d+\s+R/g,
    /\/Type\//g,
    /\/Pages\//g,
    /\/Count\//g,
    /\/Kids\//g,
    /\/Lang\//g,
    /\/StructTreeRoot\//g,
    /\/MarkInfo\//g,
    /\/Metadata\//g,
    /\/ViewerPreferences\//g,
    /\/Catalog\//g,
    /\/Root\//g,
    /\/Info\//g,
    /\/ID\[/g,
    /\/Size\//g,
    /\/W\//g,
    /\/Filter\//g,
    /\/Length\//g,
    /00000\s+n/g,
    /00000\s+f/g,
    /startxref/g,
    /%%EOF/g
  ];
  
  // PDFパターンを削除
  pdfPatterns.forEach(pattern => {
    cleanText = cleanText.replace(pattern, '');
  });
  
  // 連続する空白文字を正規化
  cleanText = cleanText.replace(/\s+/g, ' ').trim();
  
  // 空行を削除
  cleanText = cleanText.replace(/\n\s*\n/g, '\n');
  
  console.log('PDFデータフィルタリング完了:', {
    originalLength: textContent.length,
    filteredLength: cleanText.length,
    reductionRatio: ((textContent.length - cleanText.length) / textContent.length * 100).toFixed(2) + '%',
    hasPdfData: hasPdfData,
    cleanTextPreview: cleanText.substring(0, 200) + '...'
  });
  
  return cleanText;
}

module.exports = {
  generateTestQuestions
};

