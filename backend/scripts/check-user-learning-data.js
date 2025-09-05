const { customLogger } = require('../utils/logger');
const { pool } = require('../utils/database');

// 利用者ID 98の学習データの状態を確認
async function checkUserLearningData() {
  const connection = await pool.getConnection();
  const userId = 98;
  
  try {
    console.log(`=== 利用者ID ${userId} の学習データ確認 ===`);
    
    // 1. 利用者情報の確認
    console.log('\n1. 利用者情報の確認...');
    const [users] = await connection.execute(`
      SELECT * FROM user_accounts WHERE id = ?
    `, [userId]);
    
    if (users.length > 0) {
      const user = users[0];
      console.log(`利用者: ${user.name} (ID: ${user.id})`);
      console.log(`企業ID: ${user.company_id}`);
      console.log(`拠点IDs: ${user.satellite_ids}`);
    } else {
      console.log('利用者が見つかりません');
      return;
    }
    
    // 2. 利用者とコースの関連付け確認
    console.log('\n2. 利用者とコースの関連付け確認...');
    const [userCourses] = await connection.execute(`
      SELECT 
        uc.*,
        c.title as course_title,
        c.description as course_description,
        c.category as course_category
      FROM user_courses uc
      JOIN courses c ON uc.course_id = c.id
      WHERE uc.user_id = ? AND uc.status = 'active'
    `, [userId]);
    
    console.log(`利用者コース関連付け数: ${userCourses.length}`);
    userCourses.forEach((uc, index) => {
      console.log(`${index + 1}. コース: ${uc.course_title} (ID: ${uc.course_id})`);
      console.log(`   カテゴリ: ${uc.course_category}`);
      console.log(`   ステータス: ${uc.status}`);
    });
    
    // 3. レッスン進捗の確認
    console.log('\n3. レッスン進捗の確認...');
    const [lessonProgress] = await connection.execute(`
      SELECT 
        ulp.*,
        l.title as lesson_title,
        c.title as course_title
      FROM user_lesson_progress ulp
      JOIN lessons l ON ulp.lesson_id = l.id
      JOIN courses c ON l.course_id = c.id
      WHERE ulp.user_id = ?
      ORDER BY l.course_id, l.order_index
    `, [userId]);
    
    console.log(`レッスン進捗数: ${lessonProgress.length}`);
    lessonProgress.forEach((lp, index) => {
      console.log(`${index + 1}. レッスン: ${lp.lesson_title} (ID: ${lp.lesson_id})`);
      console.log(`   コース: ${lp.course_title}`);
      console.log(`   ステータス: ${lp.status}`);
      console.log(`   テストスコア: ${lp.test_score}`);
      console.log(`   課題提出: ${lp.assignment_submitted ? '済み' : '未提出'}`);
    });
    
    // 4. カリキュラムパス関連の確認
    console.log('\n4. カリキュラムパス関連の確認...');
    const [curriculumPaths] = await connection.execute(`
      SELECT * FROM curriculum_paths WHERE status = 'active'
    `);
    
    console.log(`アクティブなカリキュラムパス数: ${curriculumPaths.length}`);
    curriculumPaths.forEach((cp, index) => {
      console.log(`${index + 1}. パス: ${cp.name} (ID: ${cp.id})`);
      console.log(`   説明: ${cp.description}`);
    });
    
    // 5. 利用者とカリキュラムパスの関連付け確認
    console.log('\n5. 利用者とカリキュラムパスの関連付け確認...');
    const [userCurriculumPaths] = await connection.execute(`
      SELECT 
        ucp.*,
        cp.name as path_name,
        cp.description as path_description
      FROM user_curriculum_paths ucp
      JOIN curriculum_paths cp ON ucp.curriculum_path_id = cp.id
      WHERE ucp.user_id = ?
    `, [userId]);
    
    console.log(`利用者カリキュラムパス関連付け数: ${userCurriculumPaths.length}`);
    userCurriculumPaths.forEach((ucp, index) => {
      console.log(`${index + 1}. パス: ${ucp.path_name} (ID: ${ucp.curriculum_path_id})`);
      console.log(`   ステータス: ${ucp.status}`);
      console.log(`   開始日: ${ucp.start_date}`);
    });
    
    // 6. 問題の特定
    console.log('\n6. 問題の特定...');
    if (userCourses.length === 0) {
      console.log('❌ 問題: 利用者にコースが割り当てられていません');
      console.log('   解決策: カリキュラムパス経由でコースを割り当てる必要があります');
    } else if (lessonProgress.length === 0) {
      console.log('❌ 問題: レッスン進捗が記録されていません');
      console.log('   解決策: 学習開始時にレッスン進捗を作成する必要があります');
    } else {
      console.log('✅ 学習データは正常に設定されています');
    }
    
  } catch (error) {
    console.error('エラーが発生しました:', error);
    customLogger.error('Failed to check user learning data', { error: error.message, userId });
  } finally {
    connection.release();
  }
}

// スクリプト実行
if (require.main === module) {
  checkUserLearningData()
    .then(() => {
      console.log('\n学習データ確認が完了しました');
      process.exit(0);
    })
    .catch((error) => {
      console.error('エラーが発生しました:', error);
      process.exit(1);
    });
}

module.exports = { checkUserLearningData };
