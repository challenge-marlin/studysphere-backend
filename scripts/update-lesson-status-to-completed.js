/**
 * 完了とすべきレッスンのステータスを一括更新するスクリプト
 * 
 * 完了条件：
 * 1. 提出物がないレッスン: test_score >= 29 かつ instructor_approved = TRUE
 * 2. 提出物があるレッスン: test_score >= 29 かつ instructor_approved = TRUE (テスト承認)
 *    かつ assignment_submitted = TRUE かつ instructor_approved = TRUE (提出物承認)
 */

// 環境変数の読み込み
try {
  require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') });
} catch (error) {
  console.log('.envファイルが見つからないため、デフォルト設定を使用します');
}

// データベースとロガーのインポート
const { pool } = require('../backend/utils/database');
const { customLogger } = require('../backend/utils/logger');

/**
 * 完了とすべきレッスンを抽出する
 */
const findLessonsToComplete = async (connection) => {
  // 完了とすべきレッスンを抽出するクエリ
  // 条件：
  // 1. 現在 status = 'in_progress' である
  // 2. 提出物がないレッスン: test_score >= 29 かつ instructor_approved = TRUE
  // 3. 提出物があるレッスン: test_score >= 29 かつ instructor_approved = TRUE 
  //    かつ assignment_submitted = TRUE
  const [lessons] = await connection.execute(`
    SELECT 
      ulp.id,
      ulp.user_id,
      ulp.lesson_id,
      ulp.status,
      ulp.test_score,
      ulp.instructor_approved,
      ulp.assignment_submitted,
      ulp.completed_at,
      l.has_assignment,
      l.title as lesson_title,
      ua.name as user_name,
      ua.login_code
    FROM user_lesson_progress ulp
    JOIN lessons l ON ulp.lesson_id = l.id
    JOIN user_accounts ua ON ulp.user_id = ua.id
    WHERE ulp.status = 'in_progress'
      AND (
        -- 提出物がないレッスン: テスト合格かつ指導員承認済み
        (l.has_assignment = FALSE 
         AND ulp.test_score >= 29 
         AND ulp.instructor_approved = TRUE)
        OR
        -- 提出物があるレッスン: テスト合格かつ指導員承認済み、かつ提出物提出済み
        (l.has_assignment = TRUE 
         AND ulp.test_score >= 29 
         AND ulp.instructor_approved = TRUE 
         AND ulp.assignment_submitted = TRUE)
      )
    ORDER BY ulp.user_id, ulp.lesson_id
  `);

  return lessons;
};

/**
 * レッスンのステータスを完了に更新する
 */
const updateLessonStatusToCompleted = async (connection, lessons) => {
  let updatedCount = 0;
  let errorCount = 0;

  for (const lesson of lessons) {
    try {
      // トランザクション開始
      await connection.beginTransaction();

      // ステータスを完了に更新
      await connection.execute(`
        UPDATE user_lesson_progress 
        SET 
          status = 'completed',
          completed_at = COALESCE(completed_at, NOW()),
          updated_at = NOW()
        WHERE id = ?
      `, [lesson.id]);

      // コース進捗率を更新
      try {
        // レッスンが属するコースIDを取得
        const [courseRows] = await connection.execute(`
          SELECT course_id FROM lessons WHERE id = ?
        `, [lesson.lesson_id]);

        if (courseRows.length > 0) {
          const courseId = courseRows[0].course_id;

          // コース全体の進捗率を計算
          const [progressRows] = await connection.execute(`
            SELECT 
              COUNT(*) as total_lessons,
              COUNT(CASE WHEN ulp.status = 'completed' THEN 1 END) as completed_lessons,
              COUNT(CASE WHEN ulp.status = 'in_progress' THEN 1 END) as in_progress_lessons
            FROM lessons l
            LEFT JOIN user_lesson_progress ulp ON l.id = ulp.lesson_id AND ulp.user_id = ?
            WHERE l.course_id = ? AND l.status = 'active'
          `, [lesson.user_id, courseId]);

          if (progressRows.length > 0) {
            const { total_lessons, completed_lessons, in_progress_lessons } = progressRows[0];
            
            // completed は100%、in_progress は50%として計算
            const weightedProgress = completed_lessons + (in_progress_lessons * 0.5);
            const progressPercentage = total_lessons > 0 
              ? Math.round((weightedProgress / total_lessons) * 10000) / 100
              : 0;

            // user_coursesテーブルの進捗率を更新
            await connection.execute(`
              UPDATE user_courses 
              SET 
                progress_percentage = ?,
                updated_at = NOW()
              WHERE user_id = ? AND course_id = ?
            `, [progressPercentage, lesson.user_id, courseId]);
          }
        }
      } catch (progressError) {
        customLogger.warn('コース進捗率の更新に失敗しました', {
          error: progressError.message,
          userId: lesson.user_id,
          lessonId: lesson.lesson_id
        });
        // 進捗率更新の失敗は続行
      }

      await connection.commit();
      updatedCount++;

      customLogger.info('レッスンステータスを完了に更新しました', {
        userId: lesson.user_id,
        userName: lesson.user_name,
        lessonId: lesson.lesson_id,
        lessonTitle: lesson.lesson_title,
        testScore: lesson.test_score,
        hasAssignment: lesson.has_assignment,
        assignmentSubmitted: lesson.assignment_submitted
      });

    } catch (error) {
      await connection.rollback();
      errorCount++;
      
      customLogger.error('レッスンステータスの更新に失敗しました', {
        error: error.message,
        userId: lesson.user_id,
        lessonId: lesson.lesson_id,
        lessonTitle: lesson.lesson_title
      });
    }
  }

  return { updatedCount, errorCount };
};

/**
 * メイン処理
 * @param {boolean} dryRun - trueの場合、抽出のみ実行（更新は行わない）
 */
const main = async (dryRun = false) => {
  const connection = await pool.getConnection();

  try {
    customLogger.info('=== レッスンステータス一括更新スクリプト開始 ===');
    
    if (dryRun) {
      customLogger.info('【DRY-RUNモード】抽出のみ実行します（更新は行いません）');
    }

    // 1. 完了とすべきレッスンを抽出
    customLogger.info('完了とすべきレッスンを抽出中...');
    const lessonsToComplete = await findLessonsToComplete(connection);

    if (lessonsToComplete.length === 0) {
      customLogger.info('完了とすべきレッスンは見つかりませんでした');
      return;
    }

    customLogger.info(`完了とすべきレッスンが見つかりました: ${lessonsToComplete.length}件`);

    // 抽出結果を表示
    console.log('\n=== 完了とすべきレッスン一覧 ===');
    lessonsToComplete.forEach((lesson, index) => {
      console.log(`${index + 1}. ユーザー: ${lesson.user_name} (${lesson.login_code})`);
      console.log(`   レッスン: ${lesson.lesson_title} (ID: ${lesson.lesson_id})`);
      console.log(`   テストスコア: ${lesson.test_score}`);
      console.log(`   指導員承認: ${lesson.instructor_approved ? '済み' : '未承認'}`);
      console.log(`   提出物: ${lesson.has_assignment ? (lesson.assignment_submitted ? '提出済み' : '未提出') : 'なし'}`);
      console.log(`   現在のステータス: ${lesson.status}`);
      console.log('');
    });

    // CSV形式でも出力
    console.log('\n=== CSV形式（コピー用） ===');
    console.log('ユーザーID,ユーザー名,ログインコード,レッスンID,レッスン名,テストスコア,指導員承認,提出物,現在のステータス');
    lessonsToComplete.forEach((lesson) => {
      console.log(
        `${lesson.user_id},"${lesson.user_name}","${lesson.login_code}",` +
        `${lesson.lesson_id},"${lesson.lesson_title}",${lesson.test_score},` +
        `${lesson.instructor_approved ? '済み' : '未承認'},` +
        `${lesson.has_assignment ? (lesson.assignment_submitted ? '提出済み' : '未提出') : 'なし'},` +
        `${lesson.status}`
      );
    });

    // DRY-RUNモードの場合はここで終了
    if (dryRun) {
      console.log('\n【DRY-RUNモード】抽出のみ実行しました。実際の更新は行いませんでした。');
      console.log('実際に更新する場合は、--execute オプションを付けて実行してください。');
      return;
    }

    // 2. ステータスを完了に更新
    customLogger.info('レッスンステータスを完了に更新中...');
    const { updatedCount, errorCount } = await updateLessonStatusToCompleted(connection, lessonsToComplete);

    // 3. 結果を表示
    customLogger.info('=== 更新結果 ===');
    customLogger.info(`成功: ${updatedCount}件`);
    if (errorCount > 0) {
      customLogger.warn(`失敗: ${errorCount}件`);
    }

    console.log('\n=== 更新完了 ===');
    console.log(`成功: ${updatedCount}件`);
    if (errorCount > 0) {
      console.log(`失敗: ${errorCount}件`);
    }

  } catch (error) {
    customLogger.error('スクリプト実行中にエラーが発生しました', {
      error: error.message,
      stack: error.stack
    });
    console.error('エラー:', error);
    process.exit(1);
  } finally {
    connection.release();
    customLogger.info('=== レッスンステータス一括更新スクリプト終了 ===');
  }
};

// スクリプト実行
if (require.main === module) {
  // コマンドライン引数を解析
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--execute');
  
  if (dryRun) {
    console.log('【DRY-RUNモード】抽出のみ実行します（更新は行いません）');
    console.log('実際に更新する場合は、--execute オプションを付けて実行してください。\n');
  } else {
    console.log('【実行モード】実際にデータベースを更新します。\n');
  }

  main(dryRun)
    .then(() => {
      console.log('\nスクリプトが正常に完了しました');
      process.exit(0);
    })
    .catch((error) => {
      console.error('スクリプト実行エラー:', error);
      process.exit(1);
    });
}

module.exports = {
  findLessonsToComplete,
  updateLessonStatusToCompleted,
  main
};
