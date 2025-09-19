const { pool } = require('../utils/database');

/**
 * admin_credentialsテーブルのusername重複チェック
 */
const checkUsernameDuplicates = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    console.log('=== admin_credentialsテーブルのusername重複チェック開始 ===');
    
    // 重複するusernameを検索
    const [duplicates] = await connection.execute(`
      SELECT 
        username, 
        COUNT(*) as count,
        GROUP_CONCAT(id) as ids,
        GROUP_CONCAT(user_id) as user_ids
      FROM admin_credentials 
      GROUP BY username 
      HAVING COUNT(*) > 1
      ORDER BY username
    `);
    
    if (duplicates.length === 0) {
      console.log('✅ 重複するusernameは見つかりませんでした');
      return {
        success: true,
        message: '重複するusernameは見つかりませんでした',
        duplicates: []
      };
    }
    
    console.log(`⚠️ ${duplicates.length}件の重複usernameが見つかりました:`);
    
    for (const duplicate of duplicates) {
      console.log(`- username: "${duplicate.username}" (${duplicate.count}件)`);
      console.log(`  IDs: ${duplicate.ids}`);
      console.log(`  User IDs: ${duplicate.user_ids}`);
      
      // 各重複レコードの詳細情報を取得
      const [details] = await connection.execute(`
        SELECT 
          ac.id,
          ac.user_id,
          ac.username,
          ua.name as user_name,
          ua.role,
          ua.status,
          ua.login_code
        FROM admin_credentials ac
        JOIN user_accounts ua ON ac.user_id = ua.id
        WHERE ac.username = ?
        ORDER BY ac.id
      `, [duplicate.username]);
      
      console.log('  詳細:');
      for (const detail of details) {
        console.log(`    - ID: ${detail.id}, User ID: ${detail.user_id}, Name: ${detail.user_name}, Role: ${detail.role}, Status: ${detail.status}, Login Code: ${detail.login_code}`);
      }
      console.log('');
    }
    
    return {
      success: true,
      message: `${duplicates.length}件の重複usernameが見つかりました`,
      duplicates: duplicates
    };
    
  } catch (error) {
    console.error('重複チェックエラー:', error);
    return {
      success: false,
      message: '重複チェックに失敗しました',
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
 * 重複usernameの修正（最初のレコード以外を削除）
 */
const fixUsernameDuplicates = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    console.log('=== 重複usernameの修正開始 ===');
    
    await connection.beginTransaction();
    
    // 重複するusernameを検索
    const [duplicates] = await connection.execute(`
      SELECT 
        username, 
        COUNT(*) as count,
        GROUP_CONCAT(id ORDER BY id) as ids
      FROM admin_credentials 
      GROUP BY username 
      HAVING COUNT(*) > 1
      ORDER BY username
    `);
    
    if (duplicates.length === 0) {
      console.log('✅ 修正対象の重複usernameはありません');
      await connection.commit();
      return {
        success: true,
        message: '修正対象の重複usernameはありません'
      };
    }
    
    let fixedCount = 0;
    
    for (const duplicate of duplicates) {
      const ids = duplicate.ids.split(',').map(id => parseInt(id.trim()));
      const keepId = ids[0]; // 最初のIDを保持
      const deleteIds = ids.slice(1); // 残りを削除
      
      console.log(`修正中: username="${duplicate.username}"`);
      console.log(`  保持するID: ${keepId}`);
      console.log(`  削除するIDs: ${deleteIds.join(', ')}`);
      
      // 削除対象のレコードの詳細を取得
      for (const deleteId of deleteIds) {
        const [record] = await connection.execute(`
          SELECT 
            ac.id,
            ac.user_id,
            ua.name as user_name,
            ua.role,
            ua.status
          FROM admin_credentials ac
          JOIN user_accounts ua ON ac.user_id = ua.id
          WHERE ac.id = ?
        `, [deleteId]);
        
        if (record.length > 0) {
          const user = record[0];
          console.log(`    削除対象: ID=${user.id}, User ID=${user.user_id}, Name=${user.user_name}, Role=${user.role}, Status=${user.status}`);
          
          // admin_credentialsレコードを削除
          await connection.execute(`
            DELETE FROM admin_credentials WHERE id = ?
          `, [deleteId]);
          
          fixedCount++;
        }
      }
    }
    
    await connection.commit();
    
    console.log(`✅ 修正完了: ${fixedCount}件の重複レコードを削除しました`);
    
    return {
      success: true,
      message: `${fixedCount}件の重複レコードを削除しました`,
      fixedCount: fixedCount
    };
    
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('重複修正エラー:', error);
    return {
      success: false,
      message: '重複修正に失敗しました',
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
  
  if (command === 'check') {
    checkUsernameDuplicates()
      .then(result => {
        console.log('結果:', result);
        process.exit(result.success ? 0 : 1);
      })
      .catch(error => {
        console.error('エラー:', error);
        process.exit(1);
      });
  } else if (command === 'fix') {
    fixUsernameDuplicates()
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
    console.log('  node check-username-duplicates.js check  # 重複チェック');
    console.log('  node check-username-duplicates.js fix    # 重複修正');
    process.exit(1);
  }
}

module.exports = {
  checkUsernameDuplicates,
  fixUsernameDuplicates
};
