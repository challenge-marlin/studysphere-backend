const { pool } = require('../config/database');
const { 
  getPendingSubmissions, 
  getStudentSubmissions, 
  approveSubmission 
} = require('../routes/submissionRoutes');

// 提出物承認機能のテストスクリプト
async function testSubmissionApproval() {
  console.log('=== 提出物承認機能テスト開始 ===');
  
  try {
    // テスト用の拠点ID（実際の環境に合わせて変更してください）
    const testSatelliteId = 1;
    const testStudentId = 1;
    const testLessonId = 1;
    
    console.log('1. 拠点内の未承認提出物一覧取得テスト');
    // 注意: 実際のAPIエンドポイントをテストする場合は、Expressアプリのコンテキストが必要です
    // ここでは直接データベースクエリでテストします
    
    const connection = await pool.getConnection();
    
    try {
      // 拠点内の未承認提出物を取得
      const [pendingSubmissions] = await connection.execute(`
        SELECT 
          d.id as submission_id,
          d.user_id,
          d.lesson_id,
          d.file_url,
          d.file_name,
          d.file_size,
          d.file_type,
          d.uploaded_at,
          d.instructor_approved,
          ua.name as student_name,
          ua.login_code as student_login_code,
          l.title as lesson_name,
          c.title as course_title,
          s.name as satellite_name
        FROM deliverables d
        JOIN user_accounts ua ON d.user_id = ua.id
        JOIN lessons l ON d.lesson_id = l.id
        JOIN courses c ON l.course_id = c.id
        JOIN satellites s ON (
          s.id IS NOT NULL AND ua.satellite_ids IS NOT NULL AND (
            JSON_CONTAINS(ua.satellite_ids, JSON_QUOTE(s.id)) OR 
            JSON_CONTAINS(ua.satellite_ids, CAST(s.id AS JSON)) OR
            JSON_SEARCH(ua.satellite_ids, 'one', CAST(s.id AS CHAR)) IS NOT NULL
          )
        )
        WHERE s.id = ? 
        AND d.instructor_approved = FALSE
        AND ua.role = 1
        ORDER BY d.uploaded_at DESC
      `, [testSatelliteId]);
      
      console.log('未承認提出物数:', pendingSubmissions.length);
      console.log('未承認提出物一覧:', pendingSubmissions);
      
      if (pendingSubmissions.length > 0) {
        const testSubmission = pendingSubmissions[0];
        
        console.log('\n2. 特定学生の提出物一覧取得テスト');
        const [studentSubmissions] = await connection.execute(`
          SELECT 
            d.id as submission_id,
            d.user_id,
            d.lesson_id,
            d.file_url,
            d.file_name,
            d.file_size,
            d.file_type,
            d.uploaded_at,
            d.instructor_approved,
            d.instructor_approved_at,
            d.instructor_comment,
            ua.name as student_name,
            ua.login_code as student_login_code,
            l.title as lesson_name,
            c.title as course_title,
            approver.name as approver_name
          FROM deliverables d
          JOIN user_accounts ua ON d.user_id = ua.id
          JOIN lessons l ON d.lesson_id = l.id
          JOIN courses c ON l.course_id = c.id
          LEFT JOIN user_accounts approver ON d.instructor_id = approver.id
          WHERE d.user_id = ?
          ORDER BY d.uploaded_at DESC
        `, [testSubmission.user_id]);
        
        console.log('学生の提出物数:', studentSubmissions.length);
        console.log('学生の提出物一覧:', studentSubmissions);
        
        console.log('\n3. 提出物承認テスト');
        console.log('承認対象:', {
          submissionId: testSubmission.submission_id,
          studentId: testSubmission.user_id,
          lessonId: testSubmission.lesson_id
        });
        
        // 承認処理のテスト（実際の承認は行わない）
        console.log('承認処理のテスト準備完了');
        console.log('実際の承認は手動で行ってください');
      } else {
        console.log('未承認提出物が見つかりませんでした');
        console.log('テスト用の提出物データを作成してください');
      }
      
    } finally {
      connection.release();
    }
    
    console.log('\n=== 提出物承認機能テスト完了 ===');
    
  } catch (error) {
    console.error('テスト実行エラー:', error);
  }
}

// テスト用の提出物データを作成する関数
async function createTestSubmissionData() {
  console.log('=== テスト用提出物データ作成 ===');
  
  try {
    const connection = await pool.getConnection();
    
    try {
      // テスト用の提出物データを挿入
      const [result] = await connection.execute(`
        INSERT INTO deliverables 
        (user_id, lesson_id, curriculum_name, session_number, file_url, file_type, file_name, file_size, uploaded_at, instructor_approved)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), FALSE)
      `, [
        1, // user_id（実際の利用者IDに変更してください）
        1, // lesson_id（実際のレッスンIDに変更してください）
        'テストカリキュラム',
        1,
        'test/submission/sample.pdf',
        'pdf',
        'sample_submission.pdf',
        1024000 // 1MB
      ]);
      
      console.log('テスト用提出物データを作成しました:', result.insertId);
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('テストデータ作成エラー:', error);
  }
}

// スクリプトの実行
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'create-test-data') {
    createTestSubmissionData();
  } else {
    testSubmissionApproval();
  }
}

module.exports = {
  testSubmissionApproval,
  createTestSubmissionData
};
