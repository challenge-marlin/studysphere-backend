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
        // completed は100%、in_progress は50%として計算
        const weightedProgress = completedLessons + (inProgressLessons * 0.5);
        course.progress_percentage = Math.round((weightedProgress / course.total_lessons) * 100);
        
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
    course.overall_progress = totalLessons > 0 ? Math.round((weightedProgress / totalLessons) * 100) : 0;
    
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
      await updateCourseProgress(connection, userId, lessonId);
    } catch (progressError) {
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
  const { userId, lessonId, answers, score, totalQuestions } = req.body;
  const connection = await pool.getConnection();
  
  try {
    // テスト結果を保存（新しいテーブルを作成する必要があります）
    // 現在はuser_lesson_progressにテストスコアのみ保存
    await connection.execute(`
      INSERT INTO user_lesson_progress (
        user_id, lesson_id, status, test_score, completed_at
      ) VALUES (?, ?, 'completed', ?, NOW())
      ON DUPLICATE KEY UPDATE
        status = 'completed',
        test_score = VALUES(test_score),
        completed_at = VALUES(completed_at),
        updated_at = NOW()
    `, [userId, lessonId, score]);

    // レッスンを完了済みに更新
    await connection.execute(`
      UPDATE user_lesson_progress 
      SET status = 'completed', completed_at = NOW(), updated_at = NOW()
      WHERE user_id = ? AND lesson_id = ?
    `, [userId, lessonId]);

    // コース全体の進捗率を更新（エラーが発生しても処理を継続）
    try {
      await updateCourseProgress(connection, userId, lessonId);
    } catch (progressError) {
      customLogger.warn('Course progress update failed, but lesson progress was updated', {
        error: progressError.message,
        userId,
        lessonId
      });
    }

    customLogger.info('Test result submitted successfully', {
      userId,
      lessonId,
      score,
      totalQuestions
    });

    res.json({
      success: true,
      message: 'テスト結果が提出されました',
      data: { score, totalQuestions }
    });
  } catch (error) {
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

// コース全体の進捗率を更新（内部関数）
const updateCourseProgress = async (connection, userId, lessonId) => {
  try {
    // レッスンが属するコースIDを取得
    const [courseRows] = await connection.execute(`
      SELECT course_id FROM lessons WHERE id = ?
    `, [lessonId]);

    if (courseRows.length === 0) return;

    const courseId = courseRows[0].course_id;

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
      // completed は100%、in_progress は50%として計算
      const weightedProgress = completed_lessons + (in_progress_lessons * 0.5);
      const progressPercentage = total_lessons > 0 
        ? Math.round((weightedProgress / total_lessons) * 100) 
        : 0;

      // user_coursesテーブルの進捗率を更新
      await connection.execute(`
        UPDATE user_courses 
        SET 
          progress_percentage = ?,
          updated_at = NOW()
        WHERE user_id = ? AND course_id = ?
      `, [progressPercentage, userId, courseId]);
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
    
    // updated_atが最新のin_progressレッスンを取得（LIMIT 1で最新の1件のみ）
    query += ' ORDER BY ulp.updated_at DESC LIMIT 1';
    
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
  getCurrentLesson
};
