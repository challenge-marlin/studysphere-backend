const { customLogger } = require('../utils/logger');
const { pool } = require('../utils/database');

// 学習データの初期化
async function initLearningData() {
  const connection = await pool.getConnection();
  
  try {
    console.log('=== 学習データの初期化を開始します ===');
    
    // 1. コースデータの確認
    console.log('\n1. コースデータの確認...');
    const [courses] = await connection.execute('SELECT * FROM courses WHERE status = "active"');
    console.log(`コース数: ${courses.length}`);
    
    if (courses.length === 0) {
      console.log('コースデータが存在しません。コースを作成します...');
      await createCourses(connection);
    }
    
    // 2. レッスンデータの確認
    console.log('\n2. レッスンデータの確認...');
    const [lessons] = await connection.execute('SELECT * FROM lessons WHERE status = "active"');
    console.log(`レッスン数: ${lessons.length}`);
    
    if (lessons.length === 0) {
      console.log('レッスンデータが存在しません。レッスンを作成します...');
      await createLessons(connection);
    }
    
    // 3. 利用者とコースの関連付け確認
    console.log('\n3. 利用者とコースの関連付け確認...');
    const [userCourses] = await connection.execute('SELECT * FROM user_courses WHERE status = "active"');
    console.log(`利用者コース関連付け数: ${userCourses.length}`);
    
    if (userCourses.length === 0) {
      console.log('利用者とコースの関連付けが存在しません。関連付けを作成します...');
      await createUserCourseRelations(connection);
    }
    
    console.log('\n=== 学習データの初期化が完了しました ===');
    
  } catch (error) {
    console.error('学習データの初期化中にエラーが発生しました:', error);
    customLogger.error('Failed to initialize learning data', { error: error.message });
  } finally {
    connection.release();
  }
}

// コースの作成
async function createCourses(connection) {
  const courses = [
    {
      name: 'ITリテラシー・AIの基本',
      title: 'ITリテラシー・AIの基本',
      description: 'ITの基本知識とAIの活用方法を学ぶコース',
      category: 'basic',
      order_index: 1,
      status: 'active'
    },
    {
      name: 'SNS運用の基礎・画像生成編集',
      title: 'SNS運用の基礎・画像生成編集',
      description: 'SNSの活用と画像生成・編集技術を学ぶコース',
      category: 'intermediate',
      order_index: 2,
      status: 'active'
    },
    {
      name: 'LP制作 (HTML・CSS)',
      title: 'LP制作 (HTML・CSS)',
      description: 'HTML・CSSを使用したランディングページ制作を学ぶコース',
      category: 'advanced',
      order_index: 3,
      status: 'active'
    }
  ];
  
  for (const course of courses) {
    await connection.execute(`
      INSERT INTO courses (name, title, description, category, order_index, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [course.name, course.title, course.description, course.category, course.order_index, course.status]);
  }
  
  console.log(`${courses.length}件のコースを作成しました`);
}

// レッスンの作成
async function createLessons(connection) {
  const lessons = [
    {
      course_id: 1,
      title: 'Windows 11 の基本操作とソフトウェアの活用',
      description: 'Windows 11の基本操作と各種ソフトウェアの活用方法を学びます。',
      order_index: 1,
      status: 'active'
    },
    {
      course_id: 1,
      title: 'インターネットの基礎と安全な利用',
      description: 'インターネットの基本概念と安全な利用方法を学びます。',
      order_index: 2,
      status: 'active'
    },
    {
      course_id: 1,
      title: 'AIの基本概念',
      description: 'AI（人工知能）の基本概念と仕組みを学びます。',
      order_index: 3,
      status: 'active'
    },
    {
      course_id: 1,
      title: 'AIの活用例と実践体験',
      description: 'AIの具体的な活用例と実践的な体験を行います。',
      order_index: 4,
      status: 'active'
    },
    {
      course_id: 1,
      title: '簡単なプログラミングとAI アシスタント活用',
      description: '基本的なプログラミングとAIアシスタントの活用方法を学びます。',
      order_index: 5,
      status: 'active'
    },
    {
      course_id: 1,
      title: 'AIを活用した簡単なLP(ランディングページ)作成',
      description: 'AIを活用してランディングページを作成する方法を学びます。',
      order_index: 6,
      status: 'active'
    }
  ];
  
  for (const lesson of lessons) {
    await connection.execute(`
      INSERT INTO lessons (course_id, title, description, order_index, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, NOW(), NOW())
    `, [lesson.course_id, lesson.title, lesson.description, lesson.order_index, lesson.status]);
  }
  
  console.log(`${lessons.length}件のレッスンを作成しました`);
}

// 利用者とコースの関連付け作成
async function createUserCourseRelations(connection) {
  // 利用者ID 98-103にコース1を割り当て
  const userIds = [98, 99, 100, 101, 102, 103];
  
  for (const userId of userIds) {
    await connection.execute(`
      INSERT INTO user_courses (user_id, course_id, status, start_date, created_at, updated_at)
      VALUES (?, 1, 'active', NOW(), NOW(), NOW())
    `, [userId]);
  }
  
  console.log(`${userIds.length}件の利用者コース関連付けを作成しました`);
}

// スクリプト実行
if (require.main === module) {
  initLearningData()
    .then(() => {
      console.log('学習データの初期化が完了しました');
      process.exit(0);
    })
    .catch((error) => {
      console.error('エラーが発生しました:', error);
      process.exit(1);
    });
}

module.exports = { initLearningData };
