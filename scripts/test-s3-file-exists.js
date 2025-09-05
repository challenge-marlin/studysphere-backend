const AWS = require('aws-sdk');
require('dotenv').config();

// S3設定
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'ap-northeast-1'
});

async function testS3FileExists(s3Key) {
  try {
    console.log(`S3ファイルの存在確認を開始: ${s3Key}`);
    console.log('S3設定:', {
      bucket: process.env.AWS_S3_BUCKET,
      region: process.env.AWS_REGION || 'ap-northeast-1',
      hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
      hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY
    });

    // ファイルの存在確認
    const headResult = await s3.headObject({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: s3Key
    }).promise();

    console.log('✅ ファイルが存在します:', {
      s3Key,
      bucket: process.env.AWS_S3_BUCKET,
      contentType: headResult.ContentType,
      contentLength: headResult.ContentLength,
      lastModified: headResult.LastModified
    });

    return true;
  } catch (error) {
    if (error.code === 'NotFound') {
      console.log('❌ ファイルが存在しません:', {
        s3Key,
        bucket: process.env.AWS_S3_BUCKET,
        error: error.message
      });
    } else {
      console.log('❌ S3エラーが発生しました:', {
        s3Key,
        bucket: process.env.AWS_S3_BUCKET,
        error: error.message,
        code: error.code
      });
    }
    return false;
  }
}

// コマンドライン引数からS3キーを取得
const s3Key = process.argv[2];

if (!s3Key) {
  console.log('使用方法: node test-s3-file-exists.js <S3キー>');
  console.log('例: node test-s3-file-exists.js "lessons/course1/lesson1/document.pdf"');
  process.exit(1);
}

// テスト実行
testS3FileExists(s3Key)
  .then(exists => {
    console.log(`\n結果: ファイルは${exists ? '存在します' : '存在しません'}`);
    process.exit(exists ? 0 : 1);
  })
  .catch(error => {
    console.error('テスト実行エラー:', error);
    process.exit(1);
  });
