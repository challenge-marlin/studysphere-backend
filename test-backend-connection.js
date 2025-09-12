const http = require('http');

function testBackendConnection() {
    const options = {
        hostname: 'localhost',
        port: 5050,
        path: '/api/test/health',
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    };

    const req = http.request(options, (res) => {
        console.log(`ステータス: ${res.statusCode}`);
        console.log(`ヘッダー:`, res.headers);

        let data = '';
        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            console.log('レスポンス:', data);
        });
    });

    req.on('error', (error) => {
        console.error('エラー:', error.message);
    });

    req.end();
}

console.log('バックエンド接続テスト開始...');
testBackendConnection();
