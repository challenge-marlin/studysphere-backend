const { pool } = require('../utils/database');

/**
 * admin_credentialsテーブルのusernameフィールドにユニーク制約を追加
 */
const addUsernameUniqueConstraint = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    console.log('=== admin_credentialsテーブルのusernameユニーク制約追加開始 ===');
    
    // 現在のインデックス状況を確認
    console.log('現在のインデックス状況を確認中...');
    const [indexes] = await connection.execute(`
      SHOW INDEX FROM admin_credentials WHERE Column_name = 'username'
    `);
    
    console.log('現在のusernameインデックス:');
    for (const index of indexes) {
      console.log(`- ${index.Key_name}: ${index.Column_name} (${index.Non_unique === 0 ? 'UNIQUE' : 'NON-UNIQUE'})`);
    }
    
    // 既存のidx_usernameインデックスを削除（存在する場合）
    const existingIndex = indexes.find(idx => idx.Key_name === 'idx_username');
    if (existingIndex) {
      console.log('既存のidx_usernameインデックスを削除中...');
      await connection.execute(`DROP INDEX idx_username ON admin_credentials`);
      console.log('✅ 既存のidx_usernameインデックスを削除しました');
    }
    
    // ユニーク制約を追加
    console.log('usernameフィールドにユニーク制約を追加中...');
    await connection.execute(`
      ALTER TABLE admin_credentials 
      ADD CONSTRAINT unique_username UNIQUE (username)
    `);
    
    console.log('✅ usernameフィールドにユニーク制約を追加しました');
    
    // 追加後のインデックス状況を確認
    console.log('追加後のインデックス状況を確認中...');
    const [newIndexes] = await connection.execute(`
      SHOW INDEX FROM admin_credentials WHERE Column_name = 'username'
    `);
    
    console.log('追加後のusernameインデックス:');
    for (const index of newIndexes) {
      console.log(`- ${index.Key_name}: ${index.Column_name} (${index.Non_unique === 0 ? 'UNIQUE' : 'NON-UNIQUE'})`);
    }
    
    return {
      success: true,
      message: 'usernameフィールドにユニーク制約を正常に追加しました'
    };
    
  } catch (error) {
    console.error('ユニーク制約追加エラー:', error);
    return {
      success: false,
      message: 'ユニーク制約の追加に失敗しました',
      error: error.message
    };
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

/**
 * ユニーク制約のテスト（重複データ挿入を試行）
 */
const testUniqueConstraint = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    console.log('=== ユニーク制約のテスト開始 ===');
    
    // 既存のusernameを1つ取得
    const [existingUsers] = await connection.execute(`
      SELECT username FROM admin_credentials LIMIT 1
    `);
    
    if (existingUsers.length === 0) {
      console.log('⚠️ テスト用の既存usernameが見つかりません');
      return {
        success: true,
        message: 'テスト用の既存usernameが見つかりません'
      };
    }
    
    const testUsername = existingUsers[0].username;
    console.log(`テスト用username: ${testUsername}`);
    
    // 既存のuser_idを1つ取得
    const [existingUser] = await connection.execute(`
      SELECT user_id FROM admin_credentials WHERE username = ?
    `, [testUsername]);
    
    if (existingUser.length === 0) {
      console.log('⚠️ テスト用の既存user_idが見つかりません');
      return {
        success: true,
        message: 'テスト用の既存user_idが見つかりません'
      };
    }
    
    const testUserId = existingUser[0].user_id;
    console.log(`テスト用user_id: ${testUserId}`);
    
    // 重複するusernameで挿入を試行（エラーが発生することを期待）
    try {
      await connection.execute(`
        INSERT INTO admin_credentials (user_id, username, password_hash)
        VALUES (?, ?, 'test_hash')
      `, [testUserId, testUsername]);
      
      console.log('❌ ユニーク制約が正しく動作していません（重複挿入が成功してしまいました）');
      return {
        success: false,
        message: 'ユニーク制約が正しく動作していません'
      };
      
    } catch (insertError) {
      if (insertError.code === 'ER_DUP_ENTRY') {
        console.log('✅ ユニーク制約が正しく動作しています（重複挿入が適切に拒否されました）');
        return {
          success: true,
          message: 'ユニーク制約が正しく動作しています'
        };
      } else {
        console.log('⚠️ 予期しないエラーが発生しました:', insertError.message);
        return {
          success: false,
          message: '予期しないエラーが発生しました',
          error: insertError.message
        };
      }
    }
    
  } catch (error) {
    console.error('ユニーク制約テストエラー:', error);
    return {
      success: false,
      message: 'ユニーク制約テストに失敗しました',
      error: error.message
    };
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

// スクリプトとして実行された場合
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'add') {
    addUsernameUniqueConstraint()
      .then(result => {
        console.log('結果:', result);
        process.exit(result.success ? 0 : 1);
      })
      .catch(error => {
        console.error('エラー:', error);
        process.exit(1);
      });
  } else if (command === 'test') {
    testUniqueConstraint()
      .then(result => {
        console.log('結果:', result);
        process.exit(result.success ? 0 : 1);
      })
      .catch(error => {
        console.error('エラー:', error);
        process.exit(1);
      });
  } else {
    console.log('使用方法:');
    console.log('  node add-username-unique-constraint.js add   # ユニーク制約追加');
    console.log('  node add-username-unique-constraint.js test  # ユニーク制約テスト');
    process.exit(1);
  }
}

module.exports = {
  addUsernameUniqueConstraint,
  testUniqueConstraint
};
