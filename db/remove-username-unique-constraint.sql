-- Remove unique constraint from username in admin_credentials table
USE `curriculum-portal`;

-- Drop the unique constraint on username
ALTER TABLE `admin_credentials` DROP INDEX `unique_username`; 