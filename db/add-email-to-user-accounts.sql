-- Add email column to user_accounts table
USE `curriculum-portal`;

-- Add email column to user_accounts table
ALTER TABLE `user_accounts` 
ADD COLUMN `email` VARCHAR(255) DEFAULT NULL COMMENT 'Email address' AFTER `name`;

-- Add index for email searches
CREATE INDEX `idx_email` ON `user_accounts` (`email`); 