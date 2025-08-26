require('dotenv').config();

console.log('=== S3環境変数チェック ===');
console.log('');

// 環境変数の確認
const envVars = {
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  AWS_REGION: process.env.AWS_REGION || 'ap-northeast-1',
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET || 'studysphere'
};

console.log('環境変数設定状況:');
Object.entries(envVars).forEach(([key, value]) => {
  if (key.includes('SECRET')) {
    console.log(`- ${key}: ${value ? '設定済み（値は非表示）' : '未設定'}`);
  } else {
    console.log(`- ${key}: ${value || '未設定'}`);
  }
});

console.log('');

// 設定状況の判定
const missingVars = Object.entries(envVars)
  .filter(([key, value]) => !value && key !== 'AWS_REGION' && key !== 'AWS_S3_BUCKET')
  .map(([key]) => key);

if (missingVars.length > 0) {
  console.log('❌ 問題: 以下の環境変数が設定されていません:');
  missingVars.forEach(varName => console.log(`  - ${varName}`));
  console.log('');
  console.log('解決方法:');
  console.log('1. .envファイルを作成し、以下の内容を設定してください:');
  console.log('   AWS_ACCESS_KEY_ID=your_aws_access_key_id');
  console.log('   AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key');
  console.log('   AWS_REGION=ap-northeast-1');
  console.log('   AWS_S3_BUCKET=studysphere');
  console.log('');
  console.log('2. バックエンドを再起動してください');
} else {
  console.log('✅ すべての必要な環境変数が設定されています');
  console.log('');
  console.log('次のステップ:');
  console.log('1. node test-s3-config.js を実行してS3接続をテストしてください');
  console.log('2. Electronアプリでログインを試してください');
}

console.log('');
