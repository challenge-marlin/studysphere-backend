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
 * GPT-4oによる月次評価内容自動生成
 */

// 訓練目標のAI提案（個別支援計画の長・短期目標から）
router.post('/generate-goal', async (req, res) => {
  const { user_id } = req.body;
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    // 個別支援計画を取得
    const [supportPlan] = await connection.execute(`
      SELECT 
        long_term_goal,
        short_term_goal,
        needs,
        support_content,
        goal_date
      FROM support_plans
      WHERE user_id = ?
    `, [user_id]);
    
    if (supportPlan.length === 0) {
      return res.status(404).json({
        success: false,
        message: '個別支援計画が見つかりません'
      });
    }
    
    const plan = supportPlan[0];
    
    // GPT-4oに送信するプロンプトを構築
    const prompt = `
以下の個別支援計画の情報を基に、月次評価記録の「訓練目標」を提案してください。

【個別支援計画】
- 長期目標: ${plan.long_term_goal || '未設定'}
- 短期目標: ${plan.short_term_goal || '未設定'}
- ニーズ: ${plan.needs || '未設定'}
- 支援内容: ${plan.support_content || '未設定'}
- 目標達成予定日: ${plan.goal_date || '未設定'}

【指示】
1. 長期目標と短期目標を踏まえて、月次評価に適した具体的な訓練目標を提案してください
2. 目標は測定可能で具体的な内容にしてください
3. 在宅就労支援の文脈に適した内容にしてください
4. 200文字以内で簡潔に記述してください

【出力形式】
提案する訓練目標のみを出力してください。説明や補足は不要です。
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "あなたは在宅就労支援の専門家です。個別支援計画を基に、月次評価に適した具体的な訓練目標を提案してください。"
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 300,
      temperature: 0.7
    });
    
    const goal = completion.choices[0].message.content.trim();
    
    res.json({
      success: true,
      data: {
        goal: goal
      }
    });
  } catch (error) {
    customLogger.error('訓練目標AI提案エラー:', error);
    res.status(500).json({
      success: false,
      message: '訓練目標の提案中にエラーが発生しました',
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

// 取組内容のAI提案（該当期間の週報から要約）
router.post('/generate-effort', async (req, res) => {
  const { user_id, period_start, period_end } = req.body;
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    // 該当期間の週次評価を取得（期間が重なるものを取得）
    const [weeklyEvaluations] = await connection.execute(`
      SELECT 
        period_start,
        period_end,
        evaluation_content,
        date
      FROM weekly_evaluation_records
      WHERE user_id = ? 
        AND period_start <= ? 
        AND period_end >= ?
        AND (evaluation_content IS NOT NULL AND evaluation_content != '')
      ORDER BY period_start ASC
    `, [user_id, period_end, period_start]);
    
    if (weeklyEvaluations.length === 0) {
      return res.status(404).json({
        success: false,
        message: '該当期間の週次評価が見つかりません'
      });
    }
    
    // 週次評価のサマリーを作成
    const weeklySummary = weeklyEvaluations.map(record => 
      `【${record.period_start} ～ ${record.period_end}】評価日: ${record.date}\n評価内容: ${record.evaluation_content || ''}`
    ).join('\n\n');
    
    // GPT-4oに送信するプロンプトを構築
    const prompt = `
以下の期間の週次評価を基に、月次評価記録の「取組内容」を要約・提案してください。

【対象期間】
${period_start} ～ ${period_end}

【週次評価】
${weeklySummary}

【指示】
1. 上記の週次評価を整理・要約して、月次評価に適した取組内容を提案してください
2. 具体的な作業内容と支援内容を盛り込んでください
3. 在宅就労支援の文脈に適した内容にしてください
4. 300文字以内で簡潔に記述してください

【出力形式】
提案する取組内容のみを出力してください。説明や補足は不要です。
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "あなたは在宅就労支援の専門家です。週次評価を基に、月次評価に適した取組内容を要約・提案してください。"
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 400,
      temperature: 0.7
    });
    
    const effort = completion.choices[0].message.content.trim();
    
    res.json({
      success: true,
      data: {
        effort: effort
      }
    });
  } catch (error) {
    customLogger.error('取組内容AI提案エラー:', error);
    res.status(500).json({
      success: false,
      message: '取組内容の提案中にエラーが発生しました',
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

// 訓練目標に対する達成度のAI提案
router.post('/generate-achievement', async (req, res) => {
  const { goal, effort } = req.body;
  
  try {
    // GPT-4oに送信するプロンプトを構築
    const prompt = `
以下の訓練目標と取組内容を比較して、月次評価記録の「訓練目標に対する達成度」を提案してください。

【訓練目標】
${goal}

【取組内容】
${effort}

【指示】
1. 訓練目標と取組内容を比較して、達成度を客観的に評価してください
2. 具体的な成果や進捗を踏まえて評価してください
3. 在宅就労支援の文脈に適した内容にしてください
4. 200文字以内で簡潔に記述してください

【出力形式】
提案する達成度評価のみを出力してください。説明や補足は不要です。
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "あなたは在宅就労支援の専門家です。訓練目標と取組内容を比較して、客観的な達成度評価を提案してください。"
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 300,
      temperature: 0.7
    });
    
    const achievement = completion.choices[0].message.content.trim();
    
    res.json({
      success: true,
      data: {
        achievement: achievement
      }
    });
  } catch (error) {
    customLogger.error('達成度AI提案エラー:', error);
    res.status(500).json({
      success: false,
      message: '達成度の提案中にエラーが発生しました',
      error: error.message
    });
  }
});

// 課題のAI提案
router.post('/generate-issues', async (req, res) => {
  const { goal, achievement } = req.body;
  
  try {
    // GPT-4oに送信するプロンプトを構築
    const prompt = `
以下の訓練目標と達成度を比較して、月次評価記録の「課題」を提案してください。

【訓練目標】
${goal}

【訓練目標に対する達成度】
${achievement}

【指示】
1. 訓練目標と達成度のギャップから課題を特定してください
2. 具体的で改善可能な課題を提案してください
3. 在宅就労支援の文脈に適した内容にしてください
4. 200文字以内で簡潔に記述してください

【出力形式】
提案する課題のみを出力してください。説明や補足は不要です。
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "あなたは在宅就労支援の専門家です。訓練目標と達成度のギャップから、具体的で改善可能な課題を提案してください。"
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 300,
      temperature: 0.7
    });
    
    const issues = completion.choices[0].message.content.trim();
    
    res.json({
      success: true,
      data: {
        issues: issues
      }
    });
  } catch (error) {
    customLogger.error('課題AI提案エラー:', error);
    res.status(500).json({
      success: false,
      message: '課題の提案中にエラーが発生しました',
      error: error.message
    });
  }
});

// 課題の改善方針のAI提案（課題と個別支援計画書から）
router.post('/generate-improvement', async (req, res) => {
  const { issues, user_id } = req.body;
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    // 個別支援計画を取得
    const [supportPlans] = await connection.execute(`
      SELECT 
        long_term_goal,
        short_term_goal,
        needs,
        support_content,
        goal_date
      FROM support_plans
      WHERE user_id = ?
    `, [user_id]);
    
    const supportPlan = supportPlans.length > 0 ? supportPlans[0] : null;
    
    // GPT-4oに送信するプロンプトを構築
    const prompt = `
以下の課題と個別支援計画を基に、月次評価記録の「課題の改善方針」を提案してください。

【課題】
${issues}

【個別支援計画】
${supportPlan ? `
- 長期目標: ${supportPlan.long_term_goal || '未設定'}
- 短期目標: ${supportPlan.short_term_goal || '未設定'}
- ニーズ: ${supportPlan.needs || '未設定'}
- 支援内容: ${supportPlan.support_content || '未設定'}
- 目標達成予定日: ${supportPlan.goal_date || '未設定'}
` : '個別支援計画の記録がありません'}

【指示】
1. 課題に対して具体的な改善方針を提案してください
2. 個別支援計画の内容を参考に、実現可能な改善策を提案してください
3. 在宅就労支援の文脈に適した内容にしてください
4. 200文字以内で簡潔に記述してください

【出力形式】
提案する改善方針のみを出力してください。説明や補足は不要です。
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "あなたは在宅就労支援の専門家です。課題と個別支援計画を基に、具体的で実現可能な改善方針を提案してください。"
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 300,
      temperature: 0.7
    });
    
    const improvement = completion.choices[0].message.content.trim();
    
    res.json({
      success: true,
      data: {
        improvement: improvement
      }
    });
  } catch (error) {
    customLogger.error('改善方針AI提案エラー:', error);
    res.status(500).json({
      success: false,
      message: '改善方針の提案中にエラーが発生しました',
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

// 健康・体調面での留意事項のAI提案（対象期間中の週報を基に）
router.post('/generate-health', async (req, res) => {
  const { user_id, period_start, period_end } = req.body;
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    // 該当期間の週次評価を取得（健康・体調に関する情報を含む可能性があるため、全内容を取得）
    // 期間が重なるものを取得
    const [weeklyEvaluations] = await connection.execute(`
      SELECT 
        period_start,
        period_end,
        evaluation_content,
        date
      FROM weekly_evaluation_records
      WHERE user_id = ? 
        AND period_start <= ? 
        AND period_end >= ?
        AND (evaluation_content IS NOT NULL AND evaluation_content != '')
      ORDER BY period_start ASC
    `, [user_id, period_end, period_start]);
    
    if (weeklyEvaluations.length === 0) {
      return res.json({
        success: true,
        data: {
          health: '該当期間の週次評価がありません。健康・体調に関する記録も見つかりませんでした。'
        }
      });
    }
    
    // 週次評価のサマリーを作成
    const weeklySummary = weeklyEvaluations.map(record => 
      `【${record.period_start} ～ ${record.period_end}】評価日: ${record.date}\n評価内容: ${record.evaluation_content || ''}`
    ).join('\n\n');
    
    // GPT-4oに送信するプロンプトを構築
    const prompt = `
以下の期間の週次評価を基に、月次評価記録の「健康・体調面での留意事項」を要約・提案してください。

【対象期間】
${period_start} ～ ${period_end}

【週次評価】
${weeklySummary}

【指示】
1. 上記の週次評価から健康・体調に関する情報を抽出し、留意事項を提案してください
2. 継続的な支援に必要な健康・体調面での情報を整理してください
3. 在宅就労支援の文脈に適した内容にしてください
4. 200文字以内で簡潔に記述してください

【出力形式】
提案する留意事項のみを出力してください。説明や補足は不要です。
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "あなたは在宅就労支援の専門家です。週次評価から健康・体調に関する情報を抽出し、継続的な支援に必要な留意事項を提案してください。"
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 300,
      temperature: 0.7
    });
    
    const health = completion.choices[0].message.content.trim();
    
    res.json({
      success: true,
      data: {
        health: health
      }
    });
  } catch (error) {
    customLogger.error('健康留意事項AI提案エラー:', error);
    res.status(500).json({
      success: false,
      message: '健康留意事項の提案中にエラーが発生しました',
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

// 在宅就労継続の妥当性のAI提案（個別支援計画書と訓練目標～その他特記事項の内容を総合的に勘案）
router.post('/generate-appropriateness', async (req, res) => {
  const { user_id, goal, effort, achievement, issues, improvement, health, other_notes } = req.body;
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    // 個別支援計画を取得
    const [supportPlans] = await connection.execute(`
      SELECT 
        long_term_goal,
        short_term_goal,
        needs,
        support_content,
        goal_date
      FROM support_plans
      WHERE user_id = ?
    `, [user_id]);
    
    const supportPlan = supportPlans.length > 0 ? supportPlans[0] : null;
    
    // GPT-4oに送信するプロンプトを構築
    const prompt = `
以下の個別支援計画と月次評価記録の内容を基に、「在宅就労継続の妥当性」を提案してください。

【個別支援計画】
${supportPlan ? `
- 長期目標: ${supportPlan.long_term_goal || '未設定'}
- 短期目標: ${supportPlan.short_term_goal || '未設定'}
- ニーズ: ${supportPlan.needs || '未設定'}
- 支援内容: ${supportPlan.support_content || '未設定'}
- 目標達成予定日: ${supportPlan.goal_date || '未設定'}
` : '個別支援計画の記録がありません'}

【訓練目標】
${goal || '未設定'}

【取組内容】
${effort || '未設定'}

【訓練目標に対する達成度】
${achievement || '未設定'}

【課題】
${issues || '未設定'}

【課題の改善方針】
${improvement || '未設定'}

【健康・体調面での留意事項】
${health || '未設定'}

【その他特記事項】
${other_notes || 'なし'}

【指示】
1. 個別支援計画と月次評価記録の全ての情報を総合的に評価して、在宅就労継続の妥当性を判断してください
2. 妥当性があると納得させる文章を作成してください
3. 具体的な根拠を示してください
4. 在宅就労支援の文脈に適した内容にしてください
5. 300文字以内で簡潔に記述してください

【出力形式】
提案する妥当性評価のみを出力してください。説明や補足は不要です。
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "あなたは在宅就労支援の専門家です。個別支援計画と月次評価記録の内容を総合的に評価して、在宅就労継続の妥当性を判断してください。"
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 400,
      temperature: 0.7
    });
    
    const appropriateness = completion.choices[0].message.content.trim();
    
    res.json({
      success: true,
      data: {
        appropriateness: appropriateness
      }
    });
  } catch (error) {
    customLogger.error('妥当性AI提案エラー:', error);
    res.status(500).json({
      success: false,
      message: '妥当性の提案中にエラーが発生しました',
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
