const { pool } = require('../backend/utils/database');

async function testDailyReports() {
  try {
    console.log('=== 日報取得処理テスト ===');
    
    // テスト用パラメータ
    const userId = '18';
    const startDate = '2025-08-26';
    const endDate = '2025-08-26';
    const page = 1;
    const limit = 20;
    
    console.log('テストパラメータ:', { userId, startDate, endDate, page, limit });
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (userId) {
      whereClause += ' AND rsdr.user_id = ?';
      params.push(userId);
    }
    
    if (startDate) {
      whereClause += ' AND rsdr.date >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      whereClause += ' AND rsdr.date <= ?';
      params.push(endDate);
    }
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    console.log('WHERE句:', whereClause);
    console.log('パラメータ:', params);
    console.log('OFFSET:', offset);
    console.log('LIMIT:', limit);
    
    // プレースホルダーの数を確認
    const placeholdersInWhere = (whereClause.match(/\?/g) || []).length;
    const totalPlaceholders = placeholdersInWhere + 2; // +2 for LIMIT and OFFSET
    const totalParams = params.length + 2;
    
    console.log('プレースホルダー数:', totalPlaceholders);
    console.log('パラメータ数:', totalParams);
    
    if (totalPlaceholders !== totalParams) {
      console.error('❌ プレースホルダー数とパラメータ数が一致しません');
      return;
    }
    
         // 実際のクエリを実行
     const queryParams = [...params, limit.toString(), offset.toString()];
     console.log('最終パラメータ:', queryParams);
     console.log('パラメータの型:', queryParams.map(p => typeof p));
    
         // まずシンプルなクエリでテスト
     console.log('シンプルなクエリでテスト...');
     const [simpleTest] = await pool.execute('SELECT COUNT(*) as count FROM remote_support_daily_records');
     console.log('シンプルクエリ結果:', simpleTest);
     
     // 次にWHERE句のみでテスト
     console.log('WHERE句のみでテスト...');
     const [whereTest] = await pool.execute(`
       SELECT COUNT(*) as count
       FROM remote_support_daily_records rsdr
       ${whereClause}
     `, params);
     console.log('WHERE句テスト結果:', whereTest);
     
     // 最後に完全なクエリを実行
     console.log('完全なクエリでテスト...');
     const [reports] = await pool.execute(`
       SELECT 
         rsdr.*,
         ua.name as user_name,
         ua.login_code,
         ua.instructor_id,
         i.name as instructor_name
       FROM remote_support_daily_records rsdr
       LEFT JOIN user_accounts ua ON rsdr.user_id = ua.id
       LEFT JOIN user_accounts i ON ua.instructor_id = i.id
       ${whereClause}
       ORDER BY rsdr.date DESC, rsdr.created_at DESC
       LIMIT ? OFFSET ?
     `, queryParams);
    
    console.log('✅ クエリ実行成功');
    console.log('取得件数:', reports.length);
    
    if (reports.length > 0) {
      console.log('最初のレコード:', reports[0]);
    }
    
  } catch (error) {
    console.error('❌ エラー:', error.message);
    console.error('スタックトレース:', error.stack);
  } finally {
    await pool.end();
  }
}

testDailyReports();
