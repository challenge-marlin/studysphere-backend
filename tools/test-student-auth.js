const { pool } = require('../backend/utils/database');
const { verifyTemporaryPassword } = require('../backend/scripts/userController');

async function testStudentAuth() {
  try {
    console.log('=== 学生認証テスト ===');
    
    const loginCode = 'RMWI-WlAm-vbyT';
    const tempPassword = '7AL1-9MDD';
    
    console.log(`ログインコード: ${loginCode}`);
    console.log(`一時パスワード: ${tempPassword}`);
    
    // 一時パスワード認証をテスト
    console.log('\n--- 一時パスワード認証テスト ---');
    const authResult = await verifyTemporaryPassword(loginCode, tempPassword);
    console.log('認証結果:', JSON.stringify(authResult, null, 2));
    
    if (authResult.success) {
      const userId = authResult.data.userId;
      console.log(`\n認証成功! ユーザーID: ${userId}`);
      
      // ユーザーのコース一覧を取得
      console.log('\n--- ユーザーのコース一覧取得テスト ---');
      const connection = await pool.getConnection();
      
      try {
        const [courses] = await connection.execute(`
          SELECT 
            c.id,
            c.title,
            c.description,
            c.category,
            c.status,
            uc.progress_percentage,
            uc.start_date,
            uc.completion_date,
            uc.status as enrollment_status,
            (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id AND l.status != 'deleted') as total_lessons,
            (SELECT COUNT(*) FROM user_lesson_progress ulp 
             JOIN lessons l ON ulp.lesson_id = l.id 
             WHERE l.course_id = c.id AND ulp.user_id = uc.user_id AND ulp.status = 'completed') as completed_lessons
          FROM user_courses uc
          JOIN courses c ON uc.course_id = c.id
          WHERE uc.user_id = ? AND c.status = 'active'
          ORDER BY c.order_index ASC, c.title ASC
        `, [userId]);
        
        console.log(`コース数: ${courses.length}件`);
        courses.forEach((course, index) => {
          console.log(`${index + 1}. ${course.title} (${course.category})`);
          console.log(`   進捗: ${course.progress_percentage}%`);
          console.log(`   レッスン数: ${course.total_lessons}件 (完了: ${course.completed_lessons}件)`);
        });
        
      } finally {
        connection.release();
      }
      
    } else {
      console.log('認証失敗:', authResult.message);
      
      // データベースの状態を確認
      console.log('\n--- データベース状態確認 ---');
      const connection = await pool.getConnection();
      
      try {
        // ログインコードの存在確認
        const [users] = await connection.execute(
          'SELECT id, name, role, login_code FROM user_accounts WHERE login_code = ?',
          [loginCode]
        );
        console.log(`ログインコード ${loginCode} を持つユーザー数: ${users.length}件`);
        users.forEach(user => {
          console.log(`- ID: ${user.id}, 名前: ${user.name}, ロール: ${user.role}`);
        });
        
        // 一時パスワードの存在確認
        const [tempPasswords] = await connection.execute(
          'SELECT user_id, temp_password, expires_at, is_used FROM user_temp_passwords WHERE temp_password = ?',
          [tempPassword]
        );
        console.log(`一時パスワード ${tempPassword} の数: ${tempPasswords.length}件`);
        tempPasswords.forEach(temp => {
          console.log(`- ユーザーID: ${temp.user_id}, 有効期限: ${temp.expires_at}, 使用済み: ${temp.is_used}`);
        });
        
      } finally {
        connection.release();
      }
    }
    
  } catch (error) {
    console.error('エラー:', error);
  } finally {
    await pool.end();
  }
}

testStudentAuth();
