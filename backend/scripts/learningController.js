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
  const { userId, lessonId, status, testScore, assignmentSubmitted, instructorApproved, instructorId, forceUpdate, lastViewedSectionIndex, lastViewedSectionTextKey } = req.body;
  
  // 必須パラメータのバリデーション
  if (userId === undefined || userId === null) {
    customLogger.error('Failed to update lesson progress: userId is required', { userId, lessonId });
    return res.status(400).json({
      success: false,
      message: 'ユーザーIDは必須です'
    });
  }
  
  if (lessonId === undefined || lessonId === null) {
    customLogger.error('Failed to update lesson progress: lessonId is required', { userId, lessonId });
    return res.status(400).json({
      success: false,
      message: 'レッスンIDは必須です'
    });
  }
  
  // undefinedをnullに変換（MySQLのバインドパラメータエラーを防ぐ）
  const normalizedUserId = userId !== undefined ? userId : null;
  const normalizedLessonId = lessonId !== undefined ? lessonId : null;
  const normalizedStatus = status !== undefined ? status : null;
  const normalizedLastViewedSectionIndex =
    lastViewedSectionIndex !== undefined && lastViewedSectionIndex !== null && !Number.isNaN(Number(lastViewedSectionIndex))
      ? parseInt(lastViewedSectionIndex, 10)
      : null;
  const normalizedLastViewedSectionTextKey =
    typeof lastViewedSectionTextKey === 'string' && lastViewedSectionTextKey.trim().length > 0
      ? lastViewedSectionTextKey.trim()
      : null;
  
  const connection = await pool.getConnection();
  
  try {
    customLogger.info('Updating lesson progress', {
      userId: normalizedUserId,
      lessonId: normalizedLessonId,
      status: normalizedStatus,
      testScore,
      assignmentSubmitted,
      instructorApproved,
      forceUpdate,
      lastViewedSectionIndex: normalizedLastViewedSectionIndex,
      lastViewedSectionTextKey: normalizedLastViewedSectionTextKey
    });

    // 既存の進捗を確認
    const [existingProgress] = await connection.execute(`
      SELECT * FROM user_lesson_progress 
      WHERE user_id = ? AND lesson_id = ?
    `, [normalizedUserId, normalizedLessonId]);

    if (existingProgress.length > 0) {
      // forceUpdateフラグがある場合、同じステータスでも確実に更新されるように
      // 一旦別のステータスに変更してから元に戻す
      if (forceUpdate && existingProgress[0].status === status) {
        customLogger.info('Force update: changing status temporarily to ensure updated_at changes', {
          userId,
          lessonId,
          currentStatus: status
        });
        
        // 1回目: 一旦 not_started に変更
        await connection.execute(`
          UPDATE user_lesson_progress 
          SET status = 'not_started', updated_at = NOW()
          WHERE user_id = ? AND lesson_id = ?
        `, [normalizedUserId, normalizedLessonId]);
        
        customLogger.info('Force update: temporarily set to not_started');
        
        // 2回目: 元のステータスに戻しつつ、他のフィールドも更新
        const forceUpdateFields = ['status = ?'];
        const forceUpdateValues = [normalizedStatus];
        
        // testScoreがnullでない場合のみ更新
        if (testScore !== null && testScore !== undefined) {
          forceUpdateFields.push('test_score = ?');
          forceUpdateValues.push(testScore);
        }
        
        // assignmentSubmittedが明示的に指定された場合のみ更新
        if (assignmentSubmitted !== null && assignmentSubmitted !== undefined && assignmentSubmitted !== false) {
          forceUpdateFields.push('assignment_submitted = ?');
          forceUpdateValues.push(assignmentSubmitted);
          if (assignmentSubmitted === true || assignmentSubmitted === 1) {
            forceUpdateFields.push('assignment_submitted_at = NOW()');
          }
        }
        
        // instructorApprovedが明示的に指定された場合のみ更新
        if (instructorApproved !== null && instructorApproved !== undefined) {
          forceUpdateFields.push('instructor_approved = ?');
          forceUpdateValues.push(instructorApproved);
          if (instructorApproved === true || instructorApproved === 1) {
            forceUpdateFields.push('instructor_approved_at = NOW()');
            if (instructorId) {
              forceUpdateFields.push('instructor_id = ?');
              forceUpdateValues.push(instructorId);
            }
          }
        }
        
        // completedの場合は完了日時を設定
        if (normalizedStatus === 'completed') {
          forceUpdateFields.push('completed_at = NOW()');
        }

        // in_progress の場合は「最終アクセス日時」を更新（ミリ秒精度）
        if (normalizedStatus === 'in_progress') {
          forceUpdateFields.push('last_accessed_at = NOW(3)');
        }

        // 最後に閲覧したセクション（0始まり）
        if (normalizedLastViewedSectionIndex !== null && normalizedLastViewedSectionIndex >= 0) {
          forceUpdateFields.push('last_viewed_section_index = ?');
          forceUpdateValues.push(normalizedLastViewedSectionIndex);
        }

        // 最後に閲覧したセクションのテキストキー（S3キー）
        if (normalizedLastViewedSectionTextKey) {
          forceUpdateFields.push('last_viewed_section_text_key = ?');
          forceUpdateValues.push(normalizedLastViewedSectionTextKey);
        }
        
        // updated_atは常に更新
        forceUpdateFields.push('updated_at = NOW()');
        
        forceUpdateValues.push(normalizedUserId, normalizedLessonId);
        
        const forceUpdateQuery = `
          UPDATE user_lesson_progress 
          SET ${forceUpdateFields.join(', ')}
          WHERE user_id = ? AND lesson_id = ?
        `;
        
        await connection.execute(forceUpdateQuery, forceUpdateValues);
        
        customLogger.info('Force update: restored to original status with all fields updated', { 
          status,
          updatedFields: forceUpdateFields
        });
        
        // forceUpdateの場合は通常の更新をスキップ
        // コース進捗更新のみ実行
        try {
          console.log(`🔄 レッスン進捗更新後、コース進捗を更新: userId=${normalizedUserId}, lessonId=${normalizedLessonId}`);
          await updateCourseProgress(connection, normalizedUserId, normalizedLessonId);
        } catch (progressError) {
          console.error(`❌ コース進捗更新失敗: ${progressError.message}`);
          customLogger.warn('Course progress update failed, but lesson progress was updated', {
            error: progressError.message,
            userId: normalizedUserId,
            lessonId: normalizedLessonId
          });
        }

        customLogger.info('Lesson progress force updated successfully', {
          userId: normalizedUserId,
          lessonId: normalizedLessonId,
          status: normalizedStatus
        });

        res.json({
          success: true,
          message: '進捗が更新されました'
        });
        
        return; // 処理を終了
      }
      
      // 通常の更新処理（forceUpdateではない場合）
      // assignment_submittedとinstructor_approvedは明示的に指定された場合のみ更新
      const updateFields = [];
      const updateValues = [];
      
      updateFields.push('status = ?');
      updateValues.push(normalizedStatus);
      
      // testScoreがnullでない場合のみ更新
      if (testScore !== null && testScore !== undefined) {
        updateFields.push('test_score = ?');
        updateValues.push(testScore);
      }
      
      // assignmentSubmittedが明示的に指定された場合のみ更新
      if (assignmentSubmitted !== null && assignmentSubmitted !== undefined && assignmentSubmitted !== false) {
        updateFields.push('assignment_submitted = ?');
        updateValues.push(assignmentSubmitted);
        if (assignmentSubmitted === true || assignmentSubmitted === 1) {
          updateFields.push('assignment_submitted_at = NOW()');
        }
      }
      
      // instructorApprovedが明示的に指定された場合のみ更新
      if (instructorApproved !== null && instructorApproved !== undefined) {
        updateFields.push('instructor_approved = ?');
        updateValues.push(instructorApproved);
        if (instructorApproved === true || instructorApproved === 1) {
          updateFields.push('instructor_approved_at = NOW()');
          if (instructorId) {
            updateFields.push('instructor_id = ?');
            updateValues.push(instructorId);
          }
        }
      }
      
      // completedの場合は完了日時を設定
      if (normalizedStatus === 'completed') {
        updateFields.push('completed_at = NOW()');
      }

      // in_progress の場合は「最終アクセス日時」を更新（ミリ秒精度）
      if (normalizedStatus === 'in_progress') {
        updateFields.push('last_accessed_at = NOW(3)');
      }

      // 最後に閲覧したセクション（0始まり）
      if (normalizedLastViewedSectionIndex !== null && normalizedLastViewedSectionIndex >= 0) {
        updateFields.push('last_viewed_section_index = ?');
        updateValues.push(normalizedLastViewedSectionIndex);
      }

      // 最後に閲覧したセクションのテキストキー（S3キー）
      if (normalizedLastViewedSectionTextKey) {
        updateFields.push('last_viewed_section_text_key = ?');
        updateValues.push(normalizedLastViewedSectionTextKey);
      }
      
      // updated_atは常に更新
      updateFields.push('updated_at = NOW()');
      
      // WHERE句のパラメータ
      updateValues.push(normalizedUserId, normalizedLessonId);
      
      const updateQuery = `
        UPDATE user_lesson_progress 
        SET ${updateFields.join(', ')}
        WHERE user_id = ? AND lesson_id = ?
      `;
      
      const [updateResult] = await connection.execute(updateQuery, updateValues);
      
      customLogger.info('Existing lesson progress updated', {
        userId: normalizedUserId,
        lessonId: normalizedLessonId,
        updatedFields: updateFields,
        affectedRows: updateResult.affectedRows,
        changedRows: updateResult.changedRows
      });
    } else {
      // 新しい進捗を作成
      // undefinedをnullに変換（MySQLのバインドパラメータエラーを防ぐ）
      const normalizedTestScore = (testScore !== undefined && testScore !== null) ? testScore : null;
      const normalizedAssignmentSubmitted = (assignmentSubmitted !== undefined && assignmentSubmitted !== null) ? assignmentSubmitted : false;
      const normalizedInstructorApproved = (instructorApproved !== undefined && instructorApproved !== null) ? instructorApproved : false;
      const normalizedInstructorId = (instructorId !== undefined && instructorId !== null) ? instructorId : null;
      const normalizedInsertLastViewedSectionIndex = (normalizedLastViewedSectionIndex !== null && normalizedLastViewedSectionIndex >= 0)
        ? normalizedLastViewedSectionIndex
        : null;
      
      await connection.execute(`
        INSERT INTO user_lesson_progress (
          user_id, lesson_id, status, test_score, assignment_submitted, 
          instructor_approved, instructor_id, completed_at, assignment_submitted_at, instructor_approved_at,
          created_at, updated_at, last_accessed_at, last_viewed_section_index, last_viewed_section_text_key
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 
          CASE WHEN ? = 'completed' THEN NOW() ELSE NULL END,
          CASE WHEN ? = 1 THEN NOW() ELSE NULL END,
          CASE WHEN ? = 1 THEN NOW() ELSE NULL END,
          NOW(), NOW(),
          CASE WHEN ? = 'in_progress' THEN NOW(3) ELSE NULL END,
          ?,
          ?
        )
      `, [
        normalizedUserId, 
        normalizedLessonId, 
        normalizedStatus, 
        normalizedTestScore, 
        normalizedAssignmentSubmitted, 
        normalizedInstructorApproved, 
        normalizedInstructorId, 
        normalizedStatus, 
        normalizedAssignmentSubmitted, 
        normalizedInstructorApproved,
        normalizedStatus,
        normalizedInsertLastViewedSectionIndex,
        normalizedLastViewedSectionTextKey
      ]);
      
      customLogger.info('New lesson progress created', {
        userId: normalizedUserId,
        lessonId: normalizedLessonId,
        status: normalizedStatus
      });
    }

    // コース全体の進捗率を更新（エラーが発生しても処理を継続）
    try {
      console.log(`🔄 レッスン進捗更新後、コース進捗を更新: userId=${normalizedUserId}, lessonId=${normalizedLessonId}`);
      await updateCourseProgress(connection, normalizedUserId, normalizedLessonId);
    } catch (progressError) {
      console.error(`❌ コース進捗更新失敗: ${progressError.message}`);
      customLogger.warn('Course progress update failed, but lesson progress was updated', {
        error: progressError.message,
        userId: normalizedUserId,
        lessonId: normalizedLessonId
      });
    }



    customLogger.info('Lesson progress updated successfully', {
      userId: normalizedUserId,
      lessonId: normalizedLessonId,
      status: normalizedStatus,
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
      userId: normalizedUserId,
      lessonId: normalizedLessonId
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
          s.id IS NOT NULL AND ua.satellite_ids IS NOT NULL AND (
            JSON_CONTAINS(ua.satellite_ids,  JSON_QUOTE(CAST(s.id AS CHAR))) OR 
            JSON_CONTAINS(ua.satellite_ids, CAST(s.id AS JSON)) OR
            JSON_SEARCH(ua.satellite_ids, 'one', CAST(s.id AS CHAR)) IS NOT NULL
          )
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
    
    // 既存のレッスン進捗を確認（承認済みレッスンの再受験時にステータスを維持するため）
    const [existingProgressRows] = await connection.execute(`
      SELECT status, instructor_approved, completed_at, instructor_id, instructor_approved_at
      FROM user_lesson_progress
      WHERE user_id = ? AND lesson_id = ?
      FOR UPDATE
    `, [userId, lessonId]);

    // 承認済みレッスンの判定：instructor_approvedが1であれば承認済みとみなす
    // （提出物があるレッスンではstatusがcompletedでなくても承認済みの場合がある）
    const normalizeApprovalFlag = (value) => value === 1 || value === true || value === '1' || value === 'true';
    const approvedProgress = existingProgressRows.find(row => normalizeApprovalFlag(row.instructor_approved));
    const existingProgress = approvedProgress || existingProgressRows[0] || null;
    const isAlreadyApprovedLesson = !!approvedProgress;

    if (existingProgressRows.length > 1) {
      console.warn('⚠️ user_lesson_progressに複数レコードが存在します', {
        userId,
        lessonId,
        rowCount: existingProgressRows.length,
        hasApprovedRow: !!approvedProgress
      });
    }

    // テスト合格の場合のみ進捗を更新、指導員承認待ちの状態にする
    let newStatus = 'in_progress'; // デフォルトは進行中
    let completedAt = null;
    let instructorApproved = null;
    let instructorId = null;
    let instructorApprovedAt = null;
    
    if (isAlreadyApprovedLesson) {
      // 一度承認済みのレッスンは再受験しても承認状態と完了状態を維持
      // 復習で不合格になっても承認状態は維持される
      // statusが'completed'の場合は必ず'completed'を維持（完了から進行中に戻さない）
      if (existingProgress.status === 'completed') {
        newStatus = 'completed';
        // completed_atも維持（nullの場合は現在時刻を設定）
        completedAt = existingProgress.completed_at || new Date();
      } else {
        // statusが'completed'以外の場合は既存のstatusを維持
        newStatus = existingProgress.status || 'in_progress';
        completedAt = existingProgress?.completed_at || null;
      }
      // 承認済みレッスンの場合は、instructor_approvedを必ず1に設定（復習で不合格でも承認は解除しない）
      instructorApproved = 1;
      instructorId = existingProgress.instructor_id;
      instructorApprovedAt = existingProgress.instructor_approved_at;
      console.log('🛡️ 承認済みレッスンの再受験: ステータスと承認情報を保持します（復習で不合格でも承認は維持）', {
        existingStatus: existingProgress.status,
        newStatus: newStatus,
        instructor_approved: instructorApproved,
        testPassed: testPassed,
        completedAt: completedAt
      });
    } else if (testPassed) {
      // テストは合格したが、指導員承認待ち
      newStatus = 'in_progress'; // 指導員承認まで完了にはしない
      console.log(`✅ テスト合格 (${progressPercentage}%) - 指導員承認待ち`);
    } else {
      // テスト不合格
      newStatus = 'in_progress'; // 再受験が必要
      console.log(`❌ テスト不合格 (${progressPercentage}%) - 再受験が必要`);
    }
    
    // 承認済みレッスンの場合は承認情報も含めて更新
    if (isAlreadyApprovedLesson) {
      console.log('🛡️ 承認済みレッスンの更新パラメータ:', {
        userId,
        lessonId,
        newStatus,
        calculatedScore,
        completedAt,
        instructorApproved,
        instructorId,
        instructorApprovedAt,
        existingInstructorId: existingProgress.instructor_id,
        existingInstructorApprovedAt: existingProgress.instructor_approved_at
      });
      
      // 承認済みレッスンの場合は、必ず承認状態を1に維持（復習で不合格でも承認は解除しない）
      // まず、テストスコアとステータスのみ更新（承認情報は触らない）
      await connection.execute(`
        INSERT INTO user_lesson_progress (
          user_id, lesson_id, status, test_score, completed_at
        ) VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          status = VALUES(status),
          test_score = VALUES(test_score),
          completed_at = COALESCE(VALUES(completed_at), completed_at),
          updated_at = NOW()
      `, [userId, lessonId, newStatus, calculatedScore, completedAt]);
      
      // 承認情報を明示的に維持（既存値が存在する場合は保持、存在しない場合は設定した値を使用）
      await connection.execute(`
        UPDATE user_lesson_progress
        SET instructor_approved = 1,
            instructor_id = COALESCE(?, instructor_id),
            instructor_approved_at = COALESCE(?, instructor_approved_at),
            updated_at = NOW()
        WHERE user_id = ? AND lesson_id = ?
      `, [instructorId || existingProgress.instructor_id, 
          instructorApprovedAt || existingProgress.instructor_approved_at,
          userId, lessonId]);
      
      console.log('🛡️ 承認済みレッスンの承認状態を維持しました:', {
        userId,
        lessonId,
        instructor_approved: 1,
        instructor_id: instructorId || existingProgress.instructor_id,
        instructor_approved_at: instructorApprovedAt || existingProgress.instructor_approved_at
      });
    } else {
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
    }

    // コース全体の進捗率を更新（エラーが発生しても処理を継続）
    try {
      if (userId !== undefined && userId !== null && lessonId !== undefined && lessonId !== null) {
        console.log(`🔄 レッスン進捗更新後、コース進捗を更新: userId=${userId}, lessonId=${lessonId}`);
        await updateCourseProgress(connection, userId, lessonId);
      } else {
        customLogger.warn('updateCourseProgress skipped: userId or lessonId is undefined', { userId, lessonId });
      }
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
      if (userId !== undefined && userId !== null && lessonId !== undefined && lessonId !== null) {
        await updateCourseProgress(connection, userId, lessonId);
      } else {
        customLogger.warn('updateCourseProgress skipped: userId or lessonId is undefined', { userId, lessonId });
      }
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
  if (testType === 'section' && sectionIndex !== null) {
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
    markdown += `**問題**: ${question.question}\n\n`;
    
    question.options.forEach((option, optionIndex) => {
      const optionNumber = optionIndex + 1;
      let marker = '';
      if (optionIndex === question.correctAnswer) {
        marker = ' ✅ (正答)';
      }
      if (userAnswer === optionIndex) {
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

// テスト結果を取得（最新のレッスンテストのみ）
// 承認済みの合格結果を優先的に取得する
const getTestResults = async (req, res) => {
  const { userId } = req.params;
  const connection = await pool.getConnection();
  
  try {
    // user_lesson_progressテーブルと結合して、承認済みの合格結果を優先的に取得
    const [results] = await connection.execute(`
      SELECT 
        er.lesson_id,
        er.test_type,
        er.passed,
        er.score as test_score,
        er.total_questions,
        er.percentage,
        er.exam_date as completed_at,
        er.id as exam_result_id,
        l.title as lesson_title,
        ulp.instructor_approved,
        ulp.test_score as progress_test_score
      FROM exam_results er
      JOIN lessons l ON er.lesson_id = l.id
      LEFT JOIN user_lesson_progress ulp ON er.user_id = ulp.user_id AND er.lesson_id = ulp.lesson_id
      WHERE er.user_id = ? 
        AND er.test_type = 'lesson'
      ORDER BY er.lesson_id, 
        -- 承認済みの合格結果を優先（instructor_approved = 1 かつ passed = 1）
        CASE 
          WHEN ulp.instructor_approved = 1 AND er.passed = 1 THEN 0
          ELSE 1
        END,
        -- 次に合格結果を優先
        CASE 
          WHEN er.passed = 1 THEN 0
          ELSE 1
        END,
        -- 最後に日付でソート（新しい順）
        er.exam_date DESC
    `, [userId]);

    // レッスンごとに最適な結果を選択
    // 優先順位: 1. 承認済みの合格結果, 2. 合格結果（最新）, 3. 最新の結果
    const bestResults = {};
    results.forEach(result => {
      const lessonId = result.lesson_id;
      const isApprovedPassed = result.instructor_approved === 1 && result.passed === 1;
      const isPassed = result.passed === 1;
      
      if (!bestResults[lessonId]) {
        // 最初の結果を設定
        bestResults[lessonId] = result;
      } else {
        const current = bestResults[lessonId];
        const currentIsApprovedPassed = current.instructor_approved === 1 && current.passed === 1;
        const currentIsPassed = current.passed === 1;
        
        // 承認済みの合格結果を優先
        if (isApprovedPassed && !currentIsApprovedPassed) {
          bestResults[lessonId] = result;
        } 
        // 承認済みの合格結果がある場合は、それを維持（再受験の不合格結果で上書きしない）
        else if (currentIsApprovedPassed) {
          // 承認済みの合格結果は維持（何もしない）
        }
        // 承認済みの合格結果がない場合、合格結果を優先
        else if (!currentIsApprovedPassed && isPassed && !currentIsPassed) {
          bestResults[lessonId] = result;
        }
        // どちらも合格結果の場合、またはどちらも不合格の場合、最新のものを選択
        else if (!currentIsApprovedPassed && !currentIsPassed && !isPassed) {
          if (new Date(result.completed_at) > new Date(current.completed_at)) {
            bestResults[lessonId] = result;
          }
        }
      }
    });

    // user_lesson_progressテーブルから直接承認状態を取得（選択したテスト結果に関係なく承認状態を維持）
    const lessonIds = Object.keys(bestResults).map(id => parseInt(id));
    if (lessonIds.length > 0) {
      // IN句のプレースホルダーを動的に生成
      const placeholders = lessonIds.map(() => '?').join(',');
      const [progressRows] = await connection.execute(`
        SELECT lesson_id, instructor_approved
        FROM user_lesson_progress
        WHERE user_id = ? AND lesson_id IN (${placeholders})
      `, [userId, ...lessonIds]);
      
      // 承認状態をマップに変換
      const approvalMap = {};
      progressRows.forEach(row => {
        approvalMap[row.lesson_id] = row.instructor_approved === 1 || row.instructor_approved === true;
      });
      
      // 承認状態を各結果に適用
      Object.keys(bestResults).forEach(lessonId => {
        const lessonIdNum = parseInt(lessonId);
        if (approvalMap.hasOwnProperty(lessonIdNum)) {
          // user_lesson_progressの承認状態を優先（承認済みの場合は、テスト結果が不合格でも承認状態を維持）
          bestResults[lessonId].instructor_approved = approvalMap[lessonIdNum] ? 1 : 0;
        }
      });
    }

    // 配列に変換
    const finalResults = Object.values(bestResults).map(result => ({
      lesson_id: result.lesson_id,
      test_score: result.test_score,
      total_questions: result.total_questions,
      percentage: result.percentage,
      passed: result.passed,
      completed_at: result.completed_at,
      test_type: result.test_type,
      lesson_title: result.lesson_title,
      instructor_approved: result.instructor_approved === 1
    }));

    customLogger.info('Latest test results retrieved successfully from database', {
      userId,
      resultCount: finalResults.length
    });

    res.json({
      success: true,
      data: finalResults
    });
  } catch (error) {
    customLogger.error('Failed to retrieve latest test results', {
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
  // プレビュー等で user_id が取れないケースに備えてフォールバック
  const userId = Number(req.user?.user_id) || 0;
  const connection = await pool.getConnection();
  
  try {
    console.log(`=== レッスンコンテンツ取得開始: レッスンID ${lessonId} ===`);
    if (!req.user?.user_id) {
      console.warn('getLessonContent: req.user.user_id が未設定のため 0 を使用します', {
        hasUser: !!req.user,
        user: req.user
      });
    }
    
    // レッスン基本情報を取得
    // 注意: DBスキーマが古い環境だと last_viewed_section_* 列が存在しない可能性があるため、
    // Unknown column の場合は列を含めないクエリにフォールバックする。
    let lessonRows;
    try {
      const [rows] = await connection.execute(`
        SELECT 
          l.*,
          c.title as course_title,
          ulp.last_viewed_section_index as last_viewed_section_index,
          ulp.last_viewed_section_text_key as last_viewed_section_text_key
        FROM lessons l
        JOIN courses c ON l.course_id = c.id
        LEFT JOIN user_lesson_progress ulp
          ON ulp.lesson_id = l.id AND ulp.user_id = ?
        WHERE l.id = ? AND l.status = 'active'
      `, [userId, lessonId]);
      lessonRows = rows;
    } catch (e) {
      const msg = String(e?.message || e?.sqlMessage || '');
      const code = e?.code;
      const isBadField = code === 'ER_BAD_FIELD_ERROR' || msg.toLowerCase().includes('unknown column');
      if (isBadField && msg.toLowerCase().includes('last_viewed_section')) {
        console.warn('getLessonContent: DBに last_viewed_section_* が無いためフォールバックします', { message: msg });
        const [rows] = await connection.execute(`
          SELECT 
            l.*,
            c.title as course_title
          FROM lessons l
          JOIN courses c ON l.course_id = c.id
          WHERE l.id = ? AND l.status = 'active'
        `, [lessonId]);
        // 後続のフロント/ロジック互換のため、フィールドを補完
        lessonRows = rows.map(r => ({
          ...r,
          last_viewed_section_index: null,
          last_viewed_section_text_key: null
        }));
      } else {
        throw e;
      }
    }

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
      s3_key: lesson.s3_key,
      file_type: lesson.file_type,  // ← file_typeも出力
      file_size: lesson.file_size
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
          // ファイルタイプを判定（file_typeフィールドとS3キーの拡張子の両方をチェック）
          const s3KeyLower = lesson.s3_key.toLowerCase();
          const fileTypeLower = (lesson.file_type || '').toLowerCase();
          const isPDF = s3KeyLower.endsWith('.pdf') && (fileTypeLower === 'pdf' || fileTypeLower === 'application/pdf');
          
          // PDFの場合は、S3の署名付きURLを生成し、テキストコンテンツも取得する
          if (isPDF) {
            console.log('PDFファイルのため、署名付きURLを生成し、テキストコンテンツも取得中...');
            
            // PDFファイルのテキストコンテンツを取得
            try {
              console.log('PDFProcessorを読み込み中...');
              const PDFProcessor = require('./pdfProcessor');
              console.log('PDFProcessor読み込み完了、テキスト抽出開始...', {
                s3DataSize: s3Result.data?.length || 0,
                s3DataType: typeof s3Result.data
              });
              
              const extractedText = await PDFProcessor.extractTextFromPDF(s3Result.data);
              console.log('PDFテキスト抽出完了:', {
                extractedTextLength: extractedText?.length || 0,
                extractedTextType: typeof extractedText,
                extractedTextPreview: extractedText?.substring(0, 200) + '...'
              });
              
              if (extractedText && extractedText.trim().length > 0) {
                lesson.textContent = extractedText;
                console.log('PDFファイルのテキスト抽出成功:', {
                  textLength: extractedText.length,
                  textPreview: extractedText.substring(0, 200) + '...'
                });
              } else {
                lesson.textContent = null;
                console.warn('PDFファイルからテキストを抽出できませんでした:', {
                  extractedText: extractedText,
                  extractedTextLength: extractedText?.length || 0
                });
              }
            } catch (pdfError) {
              console.error('PDFファイルのテキスト抽出エラー:', {
                error: pdfError.message,
                stack: pdfError.stack,
                s3DataSize: s3Result.data?.length || 0
              });
              lesson.textContent = null;
            }
            
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
          } else {
            // テキストファイル（MD、TXT等）の場合は、そのままテキストコンテンツとして使用
            const fileExtension = s3KeyLower.split('.').pop();
            console.log('テキストファイルのため、内容をそのまま使用', { 
              fileType: lesson.file_type, 
              extension: fileExtension,
              s3Key: lesson.s3_key
            });
            const fileContent = s3Result.data.toString('utf8');
            lesson.textContent = fileContent;
            
            // MDファイルの場合はPDFのURLは不要
            lesson.pdfUrl = null;
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

    // 同じレッスンIDで複数回合格している場合、最高得点かつ最新の1回のみを返す
    const filteredCertificates = [];
    const certificateMap = new Map();
    
    // レッスンIDでグループ化
    for (const certificate of certificates) {
      const key = certificate.lessonId;
      
      if (!certificateMap.has(key)) {
        certificateMap.set(key, certificate);
      } else {
        const existing = certificateMap.get(key);
        // 既存のものと比較して、より良い結果を選択
        // 1. 得点が高い方を優先
        // 2. 得点が同じ場合は、より新しい方を優先
        if (
          certificate.score > existing.score ||
          (certificate.score === existing.score && 
           new Date(certificate.examDate) > new Date(existing.examDate))
        ) {
          certificateMap.set(key, certificate);
        }
      }
    }
    
    // Mapから配列に変換
    filteredCertificates.push(...certificateMap.values());

    customLogger.info('User certificates retrieved successfully', {
      userId,
      certificateCount: filteredCertificates.length,
      originalCount: certificates.length
    });

    console.log('=== getUserCertificates response ===');
    console.log('userId:', userId);
    console.log('certificates count (filtered):', filteredCertificates.length);
    console.log('certificates count (original):', certificates.length);
    console.log('certificates data:', filteredCertificates);

    res.json({
      success: true,
      data: filteredCertificates
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
    // undefinedチェック
    if (userId === undefined || userId === null) {
      customLogger.error('updateCourseProgress: userId is undefined or null', { userId, lessonId });
      return;
    }
    
    if (lessonId === undefined || lessonId === null) {
      customLogger.error('updateCourseProgress: lessonId is undefined or null', { userId, lessonId });
      return;
    }
    
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
    
    // 進行中（in_progress）のレッスンのみを対象とし、最終アクセス日時が最新のレッスンを取得
    // last_accessed_at が NULL の既存データは updated_at をフォールバックとして使用
    query += " ORDER BY COALESCE(ulp.last_accessed_at, ulp.updated_at) DESC, ulp.updated_at DESC, ulp.lesson_id DESC LIMIT 1";
    
    const [currentLessons] = await connection.execute(query, params);

    // 進行中のレッスンがない場合は、現在受講中タグは表示しない
    if (currentLessons.length === 0) {
      customLogger.info('No in-progress lessons found - no current lesson will be displayed', {
        userId,
        courseId
      });
    }

    customLogger.info('Current lesson retrieved successfully', {
      userId,
      courseId,
      count: currentLessons.length,
      currentLesson: currentLessons.length > 0 ? currentLessons[0].lesson_id : null
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

// レッスンまとめテスト（30問）合格後の「次のレッスン」を取得
// 条件: 同じコース、まだ30問テスト未合格、該当レッスンの次に order_index が大きいレッスン
const getNextLessonAfterPass = async (req, res) => {
  const userId = req.user?.user_id;
  const lessonId = parseInt(req.params.lessonId, 10);
  const connection = await pool.getConnection();

  try {
    if (!userId || !lessonId || isNaN(lessonId)) {
      return res.status(400).json({
        success: false,
        message: 'レッスンIDが不正です'
      });
    }

    const [currentRows] = await connection.execute(`
      SELECT course_id, order_index FROM lessons WHERE id = ? AND status = 'active'
    `, [lessonId]);

    if (currentRows.length === 0) {
      return res.json({ success: true, data: null });
    }

    const { course_id: courseId, order_index: currentOrder } = currentRows[0];

    const [nextRows] = await connection.execute(`
      SELECT l.id, l.title, l.course_id, l.has_assignment,
        COALESCE(ulp.assignment_submitted, 0) AS assignment_submitted
      FROM lessons l
      LEFT JOIN user_lesson_progress ulp ON l.id = ulp.lesson_id AND ulp.user_id = ?
      WHERE l.course_id = ? AND l.status = 'active'
        AND l.order_index > ?
        AND (ulp.test_score IS NULL OR ulp.test_score < 29)
      ORDER BY l.order_index ASC
      LIMIT 1
    `, [userId, courseId, currentOrder]);

    if (nextRows.length === 0) {
      return res.json({ success: true, data: null });
    }

    const next = nextRows[0];
    res.json({
      success: true,
      data: {
        id: next.id,
        title: next.title,
        courseId: next.course_id,
        hasAssignment: !!next.has_assignment,
        assignmentSubmitted: !!next.assignment_submitted
      }
    });
  } catch (error) {
    customLogger.error('getNextLessonAfterPass failed', { error: error.message, lessonId, userId: req.user?.user_id });
    res.status(500).json({
      success: false,
      message: '次のレッスンの取得に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// セクションまとめテスト（10問）合格後の「次のセクション」を取得
// 同一レッスン内で sectionIndex+1 が存在する場合に hasNext, nextSectionIndex, courseId を返す
const getNextSectionAfterPass = async (req, res) => {
  const lessonId = parseInt(req.params.lessonId, 10);
  const sectionIndex = parseInt(req.params.sectionIndex, 10);
  const connection = await pool.getConnection();

  try {
    if (!lessonId || isNaN(lessonId) || isNaN(sectionIndex) || sectionIndex < 0) {
      return res.status(400).json({
        success: false,
        message: 'レッスンIDまたはセクションインデックスが不正です'
      });
    }

    const [lessonRows] = await connection.execute(
      'SELECT course_id FROM lessons WHERE id = ? AND status = \'active\'',
      [lessonId]
    );
    if (lessonRows.length === 0) {
      return res.json({ success: true, data: null });
    }
    const courseId = lessonRows[0].course_id;

    // セクション数: lesson_text_video_links の件数（学習画面のセクションと同一定義に合わせる場合は getTextVideoLinks 相当の集計が必要）
    const [countRows] = await connection.execute(
      'SELECT COUNT(*) AS cnt FROM lesson_text_video_links WHERE lesson_id = ?',
      [lessonId]
    );
    const sectionCount = (countRows[0] && countRows[0].cnt) || 0;
    const nextIdx = sectionIndex + 1;
    const hasNext = nextIdx < sectionCount;

    if (!hasNext) {
      return res.json({ success: true, data: null });
    }

    res.json({
      success: true,
      data: {
        courseId,
        nextSectionIndex: nextIdx,
        hasNext: true
      }
    });
  } catch (error) {
    customLogger.error('getNextSectionAfterPass failed', {
      error: error.message,
      lessonId,
      sectionIndex
    });
    res.status(500).json({
      success: false,
      message: '次のセクションの取得に失敗しました',
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
  getUserCertificates,
  getNextLessonAfterPass,
  getNextSectionAfterPass
};