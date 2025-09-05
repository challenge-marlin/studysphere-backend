const fetch = require('node-fetch');

async function testAPIEndpoint() {
  try {
    console.log('APIエンドポイントをテスト中...');
    
    // ユーザーID 98でコース一覧を取得
    const url = 'http://localhost:5050/api/student/courses?userId=98';
    console.log('テストURL:', url);
    
    const response = await fetch(url);
    console.log('レスポンスステータス:', response.status);
    console.log('レスポンスヘッダー:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const data = await response.json();
      console.log('\n=== APIレスポンス ===');
      console.log('成功:', data.success);
      console.log('データ件数:', data.data ? data.data.length : 'なし');
      
      if (data.data && data.data.length > 0) {
        console.log('\n=== 最初のコースの詳細 ===');
        const firstCourse = data.data[0];
        console.log('コースID:', firstCourse.id);
        console.log('コース名:', firstCourse.title);
        console.log('カリキュラムパス名:', firstCourse.curriculum_path_name);
        console.log('カリキュラムパス説明:', firstCourse.curriculum_path_description);
        console.log('全プロパティ:', Object.keys(firstCourse));
      }
    } else {
      console.error('API呼び出し失敗:', response.status, response.statusText);
      try {
        const errorData = await response.text();
        console.error('エラーレスポンス:', errorData);
      } catch (e) {
        console.error('エラーレスポンスの解析に失敗:', e);
      }
    }
    
  } catch (error) {
    console.error('テスト実行エラー:', error);
  }
}

testAPIEndpoint();
