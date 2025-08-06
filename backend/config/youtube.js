const { google } = require('googleapis');
const { customLogger } = require('../utils/logger');

// YouTube API設定
const youtubeConfig = {
  apiKey: process.env.YOUTUBE_API_KEY,
  clientId: process.env.YOUTUBE_CLIENT_ID,
  clientSecret: process.env.YOUTUBE_CLIENT_SECRET
};

// YouTube APIクライアントの作成
const youtube = google.youtube({
  version: 'v3',
  auth: youtubeConfig.apiKey
});

// YouTube操作のユーティリティ関数
const youtubeUtils = {
  // YouTube URLからビデオIDを抽出
  extractVideoId: (url) => {
    try {
      const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
      const match = url.match(regex);
      return match ? match[1] : null;
    } catch (error) {
      customLogger.error('Failed to extract YouTube video ID', {
        error: error.message,
        url: url
      });
      return null;
    }
  },

  // ビデオ情報を取得
  getVideoInfo: async (videoId) => {
    try {
      const response = await youtube.videos.list({
        part: ['snippet', 'contentDetails', 'statistics'],
        id: [videoId]
      });

      if (response.data.items && response.data.items.length > 0) {
        const video = response.data.items[0];
        
        // 動画の長さを秒に変換
        const duration = video.contentDetails.duration;
        const durationInSeconds = parseDuration(duration);

        customLogger.info('YouTube video info retrieved successfully', {
          videoId: videoId,
          title: video.snippet.title,
          duration: durationInSeconds
        });

        return {
          success: true,
          data: {
            videoId: video.id,
            title: video.snippet.title,
            description: video.snippet.description,
            thumbnail: video.snippet.thumbnails?.high?.url,
            duration: durationInSeconds,
            viewCount: video.statistics?.viewCount,
            likeCount: video.statistics?.likeCount
          }
        };
      } else {
        return {
          success: false,
          message: '動画が見つかりません'
        };
      }
    } catch (error) {
      customLogger.error('Failed to get YouTube video info', {
        error: error.message,
        videoId: videoId
      });
      throw error;
    }
  },

  // 動画の存在確認
  validateVideo: async (videoId) => {
    try {
      const response = await youtube.videos.list({
        part: ['id'],
        id: [videoId]
      });

      return {
        success: true,
        exists: response.data.items && response.data.items.length > 0
      };
    } catch (error) {
      customLogger.error('Failed to validate YouTube video', {
        error: error.message,
        videoId: videoId
      });
      return {
        success: false,
        error: error.message
      };
    }
  },

  // プレイリスト情報を取得
  getPlaylistInfo: async (playlistId) => {
    try {
      const response = await youtube.playlists.list({
        part: ['snippet'],
        id: [playlistId]
      });

      if (response.data.items && response.data.items.length > 0) {
        const playlist = response.data.items[0];
        
        customLogger.info('YouTube playlist info retrieved successfully', {
          playlistId: playlistId,
          title: playlist.snippet.title
        });

        return {
          success: true,
          data: {
            playlistId: playlist.id,
            title: playlist.snippet.title,
            description: playlist.snippet.description,
            thumbnail: playlist.snippet.thumbnails?.high?.url
          }
        };
      } else {
        return {
          success: false,
          message: 'プレイリストが見つかりません'
        };
      }
    } catch (error) {
      customLogger.error('Failed to get YouTube playlist info', {
        error: error.message,
        playlistId: playlistId
      });
      throw error;
    }
  }
};

// ISO 8601形式の動画時間を秒に変換
function parseDuration(duration) {
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  
  const hours = (match[1] || '').replace('H', '') || 0;
  const minutes = (match[2] || '').replace('M', '') || 0;
  const seconds = (match[3] || '').replace('S', '') || 0;
  
  return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds);
}

module.exports = {
  youtube,
  youtubeConfig,
  youtubeUtils
}; 