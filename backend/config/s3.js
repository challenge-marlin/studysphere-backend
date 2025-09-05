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

// メタデータの文字列を安全な形式に変換する関数
const sanitizeMetadata = (str) => {
  if (!str) return '';
  // 日本語文字は保持し、S3で問題となる特殊文字のみを置換
  return str
    .replace(/[<>:"|?*]/g, '_') // S3で使用できない文字をアンダースコアに変換
    .replace(/\\/g, '_') // バックスラッシュをアンダースコアに変換
    .trim(); // 前後の空白を削除
};

// ファイル名を安全な形式に変換する関数（日本語保持）
const sanitizeFileName = (fileName) => {
  if (!fileName) return 'file';
  
  try {
    // 日本語文字を保持し、S3で問題となる特殊文字のみを置換
    const sanitized = fileName
      .replace(/[<>:"|?*]/g, '_') // S3で使用できない文字をアンダースコアに変換
      .replace(/\\/g, '_') // バックスラッシュをアンダースコアに変換
      .trim() // 前後の空白を削除
      .substring(0, 255); // 長さ制限
    
    // UTF-8として正しく処理できるか確認
    Buffer.from(sanitized, 'utf8');
    return sanitized;
  } catch (error) {
    // UTF-8エラーが発生した場合は、ASCII文字のみに変換
    console.warn('UTF-8 encoding error, converting to ASCII:', error.message);
    return fileName
      .replace(/[^\x00-\x7F]/g, '_') // 非ASCII文字をアンダースコアに変換
      .replace(/[<>:"|?*]/g, '_')
      .replace(/\\/g, '_')
      .trim()
      .substring(0, 255);
  }
};

// RFC 5987に準拠したUTF-8エンコーディング関数
const encodeRFC5987 = (str) => {
  if (!str) return '';
  
  try {
    // UTF-8バイト配列に変換してから、各バイトを%XX形式でエンコード
    const utf8Bytes = Buffer.from(str, 'utf8');
    const encoded = Array.from(utf8Bytes)
      .map(byte => '%' + byte.toString(16).padStart(2, '0').toUpperCase())
      .join('');
    
    return encoded;
  } catch (error) {
    // エラーが発生した場合は元の文字列をそのまま返す
    console.warn('UTF-8 encoding failed, using original string:', error.message);
    return str;
  }
};

// ファイル名を安全にエンコードする関数（ブラウザ互換性重視）
const encodeFileName = (str) => {
  if (!str) return '';
  
  try {
    // 日本語文字を保持しつつ、特殊文字のみエンコード
    return encodeURIComponent(str)
      .replace(/['()]/g, escape)
      .replace(/%20/g, '+');
  } catch (error) {
    console.warn('File name encoding failed, using original string:', error.message);
    return str;
  }
};

// S3操作のユーティリティ関数
const s3Utils = {
  // ファイルアップロード
  uploadFile: async (file, courseName, lessonName, fileName) => {
    try {
      // S3キーは日本語文字を保持（S3はUTF-8をサポート）
      const key = `lessons/${courseName}/${lessonName}/${fileName}`;
      
      const params = {
        Bucket: s3Config.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ContentDisposition: `attachment; filename*=UTF-8''${encodeRFC5987(fileName)}`,
        Metadata: {
          'original-name': Buffer.from(file.originalname, 'utf8').toString('base64'),
          'upload-date': new Date().toISOString(),
          'course-name': Buffer.from(courseName, 'utf8').toString('base64'),
          'lesson-name': Buffer.from(lessonName, 'utf8').toString('base64')
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
      
      // メタデータのBase64デコード
      const decodedMetadata = {};
      if (result.Metadata) {
        Object.keys(result.Metadata).forEach(key => {
          try {
            decodedMetadata[key] = Buffer.from(result.Metadata[key], 'base64').toString('utf8');
          } catch (error) {
            // デコードに失敗した場合は元の値を保持
            decodedMetadata[key] = result.Metadata[key];
          }
        });
      }
      
      customLogger.info(`S3 download successful: ${key}`, {
        bucket: s3Config.bucketName,
        key: key,
        size: result.ContentLength
      });

      return {
        success: true,
        data: result.Body,
        contentType: result.ContentType,
        metadata: decodedMetadata
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

      // PDFファイルの場合はブラウザ内表示用のパラメータを設定
      if (key.toLowerCase().endsWith('.pdf')) {
        params.ResponseContentDisposition = 'inline';
        params.ResponseContentType = 'application/pdf';
      }

      const url = await s3.getSignedUrlPromise('getObject', params);
      
      customLogger.info(`Presigned URL generated: ${key}`, {
        bucket: s3Config.bucketName,
        key: key,
        expiresIn: expiresIn,
        responseContentDisposition: params.ResponseContentDisposition || 'default'
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
      // S3設定が不完全な場合は空のリストを返す
      if (!s3Config.accessKeyId || !s3Config.secretAccessKey || s3Config.accessKeyId === 'your_aws_access_key_id') {
        customLogger.warn('S3設定が不完全なため、空のファイルリストを返します', {
          prefix: prefix
        });
        return {
          success: true,
          files: [],
          count: 0
        };
      }

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
      
      // S3エラーの場合は空のリストを返す
      return {
        success: false,
        files: [],
        count: 0,
        message: error.message
      };
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
  },

  // フォルダ削除（フォルダ内の全ファイルを削除）
  deleteFolder: async (prefix) => {
    try {
      // フォルダ内のファイル一覧を取得
      const listResult = await s3Utils.listFiles(prefix);
      
      if (listResult.files.length === 0) {
        customLogger.info(`S3 folder is empty or does not exist: ${prefix}`, {
          bucket: s3Config.bucketName,
          prefix: prefix
        });
        return {
          success: true,
          message: 'Folder is empty or does not exist',
          deletedCount: 0
        };
      }

      // 削除対象のファイルキーを準備
      const deleteParams = {
        Bucket: s3Config.bucketName,
        Delete: {
          Objects: listResult.files.map(file => ({ Key: file.Key })),
          Quiet: false
        }
      };

      // 複数ファイルを一括削除
      const deleteResult = await s3.deleteObjects(deleteParams).promise();
      
      customLogger.info(`S3 folder delete successful: ${prefix}`, {
        bucket: s3Config.bucketName,
        prefix: prefix,
        deletedCount: deleteResult.Deleted ? deleteResult.Deleted.length : 0,
        errorCount: deleteResult.Errors ? deleteResult.Errors.length : 0
      });

      return {
        success: true,
        message: 'Folder deleted successfully',
        deletedCount: deleteResult.Deleted ? deleteResult.Deleted.length : 0,
        errors: deleteResult.Errors || []
      };
    } catch (error) {
      customLogger.error('S3 folder delete failed', {
        error: error.message,
        prefix: prefix
      });
      throw error;
    }
  },

  // フォルダダウンロード（ZIP形式）
  downloadFolder: async (prefix, folderName) => {
    try {
      const JSZip = require('jszip');
      const zip = new JSZip();
      
      // フォルダ内のファイル一覧を取得
      const listResult = await s3Utils.listFiles(prefix);
      
      if (listResult.files.length === 0) {
        customLogger.info(`S3 folder is empty or does not exist: ${prefix}`, {
          bucket: s3Config.bucketName,
          prefix: prefix
        });
        return {
          success: false,
          message: 'Folder is empty or does not exist'
        };
      }

      // 各ファイルをダウンロードしてZIPに追加
      for (const file of listResult.files) {
        try {
          const fileResult = await s3Utils.downloadFile(file.Key);
          
          // ファイルパスからフォルダ名を除去してZIP内のパスを決定
          const relativePath = file.Key.replace(prefix, '').replace(/^\//, '');
          const fileName = relativePath || file.Key.split('/').pop();
          
          // 元のファイル名を復元
          let originalFileName = fileName;
          if (fileResult.metadata && fileResult.metadata['original-name']) {
            originalFileName = fileResult.metadata['original-name'];
          }
          
          zip.file(originalFileName, fileResult.data);
          
          customLogger.info(`File added to ZIP: ${originalFileName}`, {
            originalKey: file.Key,
            originalName: originalFileName
          });
        } catch (fileError) {
          customLogger.warn(`Failed to download file for ZIP: ${file.Key}`, {
            error: fileError.message
          });
          // 個別ファイルのダウンロード失敗は続行
        }
      }

      // ZIPファイルを生成
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      
      customLogger.info(`S3 folder download successful: ${prefix}`, {
        bucket: s3Config.bucketName,
        prefix: prefix,
        fileCount: listResult.files.length,
        zipSize: zipBuffer.length
      });

      return {
        success: true,
        data: zipBuffer,
        contentType: 'application/zip',
        fileName: `${folderName || 'folder'}.zip`,
        fileCount: listResult.files.length
      };
    } catch (error) {
      customLogger.error('S3 folder download failed', {
        error: error.message,
        prefix: prefix
      });
      throw error;
    }
  }
};

module.exports = {
  s3,
  s3Config,
  s3Utils,
  encodeRFC5987,
  encodeFileName
}; 