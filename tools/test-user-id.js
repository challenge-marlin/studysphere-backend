const { pool } = require('./backend/utils/database');

async function testUserId() {
  const connection = await pool.getConnection();
  
  try {
    console.log('=== テスト用ユーザーID確認 ===');
    
    // 1. ユーザーアカウントの確認
    console.log('\n1. ユーザーアカウント:');
    const [users] = await connection.execute('SELECT id, name, email, role FROM user_accounts LIMIT 10');
    console.log('ユーザー数:', users.length);
    users.forEach(user => console.log(`  ID: ${user.id}, 名前: ${user.name}, メール: ${user.email}, 役割: ${user.role}`));
    
    // 2. ユーザーID 98の詳細確認
    console.log('\n2. ユーザーID 98の詳細確認:');
    const [user98] = await connection.execute('SELECT * FROM user_accounts WHERE id = 98');
    if (user98.length > 0) {
      console.log('ユーザーID 98が見つかりました:', user98[0]);
    } else {
      console.log('ユーザーID 98は存在しません');
    }
    
    // 3. ユーザーID 98のコース関連付け確認
    console.log('\n3. ユーザーID 98のコース関連付け:');
    const [user98Courses] = await connection.execute('SELECT * FROM user_courses WHERE user_id = 98');
    console.log('コース関連付け数:', user98Courses.length);
    user98Courses.forEach(uc => console.log(`  コースID: ${uc.course_id}, ステータス: ${uc.status}, 進捗: ${uc.progress_percentage}%`));
    
    // 4. ユーザーID 98のレッスン進捗確認
    console.log('\n4. ユーザーID 98のレッスン進捗:');
    const [user98Progress] = await connection.execute('SELECT * FROM user_lesson_progress WHERE user_id = 98');
    console.log('レッスン進捗数:', user98Progress.length);
    user98Progress.forEach(lp => console.log(`  レッスンID: ${lp.lesson_id}, ステータス: ${lp.status}, 作成日時: ${lp.created_at}`));
    
    // 5. 推奨テストユーザーID
    console.log('\n5. 推奨テストユーザーID:');
    if (users.length > 0) {
      const testUser = users.find(u => u.role === 4); // 一般ユーザー
      if (testUser) {
        console.log(`推奨テストユーザー: ID ${testUser.id} (${testUser.name})`);
        console.log('このユーザーIDを使用してテストしてください');
      }
    }
    
  } catch (error) {
    console.error('テストユーザーID確認エラー:', error);
  } finally {
    connection.release();
    console.log('\n=== 確認完了 ===');
    process.exit(0);
  }
}

testUserId();
