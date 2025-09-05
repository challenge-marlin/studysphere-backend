const { pool } = require('../utils/database');
const { customLogger } = require('../utils/logger');

// 学習機能に必要な初期データを作成
const initLearningData = async () => {
  const connection = await pool.getConnection();
  
  try {
    customLogger.info('学習機能の初期データ作成を開始します');

    // 1. コースデータの作成
    const courses = [
      {
        title: 'ITリテラシー・AIの基本',
        description: 'ITの基礎知識とAIの基本概念を学び、デジタル社会で活躍するための土台を構築します',
        category: '必修科目',
        order_index: 1,
        status: 'active'
      },
      {
        title: 'オフィスソフトの操作・文書作成',
        description: 'Word、Excel、PowerPointの基本操作を学び、実務で使える文書作成スキルを習得します',
        category: '選択科目',
        order_index: 2,
        status: 'active'
      }
    ];

    for (const course of courses) {
      const [result] = await connection.execute(`
        INSERT INTO courses (title, description, category, order_index, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
          title = VALUES(title),
          description = VALUES(description),
          category = VALUES(category),
          order_index = VALUES(order_index),
          status = VALUES(status),
          updated_at = NOW()
      `, [course.title, course.description, course.category, course.order_index, course.status]);

      customLogger.info(`コース "${course.title}" を作成/更新しました`);
    }

    // 2. レッスンデータの作成
    const lessons = [
      {
        course_id: 1,
        title: '第1回　Windows11の基本操作とソフトウェアの活用',
        description: 'コンピュータの基本構造とWindows 11の操作方法を学びます',
        duration: '60分',
        order_index: 1,
        has_assignment: false,
        status: 'active'
      },
      {
        course_id: 1,
        title: '第2回　インターネットの基礎と安全な利用',
        description: 'インターネットの仕組みと安全な利用方法を学びます',
        duration: '60分',
        order_index: 2,
        has_assignment: false,
        status: 'active'
      },
      {
        course_id: 1,
        title: '第3回　AIの仕組みや基本用語を学ぶ',
        description: 'AIの基本概念と用語について理解を深めます',
        duration: '60分',
        order_index: 3,
        has_assignment: true,
        status: 'active'
      },
      {
        course_id: 1,
        title: '第4回　AIの活用例と実践体験',
        description: '実際のAI活用事例を体験します',
        duration: '60分',
        order_index: 4,
        has_assignment: true,
        status: 'active'
      },
      {
        course_id: 1,
        title: '第5回　簡単なプログラミングとAIアシスタント活用',
        description: 'プログラミングの基礎とAIアシスタントの活用方法を学びます',
        duration: '60分',
        order_index: 5,
        has_assignment: true,
        status: 'active'
      },
      {
        course_id: 1,
        title: '第6回　AIの活用例と実践体験',
        description: '総合的なAI活用の実践演習を行います',
        duration: '60分',
        order_index: 6,
        has_assignment: true,
        status: 'active'
      }
    ];

    for (const lesson of lessons) {
      const [result] = await connection.execute(`
        INSERT INTO lessons (course_id, title, description, duration, order_index, has_assignment, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
          title = VALUES(title),
          description = VALUES(description),
          duration = VALUES(duration),
          order_index = VALUES(order_index),
          has_assignment = VALUES(has_assignment),
          status = VALUES(status),
          updated_at = NOW()
      `, [lesson.course_id, lesson.title, lesson.description, lesson.duration, lesson.order_index, lesson.has_assignment, lesson.status]);

      customLogger.info(`レッスン "${lesson.title}" を作成/更新しました`);
    }

    // 3. レッスン動画データの作成
    const lessonVideos = [
      {
        lesson_id: 1,
        title: 'Windows11基本操作',
        description: 'Windows 11の基本操作について学びます',
        youtube_url: 'https://www.youtube.com/watch?v=j4yNkF1w6L8',
        order_index: 1,
        status: 'active'
      },
      {
        lesson_id: 2,
        title: 'インターネット基礎',
        description: 'インターネットの基礎と安全な利用について学びます',
        youtube_url: 'https://www.youtube.com/watch?v=AtDQST1SQ5A',
        order_index: 1,
        status: 'active'
      },
      {
        lesson_id: 3,
        title: 'AIの基本概念',
        description: 'AIの仕組みや基本用語について学びます',
        youtube_url: 'https://www.youtube.com/watch?v=QkJCPOWwdwI',
        order_index: 1,
        status: 'active'
      },
      {
        lesson_id: 4,
        title: 'AI活用事例',
        description: 'AIの活用例と実践体験について学びます',
        youtube_url: 'https://www.youtube.com/watch?v=75UHkx4WZh0',
        order_index: 1,
        status: 'active'
      },
      {
        lesson_id: 5,
        title: 'プログラミング基礎とAIアシスタント',
        description: 'プログラミングの基礎とAIアシスタントの活用について学びます',
        youtube_url: 'https://www.youtube.com/watch?v=vQqMk3gFZJ0',
        order_index: 1,
        status: 'active'
      }
    ];

    for (const video of lessonVideos) {
      const [result] = await connection.execute(`
        INSERT INTO lesson_videos (lesson_id, title, description, youtube_url, order_index, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
          title = VALUES(title),
          description = VALUES(description),
          youtube_url = VALUES(youtube_url),
          order_index = VALUES(order_index),
          status = VALUES(status),
          updated_at = NOW()
      `, [video.lesson_id, video.title, video.description, video.youtube_url, video.order_index, video.status]);

      customLogger.info(`動画 "${video.title}" を作成/更新しました`);
    }

    // 4. サンプル利用者とコースの関連付け
    const sampleUserCourse = {
      user_id: 1, // サンプル利用者ID
      course_id: 1,
      status: 'active',
      start_date: new Date().toISOString().split('T')[0]
    };

    const [userCourseResult] = await connection.execute(`
      INSERT INTO user_courses (user_id, course_id, status, start_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        status = VALUES(status),
        start_date = VALUES(start_date),
        updated_at = NOW()
    `, [sampleUserCourse.user_id, sampleUserCourse.course_id, sampleUserCourse.status, sampleUserCourse.start_date]);

    customLogger.info('サンプル利用者とコースの関連付けを作成しました');

    // 5. サンプルレッスン進捗データ
    const sampleProgress = [
      {
        user_id: 1,
        lesson_id: 1,
        status: 'completed',
        completed_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
        test_score: 85
      },
      {
        user_id: 1,
        lesson_id: 2,
        status: 'in_progress'
      }
    ];

    for (const progress of sampleProgress) {
      if (progress.completed_at) {
        await connection.execute(`
          INSERT INTO user_lesson_progress (user_id, lesson_id, status, completed_at, test_score, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, NOW(), NOW())
          ON DUPLICATE KEY UPDATE
            status = VALUES(status),
            completed_at = VALUES(completed_at),
            test_score = VALUES(test_score),
            updated_at = NOW()
        `, [progress.user_id, progress.lesson_id, progress.status, progress.completed_at, progress.test_score]);
      } else {
        await connection.execute(`
          INSERT INTO user_lesson_progress (user_id, lesson_id, status, created_at, updated_at)
          VALUES (?, ?, ?, NOW(), NOW())
          ON DUPLICATE KEY UPDATE
            status = VALUES(status),
            updated_at = NOW()
        `, [progress.user_id, progress.lesson_id, progress.status]);
      }
    }

    customLogger.info('サンプルレッスン進捗データを作成しました');

    customLogger.info('学習機能の初期データ作成が完了しました');

  } catch (error) {
    customLogger.error('学習機能の初期データ作成に失敗しました', {
      error: error.message
    });
    throw error;
  } finally {
    connection.release();
  }
};

// スクリプトが直接実行された場合
if (require.main === module) {
  initLearningData()
    .then(() => {
      console.log('学習機能の初期データ作成が完了しました');
      process.exit(0);
    })
    .catch((error) => {
      console.error('学習機能の初期データ作成に失敗しました:', error);
      process.exit(1);
    });
}

module.exports = { initLearningData };
