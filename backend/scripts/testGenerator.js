const OpenAI = require('openai');

// OpenAI API設定
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'your-openai-api-key-here'
});

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
 * @param {string} params.textContent - 学習コンテンツのテキスト
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
      questionCount
    } = params;

    console.log('テスト問題生成開始:', {
      type,
      lessonId,
      sectionIndex,
      questionCount
    });

    // プロンプトを構築
    const prompt = buildPrompt({
      type,
      sectionTitle,
      sectionDescription,
      lessonTitle,
      lessonDescription,
      textContent,
      questionCount
    });

    // OpenAI APIを呼び出し
    const response = await openai.chat.completions.create({
      model: 'gpt-4o', // コスト効率の良いモデルを使用
      messages: [
        {
          role: 'system',
          content: 'あなたは教育コンテンツの専門家です。提供された学習コンテンツの具体的な内容に基づいて、学習効果を測定するための4択問題を作成してください。抽象的な問題ではなく、学習コンテンツに記載されている具体的な事実、手順、概念、用語、数値、例を問う問題を作成することが重要です。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 4000
    });

    const generatedContent = response.choices[0].message.content;
    console.log('OpenAI API レスポンス:', generatedContent);

    // 生成されたコンテンツをパース
    const testData = parseGeneratedContent(generatedContent, {
      type,
      lessonId,
      sectionIndex,
      questionCount
    });

    return testData;

  } catch (error) {
    console.error('テスト問題生成エラー:', error);
    
    // エラー時はフォールバック用のモックデータを返す
    return generateFallbackTestData(params);
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

【出力形式】
以下のJSON形式で出力してください：

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

【出力形式】
以下のJSON形式で出力してください：

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
`;
  }

  return prompt;
}

/**
 * 生成されたコンテンツをパースする
 */
function parseGeneratedContent(content, params) {
  try {
    // JSON部分を抽出
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('JSON形式のデータが見つかりません');
    }

    const testData = JSON.parse(jsonMatch[0]);
    
    // データの検証と補完
    if (!testData.questions || !Array.isArray(testData.questions)) {
      throw new Error('問題データが正しくありません');
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
 * フォールバック用のモックテストデータを生成する
 */
function generateFallbackTestData(params) {
  const {
    type,
    lessonId,
    sectionIndex,
    sectionTitle,
    lessonTitle,
    questionCount
  } = params;

  const isSection = type === 'section';
  const title = isSection 
    ? `${sectionTitle || `セクション${sectionIndex + 1}`} - セクションまとめテスト`
    : `${lessonTitle || `第${lessonId}回`} - レッスンまとめテスト`;

  const questions = [];
  for (let i = 1; i <= questionCount; i++) {
    questions.push({
      id: i,
      question: `学習コンテンツに記載されている具体的な内容について、正しい選択肢を選んでください。`,
      options: [
        '学習コンテンツに記載されている具体的な内容A',
        '学習コンテンツに記載されている具体的な内容B',
        '学習コンテンツに記載されている具体的な内容C',
        '学習コンテンツに記載されている具体的な内容D'
      ],
      correctAnswer: 0
    });
  }

  return {
    title,
    description: `${isSection ? 'セクション' : 'レッスン'}の学習内容について理解度を確認するテストです。`,
    type,
    lessonId,
    sectionIndex,
    questionCount,
    passingScore: 90,
    questions
  };
}

module.exports = {
  generateTestQuestions
};

