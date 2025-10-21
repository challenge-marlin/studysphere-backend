const mysql = require('mysql2/promise');

// データベース設定（直接指定）
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'shinomoto926!',
  database: 'curriculum-portal',
  port: 3306
};

async function testCourseProgress() {
  let connection;
  
  try {
    // データベース接続
    connection = await mysql.createConnection(dbConfig);
    console.log('データベースに接続しました');

    // ユーザー1のコース登録状況を確認
    console.log('\n=== ユーザー1のコース登録状況 ===');
    const [userCourses] = await connection.execute(`
      SELECT * FROM user_courses WHERE user_id = 1
    `);
    console.log('ユーザー1の登録コース:', userCourses);

    // コース1の情報を確認
    console.log('\n=== コース1の情報 ===');
    const [courseInfo] = await connection.execute(`
      SELECT * FROM courses WHERE id = 1
    `);
    console.log('コース1の情報:', courseInfo);

    // コース1のレッスン情報を確認
    console.log('\n=== コース1のレッスン情報 ===');
    const [lessons] = await connection.execute(`
      SELECT * FROM lessons WHERE course_id = 1 AND status != 'deleted'
      ORDER BY order_index ASC
    `);
    console.log('コース1のレッスン:', lessons);

    // ユーザー1がコース1に登録されているかチェック
    console.log('\n=== ユーザー1のコース1登録状況 ===');
    const [userCourseCheck] = await connection.execute(`
      SELECT * FROM user_courses 
      WHERE user_id = 1 AND course_id = 1
    `);
    console.log('ユーザー1のコース1登録状況:', userCourseCheck);

    if (userCourseCheck.length === 0) {
      console.log('\n=== ユーザー1をコース1に登録します ===');
      await connection.execute(`
        INSERT INTO user_courses (user_id, course_id, status, start_date, created_at, updated_at)
        VALUES (1, 1, 'active', NOW(), NOW(), NOW())
      `);
      console.log('ユーザー1をコース1に登録しました');
    }

    // レッスン3のファイルタイプを確認
    console.log('\n=== レッスン3のファイルタイプ確認 ===');
    const [lesson3] = await connection.execute(`
      SELECT id, title, s3_key, file_type FROM lessons WHERE id = 3
    `);
    console.log('レッスン3の情報:', lesson3);

  } catch (error) {
    console.error('エラーが発生しました:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\nデータベース接続を閉じました');
    }
  }
}

// スクリプト実行
if (require.main === module) {
  testCourseProgress().catch(console.error);
}

module.exports = { testCourseProgress };
