-- データベース復元スクリプト
-- バックアップテーブルからデータを復元

USE `curriculum-portal`;

-- バックアップテーブルが存在するかチェック
SET @backup_exists = (
    SELECT COUNT(*) 
    FROM information_schema.tables 
    WHERE table_schema = 'curriculum-portal' 
    AND table_name = 'backup_admin_credentials'
);

-- バックアップが存在する場合のみ復元を実行
SELECT IF(@backup_exists > 0, 'Restoring from backup...', 'No backup found, skipping restore') as status;

-- バックアップデータを復元（バックアップが存在する場合のみ）
INSERT IGNORE INTO `admin_credentials` SELECT * FROM `backup_admin_credentials`;
INSERT IGNORE INTO `user_accounts` SELECT * FROM `backup_user_accounts`;
INSERT IGNORE INTO `companies` SELECT * FROM `backup_companies`;
INSERT IGNORE INTO `satellites` SELECT * FROM `backup_satellites`;
INSERT IGNORE INTO `curriculum_progress` SELECT * FROM `backup_curriculum_progress`;
INSERT IGNORE INTO `refresh_tokens` SELECT * FROM `backup_refresh_tokens`;
INSERT IGNORE INTO `curriculum_videos` SELECT * FROM `backup_curriculum_videos`;
INSERT IGNORE INTO `test_results` SELECT * FROM `backup_test_results`;
INSERT IGNORE INTO `personality_results` SELECT * FROM `backup_personality_results`;
INSERT IGNORE INTO `questionnaire_results` SELECT * FROM `backup_questionnaire_results`;
INSERT IGNORE INTO `gatb_results` SELECT * FROM `backup_gatb_results`;
INSERT IGNORE INTO `curriculum_routes` SELECT * FROM `backup_curriculum_routes`;
INSERT IGNORE INTO `remote_support_daily_records` SELECT * FROM `backup_remote_support_daily_records`;
INSERT IGNORE INTO `weekly_evaluation_records` SELECT * FROM `backup_weekly_evaluation_records`;
INSERT IGNORE INTO `monthly_evaluation_records` SELECT * FROM `backup_monthly_evaluation_records`;
INSERT IGNORE INTO `support_plans` SELECT * FROM `backup_support_plans`;
INSERT IGNORE INTO `deliverables` SELECT * FROM `backup_deliverables`;
INSERT IGNORE INTO `instructor_specializations` SELECT * FROM `backup_instructor_specializations`;

-- 復元完了後、バックアップテーブルを削除
DROP TABLE IF EXISTS `backup_admin_credentials`;
DROP TABLE IF EXISTS `backup_user_accounts`;
DROP TABLE IF EXISTS `backup_companies`;
DROP TABLE IF EXISTS `backup_satellites`;
DROP TABLE IF EXISTS `backup_curriculum_progress`;
DROP TABLE IF EXISTS `backup_refresh_tokens`;
DROP TABLE IF EXISTS `backup_curriculum_videos`;
DROP TABLE IF EXISTS `backup_test_results`;
DROP TABLE IF EXISTS `backup_personality_results`;
DROP TABLE IF EXISTS `backup_questionnaire_results`;
DROP TABLE IF EXISTS `backup_gatb_results`;
DROP TABLE IF EXISTS `backup_curriculum_routes`;
DROP TABLE IF EXISTS `backup_remote_support_daily_records`;
DROP TABLE IF EXISTS `backup_weekly_evaluation_records`;
DROP TABLE IF EXISTS `backup_monthly_evaluation_records`;
DROP TABLE IF EXISTS `backup_support_plans`;
DROP TABLE IF EXISTS `backup_deliverables`;
DROP TABLE IF EXISTS `backup_instructor_specializations`;

-- 復元完了の確認
SELECT 'Restore completed successfully' as status; 