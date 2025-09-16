const { pool } = require('../utils/database');
const { customLogger } = require('../utils/logger');
const AWS = require('aws-sdk');
const path = require('path');

// S3設定
const s3 = new AWS.S3({
  region: 'ap-northeast-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

class RemoteSupportController {
  /**
   * 画像アップロード（カメラ・スクリーンショット）
   */
  static async uploadCapture(req, res) {
    try {
      // デバッグ用ログを追加
      customLogger.info('デバッグ: req.bodyの内容:', req.body);
      customLogger.info('デバッグ: req.filesの内容:', req.files);
      
      const { userToken } = req.body;
      const files = req.files;

      // userTokenがundefinedの場合の処理
      if (!userToken || userToken === 'undefined') {
        customLogger.error('userTokenが未定義または無効です:', { userToken, body: req.body });
        return res.status(400).json({
          success: false,
          message: 'ユーザートークンが無効です'
        });
      }

      // S3設定の確認
      const s3Config = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || 'ap-northeast-1',
        bucketName: 'studysphere'
      };

      customLogger.info('S3設定確認:', {
        accessKeyId: s3Config.accessKeyId ? '設定済み' : '未設定',
        secretAccessKey: s3Config.secretAccessKey ? '設定済み' : '未設定',
        region: s3Config.region,
        bucketName: s3Config.bucketName
      });

      // S3設定の検証
      if (!s3Config.accessKeyId || !s3Config.secretAccessKey) {
        customLogger.error('S3認証情報が設定されていません');
        return res.status(500).json({
          success: false,
          message: 'S3設定が不完全です'
        });
      }

      if (!userToken) {
        return res.status(400).json({
          success: false,
          message: 'ユーザートークンが必須です'
        });
      }

      customLogger.info('アップロードリクエスト受信:', {
        userToken,
        hasPhoto: files.photo && files.photo[0] ? 'Yes' : 'No',
        hasScreenshot: files.screenshot && files.screenshot[0] ? 'Yes' : 'No',
        photoSize: files.photo && files.photo[0] ? files.photo[0].size : 0,
        screenshotSize: files.screenshot && files.screenshot[0] ? files.screenshot[0].size : 0
      });

      // ログインコードからユーザー情報を取得
      const [users] = await pool.execute(
        'SELECT id, login_code, company_id, satellite_ids FROM user_accounts WHERE login_code = ?',
        [userToken]
      );

      if (users.length === 0) {
        customLogger.warn('ユーザーが見つかりません:', { userToken });
        return res.status(404).json({
          success: false,
          message: 'ユーザーが見つかりません'
        });
      }

      const user = users[0];
      customLogger.info('ユーザー情報取得完了:', {
        userId: user.id,
        loginCode: user.login_code,
        companyId: user.company_id,
        satelliteIds: user.satellite_ids
      });
      
      // 企業・拠点情報を取得
      if (!user.company_id) {
        customLogger.error('ユーザーの企業IDが設定されていません:', {
          userId: user.id,
          loginCode: user.login_code,
          companyId: user.company_id
        });
        return res.status(400).json({
          success: false,
          message: 'ユーザーの企業情報が設定されていません'
        });
      }

      const [companies] = await pool.execute(
        'SELECT token FROM companies WHERE id = ?',
        [user.company_id]
      );

             // satellite_idsの安全なパース
       let satelliteIds = [];
       try {
         if (user.satellite_ids) {
           // カンマ区切りの文字列として保存されている場合の処理
           if (user.satellite_ids.includes(',')) {
             satelliteIds = user.satellite_ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
           } else {
             // 単一の値の場合の処理
             try {
               const parsed = JSON.parse(user.satellite_ids);
               // JSON.parseの結果が配列の場合はそのまま使用
               if (Array.isArray(parsed)) {
                 satelliteIds = parsed;
               } else {
                 // 単一の値の場合は配列に変換
                 satelliteIds = [parsed];
               }
             } catch (jsonError) {
               // JSONとしてパースできない場合は単一の数値として処理
               const singleId = parseInt(user.satellite_ids);
               if (!isNaN(singleId)) {
                 satelliteIds = [singleId];
               } else {
                 throw jsonError;
               }
             }
           }
         }
       } catch (error) {
        customLogger.error('satellite_idsのパースに失敗:', {
          satelliteIds: user.satellite_ids,
          error: error.message
        });
        return res.status(500).json({
          success: false,
          message: '拠点情報の処理に失敗しました'
        });
      }

      if (!satelliteIds || satelliteIds.length === 0) {
        customLogger.warn('拠点IDが設定されていません:', {
          userId: user.id,
          satelliteIds: user.satellite_ids
        });
        return res.status(400).json({
          success: false,
          message: '拠点情報が設定されていません'
        });
      }

      const [satellites] = await pool.execute(
        'SELECT token FROM satellites WHERE id = ?',
        [satelliteIds[0]] // 最初の拠点を使用
      );

      if (companies.length === 0 || satellites.length === 0) {
        customLogger.warn('企業または拠点情報が見つかりません:', {
          companyId: user.company_id,
          satelliteIds: user.satellite_ids,
          companiesFound: companies.length,
          satellitesFound: satellites.length
        });
        return res.status(404).json({
          success: false,
          message: '企業または拠点情報が見つかりません'
        });
      }

      const companyToken = companies[0].token;
      const satelliteToken = satellites[0].token;
      const userLoginCode = user.login_code;

      customLogger.info('企業・拠点情報取得完了:', {
        companyToken,
        satelliteToken,
        userLoginCode
      });

      // 現在の日時
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const timestamp = `${year}${month}${day}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

      // S3パス構造: capture/{企業トークン}/{拠点トークン}/{利用者トークン}/YYYY/MM/DD/
      const basePath = `capture/${companyToken}/${satelliteToken}/${userLoginCode}/${year}/${month}/${day}`;

      customLogger.info('S3アップロード準備完了:', {
        basePath,
        timestamp,
        uploadPromises: []
      });

      const uploadPromises = [];

      // カメラ画像のアップロード
      if (files.photo && files.photo[0] && files.photo[0].buffer) {
        const photoKey = `${basePath}/camera/${timestamp}.png`;
        customLogger.info('カメラ画像アップロード開始:', {
          photoKey,
          photoSize: files.photo[0].size
        });
        
        uploadPromises.push(
          s3.upload({
            Bucket: 'studysphere',
            Key: photoKey,
            Body: files.photo[0].buffer,
            ContentType: 'image/png'
          }).promise()
        );
      } else {
        customLogger.warn('カメラ画像が存在しないか、バッファが空です:', {
          hasPhoto: !!files.photo,
          hasPhotoArray: !!(files.photo && files.photo[0]),
          hasBuffer: !!(files.photo && files.photo[0] && files.photo[0].buffer)
        });
      }

      // スクリーンショットのアップロード
      if (files.screenshot && files.screenshot[0] && files.screenshot[0].buffer) {
        const screenshotKey = `${basePath}/screenshot/${timestamp}.png`;
        customLogger.info('スクリーンショットアップロード開始:', {
          screenshotKey,
          screenshotSize: files.screenshot[0].size
        });
        
        uploadPromises.push(
          s3.upload({
            Bucket: 'studysphere',
            Key: screenshotKey,
            Body: files.screenshot[0].buffer,
            ContentType: 'image/png'
          }).promise()
        );
      } else {
        customLogger.warn('スクリーンショットが存在しないか、バッファが空です:', {
          hasScreenshot: !!files.screenshot,
          hasScreenshotArray: !!(files.screenshot && files.screenshot[0]),
          hasBuffer: !!(files.screenshot && files.screenshot[0] && files.screenshot[0].buffer)
        });
      }

      customLogger.info('S3アップロード実行開始:', {
        uploadCount: uploadPromises.length
      });

      // アップロード実行
      let uploadResults = [];
      if (uploadPromises.length === 0) {
        customLogger.warn('アップロードする画像がありません');
        return res.status(400).json({
          success: false,
          message: 'アップロードする画像がありません'
        });
      }

      try {
        uploadResults = await Promise.all(uploadPromises);
        
        customLogger.info('S3アップロード完了:', {
          results: uploadResults.map(result => ({
            key: result.Key,
            location: result.Location
          }))
        });
      } catch (error) {
        customLogger.error('S3アップロード失敗:', {
          error: error.message,
          code: error.code,
          statusCode: error.statusCode
        });
        return res.status(500).json({
          success: false,
          message: 'S3へのアップロードに失敗しました',
          error: error.message
        });
      }

      // 画像URLを準備
      const photoUrl = files.photo ? `${basePath}/camera/${timestamp}.png` : null;
      const screenshotUrl = files.screenshot ? `${basePath}/screenshot/${timestamp}.png` : null;

      // データベースに画像URLを保存
      try {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD形式
        
                 // 既存のレコードを確認
         if (!user.id) {
           customLogger.error('ユーザーIDが未定義です:', {
             user: user,
             loginCode: user.login_code
           });
           return res.status(500).json({
             success: false,
             message: 'ユーザー情報が不正です'
           });
         }

         const [existingRecords] = await pool.execute(
           'SELECT id, webcam_photos, screenshots FROM remote_support_daily_records WHERE user_id = ? AND DATE(created_at) = ?',
           [user.id, today]
         );

        let webcamPhotos = [];
        let screenshots = [];

                 if (existingRecords.length > 0) {
           // 既存レコードがある場合、既存の画像URLを取得
           const record = existingRecords[0];
           try {
             webcamPhotos = record.webcam_photos ? JSON.parse(record.webcam_photos) : [];
           } catch (error) {
             customLogger.warn('既存のwebcam_photosパースに失敗、空配列で初期化:', error.message);
             webcamPhotos = [];
           }
           
           try {
             screenshots = record.screenshots ? JSON.parse(record.screenshots) : [];
           } catch (error) {
             customLogger.warn('既存のscreenshotsパースに失敗、空配列で初期化:', error.message);
             screenshots = [];
           }
         }

        // 新しい画像URLを追加
        if (photoUrl) {
          webcamPhotos.push(photoUrl);
        }
        if (screenshotUrl) {
          screenshots.push(screenshotUrl);
        }

        // データベースに保存
        if (existingRecords.length > 0) {
          // 既存レコードを更新
          await pool.execute(
            'UPDATE remote_support_daily_records SET webcam_photos = ?, screenshots = ?, updated_at = NOW() WHERE id = ?',
            [JSON.stringify(webcamPhotos), JSON.stringify(screenshots), existingRecords[0].id]
          );
          customLogger.info('既存レコードの画像URL更新完了:', {
            recordId: existingRecords[0].id,
            webcamPhotosCount: webcamPhotos.length,
            screenshotsCount: screenshots.length
          });
        } else {
          // 新規レコードを作成
          await pool.execute(
            'INSERT INTO remote_support_daily_records (user_id, webcam_photos, screenshots, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
            [user.id, JSON.stringify(webcamPhotos), JSON.stringify(screenshots)]
          );
          customLogger.info('新規レコードの画像URL保存完了:', {
            userId: user.id,
            webcamPhotosCount: webcamPhotos.length,
            screenshotsCount: screenshots.length
          });
        }
      } catch (dbError) {
        customLogger.error('データベースへの画像URL保存に失敗:', {
          error: dbError.message,
          userId: user.id
        });
        // データベースエラーでもS3アップロードは成功しているので、警告として記録
      }

      customLogger.info(`Remote support capture uploaded for user ${userLoginCode}`);

      res.json({
        success: true,
        message: '画像のアップロードが完了しました',
        data: {
          photoPath: photoUrl,
          screenshotPath: screenshotUrl
        }
      });

    } catch (error) {
      customLogger.error('Remote support capture upload error:', error);
      res.status(500).json({
        success: false,
        message: '画像のアップロードに失敗しました',
        error: error.message
      });
    }
  }

  /**
   * 勤怠打刻
   */
  static async markAttendance(req, res) {
    try {
      const {
        login_code,
        mark_type,
        timestamp,
        temperature,
        condition,
        condition_note,
        work_note,
        work_result,
        daily_report
      } = req.body;

      if (!login_code || !mark_type) {
        return res.status(400).json({
          success: false,
          message: 'ログインコードと打刻タイプが必須です'
        });
      }

      // データベースクエリにタイムアウトを設定（10秒）
      const queryTimeout = 10000;
      const queryPromise = pool.execute(
        'SELECT id, company_id, satellite_ids FROM user_accounts WHERE login_code = ?',
        [login_code]
      );

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('データベースクエリがタイムアウトしました')), queryTimeout);
      });

      const [users] = await Promise.race([queryPromise, timeoutPromise]);

      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ユーザーが見つかりません'
        });
      }

      const user = users[0];
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD形式
      const now = timestamp || new Date().toISOString();

      // 勤怠打刻のログを記録
      customLogger.info(`Remote support attendance marked: ${mark_type} for user ${login_code} at ${now}`);

      // データベースに勤怠打刻を記録
      try {
        // 既存のレコードを確認
        const [existingRecords] = await pool.execute(
          'SELECT id FROM remote_support_daily_records WHERE user_id = ? AND date = ?',
          [user.id, today]
        );

        if (existingRecords.length > 0) {
          // 既存レコードを更新
          let updateQuery = 'UPDATE remote_support_daily_records SET updated_at = NOW()';
          let updateParams = [];

          // 打刻タイプに応じて更新するフィールドを決定
          switch (mark_type) {
            case 'start':
              updateQuery += ', mark_start = ?';
              updateParams.push(now);
              break;
            case 'lunch_start':
              updateQuery += ', mark_lunch_start = ?';
              updateParams.push(now);
              break;
            case 'lunch_end':
              updateQuery += ', mark_lunch_end = ?';
              updateParams.push(now);
              break;
            case 'end':
              updateQuery += ', mark_end = ?';
              updateParams.push(now);
              break;
          }

          // その他のデータも更新
          if (temperature !== undefined) {
            updateQuery += ', temperature = ?';
            updateParams.push(temperature);
          }
          if (condition !== undefined) {
            updateQuery += ', `condition` = ?';
            updateParams.push(condition);
          }
          if (condition_note !== undefined) {
            updateQuery += ', condition_note = ?';
            updateParams.push(condition_note);
          }
          if (work_note !== undefined) {
            updateQuery += ', work_note = ?';
            updateParams.push(work_note);
          }
          if (work_result !== undefined) {
            updateQuery += ', work_result = ?';
            updateParams.push(work_result);
          }
          if (daily_report !== undefined) {
            updateQuery += ', daily_report = ?';
            updateParams.push(daily_report);
          }

          updateQuery += ' WHERE id = ?';
          updateParams.push(existingRecords[0].id);

          await pool.execute(updateQuery, updateParams);
          customLogger.info(`既存の勤怠レコードを更新: ユーザーID ${user.id}, 打刻タイプ ${mark_type}`);
        } else {
          // 新規レコードを作成
          let insertQuery = `INSERT INTO remote_support_daily_records (
            user_id, date, created_at, updated_at`;
          let insertValues = 'VALUES (?, ?, NOW(), NOW()';
          let insertParams = [user.id, today];

          // 打刻タイプに応じてフィールドを追加
          switch (mark_type) {
            case 'start':
              insertQuery += ', mark_start';
              insertValues += ', ?';
              insertParams.push(now);
              break;
            case 'lunch_start':
              insertQuery += ', mark_lunch_start';
              insertValues += ', ?';
              insertParams.push(now);
              break;
            case 'lunch_end':
              insertQuery += ', mark_lunch_end';
              insertValues += ', ?';
              insertParams.push(now);
              break;
            case 'end':
              insertQuery += ', mark_end';
              insertValues += ', ?';
              insertParams.push(now);
              break;
          }

          // その他のデータも追加
          if (temperature !== undefined) {
            insertQuery += ', temperature';
            insertValues += ', ?';
            insertParams.push(temperature);
          }
          if (condition !== undefined) {
            insertQuery += ', `condition`';
            insertValues += ', ?';
            insertParams.push(condition);
          }
          if (condition_note !== undefined) {
            insertQuery += ', condition_note';
            insertValues += ', ?';
            insertParams.push(condition_note);
          }
          if (work_note !== undefined) {
            insertQuery += ', work_note';
            insertValues += ', ?';
            insertParams.push(work_note);
          }
          if (work_result !== undefined) {
            insertQuery += ', work_result';
            insertValues += ', ?';
            insertParams.push(work_result);
          }
          if (daily_report !== undefined) {
            insertQuery += ', daily_report';
            insertValues += ', ?';
            insertParams.push(daily_report);
          }

          insertQuery += ') ' + insertValues + ')';
          await pool.execute(insertQuery, insertParams);
          customLogger.info(`新規勤怠レコードを作成: ユーザーID ${user.id}, 打刻タイプ ${mark_type}`);
        }
      } catch (dbError) {
        customLogger.error('勤怠データの記録に失敗:', {
          error: dbError.message,
          userId: user.id,
          markType: mark_type,
          date: today
        });
        // データベースエラーでもレスポンスは返す
      }

      res.json({
        success: true,
        message: '勤怠打刻が完了しました'
      });

    } catch (error) {
      customLogger.error('Remote support attendance error:', error);
      if (error.message.includes('タイムアウト')) {
        res.status(408).json({
          success: false,
          message: '勤怠打刻処理がタイムアウトしました',
          error: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: '勤怠打刻に失敗しました',
          error: error.message
        });
      }
    }
  }

  /**
   * 一時パスワード監視
   */
  static async checkTempPassword(req, res) {
    try {
      const { loginCode } = req.params;

      if (!loginCode) {
        return res.status(400).json({
          success: false,
          message: 'ログインコードが必須です'
        });
      }

      customLogger.info(`Temp password check requested for login code: ${loginCode}`);

      // ユーザーIDを取得
      const [users] = await pool.execute(
        'SELECT id FROM user_accounts WHERE login_code = ?',
        [loginCode]
      );

      if (users.length === 0) {
        customLogger.warn(`User not found for login code: ${loginCode}`);
        return res.status(404).json({
          success: false,
          message: 'ユーザーが見つかりません'
        });
      }

      // デバッグ用：ユーザー情報をログ出力
      customLogger.info(`User found for login code ${loginCode}: ID ${users[0].id}`);

      const userId = users[0].id;
      customLogger.info(`User found: ID ${userId} for login code: ${loginCode}`);

             // 有効な一時パスワードをチェック（日本時間での有効期限チェック）
       // 現在の日本時間を計算
       const now = new Date();
       const japanTimeString = now.toLocaleString('ja-JP', {
         timeZone: 'Asia/Tokyo',
         year: 'numeric',
         month: '2-digit',
         day: '2-digit',
         hour: '2-digit',
         minute: '2-digit',
         second: '2-digit',
         hour12: false
       });
       const japanDate = new Date(japanTimeString.replace(/\//g, '-'));
       const utcNow = new Date(japanDate.getTime() - (9 * 60 * 60 * 1000));
       const utcNowString = utcNow.toISOString().slice(0, 19).replace('T', ' ');
       
       customLogger.info(`一時パスワード確認: 現在時刻 (UTC): ${utcNowString}`);
       
       // デバッグ用：全ての一時パスワードを取得
       const [allTempPasswords] = await pool.execute(
         `SELECT temp_password, expires_at, is_used, issued_at 
          FROM user_temp_passwords 
          WHERE user_id = ? 
          ORDER BY issued_at DESC`,
         [userId]
       );
       
       customLogger.info(`ユーザー${userId}の全一時パスワード:`, allTempPasswords);
       
       const [tempPasswords] = await pool.execute(
         `SELECT temp_password, expires_at 
          FROM user_temp_passwords 
          WHERE user_id = ? 
          AND expires_at > ?
          AND is_used = 0 
          ORDER BY issued_at DESC 
          LIMIT 1`,
         [userId, utcNowString]
       );

      customLogger.info(`Found ${tempPasswords.length} valid temp passwords for user ${userId}`);

      if (tempPasswords.length > 0) {
        const tempPassword = tempPasswords[0];
        
        // 読み取り時は使用済み化しない（新規パスワード発行時のみ使用済み化）
        customLogger.info(`Temp password found for user ${userId} (not marked as used)`);

        res.json({
          success: true,
          hasTempPassword: true,
          tempPassword: tempPassword.temp_password,
          expiresAt: tempPassword.expires_at
        });
      } else {
        customLogger.info(`No valid temp password found for user ${userId}`);
        res.json({
          success: true,
          hasTempPassword: false
        });
      }

    } catch (error) {
      customLogger.error('Temp password check error:', error);
      res.status(500).json({
        success: false,
        message: '一時パスワードの確認に失敗しました',
        error: error.message
      });
    }
  }

  /**
   * 支援アプリログイン
   */
  static async login(req, res) {
    try {
      const { login_code, temperature, condition, condition_note, work_note } = req.body;

      if (!login_code) {
        return res.status(400).json({
          success: false,
          message: 'ログインコードが必須です'
        });
      }

      // データベースクエリにタイムアウトを設定（10秒）
      const queryTimeout = 10000;
      const queryPromise = pool.execute(
        'SELECT id, name, login_code, company_id, satellite_ids FROM user_accounts WHERE login_code = ?',
        [login_code]
      );

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('データベースクエリがタイムアウトしました')), queryTimeout);
      });

      const [users] = await Promise.race([queryPromise, timeoutPromise]);

      if (users.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'ログインコードが無効です'
        });
      }

      const user = users[0];
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD形式
      const now = new Date().toISOString();

      // 日報データをデータベースに記録
      try {
        // 既存のレコードを確認
        const [existingRecords] = await pool.execute(
          'SELECT id FROM remote_support_daily_records WHERE user_id = ? AND date = ?',
          [user.id, today]
        );

        if (existingRecords.length > 0) {
          // 既存レコードを更新（ログイン時間のみ更新）
          await pool.execute(
            'UPDATE remote_support_daily_records SET mark_start = ?, updated_at = NOW() WHERE id = ?',
            [now, existingRecords[0].id]
          );
          customLogger.info(`既存の日報レコードを更新: ユーザーID ${user.id}, 日付 ${today}`);
        } else {
          // 新規レコードを作成
          await pool.execute(
            `INSERT INTO remote_support_daily_records (
              user_id, date, mark_start, temperature, \`condition\`, 
              condition_note, work_note, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [user.id, today, now, temperature || null, condition || null, 
             condition_note || null, work_note || null]
          );
          customLogger.info(`新規日報レコードを作成: ユーザーID ${user.id}, 日付 ${today}`);
        }
      } catch (dbError) {
        customLogger.error('日報データの記録に失敗:', {
          error: dbError.message,
          userId: user.id,
          date: today
        });
        // データベースエラーでもログインは成功させる
      }

      customLogger.info(`Remote support login: ${login_code} logged in successfully`);

      res.json({
        success: true,
        message: 'ログインに成功しました',
        data: {
          user_id: user.id,
          name: user.name,
          login_code: user.login_code
        }
      });

    } catch (error) {
      customLogger.error('Remote support login error:', error);
      if (error.message.includes('タイムアウト')) {
        res.status(408).json({
          success: false,
          message: 'ログイン処理がタイムアウトしました',
          error: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'ログイン処理に失敗しました',
          error: error.message
        });
      }
    }
  }

  /**
   * 学習ページ自動ログイン
   */
  static async autoLogin(req, res) {
    try {
      const { login_code, target } = req.body;

      if (!login_code) {
        return res.status(400).json({
          success: false,
          message: 'ログインコードが必須です'
        });
      }

      // ユーザー情報を取得
      const [users] = await pool.execute(
        'SELECT id, name, login_code FROM user_accounts WHERE login_code = ?',
        [login_code]
      );

      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ユーザーが見つかりません'
        });
      }

      const user = users[0];

      // 環境に応じたURLを設定
      const baseUrl = target === 'prod' 
        ? 'https://studysphere-frontend.vercel.app/studysphere'
        : 'http://localhost:3000/studysphere';

      // 自動ログイン用のHTMLを生成
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>自動ログイン中...</title>
          <meta charset="UTF-8">
        </head>
        <body>
          <script>
            // ローカルストレージにログイン情報を保存
            localStorage.setItem('autoLoginCode', '${user.login_code}');
            localStorage.setItem('autoLoginUser', '${user.name}');
            localStorage.setItem('autoLoginTarget', '${target}');
            
            // 利用者ダッシュボードにリダイレクト
            window.location.href = '${baseUrl}/student-dashboard';
          </script>
          <p>自動ログイン中...</p>
        </body>
        </html>
      `;

      res.setHeader('Content-Type', 'text/html');
      res.send(html);

    } catch (error) {
      customLogger.error('Auto login error:', error);
      res.status(500).json({
        success: false,
        message: '自動ログインに失敗しました',
        error: error.message
      });
    }
  }

  /**
   * デバッグ用：一時パスワード一覧取得
   */
  static async debugTempPasswords(req, res) {
    try {
      const { loginCode } = req.params;

      if (!loginCode) {
        return res.status(400).json({
          success: false,
          message: 'ログインコードが必須です'
        });
      }

      // ユーザーIDを取得
      const [users] = await pool.execute(
        'SELECT id, name, login_code FROM user_accounts WHERE login_code = ?',
        [loginCode]
      );

      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ユーザーが見つかりません'
        });
      }

      const userId = users[0].id;

             // 一時パスワード一覧を取得
       const [tempPasswords] = await pool.execute(
         `SELECT temp_password, expires_at, is_used, issued_at
          FROM user_temp_passwords 
          WHERE user_id = ? 
          ORDER BY issued_at DESC`,
         [userId]
       );

      res.json({
        success: true,
        user: {
          id: users[0].id,
          name: users[0].name,
          login_code: users[0].login_code
        },
        temp_passwords: tempPasswords
      });

    } catch (error) {
      customLogger.error('Debug temp passwords error:', error);
      res.status(500).json({
        success: false,
        message: '一時パスワード一覧の取得に失敗しました',
        error: error.message
      });
    }
  }

  /**
   * 一時パスワード通知受信
   */
  static async notifyTempPassword(req, res) {
    try {
      const { loginCode, tempPassword, userName, timestamp } = req.body;

      if (!loginCode || !tempPassword || !userName) {
        return res.status(400).json({
          success: false,
          message: 'ログインコード、一時パスワード、ユーザー名は必須です'
        });
      }

      customLogger.info(`一時パスワード通知を受信: ${userName} (${loginCode})`);

      // 通知データを保存（後で支援アプリが取得できるように）
      const notificationData = {
        loginCode,
        tempPassword,
        userName,
        timestamp,
        receivedAt: new Date().toISOString()
      };

      // メモリまたはデータベースに保存（簡易実装）
      // 実際の実装では、Redisやデータベースを使用することを推奨
      global.tempPasswordNotifications = global.tempPasswordNotifications || {};
      global.tempPasswordNotifications[loginCode] = notificationData;

      customLogger.info(`一時パスワード通知を保存: ${loginCode}`);

      res.json({
        success: true,
        message: '一時パスワード通知を受信しました',
        data: {
          loginCode,
          userName,
          timestamp
        }
      });

    } catch (error) {
      customLogger.error('一時パスワード通知受信エラー:', error);
      res.status(500).json({
        success: false,
        message: '一時パスワード通知の受信に失敗しました',
        error: error.message
      });
    }
  }

  /**
   * 一時パスワード通知取得
   */
  static async getTempPasswordNotification(req, res) {
    try {
      const { loginCode } = req.params;

      if (!loginCode) {
        return res.status(400).json({
          success: false,
          message: 'ログインコードが必須です'
        });
      }

      // 保存された通知データを取得
      const notificationData = global.tempPasswordNotifications?.[loginCode];

      if (!notificationData) {
        return res.status(404).json({
          success: false,
          message: '通知データが見つかりません'
        });
      }

      customLogger.info(`一時パスワード通知を取得: ${loginCode}`);

      res.json({
        success: true,
        message: '一時パスワード通知を取得しました',
        data: notificationData
      });

    } catch (error) {
      customLogger.error('一時パスワード通知取得エラー:', error);
      res.status(500).json({
        success: false,
        message: '一時パスワード通知の取得に失敗しました',
        error: error.message
      });
    }
  }

  /**
   * 日報一覧取得（指導員用）
   */
  static async getDailyReports(req, res) {
    try {
      const { userId, startDate, endDate, page = 1, limit = 20 } = req.query;
      
      customLogger.info('日報一覧取得リクエスト:', {
        userId,
        startDate,
        endDate,
        page,
        limit
      });
      
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
      
      customLogger.info('SQLクエリ構築:', {
        whereClause,
        params,
        offset,
        limit,
        page,
        limitType: typeof limit,
        pageType: typeof page
      });
      
      // 日報データを取得（ユーザー情報も含む）
      const queryParams = [...params, limit.toString(), offset.toString()];
      customLogger.info('SQLクエリパラメータ:', {
        params: queryParams,
        paramsLength: queryParams.length,
        expectedPlaceholders: (whereClause.match(/\?/g) || []).length + 2 // +2 for LIMIT and OFFSET
      });
      
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
      
      // 総件数を取得
      const [countResult] = await pool.execute(`
        SELECT COUNT(*) as total
        FROM remote_support_daily_records rsdr
        LEFT JOIN user_accounts ua ON rsdr.user_id = ua.id
        ${whereClause}
      `, params);
      
      const total = countResult[0].total;
      
      customLogger.info(`日報一覧取得: ${reports.length}件 (総件数: ${total}件)`);
      
      // データが存在しない場合でも正常にレスポンスを返す
      res.json({
        success: true,
        data: {
          reports: reports || [],
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      });
      
    } catch (error) {
      customLogger.error('日報一覧取得エラー:', {
        error: error.message,
        stack: error.stack,
        query: req.query
      });
      res.status(500).json({
        success: false,
        message: '日報一覧の取得に失敗しました',
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  /**
   * 日報詳細取得
   */
  static async getDailyReport(req, res) {
    try {
      const { id } = req.params;
      
      customLogger.info(`日報詳細取得リクエスト: ID ${id}`);
      
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
        WHERE rsdr.id = ?
      `, [id]);
      
      if (reports.length === 0) {
        customLogger.warn(`日報が見つかりません: ID ${id}`);
        return res.status(404).json({
          success: false,
          message: '日報が見つかりません'
        });
      }
      
      const report = reports[0];
      
      // JSONフィールドをパース
      if (report.webcam_photos) {
        try {
          report.webcam_photos = JSON.parse(report.webcam_photos);
        } catch (e) {
          customLogger.warn(`webcam_photosのJSONパースに失敗: ID ${id}`, e.message);
          report.webcam_photos = [];
        }
      }
      
      if (report.screenshots) {
        try {
          report.screenshots = JSON.parse(report.screenshots);
        } catch (e) {
          customLogger.warn(`screenshotsのJSONパースに失敗: ID ${id}`, e.message);
          report.screenshots = [];
        }
      }
      
      customLogger.info(`日報詳細取得成功: ID ${id}`);
      
      res.json({
        success: true,
        data: report
      });
      
    } catch (error) {
      customLogger.error('日報詳細取得エラー:', {
        error: error.message,
        stack: error.stack,
        id: req.params.id
      });
      res.status(500).json({
        success: false,
        message: '日報詳細の取得に失敗しました',
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  /**
   * 日報更新（指導員用）
   */
  static async updateDailyReport(req, res) {
    try {
      const { id } = req.params;
      const {
        temperature,
        condition,
        condition_note,
        work_note,
        work_result,
        daily_report,
        support_method,
        support_method_note,
        task_content,
        support_content,
        advice,
        instructor_comment,
        mark_start,
        mark_lunch_start,
        mark_lunch_end,
        mark_end
      } = req.body;

      // リクエストボディをログ出力
      customLogger.info('リクエストボディ:', req.body);
      customLogger.info('リクエストボディ詳細:', {
        temperature: typeof temperature + ':' + temperature,
        condition: typeof condition + ':' + condition,
        work_note: typeof work_note + ':' + work_note,
        work_result: typeof work_result + ':' + work_result,
        daily_report: typeof daily_report + ':' + daily_report,
        mark_start: typeof mark_start + ':' + mark_start + ' (JSON: ' + JSON.stringify(mark_start) + ')',
        mark_lunch_start: typeof mark_lunch_start + ':' + mark_lunch_start + ' (JSON: ' + JSON.stringify(mark_lunch_start) + ')',
        mark_lunch_end: typeof mark_lunch_end + ':' + mark_lunch_end + ' (JSON: ' + JSON.stringify(mark_lunch_end) + ')',
        mark_end: typeof mark_end + ':' + mark_end + ' (JSON: ' + JSON.stringify(mark_end) + ')'
      });
      
      // データベース接続確認
      if (!pool) {
        customLogger.error('データベース接続が利用できません');
        return res.status(500).json({
          success: false,
          message: 'データベース接続エラー'
        });
      }

      // 既存の日報を確認
      const [existingReports] = await pool.execute(
        'SELECT * FROM remote_support_daily_records WHERE id = ?',
        [id]
      );
      
      if (existingReports.length === 0) {
        return res.status(404).json({
          success: false,
          message: '日報が見つかりません'
        });
      }

      // 時間データをDATETIME形式に変換する関数
      const convertTimeToDateTime = (timeString, dateString) => {
        try {
          customLogger.info(`時間変換開始: ${timeString} (型: ${typeof timeString})`);
          
          if (!timeString || timeString.trim() === '' || timeString === '--') {
            customLogger.info('時間が空のためnullを返します');
            return null;
          }
          
          // フロントエンドからMySQL形式（YYYY-MM-DD HH:MM:SS）で送信される場合
          if (typeof timeString === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(timeString)) {
            customLogger.info(`MySQL形式として認識: ${timeString}`);
            return timeString;
          }
          
          // HH:MM形式の文字列の場合（後方互換性のため）
          if (typeof timeString === 'string' && /^\d{2}:\d{2}$/.test(timeString)) {
            const reportDate = existingReports[0].date;
            customLogger.info(`HH:MM形式として認識: ${timeString}, 使用する日付: ${reportDate}`);
            const datetime = `${reportDate} ${timeString}:00`;
            customLogger.info(`時間変換成功: ${timeString} -> ${datetime}`);
            return datetime;
          }
          
          customLogger.error(`無効な時間形式: ${timeString} (型: ${typeof timeString})`);
          return null;
        } catch (error) {
          customLogger.error(`時間変換エラー: ${timeString}`, error);
          return null;
        }
      };

      // 時間フィールドを変換
      customLogger.info('時間フィールド変換開始:', {
        mark_start: { value: mark_start, type: typeof mark_start, stringified: JSON.stringify(mark_start) },
        mark_lunch_start: { value: mark_lunch_start, type: typeof mark_lunch_start, stringified: JSON.stringify(mark_lunch_start) },
        mark_lunch_end: { value: mark_lunch_end, type: typeof mark_lunch_end, stringified: JSON.stringify(mark_lunch_end) },
        mark_end: { value: mark_end, type: typeof mark_end, stringified: JSON.stringify(mark_end) }
      });
      
      const markStartDateTime = convertTimeToDateTime(mark_start, existingReports[0].date);
      const markLunchStartDateTime = convertTimeToDateTime(mark_lunch_start, existingReports[0].date);
      const markLunchEndDateTime = convertTimeToDateTime(mark_lunch_end, existingReports[0].date);
      const markEndDateTime = convertTimeToDateTime(mark_end, existingReports[0].date);
      
      customLogger.info('時間フィールド変換結果:', {
        markStartDateTime,
        markLunchStartDateTime,
        markLunchEndDateTime,
        markEndDateTime
      });
      
      // 更新対象のフィールドを動的に構築
      const updateFields = [];
      const updateParams = [];
      
      // 各フィールドをチェックして、値が存在する場合のみ更新対象に追加
      const isValidValue = (value) => {
        return value !== undefined && value !== null && value !== '' && String(value).trim() !== '';
      };

      if (isValidValue(temperature)) {
        updateFields.push('temperature = ?');
        updateParams.push(temperature);
      }
      
      if (isValidValue(condition)) {
        updateFields.push('`condition` = ?');
        updateParams.push(condition);
      }
      
      if (isValidValue(condition_note)) {
        updateFields.push('condition_note = ?');
        updateParams.push(condition_note);
      }
      
      if (isValidValue(work_note)) {
        updateFields.push('work_note = ?');
        updateParams.push(work_note);
      }
      
      if (isValidValue(work_result)) {
        updateFields.push('work_result = ?');
        updateParams.push(work_result);
      }
      
      if (isValidValue(daily_report)) {
        updateFields.push('daily_report = ?');
        updateParams.push(daily_report);
      }
      
      if (isValidValue(support_method)) {
        updateFields.push('support_method = ?');
        updateParams.push(support_method);
      }
      
      if (isValidValue(support_method_note)) {
        updateFields.push('support_method_note = ?');
        updateParams.push(support_method_note);
      }
      
      if (isValidValue(task_content)) {
        updateFields.push('task_content = ?');
        updateParams.push(task_content);
      }
      
      if (isValidValue(support_content)) {
        updateFields.push('support_content = ?');
        updateParams.push(support_content);
      }
      
      if (isValidValue(advice)) {
        updateFields.push('advice = ?');
        updateParams.push(advice);
      }
      
      if (isValidValue(instructor_comment)) {
        updateFields.push('instructor_comment = ?');
        updateParams.push(instructor_comment);
      }
      
      // 時間フィールドの処理
      if (markStartDateTime !== null && markStartDateTime !== '' && markStartDateTime !== undefined) {
        updateFields.push('mark_start = ?');
        updateParams.push(markStartDateTime);
        customLogger.info('mark_start追加:', markStartDateTime);
      }
      
      if (markLunchStartDateTime !== null && markLunchStartDateTime !== '' && markLunchStartDateTime !== undefined) {
        updateFields.push('mark_lunch_start = ?');
        updateParams.push(markLunchStartDateTime);
        customLogger.info('mark_lunch_start追加:', markLunchStartDateTime);
      }
      
      if (markLunchEndDateTime !== null && markLunchEndDateTime !== '' && markLunchEndDateTime !== undefined) {
        updateFields.push('mark_lunch_end = ?');
        updateParams.push(markLunchEndDateTime);
        customLogger.info('mark_lunch_end追加:', markLunchEndDateTime);
      }
      
      if (markEndDateTime !== null && markEndDateTime !== '' && markEndDateTime !== undefined) {
        updateFields.push('mark_end = ?');
        updateParams.push(markEndDateTime);
        customLogger.info('mark_end追加:', markEndDateTime);
      }
      
      // updated_atは常に更新
      updateFields.push('updated_at = NOW()');
      
      // 更新対象のフィールドがない場合はエラー
      if (updateFields.length === 1) { // updated_atのみの場合
        return res.status(400).json({
          success: false,
          message: '更新するデータがありません'
        });
      }
      
      // WHERE句のIDを追加
      updateParams.push(id);
      
      // SQLクエリを構築（updated_atを除いたフィールドのみ）
      const setFields = updateFields.filter(field => !field.includes('updated_at'));
      
      // 更新対象フィールドがない場合はエラー
      if (setFields.length === 0) {
        return res.status(400).json({
          success: false,
          message: '更新するデータがありません'
        });
      }
      
      const updateQuery = `
        UPDATE remote_support_daily_records 
        SET ${setFields.join(', ')}, updated_at = NOW()
        WHERE id = ?
      `;

      // 更新データをログ出力
      customLogger.info('更新対象フィールド:', updateFields);
      customLogger.info('更新パラメータ:', updateParams);
      customLogger.info('SET句フィールド:', setFields);
      customLogger.info('SQLクエリ:', updateQuery);
      customLogger.info('リクエストボディ詳細:', {
        temperature: typeof temperature + ':' + temperature,
        condition: typeof condition + ':' + condition,
        work_note: typeof work_note + ':' + work_note,
        work_result: typeof work_result + ':' + work_result,
        daily_report: typeof daily_report + ':' + daily_report,
        mark_start: typeof mark_start + ':' + mark_start,
        mark_lunch_start: typeof mark_lunch_start + ':' + mark_lunch_start,
        mark_lunch_end: typeof mark_lunch_end + ':' + mark_lunch_end,
        mark_end: typeof mark_end + ':' + mark_end
      });

      // 日報を更新
      const updateResult = await pool.execute(updateQuery, updateParams);

      customLogger.info('更新結果:', updateResult);
      
      customLogger.info(`日報更新: ID ${id}`);
      
      res.json({
        success: true,
        message: '日報が更新されました'
      });
      
    } catch (error) {
      customLogger.error('日報更新エラー:', error);
      customLogger.error('エラー詳細:', {
        error: error.message,
        stack: error.stack,
        body: req.body,
        params: req.params
      });
      res.status(500).json({
        success: false,
        message: '日報の更新に失敗しました',
        error: error.message,
        details: error.stack
      });
    }
  }

  /**
   * 日報コメント追加
   */
  static async addDailyReportComment(req, res) {
    try {
      const { id } = req.params;
      const { comment, instructor_name } = req.body;
      
      if (!comment || !instructor_name) {
        return res.status(400).json({
          success: false,
          message: 'コメントと指導員名は必須です'
        });
      }

      // コメントの文字数制限（1000文字）
      if (comment.length > 1000) {
        return res.status(400).json({
          success: false,
          message: 'コメントは1000文字以内で入力してください'
        });
      }

      // コメントの内容チェック（空文字や空白のみは不可）
      if (!comment.trim()) {
        return res.status(400).json({
          success: false,
          message: 'コメント内容を入力してください'
        });
      }
      
      // 既存の日報を確認
      const [existingReports] = await pool.execute(
        'SELECT * FROM remote_support_daily_records WHERE id = ?',
        [id]
      );
      
      if (existingReports.length === 0) {
        return res.status(404).json({
          success: false,
          message: '日報が見つかりません'
        });
      }
      
      const existingReport = existingReports[0];
      
      // 既存のコメントを取得
      let comments = [];
      if (existingReport.instructor_comment) {
        try {
          comments = JSON.parse(existingReport.instructor_comment);
        } catch (e) {
          comments = [];
        }
      }
      
      // 新しいコメントを追加
      const newComment = {
        id: Date.now(),
        comment: comment.trim(),
        instructor_name,
        created_at: new Date().toISOString()
      };
      
      comments.push(newComment);
      
      // 日報を更新
      await pool.execute(
        'UPDATE remote_support_daily_records SET instructor_comment = ?, updated_at = NOW() WHERE id = ?',
        [JSON.stringify(comments), id]
      );
      
      customLogger.info(`日報コメント追加: ID ${id}, 指導員: ${instructor_name}, コメント長: ${comment.length}文字`);
      
      res.json({
        success: true,
        message: 'コメントが追加されました',
        data: newComment
      });
      
    } catch (error) {
      customLogger.error('日報コメント追加エラー:', error);
      res.status(500).json({
        success: false,
        message: 'コメントの追加に失敗しました',
        error: error.message
      });
    }
  }
}

module.exports = RemoteSupportController;
