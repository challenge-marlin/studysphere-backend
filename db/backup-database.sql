-- データベースバックアップスクリプト
-- 既存のデータを一時テーブルに保存

USE `curriculum-portal`;

-- バックアップ用の一時テーブルを作成
CREATE TABLE IF NOT EXISTS `backup_admin_credentials` LIKE `admin_credentials`;
CREATE TABLE IF NOT EXISTS `backup_user_accounts` LIKE `user_accounts`;
CREATE TABLE IF NOT EXISTS `backup_companies` LIKE `companies`;
CREATE TABLE IF NOT EXISTS `backup_satellites` LIKE `satellites`;
CREATE TABLE IF NOT EXISTS `backup_curriculum_progress` LIKE `curriculum_progress`;
CREATE TABLE IF NOT EXISTS `backup_refresh_tokens` LIKE `refresh_tokens`;
CREATE TABLE IF NOT EXISTS `backup_curriculum_videos` LIKE `curriculum_videos`;
CREATE TABLE IF NOT EXISTS `backup_test_results` LIKE `test_results`;
CREATE TABLE IF NOT EXISTS `backup_personality_results` LIKE `personality_results`;
CREATE TABLE IF NOT EXISTS `backup_questionnaire_results` LIKE `questionnaire_results`;
CREATE TABLE IF NOT EXISTS `backup_gatb_results` LIKE `gatb_results`;
CREATE TABLE IF NOT EXISTS `backup_curriculum_routes` LIKE `curriculum_routes`;
CREATE TABLE IF NOT EXISTS `backup_remote_support_daily_records` LIKE `remote_support_daily_records`;
CREATE TABLE IF NOT EXISTS `backup_weekly_evaluation_records` LIKE `weekly_evaluation_records`;
CREATE TABLE IF NOT EXISTS `backup_monthly_evaluation_records` LIKE `monthly_evaluation_records`;
CREATE TABLE IF NOT EXISTS `backup_support_plans` LIKE `support_plans`;
CREATE TABLE IF NOT EXISTS `backup_deliverables` LIKE `deliverables`;
CREATE TABLE IF NOT EXISTS `backup_instructor_specializations` LIKE `instructor_specializations`;

-- 既存データをバックアップテーブルにコピー
INSERT INTO `backup_admin_credentials` SELECT * FROM `admin_credentials`;
INSERT INTO `backup_user_accounts` SELECT * FROM `user_accounts`;
INSERT INTO `backup_companies` SELECT * FROM `companies`;
INSERT INTO `backup_satellites` SELECT * FROM `satellites`;
INSERT INTO `backup_curriculum_progress` SELECT * FROM `curriculum_progress`;
INSERT INTO `backup_refresh_tokens` SELECT * FROM `refresh_tokens`;
INSERT INTO `backup_curriculum_videos` SELECT * FROM `curriculum_videos`;
INSERT INTO `backup_test_results` SELECT * FROM `test_results`;
INSERT INTO `backup_personality_results` SELECT * FROM `personality_results`;
INSERT INTO `backup_questionnaire_results` SELECT * FROM `questionnaire_results`;
INSERT INTO `backup_gatb_results` SELECT * FROM `gatb_results`;
INSERT INTO `backup_curriculum_routes` SELECT * FROM `curriculum_routes`;
INSERT INTO `backup_remote_support_daily_records` SELECT * FROM `remote_support_daily_records`;
INSERT INTO `backup_weekly_evaluation_records` SELECT * FROM `weekly_evaluation_records`;
INSERT INTO `backup_monthly_evaluation_records` SELECT * FROM `monthly_evaluation_records`;
INSERT INTO `backup_support_plans` SELECT * FROM `support_plans`;
INSERT INTO `backup_deliverables` SELECT * FROM `deliverables`;
INSERT INTO `backup_instructor_specializations` SELECT * FROM `instructor_specializations`;

-- バックアップ完了の確認
SELECT 'Backup completed successfully' as status; 