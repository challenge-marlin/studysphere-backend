const AWS = require('aws-sdk');
const { customLogger } = require('../utils/logger');

// AWS S3設定
const s3Config = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'ap-northeast-1',
  bucketName: process.env.AWS_S3_BUCKET || 'studysphere'
};

// S3インスタンスの作成
const s3 = new AWS.S3({
  accessKeyId: s3Config.accessKeyId,
  secretAccessKey: s3Config.secretAccessKey,
  region: s3Config.region
});

// S3操作のユーティリティ関数
const s3Utils = {
  // ファイルアップロード
  uploadFile: async (file, courseName, lessonName, fileName) => {
    try {
      const key = `lessons/${courseName}/${lessonName}/${fileName}`;
      
      const params = {
        Bucket: s3Config.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        Metadata: {
          'original-name': file.originalname,
          'upload-date': new Date().toISOString(),
          'course-name': courseName,
          'lesson-name': lessonName
        }
      };

      const result = await s3.upload(params).promise();
      
      customLogger.info(`S3 upload successful: ${key}`, {
        bucket: s3Config.bucketName,
        key: key,
        size: file.size
      });

      return {
        success: true,
        key: key,
        url: result.Location,
        etag: result.ETag
      };
    } catch (error) {
      customLogger.error('S3 upload failed', {
        error: error.message,
        courseName,
        lessonName,
        fileName
      });
      throw error;
    }
  },

  // ファイルダウンロード
  downloadFile: async (key) => {
    try {
      const params = {
        Bucket: s3Config.bucketName,
        Key: key
      };

      const result = await s3.getObject(params).promise();
      
      customLogger.info(`S3 download successful: ${key}`, {
        bucket: s3Config.bucketName,
        key: key,
        size: result.ContentLength
      });

      return {
        success: true,
        data: result.Body,
        contentType: result.ContentType,
        metadata: result.Metadata
      };
    } catch (error) {
      customLogger.error('S3 download failed', {
        error: error.message,
        key: key
      });
      throw error;
    }
  },

  // 署名付きURL生成（一時的なアクセス用）
  generatePresignedUrl: async (key, expiresIn = 3600) => {
    try {
      const params = {
        Bucket: s3Config.bucketName,
        Key: key,
        Expires: expiresIn
      };

      const url = await s3.getSignedUrlPromise('getObject', params);
      
      customLogger.info(`Presigned URL generated: ${key}`, {
        bucket: s3Config.bucketName,
        key: key,
        expiresIn: expiresIn
      });

      return {
        success: true,
        url: url,
        expiresIn: expiresIn
      };
    } catch (error) {
      customLogger.error('Presigned URL generation failed', {
        error: error.message,
        key: key
      });
      throw error;
    }
  },

  // ファイル削除
  deleteFile: async (key) => {
    try {
      const params = {
        Bucket: s3Config.bucketName,
        Key: key
      };

      await s3.deleteObject(params).promise();
      
      customLogger.info(`S3 delete successful: ${key}`, {
        bucket: s3Config.bucketName,
        key: key
      });

      return {
        success: true,
        message: 'File deleted successfully'
      };
    } catch (error) {
      customLogger.error('S3 delete failed', {
        error: error.message,
        key: key
      });
      throw error;
    }
  },

  // フォルダ内のファイル一覧取得
  listFiles: async (prefix) => {
    try {
      const params = {
        Bucket: s3Config.bucketName,
        Prefix: prefix
      };

      const result = await s3.listObjectsV2(params).promise();
      
      customLogger.info(`S3 list files successful: ${prefix}`, {
        bucket: s3Config.bucketName,
        prefix: prefix,
        count: result.Contents ? result.Contents.length : 0
      });

      return {
        success: true,
        files: result.Contents || [],
        count: result.Contents ? result.Contents.length : 0
      };
    } catch (error) {
      customLogger.error('S3 list files failed', {
        error: error.message,
        prefix: prefix
      });
      throw error;
    }
  },

  // ファイル存在確認
  fileExists: async (key) => {
    try {
      const params = {
        Bucket: s3Config.bucketName,
        Key: key
      };

      await s3.headObject(params).promise();
      return true;
    } catch (error) {
      if (error.code === 'NotFound') {
        return false;
      }
      throw error;
    }
  }
};

module.exports = {
  s3,
  s3Config,
  s3Utils
}; 