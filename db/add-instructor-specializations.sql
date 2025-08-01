-- Add instructor specializations table migration
-- Execution date: 2024-12

USE `curriculum-portal`;

-- Create instructor specializations table
CREATE TABLE IF NOT EXISTS `instructor_specializations` (
    `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Specialization ID',
    `user_id` INT NOT NULL COMMENT 'Instructor user ID (user_accounts.id)',
    `specialization` VARCHAR(255) NOT NULL COMMENT 'Specialization (text format)',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'Created at',
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Updated at',
    FOREIGN KEY (`user_id`) REFERENCES `user_accounts`(`id`) ON DELETE CASCADE,
    INDEX `idx_user_id` (`user_id`)
) COMMENT = 'Instructor specializations table';

-- Sample data for instructor specializations
-- Note: Adjust user IDs according to actual data
INSERT IGNORE INTO `instructor_specializations` (`user_id`, `specialization`) VALUES
(2, 'IT Literacy'),
(2, 'Programming Basics'),
(2, 'Employment Support'),
(3, 'IT Literacy'),
(3, 'Disability Support'),
(3, 'Stress Management'),
(4, 'Web Design'),
(4, 'Data Analysis'),
(4, 'Vocational Training');

-- Migration completion message
SELECT 'Instructor specializations table addition completed.' AS migration_status; 