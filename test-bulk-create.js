async function testBulkCreate() {
  // selectedSatelliteの構造を模擬したテストデータ
  const testData = {
    users: [
      {
        name: 'テストユーザー（メールあり）',
        email: 'test@example.com',
        instructor_id: null,
        company_id: 1, // selectedSatellite.company_idから取得される値
        satellite_id: 1, // selectedSatellite.idから取得される値
        tags: []
      },
      {
        name: 'テストユーザー（メールなし）',
        email: null,
        instructor_id: null,
        company_id: 1, // selectedSatellite.company_idから取得される値
        satellite_id: 1, // selectedSatellite.idから取得される値
        tags: []
      }
    ]
  };

  // selectedSatelliteの構造をログ出力
  console.log('=== selectedSatellite構造の例 ===');
  console.log('sessionStorage.getItem("selectedSatellite")の期待値:');
  console.log(JSON.stringify({
    id: 1, // satellite_id
    name: "テスト拠点",
    company_id: 1, // これが使用されるcompany_id
    company_name: "テスト企業"
  }, null, 2));

  try {
    console.log('テストデータ:', JSON.stringify(testData, null, 2));
    
    const response = await fetch('http://localhost:5000/api/users/bulk-create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    console.log('レスポンスステータス:', response.status);
    console.log('レスポンスOK:', response.ok);

    const responseData = await response.json();
    console.log('レスポンスデータ:', JSON.stringify(responseData, null, 2));
    
    if (response.ok) {
      console.log('✅ テスト成功: ユーザーが正常に作成されました');
    } else {
      console.log('❌ テスト失敗: エラーが発生しました');
      console.log('エラー詳細:', responseData);
    }

  } catch (error) {
    console.error('エラー:', error);
  }
}

testBulkCreate();
