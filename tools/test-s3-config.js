const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const AWS = require('aws-sdk');

console.log('=== S3設定テスト ===');

// 環境変数の確認
console.log('環境変数確認:');
console.log('- AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? '設定済み' : '未設定');
console.log('- AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? '設定済み' : '未設定');
console.log('- AWS_REGION:', process.env.AWS_REGION || 'ap-northeast-1');

// S3インスタンスの作成
const s3 = new AWS.S3({
  region: 'ap-northeast-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

// バケットの存在確認
async function testS3Connection() {
  try {
    console.log('\n=== S3接続テスト ===');
    
    // バケットの存在確認
    const bucketExists = await s3.headBucket({ Bucket: 'studysphere' }).promise();
    console.log('✅ バケット "studysphere" にアクセス可能');
    
    // テストファイルのアップロード
    console.log('\n=== テストファイルアップロード ===');
    const testData = Buffer.from('test file content');
    const uploadResult = await s3.upload({
      Bucket: 'studysphere',
      Key: 'test/connection-test.txt',
      Body: testData,
      ContentType: 'text/plain'
    }).promise();
    
    console.log('✅ テストファイルアップロード成功:', uploadResult.Location);
    
    // テストファイルの削除
    await s3.deleteObject({
      Bucket: 'studysphere',
      Key: 'test/connection-test.txt'
    }).promise();
    
    console.log('✅ テストファイル削除完了');
    console.log('\n🎉 S3設定は正常です！');
    
  } catch (error) {
    console.error('❌ S3接続エラー:', error.message);
    
    if (error.code === 'NoSuchBucket') {
      console.error('バケット "studysphere" が存在しません');
    } else if (error.code === 'InvalidAccessKeyId') {
      console.error('AWS_ACCESS_KEY_ID が無効です');
    } else if (error.code === 'SignatureDoesNotMatch') {
      console.error('AWS_SECRET_ACCESS_KEY が無効です');
    } else if (error.code === 'CredentialsError') {
      console.error('認証情報が設定されていません');
    }
  }
}

testS3Connection();
