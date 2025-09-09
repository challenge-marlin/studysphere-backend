const { pool } = require('../utils/database');
const { customLogger } = require('../utils/logger');

/**
 * テスト用の利用者データとコース関連付けを作成
 */
const createTestStudentData = async () => {
  const connection = await pool.getConnection();
  
  try {
    console.log('テスト用の利用者データとコース関連付けを作成中...');
    
    // テスト用の利用者を作成
    const testUsers = [
      {
        name: 'テスト利用者1',
        email: 'test1@example.com',
        login_code: 'TEST-0001-0001',
        company_id: 1,
        satellite_ids: JSON.stringify([1])
      },
      {
        name: 'テスト利用者2',
        email: 'test2@example.com',
        login_code: 'TEST-0001-0002',
        company_id: 1,
        satellite_ids: JSON.stringify([1])
      }
    ];
    
    for (const userData of testUsers) {
      // 利用者を作成
      const [userResult] = await connection.execute(`
        INSERT INTO user_accounts (name, email, role, status, login_code, company_id, satellite_ids)
        VALUES (?, ?, 1, 1, ?, ?, ?)
        ON DUPLICATE KEY UPDATE name = VALUES(name)
      `, [userData.name, userData.email, userData.login_code, userData.company_id, userData.satellite_ids]);
      
      const userId = userResult.insertId || userResult.insertId;
      console.log(`利用者を作成/更新しました: ${userData.name} (ID: ${userId})`);
      
      // 利用可能なコースを取得
      const [courses] = await connection.execute(`
        SELECT id FROM courses WHERE status = 'active'
      `);
      
      // 各コースに関連付けを作成
      for (const course of courses) {
        await connection.execute(`
          INSERT INTO user_courses (user_id, course_id, status, progress_percentage, start_date)
          VALUES (?, ?, 'active', 0, NOW())
          ON DUPLICATE KEY UPDATE status = 'active'
        `, [userId, course.id]);
      }
      
      console.log(`${courses.length}個のコースに関連付けを作成しました`);
    }
    
    // 進捗レコードを作成
    console.log('進捗レコードを作成中...');
    
    const [userCourseCombinations] = await connection.execute(`
      SELECT DISTINCT 
        uc.user_id,
        l.id as lesson_id
      FROM user_courses uc
      JOIN courses c ON uc.course_id = c.id
      JOIN lessons l ON c.id = l.course_id
      WHERE uc.status = 'active' 
        AND c.status = 'active' 
        AND l.status != 'deleted'
        AND uc.user_id IN (SELECT id FROM user_accounts WHERE login_code LIKE 'TEST-%')
    `);
    
    for (const combo of userCourseCombinations) {
      await connection.execute(`
        INSERT INTO user_lesson_progress (user_id, lesson_id, status, created_at, updated_at)
        VALUES (?, ?, 'not_started', NOW(), NOW())
        ON DUPLICATE KEY UPDATE updated_at = NOW()
      `, [combo.user_id, combo.lesson_id]);
    }
    
    console.log(`${userCourseCombinations.length}件の進捗レコードを作成しました`);
    
    customLogger.info('Test student data created successfully');
    
  } catch (error) {
    console.error('テスト用データ作成エラー:', error);
    customLogger.error('Failed to create test student data', {
      error: error.message
    });
    throw error;
  } finally {
    connection.release();
  }
};

// スクリプトが直接実行された場合
if (require.main === module) {
  createTestStudentData()
    .then(() => {
      console.log('テスト用の利用者データとコース関連付けの作成が完了しました');
      process.exit(0);
    })
    .catch((error) => {
      console.error('エラーが発生しました:', error);
      process.exit(1);
    });
}

module.exports = { createTestStudentData };
