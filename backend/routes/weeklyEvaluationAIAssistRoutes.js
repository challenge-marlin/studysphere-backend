const express = require('express');
const router = express.Router();
const { pool } = require('../utils/database');
const { customLogger } = require('../utils/logger');
const OpenAI = require('openai');

// OpenAIクライアントの初期化
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * GPT-4oによる週次評価内容自動生成
 */
router.post('/generate-evaluation-content', async (req, res) => {
  const {
    user_id,
    period_start,
    period_end,
    evaluation_method,
    recorder_name
  } = req.body;
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    // 1. 対象期間の日次記録を取得
    const [dailyRecords] = await connection.execute(`
      SELECT 
        date,
        work_note,
        work_result,
        daily_report,
        support_content,
        advice,
        condition,
        condition_note
      FROM remote_support_daily_records
      WHERE user_id = ? 
        AND date >= ? 
        AND date <= ?
      ORDER BY date ASC
    `, [user_id, period_start, period_end]);
    
    // 2. 個別支援計画を取得
    const [supportPlan] = await connection.execute(`
      SELECT 
        long_term_goal,
        short_term_goal,
        needs,
        support_content as plan_support_content,
        goal_date
      FROM support_plans
      WHERE user_id = ?
    `, [user_id]);
    
    // 3. ユーザー情報を取得
    const [userInfo] = await connection.execute(`
      SELECT 
        name,
        recipient_number
      FROM user_accounts
      WHERE id = ?
    `, [user_id]);
    
    if (userInfo.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ユーザー情報が見つかりません'
      });
    }
    
    // 4. GPT-4oに送信するプロンプトを構築
    const user = userInfo[0];
    const supportPlanData = supportPlan[0] || {};
    
    // 日次記録のサマリーを作成
    const dailyRecordsSummary = dailyRecords.map(record => ({
      date: record.date,
      work_content: record.work_note || '',
      work_result: record.work_result || '',
      daily_report: record.daily_report || '',
      support_content: record.support_content || '',
      advice: record.advice || '',
      condition: record.condition || '',
      condition_note: record.condition_note || ''
    }));
    
    const prompt = `
以下の情報を基に、在宅就労支援の週次評価内容を生成してください。

【対象者情報】
- 氏名: ${user.name}
- 受給者証番号: ${user.recipient_number || '未設定'}
- 評価期間: ${period_start} ～ ${period_end}
- 評価方法: ${evaluation_method}
- 記録者: ${recorder_name}

【個別支援計画】
- 長期目標: ${supportPlanData.long_term_goal || '未設定'}
- 短期目標: ${supportPlanData.short_term_goal || '未設定'}
- ニーズ: ${supportPlanData.needs || '未設定'}
- 支援内容: ${supportPlanData.plan_support_content || '未設定'}
- 目標達成予定日: ${supportPlanData.goal_date || '未設定'}

【対象期間の日次記録】
${dailyRecordsSummary.map(record => `
日付: ${record.date}
- 作業内容: ${record.work_content}
- 作業実績: ${record.work_result}
- 日報: ${record.daily_report}
- 支援内容: ${record.support_content}
- 心身状況・助言内容: ${record.advice}
- 体調: ${record.condition} ${record.condition_note ? `(${record.condition_note})` : ''}
`).join('\n')}

【評価内容生成の指示】
上記の情報を基に、以下の観点から週次評価内容を生成してください：

1. 対象期間の支援内容の振り返り
2. 対象者の心身の状況・変化
3. 個別支援計画に沿った目標達成状況
4. 課題と今後の支援方針
5. 在宅就労継続の妥当性

評価内容は専門的で具体的に記述し、個別支援計画との整合性を保ってください。
文字数は800-1200文字程度で、読みやすい文章にしてください。
`;

    // 5. GPT-4oにリクエストを送信
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "あなたは在宅就労支援の専門家です。週次評価記録を作成する際は、個別支援計画に基づいた具体的で専門的な評価内容を提供してください。"
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.7
    });
    
    const generatedContent = completion.choices[0].message.content;
    
    res.json({
      success: true,
      data: {
        evaluation_content: generatedContent,
        daily_records_count: dailyRecords.length,
        has_support_plan: supportPlan.length > 0
      }
    });
    
  } catch (error) {
    customLogger.error('GPT-4o評価内容生成エラー:', error);
    
    // OpenAI APIエラーの場合の詳細ログ
    if (error.response) {
      customLogger.error('OpenAI API エラー詳細:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
    }
    
    res.status(500).json({
      success: false,
      message: '評価内容の生成中にエラーが発生しました',
      error: error.message
    });
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('接続の解放に失敗:', releaseError);
      }
    }
  }
});

/**
 * 評価内容の改善提案
 */
router.post('/improve-evaluation-content', async (req, res) => {
  const {
    current_content,
    user_id,
    period_start,
    period_end
  } = req.body;
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    // 個別支援計画を取得
    const [supportPlan] = await connection.execute(`
      SELECT 
        long_term_goal,
        short_term_goal,
        needs,
        support_content as plan_support_content
      FROM support_plans
      WHERE user_id = ?
    `, [user_id]);
    
    const supportPlanData = supportPlan[0] || {};
    
    const prompt = `
以下の現在の評価内容を、個別支援計画に基づいて改善してください。

【個別支援計画】
- 長期目標: ${supportPlanData.long_term_goal || '未設定'}
- 短期目標: ${supportPlanData.short_term_goal || '未設定'}
- ニーズ: ${supportPlanData.needs || '未設定'}
- 支援内容: ${supportPlanData.plan_support_content || '未設定'}

【現在の評価内容】
${current_content}

【改善指示】
1. 個別支援計画との整合性を高める
2. より具体的で専門的な表現に修正
3. 課題と改善方針を明確化
4. 在宅就労継続の妥当性をより詳細に記述

改善された評価内容を提供してください。
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "あなたは在宅就労支援の専門家です。評価内容を個別支援計画に基づいて改善し、より専門的で具体的な内容にしてください。"
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.7
    });
    
    const improvedContent = completion.choices[0].message.content;
    
    res.json({
      success: true,
      data: {
        improved_content: improvedContent
      }
    });
    
  } catch (error) {
    customLogger.error('評価内容改善エラー:', error);
    res.status(500).json({
      success: false,
      message: '評価内容の改善中にエラーが発生しました',
      error: error.message
    });
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('接続の解放に失敗:', releaseError);
      }
    }
  }
});

module.exports = router;
