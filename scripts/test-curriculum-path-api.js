const mysql = require('mysql2/promise');
const config = require('../backend/config/database');

async function testCurriculumPathAPI() {
  let connection;
  
  try {
    console.log('データベース接続中...');
    connection = await mysql.createConnection(config);
    console.log('データベース接続成功');

    // ユーザーID 98のカリキュラムパス情報を確認
    const userId = 98;
    
    console.log(`\n=== ユーザーID ${userId} のカリキュラムパス情報 ===`);
    
    // user_coursesテーブルからカリキュラムパスIDを取得
    const [userCourses] = await connection.execute(`
      SELECT 
        uc.id,
        uc.user_id,
        uc.course_id,
        uc.curriculum_path_id,
        c.title as course_title,
        cp.name as curriculum_path_name,
        cp.description as curriculum_path_description
      FROM user_courses uc
      JOIN courses c ON uc.course_id = c.id
      LEFT JOIN curriculum_paths cp ON uc.curriculum_path_id = cp.id
      WHERE uc.user_id = ?
    `, [userId]);
    
    console.log('user_courses テーブルの結果:');
    userCourses.forEach(course => {
      console.log(`  コース: ${course.course_title}`);
      console.log(`  カリキュラムパスID: ${course.curriculum_path_id}`);
      console.log(`  カリキュラムパス名: ${course.curriculum_path_name || 'なし'}`);
      console.log(`  カリキュラムパス説明: ${course.curriculum_path_description || 'なし'}`);
      console.log('  ---');
    });
    
    // curriculum_pathsテーブルの内容を確認
    console.log('\n=== curriculum_pathsテーブルの内容 ===');
    const [curriculumPaths] = await connection.execute(`
      SELECT id, name, description FROM curriculum_paths
    `);
    
    curriculumPaths.forEach(cp => {
      console.log(`  ID: ${cp.id}, 名前: ${cp.name}, 説明: ${cp.description}`);
    });
    
    // user_curriculum_pathsテーブルの内容を確認
    console.log('\n=== user_curriculum_pathsテーブルの内容 ===');
    const [userCurriculumPaths] = await connection.execute(`
      SELECT * FROM user_curriculum_paths WHERE user_id = ?
    `, [userId]);
    
    if (userCurriculumPaths.length > 0) {
      userCurriculumPaths.forEach(ucp => {
        console.log(`  ユーザーID: ${ucp.user_id}, カリキュラムパスID: ${ucp.curriculum_path_id}`);
      });
    } else {
      console.log('  ユーザーID 98のカリキュラムパス割り当てなし');
    }
    
  } catch (error) {
    console.error('エラー:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\nデータベース接続終了');
    }
  }
}

testCurriculumPathAPI();
