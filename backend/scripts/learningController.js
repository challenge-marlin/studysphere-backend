const { customLogger } = require('../utils/logger');
const { pool } = require('../utils/database');
const { s3Utils } = require('../config/s3');

// 利用者の学習進捗を取得
const getUserProgress = async (req, res) => {
  const { userId } = req.params;
  const connection = await pool.getConnection();
  
  try {
    // 利用者のコース進捗を取得
    const [courseProgress] = await connection.execute(`
      SELECT 
        uc.*,
        c.title as course_title,
        c.description as course_description,
        c.category as course_category,
        COUNT(l.id) as total_lessons,
        COUNT(CASE WHEN ulp.status IN ('completed', 'in_progress') THEN 1 END) as completed_lessons
      FROM user_courses uc
      JOIN courses c ON uc.course_id = c.id
      LEFT JOIN lessons l ON c.id = l.course_id AND l.status = 'active'
      LEFT JOIN user_lesson_progress ulp ON uc.user_id = ulp.user_id AND l.id = ulp.lesson_id
      WHERE uc.user_id = ? AND uc.status = 'active'
      GROUP BY uc.id, c.id
      ORDER BY c.order_index ASC
    `, [userId]);

    // 各コースのレッスン進捗詳細を取得
    for (let course of courseProgress) {
      const [lessonProgress] = await connection.execute(`
        SELECT 
          l.id,
          l.title,
          l.description,
          l.order_index,
          COALESCE(ulp.status, 'not_started') as status,
          ulp.completed_at,
          ulp.test_score,
          ulp.assignment_submitted
        FROM lessons l
        LEFT JOIN user_lesson_progress ulp ON l.id = ulp.lesson_id AND ulp.user_id = ?
        WHERE l.course_id = ? AND l.status = 'active'
        ORDER BY l.order_index ASC
      `, [userId, course.course_id]);
      
      course.lessons = lessonProgress;
      
      // より詳細な進捗率計算
      if (course.total_lessons > 0) {
        const completedLessons = course.completed_lessons;
        const inProgressLessons = lessonProgress.filter(l => l.status === 'in_progress').length;
        console.log(`📊 getUserProgress進捗計算: courseId=${course.course_id}, total=${course.total_lessons}, completed=${completedLessons}, in_progress=${inProgressLessons}`);
        
        // completed は100%、in_progress は50%として計算
        const weightedProgress = completedLessons + (inProgressLessons * 0.5);
        course.progress_percentage = Math.round((weightedProgress / course.total_lessons) * 10000) / 100; // 小数点第2位まで
        
        console.log(`📈 getUserProgress進捗率計算: weightedProgress=${weightedProgress}, progressPercentage=${course.progress_percentage}%`);
        
        // user_coursesテーブルの進捗率を自動更新
        try {
          await connection.execute(`
            UPDATE user_courses 
            SET progress_percentage = ?, updated_at = NOW()
            WHERE user_id = ? AND course_id = ?
          `, [course.progress_percentage, userId, course.course_id]);
        } catch (updateError) {
          customLogger.warn('Failed to update user_courses progress_percentage', {
            error: updateError.message,
            userId,
            courseId: course.course_id
          });
        }
      } else {
        course.progress_percentage = 0;
      }
    }

    // 全コースの進捗率を一括更新（データベースの整合性を保つため）
    try {
      for (const course of courseProgress) {
        await connection.execute(`
          UPDATE user_courses 
          SET progress_percentage = ?, updated_at = NOW()
          WHERE user_id = ? AND course_id = ?
        `, [course.progress_percentage, userId, course.course_id]);
      }
      customLogger.info('All course progress percentages updated in database', {
        userId,
        updatedCourses: courseProgress.length
      });
    } catch (bulkUpdateError) {
      customLogger.warn('Failed to bulk update course progress percentages', {
        error: bulkUpdateError.message,
        userId
      });
    }

    customLogger.info('User progress retrieved successfully', {
      userId,
      courseCount: courseProgress.length
    });

    res.json({
      success: true,
      data: courseProgress
    });
  } catch (error) {
    customLogger.error('Failed to retrieve user progress', {
      error: error.message,
      userId
    });
    
    res.status(500).json({
      success: false,
      message: '学習進捗の取得に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// 特定コースの進捗を取得
const getCourseProgress = async (req, res) => {
  const { userId, courseId } = req.params;
  const connection = await pool.getConnection();
  
  try {
    // コース情報と進捗を取得
    const [courseRows] = await connection.execute(`
      SELECT 
        c.*,
        uc.status as enrollment_status,
        uc.start_date,
        uc.completion_date
      FROM courses c
      JOIN user_courses uc ON c.id = uc.course_id
      WHERE c.id = ? AND uc.user_id = ? AND uc.status = 'active'
    `, [courseId, userId]);

    if (courseRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'コースが見つかりません'
      });
    }

    const course = courseRows[0];

    // レッスン進捗を取得
    const [lessonProgress] = await connection.execute(`
      SELECT 
        l.*,
        COALESCE(ulp.status, 'not_started') as progress_status,
        ulp.completed_at,
        ulp.test_score,
        ulp.assignment_submitted,
        ulp.assignment_submitted_at
      FROM lessons l
      LEFT JOIN user_lesson_progress ulp ON l.id = ulp.lesson_id AND ulp.user_id = ?
      WHERE l.course_id = ? AND l.status = 'active'
      ORDER BY l.order_index ASC
    `, [userId, courseId]);

    course.lessons = lessonProgress;

    // 全体の進捗率を計算
    const totalLessons = lessonProgress.length;
    const completedLessons = lessonProgress.filter(l => l.progress_status === 'completed').length;
    const inProgressLessons = lessonProgress.filter(l => l.progress_status === 'in_progress').length;
    // completed は100%、in_progress は50%として計算
    const weightedProgress = completedLessons + (inProgressLessons * 0.5);
    course.overall_progress = totalLessons > 0 ? Math.round((weightedProgress / totalLessons) * 10000) / 100 : 0; // 小数点第2位まで
    
    // user_coursesテーブルの進捗率を自動更新
    try {
      await connection.execute(`
        UPDATE user_courses 
        SET progress_percentage = ?, updated_at = NOW()
        WHERE user_id = ? AND course_id = ?
      `, [course.overall_progress, userId, courseId]);
    } catch (updateError) {
      customLogger.warn('Failed to update user_courses progress_percentage', {
        error: updateError.message,
        userId,
        courseId
      });
    }

    customLogger.info('Course progress retrieved successfully', {
      userId,
      courseId,
      progress: course.overall_progress
    });

    res.json({
      success: true,
      data: course
    });
  } catch (error) {
    customLogger.error('Failed to retrieve course progress', {
      error: error.message,
      userId,
      courseId
    });
    
    res.status(500).json({
      success: false,
      message: 'コース進捗の取得に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// レッスン進捗を更新
const updateLessonProgress = async (req, res) => {
  const { userId, lessonId, status, testScore, assignmentSubmitted, instructorApproved, instructorId } = req.body;
  const connection = await pool.getConnection();
  
  try {
    // 既存の進捗を確認
    const [existingProgress] = await connection.execute(`
      SELECT * FROM user_lesson_progress 
      WHERE user_id = ? AND lesson_id = ?
    `, [userId, lessonId]);

    if (existingProgress.length > 0) {
      // 既存の進捗を更新
      await connection.execute(`
        UPDATE user_lesson_progress 
        SET 
          status = ?,
          test_score = ?,
          assignment_submitted = ?,
          instructor_approved = ?,
          instructor_id = ?,
          completed_at = CASE WHEN ? = 'completed' THEN NOW() ELSE completed_at END,
          assignment_submitted_at = CASE WHEN ? = 1 THEN assignment_submitted_at ELSE assignment_submitted_at END,
          instructor_approved_at = CASE WHEN ? = 1 THEN NOW() ELSE instructor_approved_at END,
          updated_at = NOW()
        WHERE user_id = ? AND lesson_id = ?
      `, [status, testScore, assignmentSubmitted, instructorApproved || false, instructorId, status, assignmentSubmitted, instructorApproved || false, userId, lessonId]);
    } else {
      // 新しい進捗を作成
      await connection.execute(`
        INSERT INTO user_lesson_progress (
          user_id, lesson_id, status, test_score, assignment_submitted, 
          instructor_approved, instructor_id, completed_at, assignment_submitted_at, instructor_approved_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 
          CASE WHEN ? = 'completed' THEN NOW() ELSE NULL END,
          CASE WHEN ? = 1 THEN NOW() ELSE NULL END,
          CASE WHEN ? = 1 THEN NOW() ELSE NULL END
        )
      `, [userId, lessonId, status, testScore, assignmentSubmitted, instructorApproved || false, instructorId, status, assignmentSubmitted, instructorApproved || false]);
    }

    // コース全体の進捗率を更新（エラーが発生しても処理を継続）
    try {
      console.log(`🔄 レッスン進捗更新後、コース進捗を更新: userId=${userId}, lessonId=${lessonId}`);
      await updateCourseProgress(connection, userId, lessonId);
    } catch (progressError) {
      console.error(`❌ コース進捗更新失敗: ${progressError.message}`);
      customLogger.warn('Course progress update failed, but lesson progress was updated', {
        error: progressError.message,
        userId,
        lessonId
      });
    }



    customLogger.info('Lesson progress updated successfully', {
      userId,
      lessonId,
      status,
      testScore,
      assignmentSubmitted,
      instructorApproved
    });

    res.json({
      success: true,
      message: '進捗が更新されました'
    });
  } catch (error) {
    customLogger.error('Failed to update lesson progress', {
      error: error.message,
      userId,
      lessonId
    });
    
    res.status(500).json({
      success: false,
      message: '進捗の更新に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// テスト結果を提出
const submitTestResult = async (req, res) => {
  // 認証されたユーザーIDを優先的に使用
  const userId = req.user?.user_id || req.body.userId;
  const { lessonId, answers, score, totalQuestions, testData, shuffledQuestions, testType } = req.body;
  const connection = await pool.getConnection();
  
  console.log('submitTestResult呼び出し:', {
    userId,
    lessonId,
    testType,
    score,
    totalQuestions,
    hasAnswers: !!answers,
    hasTestData: !!testData,
    hasShuffledQuestions: !!shuffledQuestions,
    testDataQuestions: testData?.questions?.length,
    shuffledQuestionsLength: shuffledQuestions?.length,
    authenticatedUser: req.user?.user_id,
    bodyUserId: req.body.userId,
    testDataStructure: testData ? Object.keys(testData) : null,
    shuffledQuestionsStructure: shuffledQuestions ? Object.keys(shuffledQuestions) : null
  });
  
  try {
    // パラメータの検証
    if (!userId) {
      throw new Error(`ユーザーIDが不足しています: userId=${userId}`);
    }
    if (!lessonId) {
      throw new Error(`レッスンIDが不足しています: lessonId=${lessonId}`);
    }
    
    // 使用する問題データを決定（採点計算とMDファイル生成で同じデータを使用）
    const questionsToUse = shuffledQuestions && shuffledQuestions.length > 0 ? shuffledQuestions : testData.questions;
    
    // scoreとtotalQuestionsが提供されていない場合は、answersとquestionsToUseから計算
    let calculatedScore = score;
    let calculatedTotalQuestions = totalQuestions;
    
    if (score === undefined && answers && questionsToUse && questionsToUse.length > 0) {
      // テストスコアを計算（シャッフルされた問題データを使用）
      calculatedTotalQuestions = questionsToUse.length;
      calculatedScore = 0;
      
      questionsToUse.forEach(question => {
        const userAnswer = answers[question.id];
        if (userAnswer !== undefined && userAnswer === question.correctAnswer) {
          calculatedScore++;
        }
      });
      
      console.log('テストスコア計算結果:', {
        calculatedScore,
        calculatedTotalQuestions,
        answersCount: Object.keys(answers).length,
        usingShuffledQuestions: shuffledQuestions && shuffledQuestions.length > 0
      });
    }
    
    // 最終的なパラメータの検証
    if (calculatedScore === undefined || calculatedTotalQuestions === undefined) {
      throw new Error(`スコア計算に失敗しました: score=${calculatedScore}, totalQuestions=${calculatedTotalQuestions}`);
    }
    
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
    
    // パーセンテージを計算
    const progressPercentage = Math.round((calculatedScore / calculatedTotalQuestions) * 100);
    
    // 使用する問題データを決定（既に決定済みのquestionsToUseを使用）
    const finalTestData = { ...testData, questions: questionsToUse };
    console.log('MDファイル生成用データ決定:', {
      hasShuffledQuestions: !!shuffledQuestions,
      hasTestData: !!testData,
      usingShuffled: shuffledQuestions && shuffledQuestions.length > 0,
      finalTestDataQuestions: finalTestData?.questions?.length
    });
    
    // MD形式の採点結果を生成（シャッフルされた問題データを使用）
    const markdownContent = generateExamResultMarkdown({
      user,
      lesson,
      testType: testType || 'section', // 実際のtestTypeパラメータを使用
      sectionIndex: req.body.sectionIndex || null,
      testData: finalTestData, // シャッフルされた問題データを優先使用
      answers,
      score: calculatedScore,
      percentage: progressPercentage,
      passed: calculatedScore >= (calculatedTotalQuestions - 1)
    });

    // S3に保存
    const companyToken = user.company_token || 'UNKNOWN';
    const satelliteToken = user.satellite_token || 'UNKNOWN';
    const userToken = user.login_code;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const testTypeSuffix = (testType || 'section') === 'lesson' ? 'lesson' : 'section';
    const fileName = `exam-result-${lessonId}-${testTypeSuffix}-${timestamp}.md`;
    const s3Key = `doc/${companyToken}/${satelliteToken}/${userToken}/exam-result/${fileName}`;

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
        'test-type': testType || 'section',
        'exam-result': 'true'
      }
    };

    console.log('S3アップロードパラメータ:', { Bucket: uploadParams.Bucket, Key: uploadParams.Key });
    await s3.upload(uploadParams).promise();
    console.log('S3アップロード完了');
    
    // exam_resultsテーブルに保存
    const examPercentage = Math.round((calculatedScore / calculatedTotalQuestions) * 100);
    const passed = calculatedScore >= (calculatedTotalQuestions - 1);
    
    const examInsertParams = [
      userId,
      lessonId,
      testType || 'section', // 実際のtestTypeパラメータを使用
      req.body.sectionIndex || null,
      lesson.title,
      s3Key,
      passed,
      calculatedScore,
      calculatedTotalQuestions,
      examPercentage
    ];
    
    console.log('exam_results挿入パラメータ:', examInsertParams.map((param, index) => ({
      index,
      value: param,
      type: typeof param,
      isUndefined: param === undefined
    })));
    console.log('testType確認:', { 
      testType, 
      testTypeFromBody: req.body.testType,
      finalTestType: testType || 'section'
    });
    
    const [examResult] = await connection.execute(`
      INSERT INTO exam_results (
        user_id, lesson_id, test_type, section_index, lesson_name,
        s3_key, passed, score, total_questions, percentage, exam_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, examInsertParams);
    console.log('exam_results記録完了, ID:', examResult.insertId);
    
    // user_lesson_progressテーブルにテスト結果を保存
    // 完了条件: レッスンテスト(30問中29問以上)、セクションテスト(10問中9問以上) + 指導員承認
    const testPassed = testType === 'lesson' 
      ? calculatedScore >= 29  // レッスンテスト: 30問中29問以上
      : progressPercentage >= 90;  // セクションテスト: 90%以上
    
    // テスト合格の場合のみ進捗を更新、指導員承認待ちの状態にする
    let newStatus = 'in_progress'; // デフォルトは進行中
    let completedAt = null;
    
    if (testPassed) {
      // テストは合格したが、指導員承認待ち
      newStatus = 'in_progress'; // 指導員承認まで完了にはしない
      console.log(`✅ テスト合格 (${progressPercentage}%) - 指導員承認待ち`);
    } else {
      // テスト不合格
      newStatus = 'in_progress'; // 再受験が必要
      console.log(`❌ テスト不合格 (${progressPercentage}%) - 再受験が必要`);
    }
    
    const insertParams = [userId, lessonId, newStatus, calculatedScore, completedAt];
    console.log('user_lesson_progress挿入パラメータ:', insertParams.map((param, index) => ({
      index,
      value: param,
      type: typeof param,
      isUndefined: param === undefined
    })));
    
    await connection.execute(`
      INSERT INTO user_lesson_progress (
        user_id, lesson_id, status, test_score, completed_at
      ) VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        status = VALUES(status),
        test_score = VALUES(test_score),
        completed_at = VALUES(completed_at),
        updated_at = NOW()
    `, insertParams);

    // コース全体の進捗率を更新（エラーが発生しても処理を継続）
    try {
      console.log(`🔄 レッスン進捗更新後、コース進捗を更新: userId=${userId}, lessonId=${lessonId}`);
      await updateCourseProgress(connection, userId, lessonId);
    } catch (progressError) {
      console.error(`❌ コース進捗更新失敗: ${progressError.message}`);
      customLogger.warn('Course progress update failed, but lesson progress was updated', {
        error: progressError.message,
        userId,
        lessonId
      });
    }

    // トランザクションコミット
    await connection.commit();
    console.log('トランザクションコミット完了');

    customLogger.info('Test result submitted successfully', {
      userId,
      lessonId,
      score: calculatedScore,
      totalQuestions: calculatedTotalQuestions,
      s3Key: s3Key,
      examResultId: examResult.insertId
    });

    res.json({
      success: true,
      message: 'テスト結果が提出されました',
      data: { 
        score: calculatedScore, 
        totalQuestions: calculatedTotalQuestions,
        s3Key: s3Key,
        examResultId: examResult.insertId
      }
    });
  } catch (error) {
    // トランザクションロールバック
    console.error('submitTestResultエラー:', error);
    await connection.rollback();
    
    customLogger.error('Failed to submit test result', {
      error: error.message,
      userId,
      lessonId
    });
    
    res.status(500).json({
      success: false,
      message: 'テスト結果の提出に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// 指導員によるレッスン完了承認
const approveLessonCompletion = async (req, res) => {
  const instructorId = req.user?.user_id;
  const { userId, lessonId } = req.body;
  const connection = await pool.getConnection();
  
  try {
    // 指導員権限チェック
    if (req.user?.role < 9) {
      return res.status(403).json({
        success: false,
        message: '指導員権限が必要です'
      });
    }
    
    // レッスン進捗を確認
    const [progress] = await connection.execute(`
      SELECT * FROM user_lesson_progress 
      WHERE user_id = ? AND lesson_id = ?
    `, [userId, lessonId]);
    
    if (progress.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'レッスン進捗が見つかりません'
      });
    }
    
    const currentProgress = progress[0];
    
    // テスト合格チェック（レッスンテスト: 29問以上、セクションテスト: 90%以上）
    const testPassed = currentProgress.test_score !== null && 
                      currentProgress.test_score >= 29;  // レッスンテスト: 30問中29問以上
    
    if (!testPassed) {
      return res.status(400).json({
        success: false,
        message: 'テストが合格していません。テスト合格後に承認してください。'
      });
    }
    
    // 指導員承認を実行
    await connection.execute(`
      UPDATE user_lesson_progress 
      SET 
        status = 'completed',
        instructor_approved = TRUE,
        instructor_approved_at = NOW(),
        instructor_id = ?,
        completed_at = NOW(),
        updated_at = NOW()
      WHERE user_id = ? AND lesson_id = ?
    `, [instructorId, userId, lessonId]);
    
    // コース全体の進捗率を更新
    try {
      await updateCourseProgress(connection, userId, lessonId);
    } catch (progressError) {
      console.error(`❌ コース進捗更新失敗: ${progressError.message}`);
    }
    
    customLogger.info('Lesson completion approved by instructor', {
      instructorId,
      userId,
      lessonId,
      testScore: currentProgress.test_score
    });
    
    res.json({
      success: true,
      message: 'レッスン完了を承認しました'
    });
    
  } catch (error) {
    customLogger.error('Failed to approve lesson completion', {
      error: error.message,
      instructorId,
      userId,
      lessonId
    });
    
    res.status(500).json({
      success: false,
      message: '承認処理に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

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
  if (sectionIndex !== null && sectionIndex !== undefined) {
    markdown += `- **セクション番号**: ${sectionIndex + 1}\n`;
  }
  markdown += `- **受験日時**: ${examDate}\n\n`;

  markdown += `## 採点結果\n`;
  markdown += `- **得点**: ${score}点\n`;
  markdown += `- **総問題数**: ${testData?.questions?.length || 0}問\n`;
  markdown += `- **正答率**: ${percentage}%\n`;
  markdown += `- **合否**: ${passed ? '合格' : '不合格'}\n\n`;

  markdown += `## 詳細採点\n\n`;
  
  console.log('MDファイル生成時のtestData:', {
    hasTestData: !!testData,
    hasQuestions: !!testData?.questions,
    questionsLength: testData?.questions?.length,
    testDataKeys: testData ? Object.keys(testData) : null
  });
  
  if (testData?.questions && testData.questions.length > 0) {
    testData.questions.forEach((question, index) => {
    const userAnswer = answers[question.id];
    const isCorrect = userAnswer !== undefined && userAnswer === question.correctAnswer;
    
    console.log(`問題 ${index + 1} の採点:`, {
      questionId: question.id,
      userAnswer,
      correctAnswer: question.correctAnswer,
      isCorrect,
      hasOriginalCorrectAnswer: question.originalCorrectAnswer !== undefined,
      hasOptions: !!question.options,
      optionsLength: question.options?.length
    });
    
    markdown += `### 問題 ${index + 1}\n`;
    markdown += `**問題**: ${question.question}\n\n`;
    
    question.options.forEach((option, optionIndex) => {
      const optionNumber = optionIndex + 1;
      let marker = '';
      if (optionNumber === question.correctAnswer + 1) { // correctAnswerは0ベースなので+1
        marker = ' ✅ (正答)';
      }
      if (userAnswer === optionIndex) { // userAnswerは0ベースのインデックス
        marker += isCorrect ? ' ✅ (あなたの回答)' : ' ❌ (あなたの回答)';
      }
      markdown += `${optionNumber}. ${option}${marker}\n`;
    });
    
    markdown += `\n**結果**: ${isCorrect ? '正解' : '不正解'}\n\n`;
    });
  } else {
    markdown += `問題データが見つかりません。\n\n`;
  }

  markdown += `---\n`;
  markdown += `*このレポートは自動生成されました。*\n`;

  return markdown;
}

// テスト結果を取得
const getTestResults = async (req, res) => {
  const { userId } = req.params;
  const connection = await pool.getConnection();
  
  try {
    const [results] = await connection.execute(`
      SELECT 
        ulp.lesson_id,
        l.title as lesson_title,
        c.title as course_title,
        ulp.test_score,
        ulp.completed_at,
        ulp.assignment_submitted
      FROM user_lesson_progress ulp
      JOIN lessons l ON ulp.lesson_id = l.id
      JOIN courses c ON l.course_id = c.id
      WHERE ulp.user_id = ? AND ulp.status = 'completed'
      ORDER BY ulp.completed_at DESC
    `, [userId]);

    customLogger.info('Test results retrieved successfully', {
      userId,
      resultCount: results.length
    });

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    customLogger.error('Failed to retrieve test results', {
      error: error.message,
      userId
    });
    
    res.status(500).json({
      success: false,
      message: 'テスト結果の取得に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// レッスンコンテンツを取得
const getLessonContent = async (req, res) => {
  const { lessonId } = req.params;
  const connection = await pool.getConnection();
  
  try {
    console.log(`=== レッスンコンテンツ取得開始: レッスンID ${lessonId} ===`);
    
    // レッスン基本情報を取得
    const [lessonRows] = await connection.execute(`
      SELECT 
        l.*,
        c.title as course_title
      FROM lessons l
      JOIN courses c ON l.course_id = c.id
      WHERE l.id = ? AND l.status = 'active'
    `, [lessonId]);

    if (lessonRows.length === 0) {
      console.log('❌ レッスンが見つかりません');
      return res.status(404).json({
        success: false,
        message: 'レッスンが見つかりません'
      });
    }

    const lesson = lessonRows[0];
    console.log('✅ レッスン基本情報取得成功:', {
      id: lesson.id,
      title: lesson.title,
      course_id: lesson.course_id,
      course_title: lesson.course_title,
      s3_key: lesson.s3_key
    });

    // データ整合性チェック
    if (lesson.id !== parseInt(lessonId)) {
      console.error(`❌ データ整合性エラー: 要求したレッスンID ${lessonId} とデータベースのレッスンID ${lesson.id} が一致しません`);
      return res.status(400).json({
        success: false,
        message: `データ整合性エラー: 要求したレッスンID ${lessonId} とデータベースのレッスンID ${lesson.id} が一致しません`
      });
    }

    // 関連する動画を取得
    console.log('動画情報を取得中...');
    const [videos] = await connection.execute(`
      SELECT * FROM lesson_videos 
      WHERE lesson_id = ? AND status = 'active'
      ORDER BY order_index ASC
    `, [lessonId]);

    lesson.videos = videos;
    console.log(`✅ 動画情報取得成功: ${videos.length}件`);

    // テキストファイルと動画の紐づけ情報を取得
    console.log('テキスト・動画リンク情報を取得中...');
    let textVideoLinks = [];
    try {
      const [linkRows] = await connection.execute(`
        SELECT 
          ltv.*,
          lv.title as video_title,
          lv.youtube_url,
          lv.description as video_description
        FROM lesson_text_video_links ltv
        LEFT JOIN lesson_videos lv ON ltv.video_id = lv.id
        WHERE ltv.lesson_id = ?
        ORDER BY ltv.link_order ASC
      `, [lessonId]);

      textVideoLinks = linkRows;
      lesson.textVideoLinks = textVideoLinks;
      console.log(`✅ テキスト・動画リンク情報取得成功: ${textVideoLinks.length}件`);
    } catch (linkError) {
      console.error('テキスト・動画リンク情報取得エラー:', linkError);
      customLogger.warn('Failed to retrieve text-video links', {
        error: linkError.message,
        lessonId
      });
      // リンク情報の取得に失敗しても、他のデータは返す
      lesson.textVideoLinks = [];
    }

    // S3からテキストファイルを取得
    if (lesson.s3_key) {
      console.log('S3からテキストファイルを取得中...', { s3Key: lesson.s3_key });
      try {
        const s3Result = await s3Utils.downloadFile(lesson.s3_key);
        console.log('S3ダウンロード結果:', s3Result);
        
        if (s3Result.success) {
          // ファイルの内容をテキストとして取得
          const fileContent = s3Result.data.toString('utf8');
          lesson.textContent = fileContent;
          
          // PDFの場合は、S3の署名付きURLを生成
          if (lesson.s3_key.toLowerCase().endsWith('.pdf')) {
            console.log('PDFファイルのため、署名付きURLを生成中...');
            
            // S3設定の確認
            if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_S3_BUCKET) {
              console.error('S3設定が不完全です:', {
                hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
                hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
                hasBucket: !!process.env.AWS_S3_BUCKET
              });
              lesson.pdfUrl = null;
            } else {
              try {
                const presignedUrl = await s3Utils.generatePresignedUrl(lesson.s3_key);
                if (presignedUrl.success) {
                  lesson.pdfUrl = presignedUrl.url;
                  console.log('署名付きURL生成完了:', presignedUrl.url.substring(0, 100) + '...');
                } else {
                  console.error('署名付きURL生成失敗:', presignedUrl.message);
                  lesson.pdfUrl = null;
                }
              } catch (urlError) {
                console.error('署名付きURL生成エラー:', urlError);
                customLogger.warn('Failed to generate presigned URL', {
                  error: urlError.message,
                  lessonId,
                  s3Key: lesson.s3_key
                });
                lesson.pdfUrl = null;
              }
            }
          }
        } else {
          console.warn('S3ダウンロード失敗:', s3Result.message);
          lesson.textContent = 'テキストファイルの読み込みに失敗しました。';
        }
      } catch (s3Error) {
        console.error('S3エラー詳細:', s3Error);
        customLogger.warn('S3からテキストファイルの取得に失敗', {
          error: s3Error.message,
          lessonId,
          s3Key: lesson.s3_key
        });
        // S3エラーが発生しても、他のデータは返す
        lesson.textContent = 'テキストファイルの読み込みに失敗しました。';
      }
    } else {
      console.log('s3_keyが設定されていません');
      lesson.textContent = 'テキストファイルが設定されていません。';
    }

    console.log('=== レッスンコンテンツ取得完了 ===');
    customLogger.info('Lesson content retrieved successfully', {
      lessonId,
      videoCount: videos.length,
      linkCount: textVideoLinks.length,
      hasTextContent: !!lesson.textContent
    });

    res.json({
      success: true,
      data: lesson
    });
  } catch (error) {
    console.error('=== エラーが発生しました ===');
    console.error('エラー詳細:', error);
    console.error('エラースタック:', error.stack);
    
    customLogger.error('Failed to retrieve lesson content', {
      error: error.message,
      lessonId
    });
    
    res.status(500).json({
      success: false,
      message: 'レッスンコンテンツの取得に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// 合格証明書データを取得
const getCertificateData = async (req, res) => {
  const { userId, lessonId, examResultId } = req.params;
  const connection = await pool.getConnection();
  
  try {
    
    // 試験結果とユーザー情報、レッスン情報を結合して取得（指導員と拠点管理者の名前も含む）
    const [results] = await connection.execute(`
      SELECT 
        er.id as exam_result_id,
        er.lesson_id,
        er.test_type,
        er.section_index,
        er.lesson_name,
        er.passed,
        er.score,
        er.total_questions,
        er.percentage,
        er.exam_date,
        er.created_at,
        ua.id as user_id,
        ua.name as student_name,
        ua.login_code as student_id,
        ua.instructor_id,
        l.title as lesson_title,
        c.title as course_title,
        comp.name as company_name,
        sat.name as office_name,
        sat.address as office_address,
        sat.phone as office_phone,
        sat.manager_ids,
        instructor.name as instructor_name
      FROM exam_results er
      JOIN user_accounts ua ON er.user_id = ua.id
      JOIN lessons l ON er.lesson_id = l.id
      JOIN courses c ON l.course_id = c.id
      LEFT JOIN companies comp ON ua.company_id = comp.id
      LEFT JOIN satellites sat ON JSON_UNQUOTE(JSON_EXTRACT(ua.satellite_ids, '$[0]')) = sat.id
      LEFT JOIN user_accounts instructor ON ua.instructor_id = instructor.id
      WHERE er.user_id = ? 
        AND er.lesson_id = ?
        AND er.passed = 1
        ${examResultId ? 'AND er.id = ?' : ''}
      ORDER BY er.exam_date DESC
      LIMIT 1
    `, examResultId ? [userId, lessonId, examResultId] : [userId, lessonId]);

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: '合格証明書データが見つかりません'
      });
    }

    const certificateData = results[0];
    
    // 拠点管理者の複数人取得
    let managerNames = [];
    if (certificateData.manager_ids) {
      try {
        let managerIds = [];
        
        // manager_idsの形式を判定してパース
        if (typeof certificateData.manager_ids === 'string') {
          // JSON文字列の場合
          if (certificateData.manager_ids.startsWith('[') || certificateData.manager_ids.startsWith('{')) {
            const parsed = JSON.parse(certificateData.manager_ids);
            managerIds = Array.isArray(parsed) ? parsed : [parsed];
          } else {
            // カンマ区切りの文字列の場合
            managerIds = certificateData.manager_ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
          }
        } else if (Array.isArray(certificateData.manager_ids)) {
          // 既に配列の場合
          managerIds = certificateData.manager_ids;
        } else if (typeof certificateData.manager_ids === 'number') {
          // 単一の数値の場合
          managerIds = [certificateData.manager_ids];
        }
        
        // 数値に変換
        managerIds = managerIds.map(id => parseInt(id)).filter(id => !isNaN(id));
        
        if (managerIds.length > 0) {
          const [managerResults] = await connection.execute(`
            SELECT name FROM user_accounts 
            WHERE id IN (${managerIds.map(() => '?').join(',')}) 
            AND role = 5
          `, managerIds);
          managerNames = managerResults.map(manager => manager.name);
        }
      } catch (error) {
        customLogger.warn('Failed to parse manager_ids', { 
          error: error.message, 
          manager_ids: certificateData.manager_ids,
          type: typeof certificateData.manager_ids
        });
      }
    }
    
    // 日本時間での日付フォーマット
    const examDate = new Date(certificateData.exam_date);
    const formattedDate = examDate.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Tokyo'
    });

    // 証明書IDを生成
    const certificateId = `CERT-${certificateData.lesson_id}-${certificateData.exam_result_id}`;

    customLogger.info('Certificate data retrieved successfully', {
      userId,
      lessonId,
      examResultId: certificateData.exam_result_id,
      certificateId
    });

    res.json({
      success: true,
      data: {
        certificateId,
        lessonNumber: certificateData.lesson_id,
        lessonTitle: certificateData.lesson_title,
        courseTitle: certificateData.course_title,
        score: certificateData.score,
        totalQuestions: certificateData.total_questions,
        percentage: certificateData.percentage,
        studentName: certificateData.student_name,
        studentId: certificateData.student_id,
        completionDate: formattedDate,
        examDate: certificateData.exam_date,
        testType: certificateData.test_type,
        sectionIndex: certificateData.section_index,
        companyName: certificateData.company_name || '',
        officeName: certificateData.office_name || '',
        officeAddress: certificateData.office_address || '',
        officePhone: certificateData.office_phone || '',
        instructorName: certificateData.instructor_name || '',
        managerNames: managerNames,
        organization: certificateData.office_name || ''
      }
    });
  } catch (error) {
    customLogger.error('Failed to retrieve certificate data', {
      error: error.message,
      userId,
      lessonId,
      examResultId
    });
    
    res.status(500).json({
      success: false,
      message: '合格証明書データの取得に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// ユーザーの全終了証を取得
const getUserCertificates = async (req, res) => {
  console.log('=== getUserCertificates function called ===');
  console.log('Request params:', req.params);
  console.log('Request URL:', req.url);
  
  const { userId } = req.params;
  
  customLogger.info('getUserCertificates called', { userId });
  
  const connection = await pool.getConnection();
  
  try {
    customLogger.info('Database connection established', { userId });
    
    console.log('=== getUserCertificates query parameters ===');
    console.log('userId:', userId);
    console.log('Searching for passed = 1 AND test_type = "lesson" records');
    
    // ユーザーの合格した試験結果を全て取得（指導員と拠点管理者の名前も含む）
    const [results] = await connection.execute(`
      SELECT 
        er.id as exam_result_id,
        er.lesson_id,
        er.test_type,
        er.section_index,
        er.lesson_name,
        er.passed,
        er.score,
        er.total_questions,
        er.percentage,
        er.exam_date,
        er.created_at,
        ua.id as user_id,
        ua.name as student_name,
        ua.login_code as student_id,
        ua.instructor_id,
        l.title as lesson_title,
        c.title as course_title,
        c.id as course_id,
        comp.name as company_name,
        sat.name as office_name,
        sat.address as office_address,
        sat.phone as office_phone,
        sat.manager_ids,
        instructor.name as instructor_name
      FROM exam_results er
      JOIN user_accounts ua ON er.user_id = ua.id
      JOIN lessons l ON er.lesson_id = l.id
      JOIN courses c ON l.course_id = c.id
      LEFT JOIN companies comp ON ua.company_id = comp.id
      LEFT JOIN satellites sat ON JSON_UNQUOTE(JSON_EXTRACT(ua.satellite_ids, '$[0]')) = sat.id
      LEFT JOIN user_accounts instructor ON ua.instructor_id = instructor.id
      WHERE er.user_id = ? 
        AND er.passed = 1
        AND er.test_type = 'lesson'
      ORDER BY er.exam_date DESC
    `, [userId]);

    customLogger.info('Query executed', { userId, resultCount: results.length });
    
    console.log('=== Raw query results ===');
    console.log('results.length:', results.length);
    console.log('results:', results);

    // 終了証データを整形
    const certificates = await Promise.all(results.map(async (certificateData) => {
      // 拠点管理者の複数人取得
      let managerNames = [];
      if (certificateData.manager_ids) {
        try {
          let managerIds = [];
          
          // manager_idsの形式を判定してパース
          if (typeof certificateData.manager_ids === 'string') {
            // JSON文字列の場合
            if (certificateData.manager_ids.startsWith('[') || certificateData.manager_ids.startsWith('{')) {
              const parsed = JSON.parse(certificateData.manager_ids);
              managerIds = Array.isArray(parsed) ? parsed : [parsed];
            } else {
              // カンマ区切りの文字列の場合
              managerIds = certificateData.manager_ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
            }
          } else if (Array.isArray(certificateData.manager_ids)) {
            // 既に配列の場合
            managerIds = certificateData.manager_ids;
          } else if (typeof certificateData.manager_ids === 'number') {
            // 単一の数値の場合
            managerIds = [certificateData.manager_ids];
          }
          
          // 数値に変換
          managerIds = managerIds.map(id => parseInt(id)).filter(id => !isNaN(id));
          
          if (managerIds.length > 0) {
            const [managerResults] = await connection.execute(`
              SELECT name FROM user_accounts 
              WHERE id IN (${managerIds.map(() => '?').join(',')}) 
              AND role = 5
            `, managerIds);
            managerNames = managerResults.map(manager => manager.name);
          }
        } catch (error) {
          customLogger.warn('Failed to parse manager_ids', { 
            error: error.message, 
            manager_ids: certificateData.manager_ids,
            type: typeof certificateData.manager_ids
          });
        }
      }

      // 日本時間での日付フォーマット
      const examDate = new Date(certificateData.exam_date);
      const formattedDate = examDate.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'Asia/Tokyo'
      });

      // 証明書IDを生成
      const certificateId = `CERT-${certificateData.lesson_id}-${certificateData.exam_result_id}`;

      return {
        certificateId,
        examResultId: certificateData.exam_result_id,
        lessonId: certificateData.lesson_id,
        lessonTitle: certificateData.lesson_title,
        courseId: certificateData.course_id,
        courseTitle: certificateData.course_title,
        score: certificateData.score,
        totalQuestions: certificateData.total_questions,
        percentage: certificateData.percentage,
        studentName: certificateData.student_name,
        studentId: certificateData.student_id,
        completionDate: formattedDate,
        examDate: certificateData.exam_date,
        testType: certificateData.test_type,
        sectionIndex: certificateData.section_index,
        companyName: certificateData.company_name || '',
        officeName: certificateData.office_name || '',
        officeAddress: certificateData.office_address || '',
        officePhone: certificateData.office_phone || '',
        instructorName: certificateData.instructor_name || '',
        managerNames: managerNames,
        organization: certificateData.office_name || ''
      };
    }));

    customLogger.info('User certificates retrieved successfully', {
      userId,
      certificateCount: certificates.length
    });

    console.log('=== getUserCertificates response ===');
    console.log('userId:', userId);
    console.log('certificates count:', certificates.length);
    console.log('certificates data:', certificates);

    res.json({
      success: true,
      data: certificates
    });
  } catch (error) {
    customLogger.error('Failed to retrieve user certificates', {
      error: error.message,
      userId
    });
    
    res.status(500).json({
      success: false,
      message: '終了証データの取得に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// コース全体の進捗率を更新（内部関数）
const updateCourseProgress = async (connection, userId, lessonId) => {
  try {
    console.log(`🔄 updateCourseProgress開始: userId=${userId}, lessonId=${lessonId}`);
    
    // レッスンが属するコースIDを取得
    const [courseRows] = await connection.execute(`
      SELECT course_id FROM lessons WHERE id = ?
    `, [lessonId]);

    if (courseRows.length === 0) {
      console.log(`❌ レッスンが見つかりません: lessonId=${lessonId}`);
      return;
    }

    const courseId = courseRows[0].course_id;
    console.log(`📚 コースID取得: courseId=${courseId}`);

    // コース全体の進捗率を計算（重み付け）
    const [progressRows] = await connection.execute(`
      SELECT 
        COUNT(*) as total_lessons,
        COUNT(CASE WHEN ulp.status = 'completed' THEN 1 END) as completed_lessons,
        COUNT(CASE WHEN ulp.status = 'in_progress' THEN 1 END) as in_progress_lessons
      FROM lessons l
      LEFT JOIN user_lesson_progress ulp ON l.id = ulp.lesson_id AND ulp.user_id = ?
      WHERE l.course_id = ? AND l.status = 'active'
    `, [userId, courseId]);

    if (progressRows.length > 0) {
      const { total_lessons, completed_lessons, in_progress_lessons } = progressRows[0];
      console.log(`📊 進捗計算: total=${total_lessons}, completed=${completed_lessons}, in_progress=${in_progress_lessons}`);
      
      // completed は100%、in_progress は50%として計算
      const weightedProgress = completed_lessons + (in_progress_lessons * 0.5);
      const progressPercentage = total_lessons > 0 
        ? Math.round((weightedProgress / total_lessons) * 10000) / 100 // 小数点第2位まで
        : 0;

      console.log(`📈 進捗率計算: weightedProgress=${weightedProgress}, progressPercentage=${progressPercentage}%`);

      // user_coursesテーブルの進捗率を更新
      const [updateResult] = await connection.execute(`
        UPDATE user_courses 
        SET 
          progress_percentage = ?,
          updated_at = NOW()
        WHERE user_id = ? AND course_id = ?
      `, [progressPercentage, userId, courseId]);
      
      console.log(`✅ 進捗率更新完了: affectedRows=${updateResult.affectedRows}`);
    } else {
      console.log(`❌ 進捗データが見つかりません`);
    }
  } catch (error) {
    customLogger.error('Failed to update course progress', {
      error: error.message,
      userId,
      lessonId
    });
  }
};

// 利用者の現在受講中レッスンを取得
const getCurrentLesson = async (req, res) => {
  const userId = req.user.user_id;
  const { courseId } = req.query;
  const connection = await pool.getConnection();
  
  try {
    let query = `
      SELECT 
        ulp.*,
        l.title as lesson_title,
        l.description as lesson_description,
        l.order_index as lesson_order,
        l.course_id,
        c.title as course_title,
        c.description as course_description,
        ulp.created_at as started_at
      FROM user_lesson_progress ulp
      JOIN lessons l ON ulp.lesson_id = l.id
      JOIN courses c ON l.course_id = c.id
      WHERE ulp.user_id = ? AND ulp.status = 'in_progress'
    `;
    
    const params = [userId];
    
    if (courseId) {
      query += ' AND l.course_id = ?';
      params.push(courseId);
    }
    
    // updated_atが最新のin_progressレッスンを取得（同じ時刻の場合はlesson_idが大きい方を優先）
    query += ' ORDER BY ulp.updated_at DESC, ulp.lesson_id DESC LIMIT 1';
    
    const [currentLessons] = await connection.execute(query, params);

    // 現在受講中レッスンがない場合は、コースの最初のレッスンを推奨
    if (currentLessons.length === 0 && courseId) {
      const [firstLesson] = await connection.execute(`
        SELECT 
          l.id as lesson_id,
          l.title as lesson_title,
          l.description as lesson_description,
          l.order_index as lesson_order,
          l.course_id,
          c.title as course_title,
          c.description as course_description,
          NOW() as started_at
        FROM lessons l
        JOIN courses c ON l.course_id = c.id
        WHERE l.course_id = ? AND l.status = 'active'
        ORDER BY l.order_index ASC
        LIMIT 1
      `, [courseId]);

      if (firstLesson.length > 0) {
        currentLessons.push(firstLesson[0]);
      }
    }

    customLogger.info('Current lesson retrieved successfully', {
      userId,
      courseId,
      count: currentLessons.length
    });

    res.json({
      success: true,
      data: currentLessons
    });
  } catch (error) {
    customLogger.error('Failed to retrieve current lesson', {
      error: error.message,
      userId,
      courseId: req.query.courseId
    });
    
    res.status(500).json({
      success: false,
      message: '現在受講中レッスンの取得に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// 利用者とコースの関連付けを作成
const assignCourseToUser = async (req, res) => {
  const { userId, courseId } = req.body;
  const connection = await pool.getConnection();
  
  try {
    console.log('コース割り当て処理開始:', { userId, courseId });
    
    // 既存の関連付けを確認
    const [existingAssignment] = await connection.execute(`
      SELECT * FROM user_courses 
      WHERE user_id = ? AND course_id = ?
    `, [userId, courseId]);

    console.log('既存の関連付け:', existingAssignment);

    if (existingAssignment.length > 0) {
      // 既存の関連付けがある場合は更新
      await connection.execute(`
        UPDATE user_courses 
        SET 
          status = 'active',
          start_date = NOW(),
          updated_at = NOW()
        WHERE user_id = ? AND course_id = ?
      `, [userId, courseId]);
      console.log('既存の関連付けを更新しました');
    } else {
      // 新しい関連付けを作成
      const insertResult = await connection.execute(`
        INSERT INTO user_courses (
          user_id, course_id, status, start_date, progress_percentage, 
          created_at, updated_at
        ) VALUES (?, ?, 'active', NOW(), 0, NOW(), NOW())
      `, [userId, courseId]);
      console.log('新しい関連付けを作成しました:', insertResult);
    }

    // コースの全レッスンの進捗データを作成
    const [lessons] = await connection.execute(`
      SELECT id FROM lessons 
      WHERE course_id = ? AND status = 'active' 
      ORDER BY order_index ASC
    `, [courseId]);

    console.log('コースのレッスン数:', lessons.length);

    if (lessons.length > 0) {
      // 各レッスンの進捗データを作成
      for (const lesson of lessons) {
        try {
          await connection.execute(`
            INSERT INTO user_lesson_progress (
              user_id, lesson_id, status, created_at, updated_at
            ) VALUES (?, ?, 'not_started', NOW(), NOW())
            ON DUPLICATE KEY UPDATE
              updated_at = NOW()
          `, [userId, lesson.id]);
          console.log(`レッスン ${lesson.id} の進捗データを作成/更新しました`);
        } catch (lessonError) {
          console.error(`レッスン ${lesson.id} の進捗データ作成エラー:`, lessonError);
        }
      }
    }

    // コース割り当て後の進捗率を計算して更新
    await updateCourseProgress(connection, userId, lessons[0]?.id || courseId);

    customLogger.info('Course assigned to user successfully', {
      userId,
      courseId,
      lessonsCount: lessons.length
    });

    res.json({
      success: true,
      message: 'コースが正常に割り当てられました',
      data: {
        userId,
        courseId,
        lessonsCount: lessons.length
      }
    });
  } catch (error) {
    console.error('コース割り当てエラー:', error);
    customLogger.error('Failed to assign course to user', {
      error: error.message,
      userId,
      courseId
    });
    
    res.status(500).json({
      success: false,
      message: 'コースの割り当てに失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

module.exports = {
  getUserProgress,
  updateLessonProgress,
  submitTestResult,
  getTestResults,
  getLessonContent,
  getCourseProgress,
  assignCourseToUser,
  getCurrentLesson,
  approveLessonCompletion,
  getCertificateData,
  getUserCertificates
};
