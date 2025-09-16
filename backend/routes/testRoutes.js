const express = require('express');
const { getCourses, createCourse } = require('../scripts/courseController');
const { generateTestQuestions } = require('../scripts/testGenerator');
const { s3Utils } = require('../config/s3');
const { pool } = require('../utils/database');
const { customLogger } = require('../utils/logger');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// ヘルスチェック用エンドポイント
router.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'curriculum-portal-backend'
  });
});

// テスト用エンドポイント（認証なし）
router.post('/courses', createCourse);
router.get('/courses', getCourses);

// テキスト抽出API（テスト生成用）
router.get('/learning/extract-text/:s3Key', async (req, res) => {
  try {
    const { s3Key } = req.params;
    
    console.log('テキスト抽出リクエスト:', { s3Key });
    
    // セッションストレージからコンテキストを取得するロジックを実装
    // 実際の実装では、S3からファイルを取得してテキストを抽出する必要があります
    
    // 現在はモックデータを返す
    const mockTextContent = `これは${s3Key}から抽出されたテキストコンテンツのサンプルです。
    
具体的な学習内容：
- Windows 11の基本操作について
- デスクトップの使い方
- ファイルとフォルダの管理
- アプリケーションの起動と終了
- 設定の変更方法

詳細な手順：
1. スタートメニューをクリック
2. アプリケーションを選択
3. 右クリックでコンテキストメニューを表示
4. プロパティを選択して設定を変更

重要なポイント：
- ショートカットキーの活用
- タスクバーのカスタマイズ
- ウィンドウの管理方法
- ファイルの検索機能

この内容に基づいて具体的な問題を作成してください。`;
    
    res.json({
      success: true,
      data: {
        text: mockTextContent,
        s3Key: s3Key
      }
    });
  } catch (error) {
    console.error('テキスト抽出エラー:', error);
    res.status(500).json({
      success: false,
      message: 'テキスト抽出に失敗しました: ' + error.message
    });
  }
});

// 学習効果テスト生成API
router.post('/learning/generate-test', async (req, res) => {
  try {
    const { type, lessonId, sectionIndex, sectionTitle, sectionDescription, lessonTitle, lessonDescription, textContent, questionCount } = req.body;
    
    console.log('テスト生成リクエスト:', {
      type,
      lessonId,
      sectionIndex,
      sectionTitle,
      sectionDescription,
      lessonTitle,
      lessonDescription,
      textContentLength: textContent?.length || 0,
      textContentPreview: textContent?.substring(0, 300) + '...',
      questionCount
    });
    
    // テキストコンテンツが空の場合は警告
    if (!textContent || textContent.trim().length === 0) {
      console.warn('⚠️ テキストコンテンツが空です。フォールバック用のモックデータを返します。');
      const fallbackData = generateFallbackTestData({
        type,
        lessonId,
        sectionIndex,
        sectionTitle,
        lessonTitle,
        questionCount
      });
      return res.json({
        success: true,
        data: fallbackData
      });
    }

    const testData = await generateTestQuestions({
      type,
      lessonId,
      sectionIndex,
      sectionTitle,
      sectionDescription,
      lessonTitle,
      lessonDescription,
      textContent,
      questionCount
    });

    res.json({
      success: true,
      data: testData
    });
  } catch (error) {
    console.error('テスト生成エラー:', error);
    res.status(500).json({
      success: false,
      message: 'テスト生成に失敗しました: ' + error.message
    });
  }
});

// フィードバック生成API
router.post('/learning/generate-feedback', async (req, res) => {
  try {
    const { question, userAnswer, correctAnswer, allOptions } = req.body;
    
    console.log('フィードバック生成リクエスト:', {
      question: question?.substring(0, 100) + '...',
      userAnswer,
      correctAnswer,
      optionsCount: allOptions?.length
    });

    // OpenAI APIを使用してフィードバックを生成
    const { OpenAI } = require('openai');
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const prompt = `以下のテスト問題について、ユーザーの誤答に対する詳細で建設的なフィードバックを生成してください。

問題: ${question}

選択肢:
${allOptions.map((option, index) => `${index + 1}. ${option}`).join('\n')}

ユーザーの回答: ${userAnswer}
正解: ${correctAnswer}

フィードバックの要件:
1. **誤答の分析**: ユーザーの回答がなぜ間違っているかを具体的に説明
2. **正解の解説**: 正しい答えの理由を詳しく、分かりやすく説明
3. **学習ポイント**: この問題から学べる重要なポイントを明確に示す
4. **実践的なアドバイス**: 今後の学習に活かせる具体的なアドバイス
5. **励ましの言葉**: 学習意欲を高める励ましのメッセージ
6. **関連知識**: 関連する知識や応用についても触れる

フィードバックは教育的で親しみやすく、学習者の理解を深める内容にしてください。`;

    const systemPrompt = `あなたは経験豊富な教育指導員です。学習者の誤答に対して、以下の方針でフィードバックを提供してください：

1. **建設的で前向き**: 批判的ではなく、学習を促進する内容
2. **具体的で実用的**: 抽象的な説明ではなく、具体的で実践的なアドバイス
3. **段階的な理解**: なぜ間違ったのかから、正しい理解まで段階的に説明
4. **学習意欲の向上**: 学習者が「もっと学びたい」と思えるような内容
5. **親しみやすい文体**: 堅苦しくなく、親しみやすい口調で

フィードバックは200-300文字程度で、学習者の理解を深め、今後の学習に活かせる内容にしてください。`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.9,
      max_tokens: 400
    });

    const feedback = response.choices[0].message.content.trim();
    
    res.json({
      success: true,
      feedback: feedback
    });

  } catch (error) {
    console.error('フィードバック生成エラー:', error);
    res.status(500).json({
      success: false,
      message: 'フィードバック生成に失敗しました'
    });
  }
});

// テスト結果提出API（採点機能付き）
router.post('/learning/test/submit', async (req, res, next) => {
  try {
    // 認証トークンがある場合は認証を試行
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authenticateToken(req, res, next);
    }
    
    // 認証トークンがない場合は、一時パスワード認証を試行
    const loginCode = req.query.loginCode || req.query.code;
    const tempPassword = req.query.tempPassword || req.query.password || req.query.temp_password;
    
    if (loginCode && tempPassword) {
      // 一時パスワード認証を試行
      const { verifyTemporaryPassword } = require('../scripts/userController');
      const authResult = await verifyTemporaryPassword(loginCode, tempPassword);
      
      if (authResult.success) {
        // 認証成功の場合、ユーザー情報をリクエストに追加
        req.user = {
          user_id: authResult.data.userId,
          role: 1, // 利用者ロール
          username: authResult.data.userName
        };
        return next();
      }
    }
    
    // 認証に失敗した場合
    return res.status(401).json({
      success: false,
      message: '認証が必要です。ログインコードと一時パスワードを提供してください。'
    });
  } catch (error) {
    console.error('テスト提出API認証エラー:', error);
    return res.status(500).json({
      success: false,
      message: '認証処理中にエラーが発生しました'
    });
  }
}, async (req, res) => {
  try {
    // 認証されたユーザーIDを優先的に使用
    const userId = req.user?.user_id || req.body.userId;
    const { lessonId, sectionIndex, testType, answers, testData, shuffledQuestions } = req.body;
    
    console.log('テスト結果提出:', {
      userId,
      lessonId,
      sectionIndex,
      testType,
      answerCount: answers ? Object.keys(answers).length : 0,
      authenticatedUser: req.user?.user_id,
      bodyUserId: req.body.userId,
      hasShuffledQuestions: !!shuffledQuestions,
      shuffledQuestionsLength: shuffledQuestions?.length,
      shuffledQuestionsSample: shuffledQuestions ? shuffledQuestions.slice(0, 2) : null,
      testDataQuestionsSample: testData?.questions ? testData.questions.slice(0, 2) : null
    });
    
    // リクエストデータの検証
    if (!userId || !lessonId || !testType || !answers || !testData) {
      return res.status(400).json({
        success: false,
        message: '必要なパラメータが不足しています',
        missing: {
          userId: !userId,
          lessonId: !lessonId,
          testType: !testType,
          answers: !answers,
          testData: !testData
        }
      });
    }

    // シャッフルされた問題データがある場合はそれを使用、なければ元のtestDataを使用
    const questionsToUse = shuffledQuestions && shuffledQuestions.length > 0 ? shuffledQuestions : testData.questions;
    
    // テスト結果を計算
    console.log('テスト結果計算開始...');
    console.log('計算用データ:', {
      answersCount: Object.keys(answers).length,
      questionsCount: questionsToUse.length,
      usingShuffledQuestions: shuffledQuestions && shuffledQuestions.length > 0,
      answers: answers,
      questions: questionsToUse.map(q => ({ id: q.id, correctAnswer: q.correctAnswer }))
    });
    
    const score = calculateTestScore(answers, questionsToUse);
    const percentage = Math.round((score / questionsToUse.length) * 100);
    // 合格ライン: レッスンテスト(30問中29問以上)、セクションテスト(10問中9問以上)
    const passed = testType === 'lesson' 
      ? score >= 29  // レッスンテスト: 30問中29問以上
      : score >= (questionsToUse.length - 1);  // セクションテスト: 全問正解または1問誤答まで
    
    console.log('計算結果:', { score, percentage, passed });

    // 採点結果をS3に保存し、DBに記録
    console.log('採点結果保存開始...');
    console.log('saveExamResult呼び出しパラメータ:', {
      userId,
      lessonId,
      sectionIndex,
      testType,
      score,
      percentage,
      passed
    });
    
    // MDファイル生成用にtestDataを更新（シャッフルされた問題データを使用）
    const updatedTestData = {
      ...testData,
      questions: questionsToUse
    };
    
    const examResult = await saveExamResult({
      userId,
      lessonId,
      sectionIndex,
      testType,
      answers,
      testData: updatedTestData,
      score,
      percentage,
      passed
    });
    console.log('採点結果保存完了:', examResult);

    res.json({
      success: true,
      data: {
        score,
        totalQuestions: questionsToUse.length,
        percentage,
        passed,
        correctAnswers: score,
        wrongAnswers: questionsToUse.length - score,
        examResultId: examResult.id,
        s3Key: examResult.s3Key
      }
    });
  } catch (error) {
    console.error('テスト結果提出エラー:', error);
    console.error('エラースタック:', error.stack);
    res.status(500).json({
      success: false,
      message: 'テスト結果の提出に失敗しました: ' + error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// フォールバック用テストデータ生成関数
function generateFallbackTestData(params) {
  const { type, lessonId, sectionIndex, sectionTitle, lessonTitle, questionCount } = params;
  
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

// テストスコア計算関数
function calculateTestScore(answers, questions) {
  console.log('calculateTestScore開始:', {
    answersKeys: Object.keys(answers),
    questionsCount: questions.length,
    questions: questions.map(q => ({ id: q.id, correctAnswer: q.correctAnswer }))
  });
  
  let correctCount = 0;
  
  questions.forEach((question, index) => {
    const userAnswer = answers[question.id];
    console.log(`問題${index + 1} (ID: ${question.id}):`, {
      userAnswer,
      correctAnswer: question.correctAnswer,
      isCorrect: userAnswer !== undefined && userAnswer === question.correctAnswer
    });
    
    // シャッフルされた正答インデックスを使用
    if (userAnswer !== undefined && userAnswer === question.correctAnswer) {
      correctCount++;
    }
  });
  
  console.log('calculateTestScore結果:', { correctCount, totalQuestions: questions.length });
  return correctCount;
}

// 採点結果をS3に保存し、DBに記録する関数
async function saveExamResult({ userId, lessonId, sectionIndex, testType, answers, testData, score, percentage, passed }) {
  console.log('saveExamResult開始:', { userId, lessonId, sectionIndex, testType, score, percentage, passed });
  console.log('saveExamResult パラメータ詳細:', {
    userId: userId,
    lessonId: lessonId,
    sectionIndex: sectionIndex,
    testType: testType,
    score: score,
    percentage: percentage,
    passed: passed,
    answersKeys: answers ? Object.keys(answers) : 'undefined',
    testDataQuestions: testData ? testData.questions?.length : 'undefined'
  });
  
  const connection = await pool.getConnection();
  
  try {
    // トランザクション開始
    await connection.beginTransaction();
    console.log('トランザクション開始');

    // ユーザー情報とレッスン情報を取得
    console.log('ユーザー情報取得中...');
    const [userInfo] = await connection.execute(`
      SELECT ua.id, ua.name, ua.login_code, c.token as company_token, s.token as satellite_token
      FROM user_accounts ua
      LEFT JOIN companies c ON ua.company_id = c.id
      LEFT JOIN satellites s ON (
        JSON_CONTAINS(ua.satellite_ids, JSON_QUOTE(s.id)) OR 
        JSON_CONTAINS(ua.satellite_ids, CAST(s.id AS JSON)) OR
        JSON_SEARCH(ua.satellite_ids, 'one', CAST(s.id AS CHAR)) IS NOT NULL
      )
      WHERE ua.id = ?
    `, [userId]);
    console.log('ユーザー情報:', userInfo);

    console.log('レッスン情報取得中...');
    const [lessonInfo] = await connection.execute(`
      SELECT title FROM lessons WHERE id = ?
    `, [lessonId]);
    console.log('レッスン情報:', lessonInfo);

    if (userInfo.length === 0 || lessonInfo.length === 0) {
      throw new Error('ユーザーまたはレッスン情報が見つかりません');
    }

    const user = userInfo[0];
    const lesson = lessonInfo[0];

    // MD形式の採点結果を生成
    const markdownContent = generateExamResultMarkdown({
      user,
      lesson,
      testType,
      sectionIndex,
      testData,
      answers,
      score,
      percentage,
      passed
    });

    // S3キーを生成（doc/{企業トークン}/{拠点トークン}/{利用者トークン}/exam-result/）
    const companyToken = user.company_token || 'UNKNOWN';
    const satelliteToken = user.satellite_token || 'UNKNOWN';
    const userToken = user.login_code;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `exam-result-${lessonId}-${testType}-${timestamp}.md`;
    const s3Key = `doc/${companyToken}/${satelliteToken}/${userToken}/exam-result/${fileName}`;

    // S3にアップロード（指定したキーを使用）
    console.log('S3アップロード開始...');
    const fileBuffer = Buffer.from(markdownContent, 'utf8');
    
    const { s3 } = require('../config/s3');
    const uploadParams = {
      Bucket: process.env.AWS_S3_BUCKET || 'studysphere',
      Key: s3Key,
      Body: fileBuffer,
      ContentType: 'text/markdown',
      Metadata: {
        'original-name': Buffer.from(fileName, 'utf8').toString('base64'),
        'upload-date': new Date().toISOString(),
        'lesson-id': lessonId.toString(),
        'user-id': userId.toString(),
        'test-type': testType,
        'exam-result': 'true'
      }
    };

    console.log('S3アップロードパラメータ:', { Bucket: uploadParams.Bucket, Key: uploadParams.Key });
    await s3.upload(uploadParams).promise();
    console.log('S3アップロード完了');
    const actualS3Key = s3Key;

    // データベースに記録
    console.log('データベースに記録中...');
    console.log('挿入データ:', {
      userId,
      lessonId,
      testType,
      sectionIndex,
      lessonTitle: lesson.title,
      actualS3Key,
      passed,
      score,
      totalQuestions: testData.questions.length,
      percentage
    });
    
    // パラメータの検証とnull変換
    const insertParams = [
      userId,
      lessonId,
      testType,
      sectionIndex !== null && sectionIndex !== undefined ? sectionIndex : null,
      lesson.title,
      actualS3Key,
      passed,
      score,
      testData.questions.length,
      percentage
    ];
    
    // undefinedパラメータのチェック
    const undefinedParams = insertParams.map((param, index) => ({
      index,
      value: param,
      type: typeof param,
      isUndefined: param === undefined
    })).filter(p => p.isUndefined);
    
    if (undefinedParams.length > 0) {
      console.error('SQL挿入パラメータにundefinedが含まれています:', undefinedParams);
      throw new Error(`SQL挿入パラメータにundefinedが含まれています: ${undefinedParams.map(p => `index ${p.index}`).join(', ')}`);
    }
    
    console.log('SQL挿入パラメータ:', insertParams.map((param, index) => ({
      index,
      value: param,
      type: typeof param,
      isUndefined: param === undefined
    })));
    
    const [result] = await connection.execute(`
      INSERT INTO exam_results (
        user_id, lesson_id, test_type, section_index, lesson_name,
        s3_key, passed, score, total_questions, percentage, exam_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, insertParams);
    console.log('データベース記録完了, ID:', result.insertId);

    // トランザクションコミット
    await connection.commit();
    console.log('トランザクションコミット完了');

    customLogger.info('Exam result saved successfully', {
      userId,
      lessonId,
      testType,
      score,
      percentage,
      passed,
      s3Key: actualS3Key,
      examResultId: result.insertId
    });

    return {
      id: result.insertId,
      s3Key: actualS3Key
    };

  } catch (error) {
    // トランザクションロールバック
    console.error('saveExamResultエラー:', error);
    await connection.rollback();
    customLogger.error('Failed to save exam result', {
      error: error.message,
      userId,
      lessonId,
      testType
    });
    throw error;
  } finally {
    connection.release();
  }
}

// MD形式の採点結果を生成する関数
function generateExamResultMarkdown({ user, lesson, testType, sectionIndex, testData, answers, score, percentage, passed }) {
  const now = new Date();
  const japanTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
  const examDate = japanTime.toISOString().replace('T', ' ').substring(0, 19);

  let markdown = `# 試験結果レポート\n\n`;
  markdown += `## 基本情報\n`;
  markdown += `- **受験者**: ${user.name} (${user.login_code})\n`;
  markdown += `- **レッスン名**: ${lesson.title}\n`;
  markdown += `- **テスト種別**: ${testType === 'section' ? 'セクションテスト' : '総合テスト'}\n`;
  if (testType === 'section' && sectionIndex !== null) {
    markdown += `- **セクション番号**: ${sectionIndex + 1}\n`;
  }
  markdown += `- **受験日時**: ${examDate}\n`;
  markdown += `- **合否**: ${passed ? '合格' : '不合格'}\n`;
  markdown += `- **得点**: ${score}/${testData.questions.length} (${percentage}%)\n\n`;

  markdown += `## 問題別詳細\n\n`;
  
  console.log('MDファイル生成時のtestData:', {
    hasTestData: !!testData,
    hasQuestions: !!testData?.questions,
    questionsLength: testData?.questions?.length,
    testDataKeys: testData ? Object.keys(testData) : null,
    firstQuestion: testData?.questions?.[0]
  });
  
  if (testData?.questions && testData.questions.length > 0) {
    testData.questions.forEach((question, index) => {
    const userAnswer = answers[question.id];
    const isCorrect = userAnswer === question.correctAnswer;
    
    console.log(`問題 ${index + 1} のMD生成:`, {
      questionId: question.id,
      userAnswer,
      correctAnswer: question.correctAnswer,
      isCorrect,
      hasOptions: !!question.options,
      optionsLength: question.options?.length
    });
    
    markdown += `### 問題 ${index + 1}\n`;
    markdown += `**問題文**: ${question.question}\n\n`;
    
    markdown += `**選択肢**:\n`;
    question.options.forEach((option, optionIndex) => {
      let marker = '';
      if (optionIndex === question.correctAnswer) {
        marker = ' ✅ (正答)';
      }
      if (optionIndex === userAnswer) {
        marker += ' 👤 (解答)';
      }
      markdown += `${optionIndex + 1}. ${option}${marker}\n`;
    });
    
    markdown += `\n**結果**: ${isCorrect ? '正解' : '不正解'}\n\n`;
    markdown += `---\n\n`;
    });
  } else {
    markdown += `問題データが見つかりません。\n\n`;
  }

  markdown += `## 採点サマリー\n`;
  markdown += `- **正解数**: ${score}問\n`;
  markdown += `- **不正解数**: ${testData.questions.length - score}問\n`;
  markdown += `- **正答率**: ${percentage}%\n`;
  markdown += `- **合格基準**: 90%以上（全問正解または1問誤答まで）\n`;
  markdown += `- **判定結果**: ${passed ? '合格' : '不合格'}\n\n`;

  markdown += `---\n`;
  markdown += `*このレポートは自動生成されました。*\n`;
  markdown += `*生成日時: ${examDate}*\n`;

  return markdown;
}

// 指導員用：学生のレッスン進捗とテスト結果を取得
router.get('/instructor/student/:studentId/lesson-progress', async (req, res) => {
  try {
    const { studentId } = req.params;
    const connection = await pool.getConnection();
    
    try {
      // 学生のレッスン進捗を取得
      const [progressData] = await connection.execute(`
        SELECT 
          ulp.lesson_id,
          l.title as lesson_title,
          c.title as course_title,
          ulp.status,
          ulp.test_score,
          ulp.assignment_submitted,
          ulp.completed_at,
          ulp.created_at,
          ulp.updated_at
        FROM user_lesson_progress ulp
        JOIN lessons l ON ulp.lesson_id = l.id
        JOIN courses c ON l.course_id = c.id
        WHERE ulp.user_id = ?
        ORDER BY l.id ASC
      `, [studentId]);
      
      // 学生情報を取得
      const [studentInfo] = await connection.execute(`
        SELECT id, name, login_code, email
        FROM user_accounts
        WHERE id = ?
      `, [studentId]);
      
      res.json({
        success: true,
        data: {
          student: studentInfo[0],
          progress: progressData
        }
      });
      
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('学生進捗取得エラー:', error);
    res.status(500).json({
      success: false,
      message: '学生進捗の取得に失敗しました'
    });
  }
});

// 指導員用：レッスン完了の承認
router.post('/instructor/student/:studentId/lesson/:lessonId/approve', async (req, res) => {
  try {
    const { studentId, lessonId } = req.params;
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // レッスン進捗を完了に更新
      await connection.execute(`
        UPDATE user_lesson_progress 
        SET status = 'completed', completed_at = NOW()
        WHERE user_id = ? AND lesson_id = ?
      `, [studentId, lessonId]);
      
      await connection.commit();
      
      res.json({
        success: true,
        message: 'レッスン完了を承認しました'
      });
      
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('レッスン承認エラー:', error);
    res.status(500).json({
      success: false,
      message: 'レッスン承認に失敗しました'
    });
  }
});

// 指導員用：未承認の合格テスト結果を取得
router.get('/instructor/pending-approvals', authenticateToken, async (req, res) => {
  try {
    const instructorId = req.user.user_id;
    const { satelliteId } = req.query;
    
    if (!satelliteId) {
      return res.status(400).json({
        success: false,
        message: '拠点IDが必要です'
      });
    }

    const connection = await pool.getConnection();
    
    try {
      // 未承認の合格テスト結果を取得
      // satelliteIdが数値か文字列かを判定して適切なクエリを実行
      let pendingApprovals;
      
      // 数値かどうかをチェック
      const isNumeric = !isNaN(satelliteId) && !isNaN(parseFloat(satelliteId));
      console.log('satelliteId判定:', { satelliteId, isNumeric, type: typeof satelliteId });
      
      if (isNumeric) {
        // 数値の場合
        [pendingApprovals] = await connection.execute(`
          SELECT 
            er.id as exam_result_id,
            er.user_id,
            er.lesson_id,
            er.lesson_name,
            er.test_type,
            er.passed,
            er.score,
            er.total_questions,
            er.percentage,
            er.exam_date,
            ua.name as student_name,
            l.has_assignment,
            ulp.instructor_approved,
            ulp.assignment_submitted,
            ulp.status as lesson_status
          FROM exam_results er
          JOIN user_accounts ua ON er.user_id = ua.id
          JOIN lessons l ON er.lesson_id = l.id
          LEFT JOIN user_lesson_progress ulp ON er.user_id = ulp.user_id AND er.lesson_id = ulp.lesson_id
          WHERE er.passed = 1 
          AND er.test_type = 'lesson'
          AND (
            JSON_CONTAINS(ua.satellite_ids, JSON_QUOTE(?)) OR 
            JSON_CONTAINS(ua.satellite_ids, CAST(? AS JSON)) OR
            JSON_SEARCH(ua.satellite_ids, 'one', CAST(? AS CHAR)) IS NOT NULL
          )
          AND (ulp.instructor_approved = 0 OR ulp.instructor_approved IS NULL)
          AND ulp.status != 'completed'
          ORDER BY er.exam_date DESC
        `, [satelliteId, satelliteId, satelliteId]);
      } else {
        // 文字列の場合（office001など）
        [pendingApprovals] = await connection.execute(`
          SELECT 
            er.id as exam_result_id,
            er.user_id,
            er.lesson_id,
            er.lesson_name,
            er.test_type,
            er.passed,
            er.score,
            er.total_questions,
            er.percentage,
            er.exam_date,
            ua.name as student_name,
            l.has_assignment,
            ulp.instructor_approved,
            ulp.assignment_submitted,
            ulp.status as lesson_status
          FROM exam_results er
          JOIN user_accounts ua ON er.user_id = ua.id
          JOIN lessons l ON er.lesson_id = l.id
          LEFT JOIN user_lesson_progress ulp ON er.user_id = ulp.user_id AND er.lesson_id = ulp.lesson_id
          WHERE er.passed = 1 
          AND er.test_type = 'lesson'
          AND (
            JSON_CONTAINS(ua.satellite_ids, JSON_QUOTE(?)) OR
            JSON_SEARCH(ua.satellite_ids, 'one', ?) IS NOT NULL
          )
          AND (ulp.instructor_approved = 0 OR ulp.instructor_approved IS NULL)
          AND ulp.status != 'completed'
          ORDER BY er.exam_date DESC
        `, [satelliteId, satelliteId]);
      }
      
      res.json({
        success: true,
        data: pendingApprovals
      });
      
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('未承認合格テスト取得エラー:', error);
    res.status(500).json({
      success: false,
      message: '未承認合格テストの取得に失敗しました'
    });
  }
});

// 指導員用：テスト合格承認
router.post('/instructor/approve-test', authenticateToken, async (req, res) => {
  try {
    const instructorId = req.user.user_id;
    const { examResultId, studentId, lessonId } = req.body;
    
    if (!examResultId || !studentId || !lessonId) {
      return res.status(400).json({
        success: false,
        message: '必要なパラメータが不足しています'
      });
    }

    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // テスト結果とレッスン情報を取得（総合テストかどうかと提出物の有無を確認）
      const [testAndLessonInfo] = await connection.execute(`
        SELECT 
          er.test_type,
          l.has_assignment
        FROM exam_results er
        JOIN lessons l ON er.lesson_id = l.id
        WHERE er.id = ? AND er.lesson_id = ? AND er.user_id = ?
      `, [examResultId, lessonId, studentId]);
      
      if (testAndLessonInfo.length === 0) {
        throw new Error('テスト結果またはレッスン情報が見つかりません');
      }
      
      const { test_type, has_assignment } = testAndLessonInfo[0];
      
      // レッスンテストのみ承認可能
      if (test_type !== 'lesson') {
        throw new Error('セクションテストは承認の対象外です');
      }
      
      
      // 現在の進捗状況を取得
      const [currentProgress] = await connection.execute(`
        SELECT 
          instructor_approved,
          assignment_submitted,
          status
        FROM user_lesson_progress 
        WHERE user_id = ? AND lesson_id = ?
      `, [studentId, lessonId]);
      
      let shouldComplete = false;
      
      if (currentProgress.length === 0) {
        // 進捗レコードが存在しない場合は作成
        await connection.execute(`
          INSERT INTO user_lesson_progress 
          (user_id, lesson_id, status, instructor_approved, instructor_approved_at, instructor_id)
          VALUES (?, ?, 'in_progress', 1, NOW(), ?)
        `, [studentId, lessonId, instructorId]);
      } else {
        // 既存の進捗レコードを更新
        const progress = currentProgress[0];
        
        if (has_assignment) {
          // 提出物がある場合：テスト承認のみ
          await connection.execute(`
            UPDATE user_lesson_progress 
            SET instructor_approved = 1, instructor_approved_at = NOW(), instructor_id = ?
            WHERE user_id = ? AND lesson_id = ?
          `, [instructorId, studentId, lessonId]);
          
          // 提出物も承認済みの場合は完了にする
          if (progress.assignment_submitted) {
            shouldComplete = true;
          }
        } else {
          // 提出物がない場合：承認で完了
          shouldComplete = true;
        }
      }
      
      // 完了処理
      if (shouldComplete) {
        await connection.execute(`
          UPDATE user_lesson_progress 
          SET status = 'completed', completed_at = NOW()
          WHERE user_id = ? AND lesson_id = ?
        `, [studentId, lessonId]);
      }
      
      await connection.commit();
      
      res.json({
        success: true,
        message: shouldComplete ? 'レッスンが完了しました' : 'テスト合格を承認しました',
        completed: shouldComplete
      });
      
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('テスト承認エラー:', error);
    res.status(500).json({
      success: false,
      message: 'テスト承認に失敗しました'
    });
  }
});

module.exports = router;


