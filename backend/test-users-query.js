const { pool } = require('./utils/database');

async function testUsersQuery() {
  let connection;
  try {
    console.log('=== 利用者一覧クエリテスト開始 ===');
    
    connection = await pool.getConnection();
    console.log('データベース接続取得成功');
    
    // ステップ1: 最もシンプルなクエリ
    console.log('\n--- ステップ1: 基本的なユーザー情報取得 ---');
    const [basicRows] = await connection.execute(`
      SELECT id, name, email, role, status
      FROM user_accounts
      LIMIT 5
    `);
    console.log('基本的なユーザー情報取得成功。件数:', basicRows.length);
    console.log('サンプルデータ:', basicRows[0]);
    
    // ステップ2: 全ユーザー情報取得
    console.log('\n--- ステップ2: 全ユーザー情報取得 ---');
    const [allRows] = await connection.execute(`
      SELECT 
        id,
        name,
        email,
        role,
        status,
        login_code,
        company_id,
        satellite_ids,
        is_remote_user,
        recipient_number,
        password_reset_required,
        instructor_id
      FROM user_accounts
      ORDER BY id
    `);
    console.log('全ユーザー情報取得成功。件数:', allRows.length);
    
    // ステップ3: JOINテスト
    console.log('\n--- ステップ3: admin_credentialsとのJOINテスト ---');
    const [joinRows] = await connection.execute(`
      SELECT 
        ua.id,
        ua.name,
        ua.email,
        ua.role,
        ac.username
      FROM user_accounts ua
      LEFT JOIN admin_credentials ac ON ua.id = ac.user_id
      ORDER BY ua.id
      LIMIT 5
    `);
    console.log('JOINテスト成功。件数:', joinRows.length);
    console.log('JOINサンプルデータ:', joinRows[0]);
    
    console.log('\n=== 利用者一覧クエリテスト完了 ===');
    
  } catch (error) {
    console.error('=== クエリテストエラー ===');
    console.error('エラーメッセージ:', error.message);
    console.error('エラースタック:', error.stack);
    console.error('エラーコード:', error.code);
  } finally {
    if (connection) {
      try {
        connection.release();
        console.log('データベース接続を解放しました');
      } catch (releaseError) {
        console.error('データベース接続の解放に失敗:', releaseError);
      }
    }
  }
  
  process.exit(0);
}

testUsersQuery();
