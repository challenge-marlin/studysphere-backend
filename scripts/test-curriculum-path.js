const { pool } = require('../backend/utils/database');

const testCurriculumPath = async () => {
  const connection = await pool.getConnection();
  
  try {
    console.log('=== カリキュラムパステスト開始 ===');
    
    // 1. カリキュラムパスの存在確認
    const [paths] = await connection.execute(`
      SELECT * FROM curriculum_paths WHERE status != 'deleted'
    `);
    console.log('既存のカリキュラムパス:', paths);
    
    // 2. 利用者とカリキュラムパスの関連付け確認
    const [userPaths] = await connection.execute(`
      SELECT 
        ucp.*,
        cp.name as path_name,
        cp.description as path_description,
        ua.name as user_name
      FROM user_curriculum_paths ucp
      JOIN curriculum_paths cp ON ucp.curriculum_path_id = cp.id
      JOIN user_accounts ua ON ucp.user_id = ua.id
      WHERE ucp.status = 'active'
    `);
    console.log('利用者とカリキュラムパスの関連付け:', userPaths);
    
    // 3. 利用者とコースの関連付け確認（curriculum_path_id含む）
    const [userCourses] = await connection.execute(`
      SELECT 
        uc.*,
        c.title as course_title,
        cp.name as curriculum_path_name,
        cp.description as curriculum_path_description
      FROM user_courses uc
      JOIN courses c ON uc.course_id = c.id
      LEFT JOIN curriculum_paths cp ON uc.curriculum_path_id = cp.id
      LIMIT 5
    `);
    console.log('利用者とコースの関連付け（カリキュラムパス含む）:', userCourses);
    
    // 4. テスト用カリキュラムパスが存在しない場合は作成
    if (paths.length === 0) {
      console.log('テスト用カリキュラムパスを作成します...');
      
      const [result] = await connection.execute(`
        INSERT INTO curriculum_paths (name, description, target_audience, duration, status, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        'IT基礎コース',
        'ITリテラシーとAIの基本を学ぶコース',
        'IT初心者',
        '6ヶ月',
        'active',
        1
      ]);
      
      const pathId = result.insertId;
      console.log('作成されたカリキュラムパスID:', pathId);
      
      // 既存の利用者にカリキュラムパスを割り当て
      const [users] = await connection.execute(`
        SELECT id FROM user_accounts WHERE role = 1 LIMIT 1
      `);
      
      if (users.length > 0) {
        const userId = users[0].id;
        
        // user_curriculum_pathsに追加
        await connection.execute(`
          INSERT INTO user_curriculum_paths (user_id, curriculum_path_id, status, assigned_by)
          VALUES (?, ?, 'active', 1)
        `, [userId, pathId]);
        
        // user_coursesのcurriculum_path_idを更新
        await connection.execute(`
          UPDATE user_courses 
          SET curriculum_path_id = ? 
          WHERE user_id = ? 
          LIMIT 1
        `, [pathId, userId]);
        
        console.log(`利用者ID ${userId} にカリキュラムパスID ${pathId} を割り当てました`);
      }
    }
    
    // 5. 最終確認
    const [finalCheck] = await connection.execute(`
      SELECT 
        uc.*,
        c.title as course_title,
        cp.name as curriculum_path_name,
        cp.description as curriculum_path_description
      FROM user_courses uc
      JOIN courses c ON uc.course_id = c.id
      LEFT JOIN curriculum_paths cp ON uc.curriculum_path_id = cp.id
      WHERE uc.curriculum_path_id IS NOT NULL
      LIMIT 5
    `);
    console.log('最終確認 - カリキュラムパスが割り当てられたコース:', finalCheck);
    
  } catch (error) {
    console.error('エラーが発生しました:', error);
  } finally {
    connection.release();
  }
};

// スクリプト実行
testCurriculumPath().then(() => {
  console.log('テスト完了');
  process.exit(0);
}).catch(error => {
  console.error('テスト失敗:', error);
  process.exit(1);
});
