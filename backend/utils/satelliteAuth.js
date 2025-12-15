const { customLogger } = require('./logger');

/**
 * 拠点認証ユーティリティ
 * 拠点IDのパース、正規化、アクセス権限チェックを集約
 */

/**
 * satellite_idsをパースして正規化された数値配列を返す
 * @param {string|number|Array} satelliteIds - データベースから取得したsatellite_ids
 * @param {string} context - ログ用のコンテキスト（例: '送信者', '受信者'）
 * @param {number} userId - ユーザーID（ログ用）
 * @returns {Array<number>} 正規化された拠点IDの配列
 */
function parseSatelliteIds(satelliteIds, context = 'ユーザー', userId = null) {
  let parsedIds = [];
  
  // nullまたはundefinedの場合は空配列を返す
  if (!satelliteIds) {
    customLogger.debug(`${context}の拠点ID取得開始:`, {
      userId,
      satellite_ids_raw: satelliteIds,
      satellite_ids_type: typeof satelliteIds,
      satellite_ids_is_null: satelliteIds === null,
      satellite_ids_is_undefined: satelliteIds === undefined
    });
    return [];
  }

  try {
    customLogger.debug(`${context}の拠点ID取得開始:`, {
      userId,
      satellite_ids_raw: satelliteIds,
      satellite_ids_type: typeof satelliteIds
    });

    let parsed;
    
    // 既に配列の場合はそのまま使用
    if (Array.isArray(satelliteIds)) {
      parsed = satelliteIds;
    } 
    // 文字列の場合
    else if (typeof satelliteIds === 'string') {
      // カンマ区切りの文字列として保存されている場合の処理
      if (satelliteIds.includes(',')) {
        parsed = satelliteIds.split(',').map(id => id.trim());
      } 
      // JSON文字列の場合
      else {
        try {
          parsed = JSON.parse(satelliteIds);
          // JSON.parseの結果が配列でない場合は配列に変換
          if (!Array.isArray(parsed)) {
            parsed = [parsed];
          }
        } catch (jsonError) {
          // JSONとしてパースできない場合は単一の値として処理
          const singleId = parseInt(satelliteIds);
          if (!isNaN(singleId)) {
            parsed = [singleId];
          } else {
            throw jsonError;
          }
        }
      }
    }
    // 数値の場合は配列に変換
    else if (typeof satelliteIds === 'number') {
      parsed = [satelliteIds];
    }
    // その他の型の場合は空配列
    else {
      parsed = [];
    }

    customLogger.debug(`${context}の拠点IDパース成功:`, {
      userId,
      parsed,
      parsed_before_normalize: parsed
    });

    // すべてのIDを数値に正規化（NaNを除外）
    parsedIds = parsed
      .map(id => {
        const numId = parseInt(id);
        return isNaN(numId) ? null : numId;
      })
      .filter(id => id !== null);

    customLogger.debug(`${context}の拠点ID正規化後:`, {
      userId,
      parsedIds
    });

  } catch (error) {
    customLogger.warn(`${context}の拠点IDパースエラー:`, {
      userId,
      error: error.message,
      satellite_ids: satelliteIds,
      error_stack: error.stack
    });
    parsedIds = [];
  }

  // 空の場合は警告を出力
  if (parsedIds.length === 0) {
    customLogger.warn(`${context}のsatellite_idsが空です:`, {
      userId,
      satellite_ids: satelliteIds,
      context
    });
  }

  return parsedIds;
}

/**
 * 拠点アクセス権限をチェック
 * @param {Array<number>} senderSatelliteIds - 送信者（指導員）の所属拠点ID配列
 * @param {Array<number>} receiverSatelliteIds - 受信者（利用者）の所属拠点ID配列
 * @param {number|string|null} selectedSatelliteId - 選択中の拠点ID（オプション）
 * @param {Object} options - オプション
 * @param {number} senderId - 送信者ID（ログ用）
 * @param {number} receiverId - 受信者ID（ログ用）
 * @returns {Object} { hasAccess: boolean, commonSatellites: Array<number>, reason: string }
 */
function checkSatelliteAccess(
  senderSatelliteIds,
  receiverSatelliteIds,
  selectedSatelliteId = null,
  options = {}
) {
  const { senderId = null, receiverId = null } = options;

  customLogger.debug('拠点アクセス権限チェック開始:', {
    senderId,
    receiverId,
    senderSatelliteIds,
    receiverSatelliteIds,
    selectedSatelliteId
  });

  // 送信者または受信者の拠点IDが空の場合はアクセス拒否
  if (!senderSatelliteIds || senderSatelliteIds.length === 0) {
    customLogger.warn('拠点アクセス権限チェック失敗: 送信者の拠点IDが空', {
      senderId,
      senderSatelliteIds
    });
    return {
      hasAccess: false,
      commonSatellites: [],
      reason: '送信者の拠点IDが設定されていません'
    };
  }

  if (!receiverSatelliteIds || receiverSatelliteIds.length === 0) {
    customLogger.warn('拠点アクセス権限チェック失敗: 受信者の拠点IDが空', {
      receiverId,
      receiverSatelliteIds
    });
    return {
      hasAccess: false,
      commonSatellites: [],
      reason: '受信者の拠点IDが設定されていません'
    };
  }

  // 選択中の拠点IDがある場合、それを優先して検証
  if (selectedSatelliteId) {
    const selectedId = parseInt(selectedSatelliteId);
    if (isNaN(selectedId)) {
      customLogger.warn('拠点アクセス権限チェック: 無効なselectedSatelliteId', {
        selectedSatelliteId
      });
    } else {
      // 選択中の拠点が受信者と送信者の両方に所属しているか確認
      const receiverHasSelectedSatellite = receiverSatelliteIds.includes(selectedId);
      const senderHasSelectedSatellite = senderSatelliteIds.includes(selectedId);

      if (receiverHasSelectedSatellite && senderHasSelectedSatellite) {
        customLogger.debug('拠点アクセス権限チェック成功: 選択中の拠点で検証成功', {
          senderId,
          receiverId,
          selectedSatelliteId: selectedId,
          receiverSatelliteIds,
          senderSatelliteIds
        });
        return {
          hasAccess: true,
          commonSatellites: [selectedId],
          reason: '選択中の拠点でアクセス権限あり'
        };
      } else {
        customLogger.warn('拠点アクセス権限チェック失敗: 選択中の拠点で検証失敗', {
          senderId,
          receiverId,
          selectedSatelliteId: selectedId,
          receiverHasSelectedSatellite,
          senderHasSelectedSatellite,
          receiverSatelliteIds,
          senderSatelliteIds
        });
      }
    }
  }

  // 選択中の拠点で検証が失敗した場合、全拠点で共通の拠点があるか確認
  const commonSatellites = receiverSatelliteIds.filter(recSatId =>
    senderSatelliteIds.includes(recSatId)
  );

  if (commonSatellites.length > 0) {
    customLogger.debug('拠点アクセス権限チェック成功: 全拠点チェックで共通拠点を発見', {
      senderId,
      receiverId,
      commonSatellites,
      receiverSatelliteIds,
      senderSatelliteIds
    });
    return {
      hasAccess: true,
      commonSatellites,
      reason: '共通拠点が存在します'
    };
  } else {
    customLogger.warn('拠点アクセス権限チェック失敗: 共通拠点なし', {
      senderId,
      receiverId,
      receiverSatelliteIds,
      senderSatelliteIds,
      selectedSatelliteId
    });
    return {
      hasAccess: false,
      commonSatellites: [],
      reason: '利用者が指導員の所属拠点に所属していません'
    };
  }
}

/**
 * 拠点アクセス権限チェック（簡易版）
 * メッセージ送信、評価作成などで使用
 * @param {Object} sender - 送信者（指導員）のユーザー情報
 * @param {Object} receiver - 受信者（利用者）のユーザー情報
 * @param {number|string|null} selectedSatelliteId - 選択中の拠点ID（オプション）
 * @returns {Object} { hasAccess: boolean, commonSatellites: Array<number>, reason: string, senderSatelliteIds: Array<number>, receiverSatelliteIds: Array<number> }
 */
function verifySatelliteAccess(sender, receiver, selectedSatelliteId = null) {
  // 送信者の拠点IDをパース
  const senderSatelliteIds = parseSatelliteIds(
    sender.satellite_ids,
    '送信者',
    sender.id
  );

  // 受信者の拠点IDをパース
  const receiverSatelliteIds = parseSatelliteIds(
    receiver.satellite_ids,
    '受信者',
    receiver.id
  );

  // アクセス権限をチェック
  const accessCheck = checkSatelliteAccess(
    senderSatelliteIds,
    receiverSatelliteIds,
    selectedSatelliteId,
    {
      senderId: sender.id,
      receiverId: receiver.id
    }
  );

  // デバッグ情報も含めて返す
  return {
    ...accessCheck,
    senderSatelliteIds,
    receiverSatelliteIds
  };
}

module.exports = {
  parseSatelliteIds,
  checkSatelliteAccess,
  verifySatelliteAccess
};
