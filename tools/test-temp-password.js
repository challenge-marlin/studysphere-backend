const { pool } = require('./backend/utils/database');

// 一時パスワード生成関数
const generateTemporaryPassword = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// 今日の終了時刻を取得
const getTodayEndTime = () => {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return today;
};

// パスワード有効性チェック
const isPasswordValid = (expiryTime) => {
  const now = new Date();
  const expiry = new Date(expiryTime);
  return now < expiry;
};

// 一時パスワード発行テスト
const testIssueTemporaryPassword = async (userId) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // ユーザーの存在確認
    const [userRows] = await connection.execute(
      'SELECT id, name, role, login_code FROM user_accounts WHERE id = ?',
      [userId]
    );

    if (userRows.length === 0) {
      console.log('指定されたユーザーが見つかりません');
      return null;
    }

    const user = userRows[0];
    console.log('ユーザー情報:', user);

    // 利用者（ロール1）のみ対象
    if (user.role !== 1) {
      console.log('利用者のみ一時パスワードを発行できます');
      return null;
    }

    // 既存の一時パスワードを無効化
    await connection.execute(
      'UPDATE user_temp_passwords SET is_used = 1 WHERE user_id = ? AND is_used = 0',
      [userId]
    );
    
    // 新しい一時パスワードを生成
    const tempPassword = generateTemporaryPassword();
    const expiryTime = getTodayEndTime();
    
    console.log('生成された一時パスワード:', tempPassword);
    console.log('有効期限:', expiryTime);
    
    // 新しい一時パスワードを登録
    await connection.execute(
      'INSERT INTO user_temp_passwords (user_id, temp_password, expires_at) VALUES (?, ?, ?)',
      [userId, tempPassword, expiryTime]
    );

    return {
      tempPassword,
      loginCode: user.login_code,
      expiresAt: expiryTime
    };
  } catch (error) {
    console.error('一時パスワード発行エラー:', error);
    return null;
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('接続の解放に失敗:', releaseError);
      }
    }
  }
};

// 一時パスワード検証テスト
const testVerifyTemporaryPassword = async (loginCode, tempPassword) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // ユーザーと一時パスワードの存在確認
    const [rows] = await connection.execute(`
      SELECT 
        ua.id, 
        ua.name, 
        ua.role,
        utp.temp_password,
        utp.expires_at,
        utp.is_used
      FROM user_accounts ua
      JOIN user_temp_passwords utp ON ua.id = utp.user_id
      WHERE ua.login_code = ? AND utp.temp_password = ?
      ORDER BY utp.issued_at DESC
      LIMIT 1
    `, [loginCode, tempPassword]);

    if (rows.length === 0) {
      console.log('ログインコードまたはパスワードが正しくありません');
      return false;
    }

    const user = rows[0];
    console.log('検証対象ユーザー:', user);

    // 有効期限チェック
    if (!isPasswordValid(user.expires_at)) {
      console.log('パスワードの有効期限が切れています');
      return false;
    }

    // 使用済みチェック
    if (user.is_used) {
      console.log('このパスワードは既に使用されています');
      return false;
    }

    // ログイン時は使用済みフラグを更新しない（ログアウト時に更新）

    console.log('ログイン成功:', user.name);
    return true;
  } catch (error) {
    console.error('パスワード検証エラー:', error);
    return false;
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('接続の解放に失敗:', releaseError);
      }
    }
  }
};

// テスト実行
const runTest = async () => {
  console.log('=== 一時パスワードテスト開始 ===');
  
  // テスト用ユーザーID（実際の利用者IDに変更してください）
  const testUserId = 14;
  
  // 一時パスワード発行テスト
  console.log('\n1. 一時パスワード発行テスト');
  const result = await testIssueTemporaryPassword(testUserId);
  
  if (result) {
    console.log('発行成功:', result);
    
    // 一時パスワード検証テスト
    console.log('\n2. 一時パスワード検証テスト');
    const isValid = await testVerifyTemporaryPassword(result.loginCode, result.tempPassword);
    
    if (isValid) {
      console.log('検証成功');
    } else {
      console.log('検証失敗');
    }
  } else {
    console.log('発行失敗');
  }
  
  console.log('\n=== テスト完了 ===');
  process.exit(0);
};

runTest().catch(console.error);
