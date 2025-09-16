/**
 * 日本時間での時刻処理を統一するためのユーティリティ関数
 */


/**
 * 現在の日本時間を取得
 * @returns {Date} 日本時間のDateオブジェクト
 */
const getCurrentJapanTime = () => {
  const now = new Date();
  
  // 日本時間の時刻を取得するために、日本時間の文字列から新しいDateオブジェクトを作成
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
  
  // 日本時間の文字列をDateオブジェクトに変換
  return new Date(japanTimeString.replace(/\//g, '-'));
};

/**
 * 日本時間の今日の23:59:59を取得（UTC変換版）
 * @returns {Date} 日本時間の今日の終了時刻（UTC変換済み）
 */
const getTodayEndTime = () => {
  const now = new Date();
  
  // 日本時間の今日の23:59:59を計算
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
  
  // 日本時間の今日の23:59:59を設定
  const japanDate = new Date(japanTimeString.replace(/\//g, '-'));
  japanDate.setHours(23, 59, 59, 999);
  
  // 日本時間をUTCに変換して返す（データベース保存用）
  const utcTime = new Date(japanDate.getTime() - (9 * 60 * 60 * 1000));
  
  console.log('getTodayEndTime 詳細:', {
    now: now.toISOString(),
    japanTimeString,
    japanDate: japanDate.toISOString(),
    utcTime: utcTime.toISOString(),
    utcTimeMySQL: utcTime.toISOString().slice(0, 19).replace('T', ' ')
  });
  
  return utcTime;
};

/**
 * 日本時間の今日の23:59:59を取得（日本時間のまま）
 * @returns {Date} 日本時間の今日の終了時刻（日本時間のまま）
 */
const getTodayEndTimeJapan = () => {
  const japanNow = getCurrentJapanTime();
  
  // 日本時間の今日の23:59:59を計算
  const endOfDay = new Date(japanNow);
  endOfDay.setHours(23, 59, 59, 999);
  
  // 日本時間のまま返す
  return endOfDay;
};

/**
 * 日本時間の今日の00:00:00を取得
 * @returns {Date} 日本時間の今日の開始時刻
 */
const getTodayStartTime = () => {
  const japanTime = getCurrentJapanTime();
  // 日本時間の今日の00:00:00を直接設定
  japanTime.setHours(0, 0, 0, 0);
  return japanTime;
};

/**
 * UTC時刻を日本時間に変換
 * @param {Date|string} utcDate - UTC時刻
 * @returns {Date} 日本時間のDateオブジェクト
 */
const convertUTCToJapanTime = (utcDate) => {
  const date = new Date(utcDate);
  const japanOffset = 9 * 60; // 日本時間はUTC+9
  return new Date(date.getTime() + (japanOffset * 60 * 1000));
};

/**
 * 日本時間をUTCに変換
 * @param {Date|string} japanDate - 日本時間
 * @returns {Date} UTCのDateオブジェクト
 */
const convertJapanTimeToUTC = (japanDate) => {
  const date = new Date(japanDate);
  const japanOffset = 9 * 60; // 日本時間はUTC+9
  return new Date(date.getTime() - (japanOffset * 60 * 1000));
};

/**
 * 有効期限チェック（日本時間基準）
 * @param {Date|string} expiryTime - 有効期限
 * @returns {boolean} 有効かどうか
 */
const isExpired = (expiryTime) => {
  if (!expiryTime) return true;
  
  try {
    const now = getCurrentJapanTime();
    const expiryDate = new Date(expiryTime);
    
    console.log('バックエンド isExpired チェック:', {
      expiryTime,
      expiryDate: expiryDate.toLocaleString('ja-JP'),
      now: now.toLocaleString('ja-JP'),
      isExpired: expiryDate <= now
    });
    
    return expiryDate <= now;
  } catch (error) {
    console.error('バックエンド isExpired エラー:', error);
    return true;
  }
};

/**
 * 日本時間での日付文字列を取得
 * @param {Date|string} date - 日付
 * @param {Object} options - オプション
 * @returns {string} 日本時間での日付文字列
 */
const formatJapanTime = (date, options = {}) => {
  const defaultOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Tokyo'
  };
  
  const dateObj = new Date(date);
  return dateObj.toLocaleString('ja-JP', { ...defaultOptions, ...options });
};

/**
 * 日本時間での日付のみ文字列を取得
 * @param {Date|string} date - 日付
 * @returns {string} 日本時間での日付文字列（YYYY-MM-DD）
 */
const formatJapanDate = (date) => {
  const dateObj = new Date(date);
  return dateObj.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Tokyo'
  }).replace(/\//g, '-');
};

/**
 * 日本時間での時刻のみ文字列を取得
 * @param {Date|string} date - 日付
 * @returns {string} 日本時間での時刻文字列（HH:MM:SS）
 */
const formatJapanTimeOnly = (date) => {
  const dateObj = new Date(date);
  return dateObj.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Tokyo'
  });
};

/**
 * MySQLのDATETIME形式に変換（YYYY-MM-DD HH:MM:SS）
 * @param {Date|string} date - 日付
 * @returns {string} MySQLのDATETIME形式
 */
const formatMySQLDateTime = (date) => {
  const dateObj = new Date(date);
  return dateObj.toISOString().slice(0, 19).replace('T', ' ');
};

/**
 * 指定された時間の日本時間での時刻を取得
 * @param {string} timeString - 時間文字列（HH:MM形式）
 * @returns {Date} 指定された時間の日本時間
 */
const getJapanTimeFromString = (timeString) => {
  const [hours, minutes] = timeString.split(':').map(Number);
  const japanTime = getCurrentJapanTime();
  const targetTime = new Date(japanTime);
  targetTime.setHours(hours, minutes, 59, 999);
  
  // 過去の時間の場合は翌日に設定
  if (targetTime <= japanTime) {
    targetTime.setDate(targetTime.getDate() + 1);
  }
  
  return targetTime;
};

module.exports = {
  getCurrentJapanTime,
  getTodayEndTime,
  getTodayEndTimeJapan,
  getTodayStartTime,
  convertUTCToJapanTime,
  convertJapanTimeToUTC,
  isExpired,
  formatJapanTime,
  formatJapanDate,
  formatJapanTimeOnly,
  formatMySQLDateTime,
  getJapanTimeFromString
};

