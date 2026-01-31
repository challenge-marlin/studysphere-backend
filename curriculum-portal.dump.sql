-- MySQL dump 10.13  Distrib 8.0.43, for Linux (x86_64)
--
-- Host: localhost    Database: curriculum-portal
-- ------------------------------------------------------
-- Server version	8.0.43

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `curriculum-portal`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `curriculum-portal` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `curriculum-portal`;

--
-- Table structure for table `admin_credentials`
--

DROP TABLE IF EXISTS `admin_credentials`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_credentials` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'èªè¨¼ID',
  `user_id` int NOT NULL COMMENT 'ãƒ¦ãƒ¼ã‚¶ãƒ¼IDï¼ˆuser_accounts.idï¼‰',
  `username` varchar(50) NOT NULL COMMENT 'ãƒ­ã‚°ã‚¤ãƒ³IDï¼ˆãƒ¦ãƒ¼ã‚¶ãƒ¼åï¼‰',
  `password_hash` varchar(255) NOT NULL COMMENT 'ãƒ‘ã‚¹ãƒ¯ãƒ¼ãƒ‰ãƒãƒƒã‚·ãƒ¥ï¼ˆbcryptç­‰ã§æš—å·åŒ–ï¼‰',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'ä½œæˆæ—¥æ™‚',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'æ›´æ–°æ—¥æ™‚',
  `last_login_at` datetime DEFAULT NULL COMMENT 'æœ€çµ‚ãƒ­ã‚°ã‚¤ãƒ³æ—¥æ™‚',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_id` (`user_id`),
  UNIQUE KEY `unique_username` (`username`),
  CONSTRAINT `admin_credentials_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user_accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='ç®¡ç†è€…èªè¨¼ãƒ†ãƒ¼ãƒ–ãƒ«ï¼ˆãƒ­ãƒ¼ãƒ«4ä»¥ä¸Šå°‚ç”¨ï¼‰';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admin_credentials`
--

LOCK TABLES `admin_credentials` WRITE;
/*!40000 ALTER TABLE `admin_credentials` DISABLE KEYS */;
INSERT INTO `admin_credentials` VALUES (1,1,'admin001','$2b$12$C.gFlhNgURGmIQ.oW6wJ8.9yxmL6DU2y1u.7yPjlpw0Z.H/8Myl92','2025-08-27 14:01:49','2025-09-16 13:57:01','2025-09-16 13:57:01'),(2,2,'moriuchi1101','$2a$10$m/BduHwveYoMANjx7ql82unVAlL58g/1np65mCmZ85qrZehu.dVzS','2025-08-27 14:17:46','2025-12-12 06:19:18','2025-12-12 06:19:18'),(3,3,'tokiyasu1104','$2a$10$/XFp9.u/7pHoJNpP/gyFUuagM57G7wJ/RoWkGpAw7I9F1NV97gPjW','2025-08-27 14:19:33','2025-12-12 02:13:39','2025-12-12 02:13:39'),(4,4,'ono1105','$2a$10$aG5Ih7Ms5tx6thGKtrV2EOaOj.XyaL6EXTNQQQg6cmjbuMfP6RvrW','2025-08-27 14:20:29','2025-09-19 14:10:16','2025-09-19 14:10:16'),(5,5,'takamatsu1202','$2a$10$EhA8pchMCi58Z6Zkp8wl1er5Ox1sdW8ZpPpQ0c4dO2t/Rb4qdvuDW','2025-08-27 14:21:35','2025-12-01 04:34:59','2025-12-01 04:34:59'),(6,6,'inokuchi1108','$2a$10$JZyT111Y3KHXY2vw4abF4u0rT1ThlnoaRruneHsRMD.ZsdQXy82Tu','2025-08-27 14:22:42','2025-08-27 14:22:42',NULL),(7,7,'ichikawa1109','$2a$10$DY3W1R7fZpYe/MEovjszYOzSIEIH.pn0wVUOZZdtamNadsuSNYr3G','2025-08-27 14:23:42','2025-08-27 14:23:42',NULL),(8,8,'m.kobuchi','$2a$12$CZ4H38s.xH9jY/h.Qqfk2uJoCArMcUkc.oN2paGahXW9CAbY/bzKS','2025-08-27 14:42:48','2025-08-27 14:42:48',NULL),(9,9,'g.sueyoshi','$2a$12$Tpv4Mfasqco6zGVB0Ab1TOtnViY5o4rEJ2s0cQ9O.Dh2tBk.AnvYa','2025-08-27 14:43:05','2026-01-28 05:44:06','2026-01-28 05:44:06');
/*!40000 ALTER TABLE `admin_credentials` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `announcements`
--

DROP TABLE IF EXISTS `announcements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `announcements` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'アナウンスID',
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'アナウンスタイトル',
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'アナウンスメッセージ',
  `created_by` int NOT NULL COMMENT '作成者ID',
  `expires_at` datetime NOT NULL DEFAULT (((curdate() + interval 1 day) + interval 30 minute)) COMMENT 'æœ‰åŠ¹æœŸé™ï¼ˆæ—¥æœ¬æ™‚é–“24:30ï¼‰',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新日時',
  PRIMARY KEY (`id`),
  KEY `idx_created_by` (`created_by`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_expires_at` (`expires_at`),
  CONSTRAINT `announcements_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `user_accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='アナウンスメッセージテーブル';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `announcements`
--

LOCK TABLES `announcements` WRITE;
/*!40000 ALTER TABLE `announcements` DISABLE KEYS */;
/*!40000 ALTER TABLE `announcements` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `companies`
--

DROP TABLE IF EXISTS `companies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `companies` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'ä¼æ¥­ID',
  `name` varchar(255) NOT NULL COMMENT 'ä¼æ¥­åï¼ˆç®¡ç†è€…ä»¥ä¸Šã®ãƒ¦ãƒ¼ã‚¶åã¨ã—ã¦ä½¿ç”¨ï¼‰',
  `address` text COMMENT 'ä¼æ¥­ä½æ‰€',
  `phone` varchar(20) DEFAULT NULL COMMENT 'ä¼æ¥­é›»è©±ç•ªå·',
  `token` varchar(14) DEFAULT NULL COMMENT 'ç®¡ç†ç¬¦å·ãƒˆãƒ¼ã‚¯ãƒ³ï¼ˆå½¢å¼ï¼šXXXX-XXXX-XXXXï¼‰',
  `token_issued_at` datetime DEFAULT NULL COMMENT 'ãƒˆãƒ¼ã‚¯ãƒ³ç™ºè¡Œæ—¥æ™‚',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'ä½œæˆæ—¥æ™‚',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'æ›´æ–°æ—¥æ™‚',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_company_token` (`token`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='ä¼æ¥­æƒ…å ±ãƒ†ãƒ¼ãƒ–ãƒ«';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `companies`
--

LOCK TABLES `companies` WRITE;
/*!40000 ALTER TABLE `companies` DISABLE KEYS */;
INSERT INTO `companies` VALUES (1,'チャレンジラボラトリー',NULL,NULL,'GFMO-VN6Y-Z4QK','2025-08-27 14:15:42','2025-08-27 14:15:41','2025-08-27 14:15:41');
/*!40000 ALTER TABLE `companies` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `courses`
--

DROP TABLE IF EXISTS `courses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `courses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ã‚³ãƒ¼ã‚¹å',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT 'ã‚³ãƒ¼ã‚¹ã®èª¬æ˜Ž',
  `category` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'é¸æŠžç§‘ç›®' COMMENT 'ã‚«ãƒ†ã‚´ãƒªï¼ˆå¿…ä¿®ç§‘ç›®/é¸æŠžç§‘ç›®ï¼‰',
  `status` enum('active','inactive','draft') COLLATE utf8mb4_unicode_ci DEFAULT 'active' COMMENT 'ã‚³ãƒ¼ã‚¹ã®çŠ¶æ…‹',
  `order_index` int DEFAULT '0' COMMENT 'è¡¨ç¤ºé †åº',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` int DEFAULT NULL COMMENT 'ä½œæˆè€…ID',
  `updated_by` int DEFAULT NULL COMMENT 'æ›´æ–°è€…ID',
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_category` (`category`),
  KEY `idx_order` (`order_index`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ã‚³ãƒ¼ã‚¹ç®¡ç†ãƒ†ãƒ¼ãƒ–ãƒ«';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `courses`
--

LOCK TABLES `courses` WRITE;
/*!40000 ALTER TABLE `courses` DISABLE KEYS */;
INSERT INTO `courses` VALUES (1,' ITリテラシー・AIの基本','','必修科目','active',0,'2025-08-27 05:25:01','2025-08-27 05:25:01',1,NULL),(2,'SNS運用の基礎・画像生成編集','','必修科目','active',1,'2025-08-27 05:25:27','2025-08-27 05:25:27',1,NULL),(3,'LP制作（HTML・CSS）','','必修科目','active',2,'2025-08-27 05:25:48','2025-08-27 05:25:48',1,NULL);
/*!40000 ALTER TABLE `courses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `curriculum_path_courses`
--

DROP TABLE IF EXISTS `curriculum_path_courses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `curriculum_path_courses` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'é–¢é€£ID',
  `curriculum_path_id` int NOT NULL COMMENT 'ã‚«ãƒªã‚­ãƒ¥ãƒ©ãƒ ãƒ‘ã‚¹ID',
  `course_id` int NOT NULL COMMENT 'ã‚³ãƒ¼ã‚¹ID',
  `order_index` int NOT NULL DEFAULT '0' COMMENT 'è¡¨ç¤ºé †åº',
  `is_required` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'å¿…é ˆã‚³ãƒ¼ã‚¹ã‹ã©ã†ã‹',
  `estimated_duration` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'æŽ¨å®šæœŸé–“ï¼ˆä¾‹ï¼š3ãƒ¶æœˆï¼‰',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'ä½œæˆæ—¥æ™‚',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'æ›´æ–°æ—¥æ™‚',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_path_course` (`curriculum_path_id`,`course_id`),
  KEY `idx_path_id` (`curriculum_path_id`),
  KEY `idx_course_id` (`course_id`),
  KEY `idx_order` (`order_index`),
  CONSTRAINT `curriculum_path_courses_ibfk_1` FOREIGN KEY (`curriculum_path_id`) REFERENCES `curriculum_paths` (`id`) ON DELETE CASCADE,
  CONSTRAINT `curriculum_path_courses_ibfk_2` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ã‚«ãƒªã‚­ãƒ¥ãƒ©ãƒ ãƒ‘ã‚¹-ã‚³ãƒ¼ã‚¹é–¢é€£ãƒ†ãƒ¼ãƒ–ãƒ«';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `curriculum_path_courses`
--

LOCK TABLES `curriculum_path_courses` WRITE;
/*!40000 ALTER TABLE `curriculum_path_courses` DISABLE KEYS */;
INSERT INTO `curriculum_path_courses` VALUES (1,1,1,1,1,'3ヶ月','2025-08-27 05:42:15','2025-08-27 05:42:15'),(2,1,2,2,1,'3ヶ月','2025-08-27 05:42:15','2025-08-27 05:42:15'),(3,1,3,3,1,'3ヶ月','2025-08-27 05:42:15','2025-08-27 05:42:15');
/*!40000 ALTER TABLE `curriculum_path_courses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `curriculum_paths`
--

DROP TABLE IF EXISTS `curriculum_paths`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `curriculum_paths` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'ã‚«ãƒªã‚­ãƒ¥ãƒ©ãƒ ãƒ‘ã‚¹ID',
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ãƒ‘ã‚¹å',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT 'ãƒ‘ã‚¹èª¬æ˜Ž',
  `target_audience` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'å¯¾è±¡è€…',
  `duration` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'æœŸé–“ï¼ˆä¾‹ï¼š12ãƒ¶æœˆï¼‰',
  `status` enum('active','inactive','draft') COLLATE utf8mb4_unicode_ci DEFAULT 'draft' COMMENT 'ã‚¹ãƒ†ãƒ¼ã‚¿ã‚¹',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'ä½œæˆæ—¥æ™‚',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'æ›´æ–°æ—¥æ™‚',
  `created_by` int DEFAULT NULL COMMENT 'ä½œæˆè€…ID',
  `updated_by` int DEFAULT NULL COMMENT 'æ›´æ–°è€…ID',
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ã‚«ãƒªã‚­ãƒ¥ãƒ©ãƒ ãƒ‘ã‚¹ãƒ†ãƒ¼ãƒ–ãƒ«';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `curriculum_paths`
--

LOCK TABLES `curriculum_paths` WRITE;
/*!40000 ALTER TABLE `curriculum_paths` DISABLE KEYS */;
INSERT INTO `curriculum_paths` VALUES (1,'Web制作基本コース','ITリテラシーの習得から始まり、実務的なSNS運用・LP制作・AIツール活用・プレゼン能力など、デジタル業務の即戦力となるスキルの獲得を目指しています。','Web制作職志望者','9ヶ月','active','2025-08-27 05:42:15','2025-08-27 05:42:15',1,NULL);
/*!40000 ALTER TABLE `curriculum_paths` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `curriculum_routes`
--

DROP TABLE IF EXISTS `curriculum_routes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `curriculum_routes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `from_curriculum` varchar(100) NOT NULL COMMENT 'ç¾åœ¨ã®ã‚«ãƒªã‚­ãƒ¥ãƒ©ãƒ åï¼ˆä¾‹ï¼šã‚«ãƒªã‚­ãƒ¥ãƒ©ãƒ 3ï¼‰',
  `from_session` int NOT NULL COMMENT 'ç¾åœ¨ã®å›žæ•°ï¼ˆä¾‹ï¼š12ï¼‰',
  `to_curriculum` varchar(100) NOT NULL COMMENT 'æ¬¡ã«é€²ã‚€ã‚«ãƒªã‚­ãƒ¥ãƒ©ãƒ å',
  `is_optional` tinyint(1) DEFAULT '0' COMMENT 'é¸æŠžåˆ¶ã‹ã©ã†ã‹',
  `condition_json` text COMMENT 'é€²è¡Œæ¡ä»¶ï¼ˆJSONå½¢å¼ã§å°†æ¥æ‹¡å¼µå¯èƒ½ï¼‰',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='ã‚«ãƒªã‚­ãƒ¥ãƒ©ãƒ é€²è¡Œãƒ«ãƒ¼ãƒˆï¼ˆé€šå¸¸â†’è‡ªå‹•ã€é¸æŠžåˆ¶â†’è¤‡æ•°è¡Œï¼‰';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `curriculum_routes`
--

LOCK TABLES `curriculum_routes` WRITE;
/*!40000 ALTER TABLE `curriculum_routes` DISABLE KEYS */;
/*!40000 ALTER TABLE `curriculum_routes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `deliverables`
--

DROP TABLE IF EXISTS `deliverables`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `deliverables` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'æˆæžœç‰©ID',
  `user_id` int NOT NULL COMMENT 'ãƒ¦ãƒ¼ã‚¶ãƒ¼ID',
  `lesson_id` int NOT NULL,
  `curriculum_name` varchar(100) NOT NULL COMMENT 'ã‚«ãƒªã‚­ãƒ¥ãƒ©ãƒ åï¼ˆä¾‹ï¼šã‚«ãƒªã‚­ãƒ¥ãƒ©ãƒ 1ï¼‰',
  `session_number` int NOT NULL COMMENT 'ç¬¬â—¯å›žï¼ˆæ•°å€¤ï¼‰',
  `file_url` text NOT NULL COMMENT 'S3ãƒ•ã‚¡ã‚¤ãƒ«ãƒ‘ã‚¹ï¼ˆç½²åãªã—ç›¸å¯¾URLï¼‰',
  `file_type` enum('image','pdf','other') DEFAULT 'other' COMMENT 'ãƒ•ã‚¡ã‚¤ãƒ«ã‚¿ã‚¤ãƒ—',
  `file_name` varchar(255) NOT NULL DEFAULT '',
  `file_size` bigint NOT NULL DEFAULT '0',
  `uploaded_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'ã‚¢ãƒƒãƒ—ãƒ­ãƒ¼ãƒ‰æ—¥æ™‚',
  `instructor_approved` tinyint(1) NOT NULL DEFAULT '0',
  `instructor_approved_at` datetime DEFAULT NULL,
  `instructor_id` int DEFAULT NULL,
  `instructor_comment` text,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`,`curriculum_name`,`session_number`),
  KEY `fk_deliverables_instructor_id` (`instructor_id`),
  KEY `idx_lesson_id` (`lesson_id`),
  KEY `idx_instructor_approved` (`instructor_approved`),
  KEY `idx_uploaded_at` (`uploaded_at`),
  CONSTRAINT `deliverables_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user_accounts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_deliverables_instructor_id` FOREIGN KEY (`instructor_id`) REFERENCES `user_accounts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_deliverables_lesson_id` FOREIGN KEY (`lesson_id`) REFERENCES `lessons` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='ã‚«ãƒªã‚­ãƒ¥ãƒ©ãƒ æˆæžœç‰©ãƒ•ã‚¡ã‚¤ãƒ«æƒ…å ±';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `deliverables`
--

LOCK TABLES `deliverables` WRITE;
/*!40000 ALTER TABLE `deliverables` DISABLE KEYS */;
INSERT INTO `deliverables` VALUES (5,98,4,' ITリテラシー・AIの基本',4,'doc/GFMO-VN6Y-Z4QK/1N9R-8AEX-QOVL/RMWI-WlAm-vbyT/4/2026_0122_120015.zip','other','test.zip',118,'2026-01-22 03:00:16',0,NULL,NULL,NULL,'2026-01-22 03:00:16','2026-01-22 03:00:16');
/*!40000 ALTER TABLE `deliverables` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `exam_results`
--

DROP TABLE IF EXISTS `exam_results`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `exam_results` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `lesson_id` int NOT NULL,
  `test_type` enum('section','lesson') NOT NULL,
  `section_index` int DEFAULT NULL,
  `lesson_name` varchar(255) NOT NULL,
  `s3_key` varchar(1024) NOT NULL,
  `passed` tinyint(1) NOT NULL,
  `score` int NOT NULL,
  `total_questions` int NOT NULL,
  `percentage` decimal(5,2) NOT NULL,
  `exam_date` datetime NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `lesson_id` (`lesson_id`),
  CONSTRAINT `exam_results_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user_accounts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `exam_results_ibfk_2` FOREIGN KEY (`lesson_id`) REFERENCES `lessons` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=42 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `exam_results`
--

LOCK TABLES `exam_results` WRITE;
/*!40000 ALTER TABLE `exam_results` DISABLE KEYS */;
INSERT INTO `exam_results` VALUES (1,98,1,'section',NULL,'Windows 11 の基本操作とソフトウェアの活用','doc/GFMO-VN6Y-Z4QK/1N9R-8AEX-QOVL/RMWI-WlAm-vbyT/exam-result/exam-result-1-section-2025-09-09T02-31-57-221Z.md',0,1,10,10.00,'2025-09-09 11:31:57','2025-09-09 11:31:57','2025-09-09 11:31:57'),(2,98,1,'section',NULL,'Windows 11 の基本操作とソフトウェアの活用','doc/GFMO-VN6Y-Z4QK/1N9R-8AEX-QOVL/RMWI-WlAm-vbyT/exam-result/exam-result-1-section-2025-09-09T03-26-07-908Z.md',0,3,10,30.00,'2025-09-09 12:26:08','2025-09-09 12:26:08','2025-09-09 12:26:08'),(3,98,1,'section',NULL,'Windows 11 の基本操作とソフトウェアの活用','doc/GFMO-VN6Y-Z4QK/1N9R-8AEX-QOVL/RMWI-WlAm-vbyT/exam-result/exam-result-1-section-2025-09-09T03-35-31-080Z.md',0,4,10,40.00,'2025-09-09 12:35:31','2025-09-09 12:35:31','2025-09-09 12:35:31'),(4,98,1,'section',NULL,'Windows 11 の基本操作とソフトウェアの活用','doc/GFMO-VN6Y-Z4QK/1N9R-8AEX-QOVL/RMWI-WlAm-vbyT/exam-result/exam-result-1-section-2025-09-09T03-54-18-406Z.md',0,1,10,10.00,'2025-09-09 12:54:18','2025-09-09 12:54:18','2025-09-09 12:54:18'),(5,98,1,'section',NULL,'Windows 11 の基本操作とソフトウェアの活用','doc/GFMO-VN6Y-Z4QK/1N9R-8AEX-QOVL/RMWI-WlAm-vbyT/exam-result/exam-result-1-section-2025-09-09T03-56-22-401Z.md',0,1,10,10.00,'2025-09-09 12:56:22','2025-09-09 12:56:22','2025-09-09 12:56:22'),(6,98,1,'section',NULL,'Windows 11 の基本操作とソフトウェアの活用','doc/GFMO-VN6Y-Z4QK/1N9R-8AEX-QOVL/RMWI-WlAm-vbyT/exam-result/exam-result-1-section-2025-09-09T03-56-22-371Z.md',0,1,10,10.00,'2025-09-09 12:56:22','2025-09-09 12:56:22','2025-09-09 12:56:22'),(7,98,1,'section',NULL,'Windows 11 の基本操作とソフトウェアの活用','doc/GFMO-VN6Y-Z4QK/1N9R-8AEX-QOVL/RMWI-WlAm-vbyT/exam-result/exam-result-1-section-2025-09-09T04-03-14-667Z.md',0,2,10,20.00,'2025-09-09 13:03:14','2025-09-09 13:03:14','2025-09-09 13:03:14'),(8,98,1,'section',NULL,'Windows 11 の基本操作とソフトウェアの活用','doc/GFMO-VN6Y-Z4QK/1N9R-8AEX-QOVL/RMWI-WlAm-vbyT/exam-result/exam-result-1-section-2025-09-09T04-03-15-344Z.md',0,2,10,20.00,'2025-09-09 13:03:15','2025-09-09 13:03:15','2025-09-09 13:03:15'),(9,98,1,'section',NULL,'Windows 11 の基本操作とソフトウェアの活用','doc/GFMO-VN6Y-Z4QK/1N9R-8AEX-QOVL/RMWI-WlAm-vbyT/exam-result/exam-result-1-section-2025-09-09T04-13-52-951Z.md',0,0,10,0.00,'2025-09-09 13:13:53','2025-09-09 13:13:53','2025-09-09 13:13:53'),(10,98,1,'section',NULL,'Windows 11 の基本操作とソフトウェアの活用','doc/GFMO-VN6Y-Z4QK/1N9R-8AEX-QOVL/RMWI-WlAm-vbyT/exam-result/exam-result-1-section-2025-09-09T04-24-27-510Z.md',0,2,10,20.00,'2025-09-09 13:24:27','2025-09-09 13:24:27','2025-09-09 13:24:27'),(11,98,1,'section',NULL,'Windows 11 の基本操作とソフトウェアの活用','doc/GFMO-VN6Y-Z4QK/1N9R-8AEX-QOVL/RMWI-WlAm-vbyT/exam-result/exam-result-1-section-2025-09-09T04-42-44-753Z.md',0,3,10,30.00,'2025-09-09 13:42:44','2025-09-09 13:42:44','2025-09-09 13:42:44'),(12,98,1,'section',NULL,'Windows 11 の基本操作とソフトウェアの活用','doc/GFMO-VN6Y-Z4QK/1N9R-8AEX-QOVL/RMWI-WlAm-vbyT/exam-result/exam-result-1-section-2025-09-09T04-51-46-181Z.md',0,5,10,50.00,'2025-09-09 13:51:46','2025-09-09 13:51:46','2025-09-09 13:51:46'),(13,98,1,'section',NULL,'Windows 11 の基本操作とソフトウェアの活用','doc/GFMO-VN6Y-Z4QK/1N9R-8AEX-QOVL/RMWI-WlAm-vbyT/exam-result/exam-result-1-section-2025-09-09T05-00-26-556Z.md',1,9,10,90.00,'2025-09-09 14:00:26','2025-09-09 14:00:26','2025-09-09 14:00:26'),(14,98,1,'section',NULL,'Windows 11 の基本操作とソフトウェアの活用','doc/GFMO-VN6Y-Z4QK/1N9R-8AEX-QOVL/RMWI-WlAm-vbyT/exam-result/exam-result-1-section-2025-09-09T05-14-12-279Z.md',1,10,10,100.00,'2025-09-09 14:14:12','2025-09-09 14:14:12','2025-09-09 14:14:12'),(20,98,1,'section',NULL,'Windows 11 の基本操作とソフトウェアの活用','doc/GFMO-VN6Y-Z4QK/1N9R-8AEX-QOVL/RMWI-WlAm-vbyT/exam-result/exam-result-1-section-2025-09-09T05-52-46-671Z.md',1,9,10,90.00,'2025-09-09 14:52:47','2025-09-09 14:52:47','2025-09-09 14:52:47'),(21,98,1,'section',NULL,'Windows 11 の基本操作とソフトウェアの活用','doc/GFMO-VN6Y-Z4QK/1N9R-8AEX-QOVL/RMWI-WlAm-vbyT/exam-result/exam-result-1-section-2025-09-09T05-59-23-409Z.md',1,9,10,90.00,'2025-09-09 14:59:23','2025-09-09 14:59:23','2025-09-09 14:59:23'),(22,98,1,'section',NULL,'Windows 11 の基本操作とソフトウェアの活用','doc/GFMO-VN6Y-Z4QK/1N9R-8AEX-QOVL/RMWI-WlAm-vbyT/exam-result/exam-result-1-section-2025-09-09T06-14-41-593Z.md',1,9,10,90.00,'2025-09-09 15:14:41','2025-09-09 15:14:41','2025-09-09 15:14:41'),(23,98,1,'lesson',NULL,'Windows 11 の基本操作とソフトウェアの活用','doc/GFMO-VN6Y-Z4QK/1N9R-8AEX-QOVL/RMWI-WlAm-vbyT/exam-result/exam-result-1-section-2025-09-09T06-35-31-965Z.md',0,22,30,73.00,'2025-09-09 15:35:32','2025-09-09 15:35:32','2025-09-11 11:52:20'),(24,98,1,'lesson',NULL,'Windows 11 の基本操作とソフトウェアの活用','doc/GFMO-VN6Y-Z4QK/1N9R-8AEX-QOVL/RMWI-WlAm-vbyT/exam-result/exam-result-1-section-2025-09-11T01-20-31-481Z.md',1,30,30,100.00,'2025-09-11 10:20:31','2025-09-11 10:20:31','2025-09-11 11:52:20'),(25,98,1,'lesson',NULL,'Windows 11 の基本操作とソフトウェアの活用','doc/GFMO-VN6Y-Z4QK/1N9R-8AEX-QOVL/RMWI-WlAm-vbyT/exam-result/exam-result-1-lesson-2025-11-19T05-12-36-793Z.md',0,0,30,0.00,'2025-11-19 05:12:36','2025-11-19 05:12:36','2025-11-19 05:12:36'),(26,98,1,'lesson',NULL,'Windows 11 の基本操作とソフトウェアの活用','doc/GFMO-VN6Y-Z4QK/1N9R-8AEX-QOVL/RMWI-WlAm-vbyT/exam-result/exam-result-1-lesson-2025-11-19T06-02-06-568Z.md',0,0,30,0.00,'2025-11-19 06:02:06','2025-11-19 06:02:06','2025-11-19 06:02:06'),(27,98,1,'lesson',NULL,'Windows 11 の基本操作とソフトウェアの活用','doc/GFMO-VN6Y-Z4QK/1N9R-8AEX-QOVL/RMWI-WlAm-vbyT/exam-result/exam-result-1-lesson-2025-11-19T06-29-30-619Z.md',0,0,30,0.00,'2025-11-19 06:29:30','2025-11-19 06:29:30','2025-11-19 06:29:30'),(28,98,1,'lesson',NULL,'Windows 11 の基本操作とソフトウェアの活用','doc/GFMO-VN6Y-Z4QK/1N9R-8AEX-QOVL/RMWI-WlAm-vbyT/exam-result/exam-result-1-lesson-2025-11-20T01-33-51-975Z.md',0,0,30,0.00,'2025-11-20 01:33:52','2025-11-20 01:33:52','2025-11-20 01:33:52'),(29,98,1,'lesson',NULL,'Windows 11 の基本操作とソフトウェアの活用','doc/GFMO-VN6Y-Z4QK/1N9R-8AEX-QOVL/RMWI-WlAm-vbyT/exam-result/exam-result-1-lesson-2025-11-20T02-49-14-932Z.md',0,0,30,0.00,'2025-11-20 02:49:15','2025-11-20 02:49:15','2025-11-20 02:49:15'),(30,98,1,'lesson',NULL,'Windows 11 の基本操作とソフトウェアの活用','doc/GFMO-VN6Y-Z4QK/1N9R-8AEX-QOVL/RMWI-WlAm-vbyT/exam-result/exam-result-1-lesson-2025-11-20T03-02-52-058Z.md',0,0,30,0.00,'2025-11-20 03:02:52','2025-11-20 03:02:52','2025-11-20 03:02:52'),(31,98,1,'lesson',NULL,'Windows 11 の基本操作とソフトウェアの活用','doc/GFMO-VN6Y-Z4QK/1N9R-8AEX-QOVL/RMWI-WlAm-vbyT/exam-result/exam-result-1-lesson-2025-11-20T03-12-39-342Z.md',0,0,30,0.00,'2025-11-20 03:12:39','2025-11-20 03:12:39','2025-11-20 03:12:39'),(32,98,1,'lesson',NULL,'Windows 11 の基本操作とソフトウェアの活用','doc/GFMO-VN6Y-Z4QK/1N9R-8AEX-QOVL/RMWI-WlAm-vbyT/exam-result/exam-result-1-lesson-2025-11-20T03-21-08-248Z.md',0,0,30,0.00,'2025-11-20 03:21:08','2025-11-20 03:21:08','2025-11-20 03:21:08'),(33,98,1,'lesson',NULL,'Windows 11 の基本操作とソフトウェアの活用','doc/GFMO-VN6Y-Z4QK/1N9R-8AEX-QOVL/RMWI-WlAm-vbyT/exam-result/exam-result-1-lesson-2025-11-20T03-46-19-130Z.md',0,0,30,0.00,'2025-11-20 03:46:19','2025-11-20 03:46:19','2025-11-20 03:46:19'),(34,98,1,'lesson',NULL,'Windows 11 の基本操作とソフトウェアの活用','doc/GFMO-VN6Y-Z4QK/1N9R-8AEX-QOVL/RMWI-WlAm-vbyT/exam-result/exam-result-1-lesson-2025-11-20T04-02-32-595Z.md',0,0,30,0.00,'2025-11-20 04:02:32','2025-11-20 04:02:32','2025-11-20 04:02:32'),(35,98,1,'lesson',NULL,'Windows 11 の基本操作とソフトウェアの活用','doc/GFMO-VN6Y-Z4QK/1N9R-8AEX-QOVL/RMWI-WlAm-vbyT/exam-result/exam-result-1-lesson-2025-11-20T04-12-39-694Z.md',0,0,30,0.00,'2025-11-20 04:12:39','2025-11-20 04:12:39','2025-11-20 04:12:39'),(36,98,1,'lesson',NULL,'Windows 11 の基本操作とソフトウェアの活用','doc/GFMO-VN6Y-Z4QK/1N9R-8AEX-QOVL/RMWI-WlAm-vbyT/exam-result/exam-result-1-lesson-2025-11-20T04-27-18-587Z.md',0,0,30,0.00,'2025-11-20 04:27:18','2025-11-20 04:27:18','2025-11-20 04:27:18'),(37,98,1,'lesson',NULL,'Windows 11 の基本操作とソフトウェアの活用','doc/GFMO-VN6Y-Z4QK/1N9R-8AEX-QOVL/RMWI-WlAm-vbyT/exam-result/exam-result-1-lesson-2025-11-20T04-52-33-185Z.md',0,0,30,0.00,'2025-11-20 04:52:33','2025-11-20 04:52:33','2025-11-20 04:52:33'),(38,98,1,'lesson',NULL,'Windows 11 の基本操作とソフトウェアの活用','doc/GFMO-VN6Y-Z4QK/1N9R-8AEX-QOVL/RMWI-WlAm-vbyT/exam-result/exam-result-1-lesson-2025-11-20T04-55-10-365Z.md',0,0,30,0.00,'2025-11-20 04:55:11','2025-11-20 04:55:11','2025-11-20 04:55:11'),(39,98,1,'lesson',NULL,'Windows 11 の基本操作とソフトウェアの活用','doc/GFMO-VN6Y-Z4QK/1N9R-8AEX-QOVL/RMWI-WlAm-vbyT/exam-result/exam-result-1-lesson-2025-11-20T05-19-35-797Z.md',0,0,30,0.00,'2025-11-20 05:19:36','2025-11-20 05:19:36','2025-11-20 05:19:36'),(40,98,8,'section',1,'テスト','doc/GFMO-VN6Y-Z4QK/1N9R-8AEX-QOVL/RMWI-WlAm-vbyT/exam-result/exam-result-8-section-2025-12-11T06-31-10-639Z.md',0,0,10,0.00,'2025-12-11 06:31:10','2025-12-11 06:31:10','2025-12-11 06:31:10'),(41,98,8,'section',NULL,'テスト','doc/GFMO-VN6Y-Z4QK/1N9R-8AEX-QOVL/RMWI-WlAm-vbyT/exam-result/exam-result-8-section-2026-01-28T06-17-46-556Z.md',1,9,10,90.00,'2026-01-28 06:17:47','2026-01-28 06:17:47','2026-01-28 06:17:47');
/*!40000 ALTER TABLE `exam_results` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `gatb_results`
--

DROP TABLE IF EXISTS `gatb_results`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `gatb_results` (
  `user_id` int NOT NULL COMMENT 'ãƒ¦ãƒ¼ã‚¶ãƒ¼IDï¼ˆuser_accounts.idï¼‰',
  `score_g` int NOT NULL COMMENT 'Gï¼šçŸ¥çš„èƒ½åŠ›ã‚¹ã‚³ã‚¢',
  `score_v` int NOT NULL COMMENT 'Vï¼šè¨€èªžèƒ½åŠ›ã‚¹ã‚³ã‚¢',
  `score_n` int NOT NULL COMMENT 'Nï¼šæ•°ç†èƒ½åŠ›ã‚¹ã‚³ã‚¢',
  `score_q` int NOT NULL COMMENT 'Qï¼šæ›¸è¨˜çš„çŸ¥è¦šã‚¹ã‚³ã‚¢',
  `score_s` int NOT NULL COMMENT 'Sï¼šç©ºé–“åˆ¤æ–­åŠ›ã‚¹ã‚³ã‚¢',
  `score_p` int NOT NULL COMMENT 'Pï¼šå½¢æ…‹çŸ¥è¦šã‚¹ã‚³ã‚¢',
  `grade` enum('ä¸­å­¦ç”Ÿ','é«˜æ ¡ç”Ÿ','å¤§å­¦ç”Ÿ','ãã®ä»–') NOT NULL COMMENT 'å­¦å¹´åŒºåˆ†',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'æ›´æ–°æ—¥æ™‚',
  PRIMARY KEY (`user_id`),
  CONSTRAINT `gatb_results_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user_accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='GATBè¨ºæ–­ã‚¹ã‚³ã‚¢ãƒ†ãƒ¼ãƒ–ãƒ«ï¼ˆæœ€æ–°å€¤ã®ã¿ï¼‰';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `gatb_results`
--

LOCK TABLES `gatb_results` WRITE;
/*!40000 ALTER TABLE `gatb_results` DISABLE KEYS */;
/*!40000 ALTER TABLE `gatb_results` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `instructor_specializations`
--

DROP TABLE IF EXISTS `instructor_specializations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `instructor_specializations` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'å°‚é–€åˆ†é‡ŽID',
  `user_id` int NOT NULL COMMENT 'æŒ‡å°Žè€…ã®ãƒ¦ãƒ¼ã‚¶ãƒ¼IDï¼ˆuser_accounts.idï¼‰',
  `specialization` varchar(255) NOT NULL COMMENT 'å°‚é–€åˆ†é‡Žï¼ˆãƒ†ã‚­ã‚¹ãƒˆå½¢å¼ï¼‰',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'ä½œæˆæ—¥æ™‚',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'æ›´æ–°æ—¥æ™‚',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  CONSTRAINT `instructor_specializations_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user_accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='æŒ‡å°Žè€…å°‚é–€åˆ†é‡Žãƒ†ãƒ¼ãƒ–ãƒ«';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `instructor_specializations`
--

LOCK TABLES `instructor_specializations` WRITE;
/*!40000 ALTER TABLE `instructor_specializations` DISABLE KEYS */;
INSERT INTO `instructor_specializations` VALUES (1,2,'サービス管理責任者','2025-08-27 14:17:47','2025-08-27 14:17:47'),(2,3,'サービス管理責任者','2025-08-27 14:19:33','2025-08-27 14:19:33'),(3,4,'生活指導員','2025-08-27 14:20:29','2025-08-27 14:20:29'),(4,5,'生活指導員','2025-08-27 14:21:35','2025-08-27 14:21:35'),(5,6,'生活指導員','2025-08-27 14:22:42','2025-08-27 14:22:42'),(6,7,'生活指導員','2025-08-27 14:23:42','2025-08-27 14:23:42');
/*!40000 ALTER TABLE `instructor_specializations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lesson_text_files`
--

DROP TABLE IF EXISTS `lesson_text_files`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lesson_text_files` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'ファイルID',
  `lesson_id` int NOT NULL COMMENT '関連レッスンID',
  `file_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ファイル名',
  `s3_key` varchar(1024) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'S3オブジェクトキー',
  `file_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'ファイルタイプ (pdf, text/plain, text/markdown, application/rtfなど)',
  `file_size` bigint DEFAULT NULL COMMENT 'ファイルサイズ (バイト)',
  `order_index` int NOT NULL DEFAULT '0' COMMENT '表示順序',
  `status` enum('active','inactive','deleted') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active' COMMENT 'ステータス',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新日時',
  `created_by` int DEFAULT NULL COMMENT '作成者ID',
  `updated_by` int DEFAULT NULL COMMENT '更新者ID',
  PRIMARY KEY (`id`),
  KEY `idx_lesson_id` (`lesson_id`),
  KEY `idx_order_index` (`order_index`),
  KEY `idx_status` (`status`),
  CONSTRAINT `lesson_text_files_ibfk_1` FOREIGN KEY (`lesson_id`) REFERENCES `lessons` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='レッスン複数テキストファイルテーブル';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lesson_text_files`
--

LOCK TABLES `lesson_text_files` WRITE;
/*!40000 ALTER TABLE `lesson_text_files` DISABLE KEYS */;
INSERT INTO `lesson_text_files` VALUES (4,8,'C2-11-2：データの取得と見方、変化する仕様への対応 目的.md','lessons/SNS運用の基礎・画像生成編集/テスト/C2-11-2：データの取得と見方、変化する仕様への対応 目的.md','text/markdown',19450,0,'active','2025-12-11 04:59:41','2025-12-11 04:59:41',9,9),(5,8,'C2-11-3：実際の事例分析と改善PDCAサイクル.md','lessons/SNS運用の基礎・画像生成編集/テスト/C2-11-3：実際の事例分析と改善PDCAサイクル.md','text/markdown',14910,1,'active','2025-12-11 04:59:41','2025-12-11 04:59:41',9,9);
/*!40000 ALTER TABLE `lesson_text_files` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lesson_text_video_links`
--

DROP TABLE IF EXISTS `lesson_text_video_links`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lesson_text_video_links` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'ç´ã¥ã‘ID',
  `lesson_id` int NOT NULL COMMENT 'é–¢é€£ãƒ¬ãƒƒã‚¹ãƒ³ID',
  `text_file_key` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ãƒ†ã‚­ã‚¹ãƒˆãƒ•ã‚¡ã‚¤ãƒ«ã®S3ã‚­ãƒ¼',
  `video_id` int NOT NULL COMMENT 'é–¢é€£å‹•ç”»ID',
  `link_order` int NOT NULL DEFAULT '0' COMMENT 'ç´ã¥ã‘é †åº',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'ä½œæˆæ—¥æ™‚',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'æ›´æ–°æ—¥æ™‚',
  `created_by` int DEFAULT NULL COMMENT 'ä½œæˆè€…ID',
  `updated_by` int DEFAULT NULL COMMENT 'æ›´æ–°è€…ID',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_text_video_link` (`lesson_id`,`text_file_key`,`video_id`),
  KEY `idx_lesson_id` (`lesson_id`),
  KEY `idx_video_id` (`video_id`),
  KEY `idx_link_order` (`link_order`),
  CONSTRAINT `lesson_text_video_links_ibfk_1` FOREIGN KEY (`lesson_id`) REFERENCES `lessons` (`id`) ON DELETE CASCADE,
  CONSTRAINT `lesson_text_video_links_ibfk_2` FOREIGN KEY (`video_id`) REFERENCES `lesson_videos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ãƒ¬ãƒƒã‚¹ãƒ³ãƒ†ã‚­ã‚¹ãƒˆã¨å‹•ç”»ã®ç´ã¥ã‘ãƒ†ãƒ¼ãƒ–ãƒ«';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lesson_text_video_links`
--

LOCK TABLES `lesson_text_video_links` WRITE;
/*!40000 ALTER TABLE `lesson_text_video_links` DISABLE KEYS */;
INSERT INTO `lesson_text_video_links` VALUES (2,2,'カリキュラム1第2回.pdf',2,0,'2025-08-28 02:56:56','2025-08-28 02:56:56',9,9),(3,3,'カリキュラム1第3回.pdf',3,0,'2025-08-28 02:57:10','2025-08-28 02:57:10',9,9),(4,4,'カリキュラム1第4回.pdf',4,0,'2025-08-28 02:57:19','2025-08-28 02:57:19',9,9),(5,5,'カリキュラム1第5回.pdf',5,0,'2025-08-28 02:57:27','2025-08-28 02:57:27',9,9),(6,6,'カリキュラム1第6回.pdf',6,0,'2025-08-28 02:57:41','2025-08-28 02:57:41',9,9),(8,1,'lesson1.md',1,0,'2025-09-09 04:40:04','2025-09-09 04:40:04',9,9),(9,8,'C2-11-1：KPIの基礎とSNSにおける目標設定.md',8,0,'2025-12-11 05:00:10','2025-12-11 05:00:10',9,9),(10,8,'C2-11-2：データの取得と見方、変化する仕様への対応 目的.md',9,1,'2025-12-11 05:00:21','2025-12-11 05:00:21',9,9);
/*!40000 ALTER TABLE `lesson_text_video_links` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lesson_videos`
--

DROP TABLE IF EXISTS `lesson_videos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lesson_videos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `lesson_id` int NOT NULL COMMENT 'é–¢é€£ãƒ¬ãƒƒã‚¹ãƒ³ID',
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'å‹•ç”»ã‚¿ã‚¤ãƒˆãƒ«',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT 'å‹•ç”»èª¬æ˜Ž',
  `youtube_url` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'YouTubeå‹•ç”»URL',
  `order_index` int NOT NULL DEFAULT '0' COMMENT 'è¡¨ç¤ºé †åº',
  `duration` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'å‹•ç”»ã®é•·ã•',
  `thumbnail_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'ã‚µãƒ ãƒã‚¤ãƒ«ç”»åƒURL',
  `status` enum('active','inactive','deleted') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active' COMMENT 'ã‚¹ãƒ†ãƒ¼ã‚¿ã‚¹',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` int DEFAULT NULL COMMENT 'ä½œæˆè€…ID',
  `updated_by` int DEFAULT NULL COMMENT 'æ›´æ–°è€…ID',
  PRIMARY KEY (`id`),
  KEY `idx_lesson_id` (`lesson_id`),
  KEY `idx_order` (`order_index`),
  KEY `idx_status` (`status`),
  CONSTRAINT `lesson_videos_ibfk_1` FOREIGN KEY (`lesson_id`) REFERENCES `lessons` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ãƒ¬ãƒƒã‚¹ãƒ³å‹•ç”»ãƒ†ãƒ¼ãƒ–ãƒ«ï¼ˆ1å¯¾å¤šå¯¾å¿œï¼‰';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lesson_videos`
--

LOCK TABLES `lesson_videos` WRITE;
/*!40000 ALTER TABLE `lesson_videos` DISABLE KEYS */;
INSERT INTO `lesson_videos` VALUES (1,1,'第1回　Windows11の基本操作とソフトウェアの活用',NULL,'https://www.youtube.com/watch?v=j4yNkF1w6L8',0,'66分32秒',NULL,'active','2025-08-27 05:28:18','2025-09-09 04:39:52',1,9),(2,2,'第２回　インターネットの基礎と安全な利用',NULL,'https://www.youtube.com/watch?v=AtDQST1SQ5A',0,'71分04秒',NULL,'active','2025-08-27 05:31:15','2025-08-27 05:31:15',1,NULL),(3,3,'第3回 AIの仕組みや基本用語を学ぶ',NULL,'https://www.youtube.com/watch?v=QkJCPOWwdwI',0,'95分37秒',NULL,'active','2025-08-27 05:33:14','2025-08-27 05:33:14',1,NULL),(4,4,'第4回：AIの活用例と実践体験',NULL,'https://www.youtube.com/watch?v=75UHkx4WZh0',0,'92分48秒',NULL,'active','2025-08-27 05:33:18','2025-08-27 05:33:18',1,NULL),(5,5,'第5回 簡単なプログラミングとAIアシスタント活用',NULL,'https://www.youtube.com/watch?v=vQqMk3gFZJ0',0,'84分25秒',NULL,'active','2025-08-27 05:36:28','2025-08-27 05:36:28',1,NULL),(6,6,'第6回 AIを活用した簡単なLP(ランディングページ)作成',NULL,'https://www.youtube.com/watch?v=aq-uqbdTc8Y',0,'96分21秒',NULL,'active','2025-08-27 05:36:43','2025-08-27 05:36:43',1,NULL),(8,8,'C2 11 1 KPIの基礎とSNSにおける目標設定',NULL,'https://www.youtube.com/watch?v=pQ4PMn2rF8k',0,NULL,NULL,'active','2025-12-11 04:36:43','2025-12-11 04:36:43',9,NULL),(9,8,'C2 11 2：データの取得と見方','','https://www.youtube.com/watch?v=kLhIIDM3k0E',1,'',NULL,'active','2025-12-11 04:49:15','2025-12-11 04:49:15',NULL,NULL);
/*!40000 ALTER TABLE `lesson_videos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lessons`
--

DROP TABLE IF EXISTS `lessons`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lessons` (
  `id` int NOT NULL AUTO_INCREMENT,
  `course_id` int NOT NULL COMMENT 'é–¢é€£ã‚³ãƒ¼ã‚¹ID',
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ãƒ¬ãƒƒã‚¹ãƒ³å',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT 'ãƒ¬ãƒƒã‚¹ãƒ³èª¬æ˜Ž',
  `duration` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'æ‰€è¦æ™‚é–“',
  `order_index` int NOT NULL DEFAULT '0' COMMENT 'è¡¨ç¤ºé †åº',
  `has_assignment` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'èª²é¡Œã®æœ‰ç„¡',
  `s3_key` varchar(1024) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'S3ã‚ªãƒ–ã‚¸ã‚§ã‚¯ãƒˆã‚­ãƒ¼',
  `file_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'ãƒ•ã‚¡ã‚¤ãƒ«ã‚¿ã‚¤ãƒ— (pdf, md, docx, pptxãªã©)',
  `file_size` bigint DEFAULT NULL COMMENT 'ãƒ•ã‚¡ã‚¤ãƒ«ã‚µã‚¤ã‚º (ãƒã‚¤ãƒˆ)',
  `status` enum('active','inactive','draft','deleted') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active' COMMENT 'ã‚¹ãƒ†ãƒ¼ã‚¿ã‚¹',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` int DEFAULT NULL COMMENT 'ä½œæˆè€…ID',
  `updated_by` int DEFAULT NULL COMMENT 'æ›´æ–°è€…ID',
  PRIMARY KEY (`id`),
  KEY `course_id` (`course_id`),
  CONSTRAINT `lessons_ibfk_1` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ãƒ¬ãƒƒã‚¹ãƒ³ç®¡ç†ãƒ†ãƒ¼ãƒ–ãƒ«';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lessons`
--

LOCK TABLES `lessons` WRITE;
/*!40000 ALTER TABLE `lessons` DISABLE KEYS */;
INSERT INTO `lessons` VALUES (1,1,'Windows 11 の基本操作とソフトウェアの活用','コンピュータの基本操作と主要ソフトウェアの使用方法を学ぶ','120分',0,0,'lessons/ ITリテラシー・AIの基本/Windows 11 の基本操作とソフトウェアの活用/lesson1.md','md',35719,'active','2025-08-27 05:28:18','2025-09-09 04:39:52',1,9),(2,1,'インターネットの基礎と安全な利用','インターネットの仕組みとセキュリティを理解する','120分',0,0,'lessons/ ITリテラシー・AIの基本/インターネットの基礎と安全な利用/カリキュラム1第2回.pdf','pdf',604619,'active','2025-08-27 05:31:15','2025-08-27 05:31:15',1,NULL),(3,1,'AI の基本概念','AI の仕組みや基本用語を学ぶ','120分',0,0,'lessons/ ITリテラシー・AIの基本/AI の基本概念/カリキュラム1第3回.pdf','pdf',759310,'active','2025-08-27 05:33:14','2025-08-27 05:33:14',1,NULL),(4,1,'AI の活用例と実践体験','AI の具体的な利用方法を知り,ツールを体験する','120分',0,1,'lessons/ ITリテラシー・AIの基本/AI の活用例と実践体験/カリキュラム1第4回.pdf','pdf',689648,'active','2025-08-27 05:33:18','2025-08-27 05:33:18',1,NULL),(5,1,'簡単なプログラミングと AI アシスタント活用','プログラミングの基本を学び,AI アシスタントを活用する','120分',0,1,'lessons/ ITリテラシー・AIの基本/簡単なプログラミングと AI アシスタント活用/カリキュラム1第5回.pdf','pdf',682476,'active','2025-08-27 05:36:28','2025-08-27 05:36:28',1,NULL),(6,1,'AI を活用した簡単な LP(ランディングページ)作成','AI を活用して簡単なウェブコンテンツを作成する','120分',0,1,'lessons/ ITリテラシー・AIの基本/AI を活用した簡単な LP(ランディングページ)作成/カリキュラム1第6回.pdf','pdf',1057947,'active','2025-08-27 05:36:43','2025-08-27 05:36:43',1,NULL),(7,2,'SNS マーケティングの基本と投稿戦略','SNS の役割と運用方法の基礎を学ぶ','120分',1,1,'lessons/SNS運用の基礎・画像生成編集/SNS マーケティングの基本と投稿戦略/カリキュラム2第1回.pdf','pdf',755346,'active','2025-08-27 05:39:02','2025-08-27 05:39:02',1,NULL),(8,2,'テスト',NULL,'120分',0,1,'lessons/SNS運用の基礎・画像生成編集/テスト/C2-11-1：KPIの基礎とSNSにおける目標設定.md','md',19210,'active','2025-12-11 04:36:43','2025-12-11 04:36:43',9,NULL);
/*!40000 ALTER TABLE `lessons` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `monthly_evaluation_records`
--

DROP TABLE IF EXISTS `monthly_evaluation_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `monthly_evaluation_records` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'è©•ä¾¡ID',
  `user_id` int NOT NULL COMMENT 'åˆ©ç”¨è€…ã®ãƒ¦ãƒ¼ã‚¶ãƒ¼ID',
  `date` date NOT NULL COMMENT 'è©•ä¾¡å®Ÿæ–½æ—¥ï¼ˆå®Ÿæ–½æ—¥ï¼‰',
  `period_start` date DEFAULT NULL COMMENT '対象期間の開始日',
  `period_end` date DEFAULT NULL COMMENT '対象期間の終了日',
  `mark_start` datetime DEFAULT NULL COMMENT 'å§‹æ¥­æ™‚é–“ï¼ˆä»»æ„ï¼‰',
  `mark_end` datetime DEFAULT NULL COMMENT 'çµ‚æ¥­æ™‚é–“ï¼ˆä»»æ„ï¼‰',
  `evaluation_method` enum('通所','訪問','その他') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '通所' COMMENT '評価方法',
  `method_other` varchar(255) DEFAULT NULL COMMENT 'è©•ä¾¡æ–¹æ³•ã®è£œè¶³ï¼ˆãã®ä»–ï¼‰',
  `goal` text COMMENT 'è¨“ç·´ç›®æ¨™',
  `effort` text COMMENT 'å–çµ„å†…å®¹',
  `achievement` text COMMENT 'è¨“ç·´ç›®æ¨™ã«å¯¾ã™ã‚‹é”æˆåº¦',
  `issues` text COMMENT 'èª²é¡Œ',
  `improvement` text COMMENT 'èª²é¡Œã®æ”¹å–„æ–¹é‡',
  `health` text COMMENT 'å¥åº·ãƒ»ä½“èª¿é¢ã§ã®ç•™æ„äº‹é …',
  `others` text COMMENT 'ãã®ä»–ç‰¹è¨˜äº‹é …',
  `appropriateness` text COMMENT 'åœ¨å®…å°±åŠ´ç¶™ç¶šã®å¦¥å½“æ€§',
  `evaluator_name` varchar(100) DEFAULT NULL COMMENT 'è©•ä¾¡å®Ÿæ–½è€…æ°å',
  `prev_evaluation_date` date DEFAULT NULL COMMENT 'å‰å›žã®é”æˆåº¦è©•ä¾¡æ—¥',
  `recipient_number` varchar(30) DEFAULT NULL COMMENT 'å—çµ¦è€…è¨¼ç•ªå·ï¼ˆè¡¨ç¤ºç”¨ï¼‰',
  `user_name` varchar(100) DEFAULT NULL COMMENT 'å¯¾è±¡è€…åï¼ˆè¡¨ç¤ºç”¨ï¼‰',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_monthly_eval` (`user_id`,`date`),
  CONSTRAINT `monthly_evaluation_records_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user_accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='æœˆæ¬¡è©•ä¾¡è¨˜éŒ²ï¼ˆæ§˜å¼3å¯¾å¿œï¼‰';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `monthly_evaluation_records`
--

LOCK TABLES `monthly_evaluation_records` WRITE;
/*!40000 ALTER TABLE `monthly_evaluation_records` DISABLE KEYS */;
INSERT INTO `monthly_evaluation_records` VALUES (1,103,'2025-12-12','2025-10-26','2025-11-27',NULL,NULL,'訪問',NULL,'テスト','テスト','テスト','テスト','テスト','テスト\n',NULL,'テスト','時安　公代',NULL,NULL,'下瀬　章継','2025-11-28 02:28:52','2025-12-12 06:16:50');
/*!40000 ALTER TABLE `monthly_evaluation_records` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `office_types`
--

DROP TABLE IF EXISTS `office_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `office_types` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'äº‹æ¥­æ‰€ã‚¿ã‚¤ãƒ—ID',
  `type` varchar(100) NOT NULL COMMENT 'äº‹æ¥­æ‰€ã‚¿ã‚¤ãƒ—å',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'ä½œæˆæ—¥æ™‚',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_type` (`type`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='äº‹æ¥­æ‰€ã‚¿ã‚¤ãƒ—ãƒ†ãƒ¼ãƒ–ãƒ«';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `office_types`
--

LOCK TABLES `office_types` WRITE;
/*!40000 ALTER TABLE `office_types` DISABLE KEYS */;
INSERT INTO `office_types` VALUES (1,'就労移行支援','2025-08-27 14:13:42'),(2,'就労継続支援A型','2025-08-27 14:13:59'),(3,'就労継続支援B型','2025-08-27 14:14:13'),(4,'学習塾','2025-08-27 14:14:18');
/*!40000 ALTER TABLE `office_types` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `operation_logs`
--

DROP TABLE IF EXISTS `operation_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `operation_logs` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'æ“ä½œãƒ­ã‚°ID',
  `admin_id` int DEFAULT NULL COMMENT 'ç®¡ç†è€…ID',
  `admin_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'ç®¡ç†è€…å',
  `action` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'æ“ä½œå†…å®¹',
  `details` text COLLATE utf8mb4_unicode_ci COMMENT 'è©³ç´°',
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'IPã‚¢ãƒ‰ãƒ¬ã‚¹',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'ä½œæˆæ—¥æ™‚',
  PRIMARY KEY (`id`),
  KEY `idx_admin_id` (`admin_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=350 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='æ“ä½œãƒ­ã‚°ãƒ†ãƒ¼ãƒ–ãƒ«';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `operation_logs`
--

LOCK TABLES `operation_logs` WRITE;
/*!40000 ALTER TABLE `operation_logs` DISABLE KEYS */;
INSERT INTO `operation_logs` VALUES (1,1,'admin001','ログイン','システム管理者「admin001」が管理者ダッシュボードでログインしました','172.18.0.1','2025-08-27 05:12:24'),(2,1,'admin001','create_course','{\"title\":\" ITリテラシー・AIの基本\",\"category\":\"必修科目\"}','N/A','2025-08-27 05:25:01'),(3,1,'admin001','create_course','{\"title\":\"SNS運用の基礎・画像生成編集\",\"category\":\"必修科目\"}','N/A','2025-08-27 05:25:27'),(4,1,'admin001','create_course','{\"title\":\"LP制作（HTML・CSS）\",\"category\":\"必修科目\"}','N/A','2025-08-27 05:25:48'),(5,1,'admin001','create_lesson','{\"title\":\"Windows 11 の基本操作とソフトウェアの活用\",\"courseId\":\"1\",\"courseTitle\":\" ITリテラシー・AIの基本\",\"hasFile\":true,\"hasVideos\":true,\"videoCount\":1}','172.18.0.1','2025-08-27 05:28:19'),(6,1,'admin001','create_lesson','{\"title\":\"インターネットの基礎と安全な利用\",\"courseId\":\"1\",\"courseTitle\":\" ITリテラシー・AIの基本\",\"hasFile\":true,\"hasVideos\":true,\"videoCount\":1}','172.18.0.1','2025-08-27 05:31:15'),(7,1,'admin001','create_lesson','{\"title\":\"AI の基本概念\",\"courseId\":\"1\",\"courseTitle\":\" ITリテラシー・AIの基本\",\"hasFile\":true,\"hasVideos\":true,\"videoCount\":1}','172.18.0.1','2025-08-27 05:33:14'),(8,1,'admin001','create_lesson','{\"title\":\"AI の活用例と実践体験\",\"courseId\":\"1\",\"courseTitle\":\" ITリテラシー・AIの基本\",\"hasFile\":true,\"hasVideos\":true,\"videoCount\":1}','172.18.0.1','2025-08-27 05:33:18'),(9,1,'admin001','create_lesson','{\"title\":\"簡単なプログラミングと AI アシスタント活用\",\"courseId\":\"1\",\"courseTitle\":\" ITリテラシー・AIの基本\",\"hasFile\":true,\"hasVideos\":true,\"videoCount\":1}','172.18.0.1','2025-08-27 05:36:28'),(10,1,'admin001','create_lesson','{\"title\":\"AI を活用した簡単な LP(ランディングページ)作成\",\"courseId\":\"1\",\"courseTitle\":\" ITリテラシー・AIの基本\",\"hasFile\":true,\"hasVideos\":true,\"videoCount\":1}','172.18.0.1','2025-08-27 05:36:43'),(11,1,'admin001','create_lesson','{\"title\":\"SNS マーケティングの基本と投稿戦略\",\"courseId\":\"2\",\"courseTitle\":\"SNS運用の基礎・画像生成編集\",\"hasFile\":true,\"hasVideos\":false,\"videoCount\":0}','172.18.0.1','2025-08-27 05:39:03'),(12,1,'admin001','create_curriculum_path','{\"name\":\"Web制作基本コース\",\"courseCount\":3}','N/A','2025-08-27 05:42:15'),(13,1,'admin001','管理者作成','管理者「小渕　正明」を新規作成しました','172.18.0.1','2025-08-27 05:42:48'),(14,1,'admin001','管理者作成','管理者「末吉　元気」を新規作成しました','172.18.0.1','2025-08-27 05:43:06'),(15,1,'admin001','ログアウト','管理者・指導員「admin001」がログアウトしました','172.18.0.1','2025-08-27 05:43:19'),(16,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-08-27 05:43:34'),(17,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-08-27 06:35:15'),(18,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-08-27 06:42:09'),(19,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-08-28 00:46:16'),(20,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-08-28 01:33:12'),(21,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-08-28 01:33:31'),(22,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-08-28 01:50:15'),(23,9,'末吉　元気','bulk_assign_curriculum_path','{\"userIds\":[98],\"curriculumPathId\":\"1\",\"courseCount\":3,\"assignmentCount\":3,\"errorCount\":0}','N/A','2025-08-28 01:57:17'),(24,9,'末吉　元気','bulk_assign_curriculum_path','{\"userIds\":[98],\"curriculumPathId\":\"1\",\"courseCount\":3,\"assignmentCount\":0,\"errorCount\":0}','N/A','2025-08-28 02:00:27'),(25,98,'原田　幸輝','ログアウト','不明「原田　幸輝」がログアウトしました','172.18.0.1','2025-08-28 02:11:50'),(26,9,'末吉　元気','ログイン','システム管理者「末吉　元気」が管理者ダッシュボードでログインしました','172.18.0.1','2025-08-28 02:12:04'),(27,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの八幡BASEでログインしました','172.18.0.1','2025-08-28 02:30:50'),(28,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの八幡BASEでログインしました','172.18.0.1','2025-08-28 02:47:38'),(29,9,'末吉　元気','ログイン','システム管理者「末吉　元気」が管理者ダッシュボードでログインしました','172.18.0.1','2025-08-28 02:51:01'),(30,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-08-28 02:57:49'),(31,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの八幡BASEでログインしました','172.18.0.1','2025-08-28 02:56:35'),(32,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの八幡BASEでログインしました','172.18.0.1','2025-08-28 02:59:43'),(33,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの八幡BASEでログインしました','172.18.0.1','2025-08-28 03:05:38'),(34,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの八幡BASEでログインしました','172.18.0.1','2025-08-28 03:12:14'),(35,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの八幡BASEでログインしました','172.18.0.1','2025-08-28 03:17:14'),(36,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの八幡BASEでログインしました','172.18.0.1','2025-08-28 03:27:35'),(37,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの八幡BASEでログインしました','172.18.0.1','2025-08-28 03:33:03'),(38,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの八幡BASEでログインしました','172.18.0.1','2025-08-28 03:43:28'),(39,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-08-28 03:46:48'),(40,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-08-28 03:52:27'),(41,2,'盛内　稔史','ログイン','指導員「盛内　稔史」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-08-28 03:52:59'),(42,4,'小野　愛莉','ログイン','指導員「小野　愛莉」がチャレンジラボラトリーの小倉BASEでログインしました（自動選択）','172.18.0.1','2025-08-28 03:58:55'),(43,4,'小野　愛莉','ログアウト','管理者・指導員「小野　愛莉」がログアウトしました','172.18.0.1','2025-08-28 04:10:30'),(44,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-08-28 04:10:45'),(45,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-08-28 04:23:03'),(46,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-08-28 05:22:09'),(47,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-08-28 05:22:24'),(48,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの八幡BASEでログインしました','172.18.0.1','2025-08-28 05:44:44'),(49,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-08-28 05:58:58'),(50,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-08-28 06:07:45'),(51,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-08-28 06:26:55'),(52,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-08-29 00:34:58'),(53,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-08-29 00:41:33'),(54,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの八幡BASEでログインしました','172.18.0.1','2025-08-29 00:41:53'),(55,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-08-29 00:50:10'),(56,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの八幡BASEでログインしました','172.18.0.1','2025-08-29 00:53:03'),(57,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-08-29 00:53:49'),(58,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-08-29 00:54:04'),(59,9,'末吉　元気','bulk_assign_curriculum_path','{\"userIds\":[98],\"curriculumPathId\":\"1\",\"courseCount\":3,\"assignmentCount\":3,\"errorCount\":0}','N/A','2025-08-29 00:55:02'),(60,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-08-29 00:58:40'),(61,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-08-29 01:22:04'),(62,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-08-29 01:28:35'),(63,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-08-29 01:28:51'),(64,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-08-29 01:45:55'),(65,9,'末吉　元気','ログイン','システム管理者「末吉　元気」が管理者ダッシュボードでログインしました','172.18.0.1','2025-08-29 02:11:11'),(66,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-08-29 03:01:29'),(67,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-08-29 04:10:44'),(68,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-08-29 04:32:18'),(69,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-08-29 05:03:12'),(70,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-08-29 05:06:54'),(71,98,'原田　幸輝','ログアウト','不明「原田　幸輝」がログアウトしました','172.18.0.1','2025-08-29 05:39:08'),(72,9,'末吉　元気','ログイン','システム管理者「末吉　元気」が管理者ダッシュボードでログインしました','172.18.0.1','2025-08-30 01:14:14'),(73,9,'末吉　元気','ログイン','システム管理者「末吉　元気」が管理者ダッシュボードでログインしました','172.18.0.1','2025-08-30 01:28:44'),(74,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-08-30 01:42:27'),(75,9,'末吉　元気','ログイン','システム管理者「末吉　元気」が管理者ダッシュボードでログインしました','172.18.0.1','2025-08-30 01:42:35'),(76,9,'末吉　元気','ログイン','システム管理者「末吉　元気」が管理者ダッシュボードでログインしました','172.18.0.1','2025-08-30 01:46:42'),(77,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-08-30 02:13:41'),(78,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-08-30 02:13:55'),(79,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-08-30 02:14:12'),(80,9,'末吉　元気','ログイン','システム管理者「末吉　元気」が管理者ダッシュボードでログインしました','172.18.0.1','2025-08-30 02:14:33'),(81,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-09-01 00:56:38'),(82,9,'末吉　元気','ログイン','システム管理者「末吉　元気」が管理者ダッシュボードでログインしました','172.18.0.1','2025-09-01 02:22:25'),(83,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-09-01 02:34:04'),(84,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-09-01 02:34:19'),(85,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-09-02 01:22:30'),(86,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-09-02 01:38:29'),(87,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-09-02 02:04:47'),(88,98,'原田　幸輝','ログアウト','不明「原田　幸輝」がログアウトしました','172.18.0.1','2025-09-02 05:13:47'),(89,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-09-02 05:14:18'),(90,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-09-03 00:54:30'),(91,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-09-03 00:55:25'),(92,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-09-04 03:21:14'),(93,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-09-05 03:53:46'),(94,98,'原田　幸輝','ログアウト','不明「原田　幸輝」がログアウトしました','172.18.0.1','2025-09-05 06:31:47'),(95,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-09-08 00:44:24'),(96,98,'原田　幸輝','ログアウト','不明「原田　幸輝」がログアウトしました','172.18.0.1','2025-09-08 02:20:44'),(97,9,'末吉　元気','ログイン','システム管理者「末吉　元気」が管理者ダッシュボードでログインしました','172.18.0.1','2025-09-08 02:20:56'),(98,9,'末吉　元気','ログイン','システム管理者「末吉　元気」が管理者ダッシュボードでログインしました','172.18.0.1','2025-09-08 02:55:34'),(99,9,'末吉　元気','update_lesson','{\"title\":\"Windows 11 の基本操作とソフトウェアの活用\",\"hasFile\":true,\"courseTitle\":\" ITリテラシー・AIの基本\",\"hasVideos\":true,\"videoCount\":1}','172.18.0.1','2025-09-08 02:55:55'),(100,98,'原田　幸輝','ログアウト','不明「原田　幸輝」がログアウトしました','172.18.0.1','2025-09-08 06:35:10'),(101,9,'末吉　元気','ログイン','システム管理者「末吉　元気」が管理者ダッシュボードでログインしました','172.18.0.1','2025-09-09 00:38:09'),(102,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-09-09 00:39:35'),(103,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-09-09 00:39:50'),(104,98,'原田　幸輝','ログアウト','不明「原田　幸輝」がログアウトしました','125.201.39.45','2025-09-09 04:30:46'),(105,9,'末吉　元気','ログイン','システム管理者「末吉　元気」が管理者ダッシュボードでログインしました','172.18.0.1','2025-09-09 04:31:10'),(106,9,'末吉　元気','update_lesson','{\"title\":\"Windows 11 の基本操作とソフトウェアの活用\",\"hasFile\":true,\"courseTitle\":\" ITリテラシー・AIの基本\",\"hasVideos\":true,\"videoCount\":1}','172.18.0.1','2025-09-09 04:39:52'),(107,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-09-11 00:54:04'),(108,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-09-12 00:53:28'),(109,98,'原田　幸輝','ログアウト','不明「原田　幸輝」がログアウトしました','172.18.0.1','2025-09-12 02:11:23'),(110,4,'小野　愛莉','ログイン','指導員「小野　愛莉」がチャレンジラボラトリーの小倉BASEでログインしました（自動選択）','172.18.0.1','2025-09-12 02:12:53'),(111,4,'小野　愛莉','ログイン','指導員「小野　愛莉」がチャレンジラボラトリーの小倉BASEでログインしました（自動選択）','172.18.0.1','2025-09-12 03:10:10'),(112,4,'小野　愛莉','ログイン','指導員「小野　愛莉」がチャレンジラボラトリーの小倉BASEでログインしました（自動選択）','172.18.0.1','2025-09-12 04:06:18'),(113,4,'小野　愛莉','ログアウト','管理者・指導員「小野　愛莉」がログアウトしました','172.18.0.1','2025-09-12 04:52:07'),(114,98,'原田　幸輝','ログアウト','不明「原田　幸輝」がログアウトしました','172.18.0.1','2025-09-12 05:24:31'),(115,98,'原田　幸輝','ログアウト','不明「原田　幸輝」がログアウトしました','172.18.0.1','2025-09-12 05:31:59'),(116,4,'小野　愛莉','ログイン','指導員「小野　愛莉」がチャレンジラボラトリーの小倉BASEでログインしました（自動選択）','172.18.0.1','2025-09-12 05:32:23'),(117,4,'小野　愛莉','ログアウト','管理者・指導員「小野　愛莉」がログアウトしました','172.18.0.1','2025-09-12 06:36:13'),(118,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-09-13 00:52:42'),(119,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-09-13 02:36:22'),(120,9,'末吉　元気','一時パスワード一括発行','対象利用者数: 5, 有効期限: 2025/9/13 14:59:59, アナウンス送信あり',NULL,'2025-09-13 02:44:14'),(121,9,'末吉　元気','ログイン','システム管理者「末吉　元気」が管理者ダッシュボードでログインしました','172.18.0.1','2025-09-16 00:43:10'),(122,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-09-16 00:44:04'),(123,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-09-16 00:44:27'),(124,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-09-16 01:54:37'),(125,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-09-16 03:31:48'),(126,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-09-16 03:50:12'),(127,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-09-16 03:51:08'),(128,98,'原田　幸輝','ログアウト','不明「原田　幸輝」がログアウトしました','172.18.0.1','2025-09-16 04:21:13'),(129,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-09-16 05:40:59'),(130,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-09-16 05:55:55'),(131,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-09-17 00:47:56'),(132,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-09-17 01:13:55'),(133,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-09-17 01:17:35'),(134,98,'原田　幸輝','ログアウト','不明「原田　幸輝」がログアウトしました','172.18.0.1','2025-09-17 01:29:03'),(135,98,'原田　幸輝','ログアウト','不明「原田　幸輝」がログアウトしました','172.18.0.1','2025-09-17 04:04:02'),(136,9,'末吉　元気','ログイン','システム管理者「末吉　元気」が管理者ダッシュボードでログインしました','172.18.0.1','2025-09-17 04:08:57'),(137,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-09-17 06:41:57'),(138,9,'末吉　元気','ログイン','システム管理者「末吉　元気」が管理者ダッシュボードでログインしました','172.18.0.1','2025-09-18 01:32:59'),(139,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-09-18 02:14:07'),(140,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-09-18 02:18:17'),(141,98,'原田　幸輝','ログアウト','不明「原田　幸輝」がログアウトしました','172.18.0.1','2025-09-18 02:32:45'),(142,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-09-18 02:33:06'),(143,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-09-18 02:33:56'),(144,4,'小野　愛莉','ログイン','指導員「小野　愛莉」がチャレンジラボラトリーの小倉BASEでログインしました（自動選択）','172.18.0.1','2025-09-18 02:34:36'),(145,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-09-18 03:37:20'),(146,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-09-18 03:38:00'),(147,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-09-18 03:52:14'),(148,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-09-18 04:07:31'),(149,4,'小野　愛莉','ログイン','指導員「小野　愛莉」がチャレンジラボラトリーの小倉BASEでログインしました（自動選択）','172.18.0.1','2025-09-18 04:14:26'),(150,4,'小野　愛莉','ログアウト','管理者・指導員「小野　愛莉」がログアウトしました','172.18.0.1','2025-09-18 04:27:25'),(151,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-09-18 04:30:21'),(152,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-09-18 04:31:22'),(153,98,'原田　幸輝','ログアウト','不明「原田　幸輝」がログアウトしました','172.18.0.1','2025-09-18 06:36:27'),(154,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-09-19 00:45:00'),(155,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-09-19 01:31:11'),(156,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-09-19 02:04:45'),(157,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-09-19 02:11:59'),(158,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-09-19 02:20:44'),(159,4,'小野　愛莉','ログイン','指導員「小野　愛莉」がチャレンジラボラトリーの小倉BASEでログインしました（自動選択）','172.18.0.1','2025-09-19 02:42:42'),(160,4,'小野　愛莉','ログイン','指導員「小野　愛莉」がチャレンジラボラトリーの小倉BASEでログインしました（自動選択）','172.18.0.1','2025-09-19 03:09:06'),(161,4,'小野　愛莉','ログイン','指導員「小野　愛莉」がチャレンジラボラトリーの小倉BASEでログインしました（自動選択）','172.18.0.1','2025-09-19 03:16:00'),(162,4,'小野　愛莉','ログイン','指導員「小野　愛莉」がチャレンジラボラトリーの小倉BASEでログインしました（自動選択）','172.18.0.1','2025-09-19 03:34:33'),(163,4,'小野　愛莉','一時パスワード一括発行','対象利用者数: 6, 有効期限: 2025/9/19 14:59:59',NULL,'2025-09-19 03:38:47'),(164,4,'小野　愛莉','ログアウト','管理者・指導員「小野　愛莉」がログアウトしました','172.18.0.1','2025-09-19 03:39:02'),(165,9,'末吉　元気','ログイン','システム管理者「末吉　元気」が管理者ダッシュボードでログインしました','172.18.0.1','2025-09-19 03:39:15'),(166,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-09-19 03:56:59'),(167,98,'原田　幸輝','ログアウト','不明「原田　幸輝」がログアウトしました','172.18.0.1','2025-09-19 05:02:29'),(168,4,'小野　愛莉','ログイン','指導員「小野　愛莉」がチャレンジラボラトリーの小倉BASEでログインしました（自動選択）','172.18.0.1','2025-09-19 05:10:16'),(169,4,'小野　愛莉','ログアウト','管理者・指導員「小野　愛莉」がログアウトしました','172.18.0.1','2025-09-19 05:14:46'),(170,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-09-20 00:55:40'),(171,9,'末吉　元気','一時パスワード一括発行','対象利用者数: 6, 有効期限: 2025/9/20 14:59:59',NULL,'2025-09-20 00:56:01'),(172,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-09-22 00:51:32'),(173,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-09-22 01:39:22'),(174,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-09-22 02:20:34'),(175,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-09-22 02:21:01'),(176,98,'原田　幸輝','ログアウト','不明「原田　幸輝」がログアウトしました','172.18.0.1','2025-09-22 02:26:13'),(177,9,'末吉　元気','ログイン','システム管理者「末吉　元気」が管理者ダッシュボードでログインしました','172.18.0.1','2025-09-22 02:26:22'),(178,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-09-22 02:28:28'),(179,98,'原田　幸輝','ログアウト','不明「原田　幸輝」がログアウトしました','172.18.0.1','2025-09-22 06:13:07'),(180,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-11-14 01:56:55'),(181,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-11-14 02:09:47'),(182,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-11-14 03:12:19'),(183,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-11-14 03:42:03'),(184,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-11-14 03:42:29'),(185,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-11-14 05:43:05'),(186,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-11-14 05:56:35'),(187,3,'時安　公代','ログイン','指導員「時安　公代」がチャレンジラボラトリーの小倉BASEでログインしました（自動選択）','172.18.0.1','2025-11-14 05:57:23'),(188,3,'時安　公代','ログイン','指導員「時安　公代」がチャレンジラボラトリーの小倉BASEでログインしました（自動選択）','172.18.0.1','2025-11-15 02:16:25'),(189,3,'時安　公代','ログアウト','管理者・指導員「時安　公代」がログアウトしました','172.18.0.1','2025-11-15 02:31:46'),(190,3,'時安　公代','ログイン','指導員「時安　公代」がチャレンジラボラトリーの小倉BASEでログインしました（自動選択）','172.18.0.1','2025-11-15 02:32:00'),(191,3,'時安　公代','ログイン','指導員「時安　公代」がチャレンジラボラトリーの小倉BASEでログインしました（自動選択）','172.18.0.1','2025-11-17 01:26:56'),(192,3,'時安　公代','ログアウト','管理者・指導員「時安　公代」がログアウトしました','172.18.0.1','2025-11-17 01:31:24'),(193,3,'時安　公代','ログイン','指導員「時安　公代」がチャレンジラボラトリーの小倉BASEでログインしました（自動選択）','172.18.0.1','2025-11-17 01:34:15'),(194,3,'時安　公代','ログアウト','管理者・指導員「時安　公代」がログアウトしました','172.18.0.1','2025-11-17 01:34:35'),(195,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-11-18 04:28:41'),(196,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-11-18 04:29:02'),(197,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-11-19 05:10:49'),(198,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-11-19 05:11:07'),(199,98,'原田　幸輝','ログアウト','不明「原田　幸輝」がログアウトしました','172.18.0.1','2025-11-19 05:47:03'),(200,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-11-19 05:47:18'),(201,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-11-19 05:47:54'),(202,98,'原田　幸輝','ログアウト','不明「原田　幸輝」がログアウトしました','172.18.0.1','2025-11-19 06:15:18'),(203,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-11-19 06:15:36'),(204,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-11-19 06:28:16'),(205,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-11-20 01:32:01'),(206,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-11-20 01:32:32'),(207,98,'原田　幸輝','ログアウト','不明「原田　幸輝」がログアウトしました','172.18.0.1','2025-11-20 02:43:53'),(208,3,'時安　公代','ログイン','指導員「時安　公代」がチャレンジラボラトリーの小倉BASEでログインしました（自動選択）','172.18.0.1','2025-11-20 02:44:10'),(209,3,'時安　公代','ログアウト','管理者・指導員「時安　公代」がログアウトしました','172.18.0.1','2025-11-20 02:48:27'),(210,98,'原田　幸輝','ログアウト','不明「原田　幸輝」がログアウトしました','172.18.0.1','2025-11-20 02:59:48'),(211,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-11-20 03:00:16'),(212,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-11-20 03:00:46'),(213,98,'原田　幸輝','ログアウト','不明「原田　幸輝」がログアウトしました','172.18.0.1','2025-11-20 03:11:11'),(214,3,'時安　公代','ログイン','指導員「時安　公代」がチャレンジラボラトリーの小倉BASEでログインしました（自動選択）','172.18.0.1','2025-11-20 03:11:26'),(215,3,'時安　公代','ログアウト','管理者・指導員「時安　公代」がログアウトしました','172.18.0.1','2025-11-20 03:11:53'),(216,98,'原田　幸輝','ログアウト','不明「原田　幸輝」がログアウトしました','172.18.0.1','2025-11-20 03:19:40'),(217,3,'時安　公代','ログイン','指導員「時安　公代」がチャレンジラボラトリーの小倉BASEでログインしました（自動選択）','172.18.0.1','2025-11-20 03:19:59'),(218,3,'時安　公代','ログアウト','管理者・指導員「時安　公代」がログアウトしました','172.18.0.1','2025-11-20 03:20:26'),(219,98,'原田　幸輝','ログアウト','不明「原田　幸輝」がログアウトしました','172.18.0.1','2025-11-20 03:43:45'),(220,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-11-20 03:44:09'),(221,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-11-20 03:44:47'),(222,98,'原田　幸輝','ログアウト','不明「原田　幸輝」がログアウトしました','172.18.0.1','2025-11-20 03:53:56'),(223,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-11-20 03:54:11'),(224,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-11-20 03:54:35'),(225,98,'原田　幸輝','ログアウト','不明「原田　幸輝」がログアウトしました','172.18.0.1','2025-11-20 03:59:26'),(226,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-11-20 03:59:44'),(227,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-11-20 04:01:49'),(228,98,'原田　幸輝','ログアウト','不明「原田　幸輝」がログアウトしました','172.18.0.1','2025-11-20 04:10:51'),(229,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-11-20 04:11:09'),(230,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-11-20 04:11:36'),(231,98,'原田　幸輝','ログアウト','不明「原田　幸輝」がログアウトしました','172.18.0.1','2025-11-20 04:25:46'),(232,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-11-20 04:26:02'),(233,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-11-20 04:26:24'),(234,98,'原田　幸輝','ログアウト','不明「原田　幸輝」がログアウトしました','172.18.0.1','2025-11-20 04:35:10'),(235,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-11-20 04:34:42'),(236,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-11-20 04:51:45'),(237,98,'原田　幸輝','ログアウト','不明「原田　幸輝」がログアウトしました','172.18.0.1','2025-11-20 04:52:41'),(238,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-11-20 04:52:56'),(239,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-11-20 04:53:33'),(240,3,'時安　公代','ログイン','指導員「時安　公代」がチャレンジラボラトリーの小倉BASEでログインしました（自動選択）','172.18.0.1','2025-11-21 01:30:51'),(241,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-11-25 01:32:02'),(242,3,'時安　公代','ログイン','指導員「時安　公代」がチャレンジラボラトリーの小倉BASEでログインしました（自動選択）','172.18.0.1','2025-11-28 02:15:09'),(243,3,'時安　公代','ログアウト','管理者・指導員「時安　公代」がログアウトしました','172.18.0.1','2025-11-28 04:09:28'),(244,3,'時安　公代','ログイン','指導員「時安　公代」がチャレンジラボラトリーの小倉BASEでログインしました（自動選択）','172.18.0.1','2025-11-28 05:21:37'),(245,3,'時安　公代','ログイン','指導員「時安　公代」がチャレンジラボラトリーの小倉BASEでログインしました（自動選択）','172.18.0.1','2025-12-01 02:07:36'),(246,3,'時安　公代','ログアウト','管理者・指導員「時安　公代」がログアウトしました','172.18.0.1','2025-12-01 02:23:45'),(247,9,'末吉　元気','ログイン','システム管理者「末吉　元気」が管理者ダッシュボードでログインしました','172.18.0.1','2025-12-01 02:24:00'),(248,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-12-01 02:24:40'),(249,2,'盛内　稔史','ログイン','指導員「盛内　稔史」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-12-01 02:25:07'),(250,2,'盛内　稔史','ログアウト','管理者・指導員「盛内　稔史」がログアウトしました','172.18.0.1','2025-12-01 02:47:58'),(251,2,'盛内　稔史','ログイン','指導員「盛内　稔史」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-12-01 02:52:15'),(252,2,'盛内　稔史','ログアウト','管理者・指導員「盛内　稔史」がログアウトしました','172.18.0.1','2025-12-01 04:31:04'),(253,3,'時安　公代','ログイン','指導員「時安　公代」がチャレンジラボラトリーの小倉BASEでログインしました（自動選択）','172.18.0.1','2025-12-01 04:31:18'),(254,3,'時安　公代','ログアウト','管理者・指導員「時安　公代」がログアウトしました','172.18.0.1','2025-12-01 04:32:36'),(255,5,'高松　百子','ログイン','指導員「高松　百子」がチャレンジラボラトリーの小倉BASEでログインしました（自動選択）','172.18.0.1','2025-12-01 04:32:55'),(256,5,'高松　百子','ログアウト','管理者・指導員「高松　百子」がログアウトしました','172.18.0.1','2025-12-01 04:33:38'),(257,9,'末吉　元気','ログイン','システム管理者「末吉　元気」が管理者ダッシュボードでログインしました','172.18.0.1','2025-12-01 04:33:50'),(258,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-12-01 04:34:30'),(259,5,'高松　百子','ログイン','指導員「高松　百子」がチャレンジラボラトリーの小倉BASEでログインしました（自動選択）','172.18.0.1','2025-12-01 04:35:00'),(260,3,'時安　公代','ログイン','指導員「時安　公代」がチャレンジラボラトリーの小倉BASEでログインしました（自動選択）','172.18.0.1','2025-12-01 04:36:34'),(261,3,'時安　公代','ログアウト','管理者・指導員「時安　公代」がログアウトしました','172.18.0.1','2025-12-01 04:40:36'),(262,2,'盛内　稔史','ログイン','指導員「盛内　稔史」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-12-01 04:41:17'),(263,2,'盛内　稔史','ログアウト','管理者・指導員「盛内　稔史」がログアウトしました','172.18.0.1','2025-12-01 05:01:42'),(264,3,'時安　公代','ログイン','指導員「時安　公代」がチャレンジラボラトリーの小倉BASEでログインしました（自動選択）','172.18.0.1','2025-12-01 05:01:54'),(265,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-12-02 05:42:09'),(266,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-12-02 05:42:31'),(267,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-12-03 01:19:42'),(268,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-12-03 01:20:04'),(269,98,'原田　幸輝','ログアウト','不明「原田　幸輝」がログアウトしました','172.18.0.1','2025-12-03 02:43:42'),(270,9,'末吉　元気','ログイン','システム管理者「末吉　元気」が管理者ダッシュボードでログインしました','172.18.0.1','2025-12-04 06:16:47'),(271,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-12-09 04:12:33'),(272,9,'末吉　元気','ログイン','システム管理者「末吉　元気」が管理者ダッシュボードでログインしました','172.18.0.1','2025-12-11 04:35:20'),(273,9,'末吉　元気','create_lesson','{\"title\":\"テスト\",\"courseId\":\"2\",\"courseTitle\":\"SNS運用の基礎・画像生成編集\",\"hasFile\":true,\"hasVideos\":true,\"videoCount\":1}','172.18.0.1','2025-12-11 04:36:43'),(274,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-12-11 05:00:31'),(275,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-12-11 05:00:50'),(276,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-12-11 05:01:08'),(277,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-12-11 05:15:10'),(278,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-12-11 05:15:27'),(279,98,'原田　幸輝','ログアウト','不明「原田　幸輝」がログアウトしました','172.18.0.1','2025-12-11 05:48:11'),(280,3,'時安　公代','ログイン','指導員「時安　公代」がチャレンジラボラトリーの小倉BASEでログインしました（自動選択）','172.18.0.1','2025-12-12 02:13:40'),(281,3,'時安　公代','ログアウト','管理者・指導員「時安　公代」がログアウトしました','172.18.0.1','2025-12-12 02:14:16'),(282,2,'盛内　稔史','ログイン','指導員「盛内　稔史」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-12-12 02:14:35'),(283,2,'盛内　稔史','ログアウト','管理者・指導員「盛内　稔史」がログアウトしました','172.18.0.1','2025-12-12 02:46:36'),(284,2,'盛内　稔史','ログイン','指導員「盛内　稔史」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-12-12 02:47:05'),(285,2,'盛内　稔史','ログアウト','管理者・指導員「盛内　稔史」がログアウトしました','172.18.0.1','2025-12-12 03:53:24'),(286,2,'盛内　稔史','ログイン','指導員「盛内　稔史」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-12-12 03:53:44'),(287,2,'盛内　稔史','ログアウト','管理者・指導員「盛内　稔史」がログアウトしました','172.18.0.1','2025-12-12 04:07:13'),(288,2,'盛内　稔史','ログイン','指導員「盛内　稔史」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-12-12 04:07:52'),(289,2,'盛内　稔史','ログアウト','管理者・指導員「盛内　稔史」がログアウトしました','172.18.0.1','2025-12-12 04:15:36'),(290,98,'原田　幸輝','ログアウト','不明「原田　幸輝」がログアウトしました','172.18.0.1','2025-12-12 05:52:08'),(291,2,'盛内　稔史','ログイン','指導員「盛内　稔史」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-12-12 06:11:38'),(292,2,'盛内　稔史','ログアウト','管理者・指導員「盛内　稔史」がログアウトしました','172.18.0.1','2025-12-12 06:18:42'),(293,2,'盛内　稔史','ログイン','指導員「盛内　稔史」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-12-12 06:19:19'),(294,2,'盛内　稔史','ログアウト','管理者・指導員「盛内　稔史」がログアウトしました','172.18.0.1','2025-12-12 06:19:56'),(295,98,'原田　幸輝','ログアウト','不明「原田　幸輝」がログアウトしました','172.18.0.1','2025-12-12 06:23:53'),(296,9,'末吉　元気','ログイン','システム管理者「末吉　元気」が管理者ダッシュボードでログインしました','172.18.0.1','2025-12-12 06:24:06'),(297,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-12-12 06:26:09'),(298,98,'原田　幸輝','ログアウト','不明「原田　幸輝」がログアウトしました','172.18.0.1','2025-12-12 06:35:09'),(299,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-12-17 01:34:28'),(300,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-12-17 01:35:12'),(301,98,'原田　幸輝','ログアウト','不明「原田　幸輝」がログアウトしました','172.18.0.1','2025-12-17 01:41:47'),(302,9,'末吉　元気','ログイン','システム管理者「末吉　元気」が管理者ダッシュボードでログインしました','172.18.0.1','2025-12-17 01:42:01'),(303,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-12-17 01:42:57'),(304,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-12-17 02:20:35'),(305,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-12-17 02:20:40'),(306,9,'末吉　元気','ログイン','システム管理者「末吉　元気」が管理者ダッシュボードでログインしました','172.18.0.1','2025-12-17 02:20:50'),(307,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-12-17 03:57:07'),(308,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-12-17 04:43:51'),(309,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-12-17 04:44:05'),(310,98,'原田　幸輝','ログアウト','不明「原田　幸輝」がログアウトしました','172.18.0.1','2025-12-17 05:04:45'),(311,9,'末吉　元気','ログイン','システム管理者「末吉　元気」が管理者ダッシュボードでログインしました','172.18.0.1','2025-12-17 05:05:06'),(312,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-12-18 05:10:52'),(313,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-12-18 05:11:08'),(314,98,'原田　幸輝','ログアウト','不明「原田　幸輝」がログアウトしました','172.18.0.1','2025-12-18 06:15:00'),(315,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2025-12-18 06:15:36'),(316,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2025-12-18 06:15:57'),(317,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2026-01-07 01:56:23'),(318,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2026-01-07 02:17:04'),(319,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2026-01-07 02:33:18'),(320,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2026-01-07 02:35:02'),(321,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2026-01-07 05:41:02'),(322,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2026-01-07 05:42:19'),(323,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2026-01-08 04:04:21'),(324,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2026-01-08 04:06:04'),(325,9,'末吉　元気','ログイン','システム管理者「末吉　元気」が管理者ダッシュボードでログインしました','172.18.0.1','2026-01-16 05:54:17'),(326,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2026-01-16 05:55:14'),(327,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2026-01-16 05:55:31'),(328,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2026-01-16 05:55:49'),(329,9,'末吉　元気','ログイン','システム管理者「末吉　元気」が管理者ダッシュボードでログインしました','172.18.0.1','2026-01-17 01:41:12'),(330,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2026-01-17 02:12:54'),(331,9,'末吉　元気','ログイン','システム管理者「末吉　元気」が管理者ダッシュボードでログインしました','172.18.0.1','2026-01-17 02:13:08'),(332,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2026-01-17 02:38:13'),(333,9,'末吉　元気','ログイン','システム管理者「末吉　元気」が管理者ダッシュボードでログインしました','172.18.0.1','2026-01-19 02:35:21'),(334,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2026-01-21 01:50:52'),(335,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2026-01-22 02:23:53'),(336,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2026-01-22 02:24:24'),(337,98,'原田　幸輝','ログアウト','不明「原田　幸輝」がログアウトしました','172.18.0.1','2026-01-22 02:26:21'),(338,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2026-01-22 02:26:39'),(339,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2026-01-22 02:27:27'),(340,98,'原田　幸輝','ログアウト','不明「原田　幸輝」がログアウトしました','172.18.0.1','2026-01-22 02:31:51'),(341,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2026-01-22 02:33:29'),(342,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2026-01-22 02:34:19'),(343,98,'原田　幸輝','ログアウト','不明「原田　幸輝」がログアウトしました','172.18.0.1','2026-01-22 02:37:46'),(344,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2026-01-22 02:38:04'),(345,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2026-01-22 02:39:18'),(346,98,'原田　幸輝','ログアウト','不明「原田　幸輝」がログアウトしました','172.18.0.1','2026-01-22 03:00:28'),(347,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2026-01-22 04:37:10'),(348,9,'末吉　元気','ログイン','指導員「末吉　元気」がチャレンジラボラトリーの小倉BASEでログインしました','172.18.0.1','2026-01-28 05:44:06'),(349,9,'末吉　元気','ログアウト','管理者・指導員「末吉　元気」がログアウトしました','172.18.0.1','2026-01-28 05:44:32');
/*!40000 ALTER TABLE `operation_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `personal_messages`
--

DROP TABLE IF EXISTS `personal_messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `personal_messages` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'メッセージID',
  `sender_id` int NOT NULL COMMENT '送信者ID',
  `receiver_id` int NOT NULL COMMENT '受信者ID',
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'メッセージ内容',
  `is_read` tinyint(1) NOT NULL DEFAULT '0' COMMENT '既読フラグ',
  `read_at` timestamp NULL DEFAULT NULL COMMENT '既読日時',
  `expires_at` datetime NOT NULL COMMENT '有効期限（日本時間24:30）',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新日時',
  PRIMARY KEY (`id`),
  KEY `idx_sender_id` (`sender_id`),
  KEY `idx_receiver_id` (`receiver_id`),
  KEY `idx_is_read` (`is_read`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_expires_at` (`expires_at`),
  CONSTRAINT `personal_messages_ibfk_1` FOREIGN KEY (`sender_id`) REFERENCES `user_accounts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `personal_messages_ibfk_2` FOREIGN KEY (`receiver_id`) REFERENCES `user_accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='個人メッセージテーブル';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `personal_messages`
--

LOCK TABLES `personal_messages` WRITE;
/*!40000 ALTER TABLE `personal_messages` DISABLE KEYS */;
/*!40000 ALTER TABLE `personal_messages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `personality_results`
--

DROP TABLE IF EXISTS `personality_results`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `personality_results` (
  `user_id` int NOT NULL COMMENT 'ãƒ¦ãƒ¼ã‚¶ãƒ¼IDï¼ˆuser_accounts.idï¼‰',
  `company_id` int DEFAULT NULL,
  `timestamp` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `conscientiousness` float DEFAULT NULL,
  `agreeableness` float DEFAULT NULL,
  `emotional_stability` float DEFAULT NULL,
  `extraversion` float DEFAULT NULL,
  `openness` float DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  KEY `company_id` (`company_id`),
  CONSTRAINT `personality_results_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user_accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `personality_results`
--

LOCK TABLES `personality_results` WRITE;
/*!40000 ALTER TABLE `personality_results` DISABLE KEYS */;
/*!40000 ALTER TABLE `personality_results` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `questionnaire_results`
--

DROP TABLE IF EXISTS `questionnaire_results`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `questionnaire_results` (
  `user_id` int NOT NULL COMMENT 'ãƒ¦ãƒ¼ã‚¶ãƒ¼IDï¼ˆuser_accounts.idï¼‰',
  `company_id` int DEFAULT NULL COMMENT 'æ‰€å±žä¼æ¥­ID',
  `timestamp` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'æ›´æ–°æ—¥æ™‚',
  `realistic` float DEFAULT NULL COMMENT 'ç¾å®Ÿçš„ï¼ˆRï¼‰',
  `investigative` float DEFAULT NULL COMMENT 'ç ”ç©¶çš„ï¼ˆIï¼‰',
  `artistic` float DEFAULT NULL COMMENT 'èŠ¸è¡“çš„ï¼ˆAï¼‰',
  `social` float DEFAULT NULL COMMENT 'ç¤¾ä¼šçš„ï¼ˆSï¼‰',
  `enterprising` float DEFAULT NULL COMMENT 'ä¼æ¥­çš„ï¼ˆEï¼‰',
  `conventional` float DEFAULT NULL COMMENT 'æ…£ç¿’çš„ï¼ˆCï¼‰',
  PRIMARY KEY (`user_id`),
  KEY `company_id` (`company_id`),
  CONSTRAINT `questionnaire_results_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user_accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='è·æ¥­èˆˆå‘³è¨ºæ–­çµæžœï¼ˆRIASECã‚¿ã‚¤ãƒ—ï¼æœ€æ–°å€¤ã®ã¿ï¼‰';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `questionnaire_results`
--

LOCK TABLES `questionnaire_results` WRITE;
/*!40000 ALTER TABLE `questionnaire_results` DISABLE KEYS */;
/*!40000 ALTER TABLE `questionnaire_results` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `refresh_tokens`
--

DROP TABLE IF EXISTS `refresh_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `refresh_tokens` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'ãƒªãƒ•ãƒ¬ãƒƒã‚·ãƒ¥ãƒˆãƒ¼ã‚¯ãƒ³ID',
  `user_id` int NOT NULL COMMENT 'ãƒ¦ãƒ¼ã‚¶ãƒ¼ID',
  `token` varchar(512) NOT NULL COMMENT 'ãƒªãƒ•ãƒ¬ãƒƒã‚·ãƒ¥ãƒˆãƒ¼ã‚¯ãƒ³ï¼ˆJWTæ–‡å­—åˆ—ï¼‰',
  `issued_at` datetime NOT NULL COMMENT 'ç™ºè¡Œæ—¥æ™‚',
  `expires_at` datetime NOT NULL COMMENT 'æœ‰åŠ¹æœŸé™ï¼ˆæ—¥æœ¬æ™‚é–“23:59å¯¾å¿œï¼‰',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_refresh_token` (`token`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `refresh_tokens_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user_accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=886 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='ãƒªãƒ•ãƒ¬ãƒƒã‚·ãƒ¥ãƒˆãƒ¼ã‚¯ãƒ³ç®¡ç†ãƒ†ãƒ¼ãƒ–ãƒ«';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `refresh_tokens`
--

LOCK TABLES `refresh_tokens` WRITE;
/*!40000 ALTER TABLE `refresh_tokens` DISABLE KEYS */;
INSERT INTO `refresh_tokens` VALUES (868,98,'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjo5OCwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3NjkwNDg2NzAsImV4cCI6MTc2OTEzNTA3MH0.ZAhWXlNJlYX-g6P77D-NlPhbUFORUZlAJPoz16x7hNA','2026-01-22 02:24:31','2026-01-22 15:00:00'),(871,98,'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjo5OCwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3NjkwNDg4NTEsImV4cCI6MTc2OTEzNTI1MX0.Ie5gypZNmeGwIAdcP-0K8E5xDg4Dzw6k49b9rI7xuZk','2026-01-22 02:27:32','2026-01-22 15:00:00'),(874,98,'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjo5OCwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3NjkwNDkyNjMsImV4cCI6MTc2OTEzNTY2M30.l-HooMo2LP5uez9jw3XA7-T7T2XphhaVafMX5QzMvPw','2026-01-22 02:34:24','2026-01-22 15:00:00'),(877,98,'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjo5OCwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3NjkwNDk1NjYsImV4cCI6MTc2OTEzNTk2Nn0.UBNg5reFa_Yl-dnfhlcjTyM2P7MJkyLOeWP5zJn__PU','2026-01-22 02:39:26','2026-01-22 15:00:00'),(883,9,'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjo5LCJ0eXBlIjoicmVmcmVzaCIsImlhdCI6MTc2OTU3OTA0NiwiZXhwIjoxNzY5NjY1NDQ2fQ.qqLE9GuhMd26sRAyG9ATaIltOOc_QqKvy3-Xw2x1MrQ','2026-01-28 05:44:07','2026-01-28 15:00:00'),(885,98,'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjo5OCwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3Njk1ODExNzcsImV4cCI6MTc2OTY2NzU3N30.XiUDAKz4XnmV21c7CeUxuGq0gSgWofIgg5slN---rhQ','2026-01-28 06:19:38','2026-01-28 15:00:00');
/*!40000 ALTER TABLE `refresh_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `remote_support_daily_records`
--

DROP TABLE IF EXISTS `remote_support_daily_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `remote_support_daily_records` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'è¨˜éŒ²ID',
  `user_id` int NOT NULL COMMENT 'åˆ©ç”¨è€…ã®ãƒ¦ãƒ¼ã‚¶ãƒ¼ID',
  `date` date NOT NULL COMMENT 'å®Ÿæ–½æ—¥',
  `mark_start` datetime DEFAULT NULL COMMENT 'å§‹æ¥­æ‰“åˆ»',
  `mark_lunch_start` datetime DEFAULT NULL COMMENT 'æ˜¼ä¼‘æ†©é–‹å§‹æ‰“åˆ»',
  `mark_lunch_end` datetime DEFAULT NULL COMMENT 'æ˜¼ä¼‘æ†©çµ‚äº†æ‰“åˆ»',
  `mark_end` datetime DEFAULT NULL COMMENT 'çµ‚æ¥­æ‰“åˆ»',
  `temperature` varchar(10) DEFAULT NULL COMMENT 'ä½“æ¸©ï¼ˆä»»æ„ï¼‰',
  `sleep_hours` varchar(50) DEFAULT NULL COMMENT '睡眠時間（任意）',
  `condition` varchar(10) NOT NULL COMMENT 'ä½“èª¿ï¼ˆè‰¯ã„ãƒ»æ™®é€šãƒ»æ‚ªã„ï¼‰',
  `condition_note` text COMMENT 'ä½“èª¿å‚™è€ƒï¼ˆä»»æ„ï¼‰',
  `work_note` text NOT NULL COMMENT 'æœ¬æ—¥ã®ä½œæ¥­å†…å®¹ï¼ˆå¿…é ˆï¼‰',
  `work_result` text COMMENT 'ä½œæ¥­å†…å®¹å®Ÿç¸¾',
  `daily_report` text COMMENT 'æ—¥å ±',
  `support_method` enum('è¨ªå•','é›»è©±','ãã®ä»–') DEFAULT NULL COMMENT 'æ”¯æ´æ–¹æ³•',
  `support_method_note` varchar(255) DEFAULT NULL COMMENT 'æ”¯æ´æ–¹æ³•è£œè¶³ï¼ˆãã®ä»–ï¼‰',
  `task_content` text COMMENT 'ä½œæ¥­ãƒ»è¨“ç·´å†…å®¹',
  `support_content` text COMMENT 'æ”¯æ´å†…å®¹ï¼ˆ1æ—¥2å›žä»¥ä¸Šï¼‰',
  `advice` text COMMENT 'å¯¾è±¡è€…ã®å¿ƒèº«ã®çŠ¶æ³ãƒ»åŠ©è¨€å†…å®¹',
  `instructor_comment` json DEFAULT NULL COMMENT 'æŒ‡å°Žå“¡ã‚³ãƒ¡ãƒ³ãƒˆï¼ˆJSONå½¢å¼ï¼‰',
  `recorder_name` varchar(100) DEFAULT NULL COMMENT 'è¨˜éŒ²è€…å',
  `webcam_photos` json DEFAULT NULL COMMENT 'Webã‚«ãƒ¡ãƒ©ç”»åƒURLä¸€è¦§ï¼ˆS3ï¼‰',
  `screenshots` json DEFAULT NULL COMMENT 'ã‚¹ã‚¯ãƒªãƒ¼ãƒ³ã‚·ãƒ§ãƒƒãƒˆURLä¸€è¦§ï¼ˆS3ï¼‰',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_daily_record` (`user_id`,`date`),
  CONSTRAINT `remote_support_daily_records_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user_accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='åœ¨å®…æ”¯æ´ã®æ—¥æ¬¡è¨˜éŒ²ï¼ˆæ‰“åˆ»å«ã‚€ï¼‰';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `remote_support_daily_records`
--

LOCK TABLES `remote_support_daily_records` WRITE;
/*!40000 ALTER TABLE `remote_support_daily_records` DISABLE KEYS */;
INSERT INTO `remote_support_daily_records` VALUES (1,103,'2025-12-12',NULL,NULL,NULL,'2025-12-12 02:40:16',NULL,NULL,'普通',NULL,'','テスト','test',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'[\"capture/GFMO-VN6Y-Z4QK/1N9R-8AEX-QOVL/3wbh-K62k-rI7K/2025/12/12/camera/20251212_0409.png\"]','[\"capture/GFMO-VN6Y-Z4QK/1N9R-8AEX-QOVL/3wbh-K62k-rI7K/2025/12/12/screenshot/20251212_0409.png\"]','2025-12-12 02:39:06','2025-12-12 04:09:15'),(2,98,'2026-01-07','2026-01-07 02:47:50',NULL,NULL,'2026-01-07 01:58:57',NULL,NULL,'普通',NULL,'','test','test',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'[\"capture/GFMO-VN6Y-Z4QK/1N9R-8AEX-QOVL/RMWI-WlAm-vbyT/2026/01/07/camera/20260107_0247.png\"]','[\"capture/GFMO-VN6Y-Z4QK/1N9R-8AEX-QOVL/RMWI-WlAm-vbyT/2026/01/07/screenshot/20260107_0247.png\"]','2026-01-07 02:00:08','2026-01-07 02:47:53'),(3,103,'2026-01-07',NULL,NULL,NULL,'2026-01-07 01:59:56',NULL,NULL,'普通',NULL,'','test','test',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'[\"capture/GFMO-VN6Y-Z4QK/1N9R-8AEX-QOVL/3wbh-K62k-rI7K/2026/01/07/camera/20260107_0201.png\"]','[\"capture/GFMO-VN6Y-Z4QK/1N9R-8AEX-QOVL/3wbh-K62k-rI7K/2026/01/07/screenshot/20260107_0201.png\"]','2026-01-07 02:01:08','2026-01-07 02:01:21'),(4,98,'2026-01-21','2026-01-21 01:51:21',NULL,NULL,NULL,'36.3','9時間15分','悪い','1月20日23時15分就寝～1月21日8時30分起床\n頭痛が痛い','サポートアプリの改修',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'[\"capture/GFMO-VN6Y-Z4QK/1N9R-8AEX-QOVL/RMWI-WlAm-vbyT/2026/01/21/camera/20260121_0151.png\"]','[\"capture/GFMO-VN6Y-Z4QK/1N9R-8AEX-QOVL/RMWI-WlAm-vbyT/2026/01/21/screenshot/20260121_0151.png\"]','2026-01-21 01:51:20','2026-01-21 01:51:27');
/*!40000 ALTER TABLE `remote_support_daily_records` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `satellites`
--

DROP TABLE IF EXISTS `satellites`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `satellites` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'æ‹ ç‚¹ID',
  `company_id` int NOT NULL COMMENT 'æ‰€å±žä¼æ¥­ID',
  `name` varchar(255) NOT NULL COMMENT 'æ‹ ç‚¹å',
  `address` text COMMENT 'æ‹ ç‚¹ä½æ‰€',
  `phone` varchar(20) DEFAULT NULL COMMENT 'æ‹ ç‚¹é›»è©±ç•ªå·',
  `office_type_id` int DEFAULT NULL COMMENT 'äº‹æ¥­æ‰€ã‚¿ã‚¤ãƒ—ID',
  `token` varchar(14) DEFAULT NULL COMMENT 'æ‹ ç‚¹ãƒˆãƒ¼ã‚¯ãƒ³ï¼ˆå½¢å¼ï¼šXXXX-XXXX-XXXXï¼‰',
  `contract_type` enum('30days','90days','1year') DEFAULT '30days' COMMENT 'å¥‘ç´„ã‚¿ã‚¤ãƒ—',
  `max_users` int NOT NULL DEFAULT '10' COMMENT 'åˆ©ç”¨è€…ï¼ˆãƒ­ãƒ¼ãƒ«1ï¼‰ã®ä¸Šé™ç™»éŒ²äººæ•°',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT 'ã‚¹ãƒ†ãƒ¼ã‚¿ã‚¹ï¼ˆ1=ç¨¼åƒä¸­ã€0=åœæ­¢ä¸­ï¼‰',
  `manager_ids` json DEFAULT NULL COMMENT 'ç®¡ç†è€…ï¼ˆãƒ­ãƒ¼ãƒ«5ï¼‰ã®ãƒ¦ãƒ¼ã‚¶ãƒ¼IDé…åˆ—',
  `disabled_course_ids` json DEFAULT NULL COMMENT 'ç„¡åŠ¹åŒ–ã•ã‚Œã¦ã„ã‚‹ã‚³ãƒ¼ã‚¹IDã®é…åˆ—ï¼ˆæœªè¨­å®š=å…¨ã‚³ãƒ¼ã‚¹æœ‰åŠ¹ï¼‰',
  `token_issued_at` datetime NOT NULL COMMENT 'ãƒˆãƒ¼ã‚¯ãƒ³ç™ºè¡Œæ—¥',
  `token_expiry_at` datetime NOT NULL COMMENT 'ãƒˆãƒ¼ã‚¯ãƒ³æœ‰åŠ¹æœŸé™',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'ä½œæˆæ—¥æ™‚',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'æ›´æ–°æ—¥æ™‚',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_satellite_token` (`token`),
  KEY `office_type_id` (`office_type_id`),
  KEY `idx_company_id` (`company_id`),
  KEY `idx_status` (`status`),
  KEY `idx_manager_ids` ((cast(`manager_ids` as char(100) charset latin1))),
  CONSTRAINT `satellites_ibfk_1` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `satellites_ibfk_2` FOREIGN KEY (`office_type_id`) REFERENCES `office_types` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='æ‹ ç‚¹ï¼ˆã‚µãƒ†ãƒ©ã‚¤ãƒˆï¼‰ãƒ†ãƒ¼ãƒ–ãƒ«';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `satellites`
--

LOCK TABLES `satellites` WRITE;
/*!40000 ALTER TABLE `satellites` DISABLE KEYS */;
INSERT INTO `satellites` VALUES (1,1,'小倉BASE','福岡県北九州市小倉北区香春口2-6-1','093-953-7020',2,'1N9R-8AEX-QOVL','1year',20,1,'[2, 3]',NULL,'2025-08-27 14:15:42','2026-08-27 23:15:41','2025-08-27 14:15:41','2025-08-27 14:19:33'),(2,1,'八幡BASE','福岡県北九州市八幡東中央2-16-1','093-383-8353',1,'7IZ2-AY60-D1Z6','1year',10,1,'[2]',NULL,'2025-08-27 14:16:58','2026-08-27 23:16:57','2025-08-27 14:16:57','2025-08-27 14:17:47');
/*!40000 ALTER TABLE `satellites` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sso_audit_logs`
--

DROP TABLE IF EXISTS `sso_audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sso_audit_logs` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'ログID',
  `user_id` int NOT NULL COMMENT 'ユーザーID',
  `ticket_id` int DEFAULT NULL COMMENT 'チケットID（sso_tickets.id）',
  `source_system` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '遷移元システム',
  `target_system` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '遷移先システム',
  `action` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'アクション種別（generate, verify, dispatch, failed）',
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'IPアドレス',
  `user_agent` text COLLATE utf8mb4_unicode_ci COMMENT 'User-Agent',
  `success` tinyint(1) NOT NULL DEFAULT '1' COMMENT '成功フラグ',
  `error_message` text COLLATE utf8mb4_unicode_ci COMMENT 'エラーメッセージ',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '実行日時（日本時間）',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_ticket_id` (`ticket_id`),
  KEY `idx_source_system` (`source_system`),
  KEY `idx_target_system` (`target_system`),
  KEY `idx_action` (`action`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `sso_audit_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user_accounts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `sso_audit_logs_ibfk_2` FOREIGN KEY (`ticket_id`) REFERENCES `sso_tickets` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='SSO監査ログテーブル';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sso_audit_logs`
--

LOCK TABLES `sso_audit_logs` WRITE;
/*!40000 ALTER TABLE `sso_audit_logs` DISABLE KEYS */;
INSERT INTO `sso_audit_logs` VALUES (1,98,1,'studysphere','findjob','generate','172.18.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',1,NULL,'2025-12-18 05:14:56'),(2,98,2,'studysphere','findjob','generate','172.18.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',1,NULL,'2025-12-18 05:15:09'),(3,98,3,'studysphere','findjob','generate','172.18.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',1,NULL,'2025-12-18 05:21:37'),(4,98,4,'studysphere','findjob','generate','172.18.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',1,NULL,'2025-12-18 05:25:40'),(5,98,4,'studysphere','findjob','verify','172.18.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',1,NULL,'2025-12-18 05:25:41'),(6,98,4,'studysphere','findjob','verify','172.18.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',0,'ALREADY_USED','2025-12-18 05:25:41'),(7,98,5,'studysphere','findjob','generate','172.18.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',1,NULL,'2025-12-18 05:30:23'),(8,98,5,'studysphere','findjob','verify','172.18.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',1,NULL,'2025-12-18 05:30:24'),(9,98,6,'studysphere','findjob','generate','172.18.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',1,NULL,'2025-12-18 06:16:13'),(10,98,6,'studysphere','findjob','verify','172.18.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',1,NULL,'2025-12-18 06:16:14'),(11,98,7,'studysphere','findjob','generate','172.18.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',1,NULL,'2025-12-18 06:16:38'),(12,98,7,'studysphere','findjob','verify','172.18.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',1,NULL,'2025-12-18 06:16:42'),(13,98,8,'studysphere','toybox_prod','generate','172.18.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',1,NULL,'2026-01-16 05:56:10'),(14,98,9,'studysphere','findjob','generate','172.18.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',1,NULL,'2026-01-16 05:57:49'),(15,98,10,'studysphere','toybox_prod','generate','172.18.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',1,NULL,'2026-01-16 05:59:14'),(16,98,11,'studysphere','toybox_prod','generate','172.18.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',1,NULL,'2026-01-16 06:04:04'),(17,98,12,'studysphere','toybox_prod','generate','172.18.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',1,NULL,'2026-01-16 06:06:44'),(18,98,13,'studysphere','toybox_prod','generate','172.18.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',1,NULL,'2026-01-16 06:08:41'),(19,98,14,'studysphere','findjob','generate','172.18.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',1,NULL,'2026-01-16 06:09:32'),(20,98,15,'studysphere','findjob','generate','172.18.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',1,NULL,'2026-01-16 06:12:41'),(21,98,16,'studysphere','toybox_prod','generate','172.18.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',1,NULL,'2026-01-16 06:13:30'),(22,98,17,'studysphere','toybox_prod','generate','172.18.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',1,NULL,'2026-01-16 06:19:42');
/*!40000 ALTER TABLE `sso_audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sso_tickets`
--

DROP TABLE IF EXISTS `sso_tickets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sso_tickets` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'チケットID',
  `ticket` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'チケット文字列（art-{random}形式）',
  `user_id` int NOT NULL COMMENT 'ユーザーID（user_accounts.id）',
  `source_system` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '遷移元システム識別子',
  `target_system` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '遷移先システム識別子',
  `context` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '生成コンテキスト（menu_click, transit, etc.）',
  `used` tinyint(1) NOT NULL DEFAULT '0' COMMENT '使用済みフラグ',
  `used_at` datetime DEFAULT NULL COMMENT '使用日時',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時（日本時間）',
  `expires_at` datetime NOT NULL COMMENT '有効期限（日本時間、通常は30-60秒後）',
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '生成元IPアドレス',
  `user_agent` text COLLATE utf8mb4_unicode_ci COMMENT '生成元User-Agent',
  PRIMARY KEY (`id`),
  UNIQUE KEY `ticket` (`ticket`),
  KEY `idx_ticket` (`ticket`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_target_system` (`target_system`),
  KEY `idx_expires_at` (`expires_at`),
  KEY `idx_used` (`used`),
  CONSTRAINT `sso_tickets_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user_accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='SSOワンタイムチケット管理テーブル';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sso_tickets`
--

LOCK TABLES `sso_tickets` WRITE;
/*!40000 ALTER TABLE `sso_tickets` DISABLE KEYS */;
INSERT INTO `sso_tickets` VALUES (1,'art-0b3c506b687e998cb558d528250842ec99d97f7daa2c0549ab7a4200e109c2e0',98,'studysphere','findjob','career_assessment',0,NULL,'2025-12-18 05:14:56','2025-12-18 14:15:26','172.18.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'),(2,'art-68493dc8775862af153026edfe749a26edc49a96723d8c2e649451ffcf4027f4',98,'studysphere','findjob','career_assessment',0,NULL,'2025-12-18 05:15:09','2025-12-18 14:15:39','172.18.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'),(3,'art-9fdde9c5e5894c2b92cabe6aa3be41a6129cf796da9d389d63b8cdbb500106ee',98,'studysphere','findjob','career_assessment',0,NULL,'2025-12-18 05:21:37','2025-12-18 14:22:07','172.18.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'),(4,'art-acac7add7549df915ed3cfdc5368804a1fee55b28f02963f77e0b6d45eef5b86',98,'studysphere','findjob','career_assessment',1,'2025-12-18 14:25:41','2025-12-18 05:25:40','2025-12-18 14:26:10','172.18.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'),(5,'art-38c904b4b88142fa55355ae413ec1320c9e1297c5b3e085c63e94c45c4b22331',98,'studysphere','findjob','career_assessment',1,'2025-12-18 14:30:24','2025-12-18 05:30:23','2025-12-18 14:30:53','172.18.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'),(6,'art-7c846a0e3f1598f809d4cd5d40a1fa61e4972eeb95c1b9c0f1669daed29e8b43',98,'studysphere','findjob','career_assessment',1,'2025-12-18 15:16:14','2025-12-18 06:16:13','2025-12-18 15:16:43','172.18.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'),(7,'art-bb21c8763a419d682dd619cb67a72c3a770b922ebf3f3cd276d49c9581b58b9c',98,'studysphere','findjob','career_assessment',1,'2025-12-18 15:16:42','2025-12-18 06:16:38','2025-12-18 15:17:08','172.18.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'),(8,'art-0c420793f7070ea717a738a9a0cac5be82a2b553330b9cddb90c551cec88b3cb',98,'studysphere','toybox_prod','sso_dispatch',0,NULL,'2026-01-16 05:56:10','2026-01-16 14:56:40','172.18.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'),(9,'art-758e6fa57250906637c89aed7c13dce1bd7e3de3dabacf9c61e1ac7ef9d7c498',98,'studysphere','findjob','career_assessment',0,NULL,'2026-01-16 05:57:49','2026-01-16 14:58:19','172.18.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'),(10,'art-4a361b4f4a1d5792f6f8e689e9947e88154e23107f298b2d1ae7885636f0a8f0',98,'studysphere','toybox_prod','sso_dispatch',0,NULL,'2026-01-16 05:59:14','2026-01-16 14:59:44','172.18.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'),(11,'art-44cd8190bdabcaef1cd71b29259a019df8385bf664d7a068a9b4fe687f87fcad',98,'studysphere','toybox_prod','sso_dispatch',0,NULL,'2026-01-16 06:04:04','2026-01-16 15:04:34','172.18.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'),(12,'art-4eda013d96a67b406f835888ff06b2e8c5b4baf8a44c209a4bb5db81d7d37018',98,'studysphere','toybox_prod','sso_dispatch',0,NULL,'2026-01-16 06:06:44','2026-01-16 15:07:14','172.18.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'),(13,'art-e438c2282f2745acdf708afe8a4da78277f8f7ddaf83ed45270eaebec38c09b6',98,'studysphere','toybox_prod','sso_dispatch',0,NULL,'2026-01-16 06:08:41','2026-01-16 15:09:11','172.18.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'),(14,'art-82d01091586eeb5d40f0995085464d59e9a464ba7a1269dc355ba6196702a00f',98,'studysphere','findjob','career_assessment',0,NULL,'2026-01-16 06:09:32','2026-01-16 15:10:02','172.18.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'),(15,'art-ad9b67261cf990284f2030408998fbe0b941110c4c2c48a5cdf2ec5f2151a108',98,'studysphere','findjob','career_assessment',0,NULL,'2026-01-16 06:12:41','2026-01-16 15:13:11','172.18.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'),(16,'art-c87b97aa574a69aa9c68a67c732138db642b8b1c834450d475747f4c858ccd00',98,'studysphere','toybox_prod','sso_dispatch',0,NULL,'2026-01-16 06:13:30','2026-01-16 15:14:00','172.18.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'),(17,'art-87621dda4d606500650e49280095ef80571b24e3d9afd07a95658e269fa4ea4c',98,'studysphere','toybox_prod','sso_dispatch',0,NULL,'2026-01-16 06:19:42','2026-01-16 15:20:11','172.18.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36');
/*!40000 ALTER TABLE `sso_tickets` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sso_trusted_systems`
--

DROP TABLE IF EXISTS `sso_trusted_systems`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sso_trusted_systems` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'システムID',
  `system_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'システム識別子（system_a, system_b, support_app等）',
  `system_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'システム表示名',
  `base_url` varchar(512) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ベースURL（リダイレクト先検証用）',
  `landing_path` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT '/landing' COMMENT 'ランディングパス',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT 'システム説明',
  `enabled` tinyint(1) NOT NULL DEFAULT '1' COMMENT '有効フラグ',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時（日本時間）',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新日時（日本時間）',
  `created_by` int DEFAULT NULL COMMENT '作成者ID',
  `updated_by` int DEFAULT NULL COMMENT '更新者ID',
  PRIMARY KEY (`id`),
  UNIQUE KEY `system_key` (`system_key`),
  KEY `idx_system_key` (`system_key`),
  KEY `idx_enabled` (`enabled`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='SSO連携信頼システム管理テーブル';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sso_trusted_systems`
--

LOCK TABLES `sso_trusted_systems` WRITE;
/*!40000 ALTER TABLE `sso_trusted_systems` DISABLE KEYS */;
INSERT INTO `sso_trusted_systems` VALUES (1,'findjob','適職診断','https://findjob.myou-kou.com','/auto-login',NULL,1,'2025-12-17 02:28:58','2025-12-17 02:28:58',9,NULL),(2,'toybox_prod','TOYBOX','https://toybox.ayatori-inc.co.jp','/sso/login',NULL,1,'2026-01-16 05:55:07','2026-01-16 05:55:07',9,NULL);
/*!40000 ALTER TABLE `sso_trusted_systems` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `support_plans`
--

DROP TABLE IF EXISTS `support_plans`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `support_plans` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `long_term_goal` text,
  `short_term_goal` text,
  `needs` text,
  `support_content` text,
  `goal_date` date DEFAULT NULL,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `support_plans_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user_accounts` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='å€‹åˆ¥æ”¯æ´è¨ˆç”»';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `support_plans`
--

LOCK TABLES `support_plans` WRITE;
/*!40000 ALTER TABLE `support_plans` DISABLE KEYS */;
/*!40000 ALTER TABLE `support_plans` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `test_results`
--

DROP TABLE IF EXISTS `test_results`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `test_results` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `type` enum('calling','GATB','personal','consultant') NOT NULL,
  `result_url` text NOT NULL,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `test_results_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user_accounts` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `test_results`
--

LOCK TABLES `test_results` WRITE;
/*!40000 ALTER TABLE `test_results` DISABLE KEYS */;
/*!40000 ALTER TABLE `test_results` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_accounts`
--

DROP TABLE IF EXISTS `user_accounts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_accounts` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'ãƒ¦ãƒ¼ã‚¶ãƒ¼ID',
  `name` varchar(255) NOT NULL COMMENT 'ãƒ¦ãƒ¼ã‚¶ãƒ¼åï¼ˆå€‹äººåã¾ãŸã¯ä¼æ¥­åï¼‰',
  `email` varchar(255) DEFAULT NULL COMMENT 'ãƒ¡ãƒ¼ãƒ«ã‚¢ãƒ‰ãƒ¬ã‚¹',
  `role` tinyint NOT NULL COMMENT 'ãƒ­ãƒ¼ãƒ«ï¼ˆ9=ã‚¢ãƒ‰ãƒŸãƒ³ã€5=ç®¡ç†è€…ã€4=æŒ‡å°Žå“¡ã€1=åˆ©ç”¨è€…ï¼‰',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT 'ã‚¹ãƒ†ãƒ¼ã‚¿ã‚¹ï¼ˆ1=ç¨¼åƒä¸­ã€0=åœæ­¢ä¸­ï¼‰',
  `login_code` char(14) NOT NULL COMMENT 'ãƒ­ã‚°ã‚¤ãƒ³ã‚³ãƒ¼ãƒ‰ï¼ˆå½¢å¼ï¼šXXXX-XXXX-XXXXï¼‰',
  `company_id` int DEFAULT NULL COMMENT 'æ‰€å±žä¼æ¥­IDï¼ˆåˆ©ç”¨è€…ã¯å¿…é ˆã€ç®¡ç†è€…ä»¥ä¸Šã¯NULLå¯ï¼‰',
  `satellite_ids` json DEFAULT NULL COMMENT 'æ‰€å±žæ‹ ç‚¹IDé…åˆ—ï¼ˆè¤‡æ•°æ‹ ç‚¹å¯¾å¿œï¼‰',
  `is_remote_user` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'åœ¨å®…æ”¯æ´å¯¾è±¡ï¼ˆãƒ­ãƒ¼ãƒ«1å°‚ç”¨ï¼‰',
  `recipient_number` varchar(30) DEFAULT NULL COMMENT 'å—çµ¦è€…è¨¼ç•ªå·',
  `password_reset_required` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'ãƒ‘ã‚¹ãƒ¯ãƒ¼ãƒ‰å¤‰æ›´è¦æ±‚ãƒ•ãƒ©ã‚°ï¼ˆ1=å¤‰æ›´è¦æ±‚ã‚ã‚Šã€0=å¤‰æ›´è¦æ±‚ãªã—ï¼‰',
  `instructor_id` int DEFAULT NULL COMMENT 'æ‹…å½“æŒ‡å°Žå“¡IDï¼ˆãƒ­ãƒ¼ãƒ«1å°‚ç”¨ï¼‰',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_login_code` (`login_code`),
  KEY `company_id` (`company_id`),
  KEY `idx_email` (`email`),
  KEY `idx_password_reset_required` (`password_reset_required`),
  KEY `idx_instructor_id` (`instructor_id`),
  KEY `idx_satellite_ids` ((cast(`satellite_ids` as char(100) charset latin1))),
  CONSTRAINT `user_accounts_ibfk_1` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_accounts_ibfk_2` FOREIGN KEY (`instructor_id`) REFERENCES `user_accounts` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=104 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='ãƒ¦ãƒ¼ã‚¶ãƒ¼æƒ…å ±ãƒ†ãƒ¼ãƒ–ãƒ«';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_accounts`
--

LOCK TABLES `user_accounts` WRITE;
/*!40000 ALTER TABLE `user_accounts` DISABLE KEYS */;
INSERT INTO `user_accounts` VALUES (1,'admin001',NULL,10,1,'ADMN-0001-0001',NULL,NULL,0,NULL,0,NULL),(2,'盛内　稔史','moriuchi1101@myou-kou.com',4,1,'82Ex-0fW7-YxNZ',1,'[\"2\", \"1\"]',0,NULL,0,NULL),(3,'時安　公代','tokiyasu1104@myou-kou.com',4,1,'AzVd-DjR6-6bSl',1,'[\"1\"]',0,NULL,0,NULL),(4,'小野　愛莉','ono1105@myou-kou.com',4,1,'fVbI-2TpU-ZYwN',1,'[\"1\"]',0,NULL,0,NULL),(5,'高松　百子','takamatsu1202@myou-kou.com',4,1,'Xj9d-izwr-h5J3',1,'[\"1\"]',0,NULL,0,NULL),(6,'猪口　千恵','inokuchi1108@myou-kou.com',4,1,'RInS-PqDT-VIPs',1,'[\"1\"]',0,NULL,0,NULL),(7,'市川　向日花','ichikawa1109@myou-kou.com',4,1,'hjBv-1SOd-b92P',1,'[\"1\"]',0,NULL,0,NULL),(8,'小渕　正明','kobuchi1106@myou-kou.com',9,1,'M6DW-QNCT-T32L',NULL,NULL,0,NULL,0,NULL),(9,'末吉　元気','sueyoshi1203@myou-kou.com',9,1,'HDZQ-MHYJ-MUR9',NULL,NULL,0,NULL,0,NULL),(98,'原田　幸輝',NULL,1,1,'RMWI-WlAm-vbyT',1,'[1]',1,NULL,0,4),(99,'城戸　真理','kido1204@myou-kou.com',1,1,'x0WN-bGSM-AUTg',1,'[1]',0,NULL,0,NULL),(100,'勝葉　慎弥','katsuba1205@myou-kou.com',1,1,'SLyO-SHNC-dlE9',1,'[1]',0,NULL,0,NULL),(101,'永山　裕樹','nagayama1206@myou-kou.com',1,1,'cgar-TbKv-XOb3',1,'[1]',0,NULL,0,NULL),(102,'佐藤　茂利','satou1209@myou-kou.com',1,1,'W51Y-XbNO-RN4b',1,'[1]',0,NULL,0,NULL),(103,'下瀬　章継','shimose1210@myou-kou.com',1,1,'3wbh-K62k-rI7K',1,'[1]',1,NULL,0,NULL);
/*!40000 ALTER TABLE `user_accounts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_announcements`
--

DROP TABLE IF EXISTS `user_announcements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_announcements` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '関連付けID',
  `user_id` int NOT NULL COMMENT '利用者ID',
  `announcement_id` int NOT NULL COMMENT 'アナウンスID',
  `is_read` tinyint(1) NOT NULL DEFAULT '0' COMMENT '既読フラグ',
  `read_at` timestamp NULL DEFAULT NULL COMMENT '既読日時',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_announcement` (`user_id`,`announcement_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_announcement_id` (`announcement_id`),
  KEY `idx_is_read` (`is_read`),
  CONSTRAINT `user_announcements_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user_accounts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_announcements_ibfk_2` FOREIGN KEY (`announcement_id`) REFERENCES `announcements` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='利用者アナウンス関連付けテーブル';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_announcements`
--

LOCK TABLES `user_announcements` WRITE;
/*!40000 ALTER TABLE `user_announcements` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_announcements` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_courses`
--

DROP TABLE IF EXISTS `user_courses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_courses` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'é–¢é€£ä»˜ã‘ID',
  `user_id` int NOT NULL COMMENT 'åˆ©ç”¨è€…ID',
  `course_id` int NOT NULL COMMENT 'ã‚³ãƒ¼ã‚¹ID',
  `curriculum_path_id` int DEFAULT NULL COMMENT 'ã‚«ãƒªã‚­ãƒ¥ãƒ©ãƒ ãƒ‘ã‚¹IDï¼ˆã‚«ãƒªã‚­ãƒ¥ãƒ©ãƒ ãƒ‘ã‚¹çµŒç”±ã§è¿½åŠ ã•ã‚ŒãŸå ´åˆï¼‰',
  `assigned_by` int DEFAULT NULL COMMENT 'å‰²ã‚Šå½“ã¦æ‹…å½“è€…ID',
  `assigned_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'å‰²ã‚Šå½“ã¦æ—¥æ™‚',
  `status` enum('active','completed','paused','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'active' COMMENT 'å­¦ç¿’ã‚¹ãƒ†ãƒ¼ã‚¿ã‚¹',
  `start_date` date DEFAULT NULL COMMENT 'å­¦ç¿’é–‹å§‹æ—¥',
  `completion_date` date DEFAULT NULL COMMENT 'å®Œäº†æ—¥',
  `progress_percentage` decimal(5,2) DEFAULT '0.00' COMMENT 'é€²æ—çŽ‡ï¼ˆ%ï¼‰',
  `notes` text COLLATE utf8mb4_unicode_ci COMMENT 'å‚™è€ƒ',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'ä½œæˆæ—¥æ™‚',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'æ›´æ–°æ—¥æ™‚',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_course` (`user_id`,`course_id`),
  KEY `assigned_by` (`assigned_by`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_course_id` (`course_id`),
  KEY `idx_curriculum_path_id` (`curriculum_path_id`),
  KEY `idx_status` (`status`),
  KEY `idx_assigned_at` (`assigned_at`),
  CONSTRAINT `user_courses_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user_accounts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_courses_ibfk_2` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_courses_ibfk_3` FOREIGN KEY (`curriculum_path_id`) REFERENCES `curriculum_paths` (`id`) ON DELETE SET NULL,
  CONSTRAINT `user_courses_ibfk_4` FOREIGN KEY (`assigned_by`) REFERENCES `user_accounts` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='åˆ©ç”¨è€…ã¨ã‚³ãƒ¼ã‚¹ã®é–¢é€£ä»˜ã‘ãƒ†ãƒ¼ãƒ–ãƒ«';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_courses`
--

LOCK TABLES `user_courses` WRITE;
/*!40000 ALTER TABLE `user_courses` DISABLE KEYS */;
INSERT INTO `user_courses` VALUES (20,98,1,1,9,'2025-08-29 00:55:02','active','2026-01-22',NULL,91.67,NULL,'2025-08-29 00:55:02','2026-01-28 05:44:38'),(21,98,2,1,9,'2025-08-29 00:55:02','active','2026-01-28',NULL,50.00,NULL,'2025-08-29 00:55:02','2026-01-28 06:19:56'),(22,98,3,1,9,'2025-08-29 00:55:02','active',NULL,NULL,0.00,NULL,'2025-08-29 00:55:02','2026-01-28 05:44:38'),(23,1,1,NULL,NULL,'2025-09-03 01:45:48','active','2025-09-03',NULL,8.33,NULL,'2025-09-03 01:45:48','2025-09-22 03:02:42');
/*!40000 ALTER TABLE `user_courses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_curriculum_paths`
--

DROP TABLE IF EXISTS `user_curriculum_paths`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_curriculum_paths` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'é–¢é€£ä»˜ã‘ID',
  `user_id` int NOT NULL COMMENT 'åˆ©ç”¨è€…ID',
  `curriculum_path_id` int NOT NULL COMMENT 'ã‚«ãƒªã‚­ãƒ¥ãƒ©ãƒ ãƒ‘ã‚¹ID',
  `assigned_by` int DEFAULT NULL COMMENT 'å‰²ã‚Šå½“ã¦æ‹…å½“è€…ID',
  `assigned_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'å‰²ã‚Šå½“ã¦æ—¥æ™‚',
  `status` enum('active','completed','paused','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'active' COMMENT 'å­¦ç¿’ã‚¹ãƒ†ãƒ¼ã‚¿ã‚¹',
  `start_date` date DEFAULT NULL COMMENT 'å­¦ç¿’é–‹å§‹æ—¥',
  `completion_date` date DEFAULT NULL COMMENT 'å®Œäº†æ—¥',
  `progress_percentage` decimal(5,2) DEFAULT '0.00' COMMENT 'é€²æ—çŽ‡ï¼ˆ%ï¼‰',
  `notes` text COLLATE utf8mb4_unicode_ci COMMENT 'å‚™è€ƒ',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'ä½œæˆæ—¥æ™‚',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'æ›´æ–°æ—¥æ™‚',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_curriculum_path` (`user_id`,`curriculum_path_id`),
  KEY `assigned_by` (`assigned_by`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_curriculum_path_id` (`curriculum_path_id`),
  KEY `idx_status` (`status`),
  KEY `idx_assigned_at` (`assigned_at`),
  CONSTRAINT `user_curriculum_paths_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user_accounts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_curriculum_paths_ibfk_2` FOREIGN KEY (`curriculum_path_id`) REFERENCES `curriculum_paths` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_curriculum_paths_ibfk_3` FOREIGN KEY (`assigned_by`) REFERENCES `user_accounts` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='åˆ©ç”¨è€…ã¨ã‚«ãƒªã‚­ãƒ¥ãƒ©ãƒ ãƒ‘ã‚¹ã®é–¢é€£ä»˜ã‘ãƒ†ãƒ¼ãƒ–ãƒ«';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_curriculum_paths`
--

LOCK TABLES `user_curriculum_paths` WRITE;
/*!40000 ALTER TABLE `user_curriculum_paths` DISABLE KEYS */;
INSERT INTO `user_curriculum_paths` VALUES (1,98,1,9,'2025-08-28 01:57:17','active',NULL,NULL,0.00,NULL,'2025-08-28 01:57:17','2025-08-28 01:57:17');
/*!40000 ALTER TABLE `user_curriculum_paths` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_lesson_progress`
--

DROP TABLE IF EXISTS `user_lesson_progress`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_lesson_progress` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '進捗ID',
  `user_id` int NOT NULL COMMENT '利用者ID',
  `lesson_id` int NOT NULL COMMENT 'レッスンID',
  `status` enum('not_started','in_progress','completed') NOT NULL DEFAULT 'not_started' COMMENT '進捗状況',
  `completed_at` datetime DEFAULT NULL COMMENT '完了日時',
  `test_score` int DEFAULT NULL COMMENT 'テストスコア',
  `assignment_submitted` tinyint(1) NOT NULL DEFAULT '0' COMMENT '課題提出済みフラグ',
  `assignment_submitted_at` datetime DEFAULT NULL COMMENT '課題提出日時',
  `instructor_approved` tinyint(1) NOT NULL DEFAULT '0' COMMENT '指導員承認フラグ',
  `instructor_approved_at` datetime DEFAULT NULL COMMENT '指導員承認日時',
  `instructor_id` int DEFAULT NULL COMMENT '承認した指導員ID',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新日時',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_lesson` (`user_id`,`lesson_id`),
  KEY `instructor_id` (`instructor_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_lesson_id` (`lesson_id`),
  KEY `idx_status` (`status`),
  KEY `idx_completed_at` (`completed_at`),
  KEY `idx_instructor_approved` (`instructor_approved`),
  CONSTRAINT `user_lesson_progress_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user_accounts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_lesson_progress_ibfk_2` FOREIGN KEY (`lesson_id`) REFERENCES `lessons` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_lesson_progress_ibfk_3` FOREIGN KEY (`instructor_id`) REFERENCES `user_accounts` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2302 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='利用者のレッスン進捗管理テーブル';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_lesson_progress`
--

LOCK TABLES `user_lesson_progress` WRITE;
/*!40000 ALTER TABLE `user_lesson_progress` DISABLE KEYS */;
INSERT INTO `user_lesson_progress` VALUES (1,98,1,'completed','2025-12-17 01:40:33',0,0,NULL,1,'2025-11-20 04:53:06',9,'2025-09-03 10:45:48','2026-01-22 02:29:44'),(16,1,1,'in_progress',NULL,NULL,0,NULL,0,NULL,NULL,'2025-09-03 11:14:41','2025-09-03 11:19:36'),(131,98,2,'in_progress',NULL,NULL,0,NULL,0,NULL,NULL,'2025-09-03 12:32:35','2026-01-22 02:29:44'),(133,98,3,'not_started',NULL,NULL,0,NULL,0,NULL,NULL,'2025-09-03 12:32:35','2026-01-22 02:29:44'),(135,98,4,'in_progress',NULL,NULL,1,'2026-01-22 03:00:16',1,'2025-09-16 11:44:04',9,'2025-09-03 12:32:35','2026-01-22 03:00:16'),(137,98,5,'in_progress',NULL,NULL,0,NULL,0,NULL,NULL,'2025-09-03 12:32:35','2026-01-22 02:29:44'),(139,98,6,'not_started',NULL,NULL,0,NULL,0,NULL,NULL,'2025-09-03 12:32:35','2026-01-22 02:29:44'),(2123,98,7,'in_progress',NULL,NULL,0,NULL,0,NULL,NULL,'2025-11-18 04:54:18','2026-01-28 05:44:57'),(2256,98,8,'in_progress',NULL,9,0,NULL,0,NULL,NULL,'2025-12-11 05:01:32','2026-01-28 06:17:47');
/*!40000 ALTER TABLE `user_lesson_progress` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_tags`
--

DROP TABLE IF EXISTS `user_tags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_tags` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'ã‚¿ã‚°ID',
  `user_id` int NOT NULL COMMENT 'ãƒ¦ãƒ¼ã‚¶ãƒ¼IDï¼ˆuser_accounts.idï¼‰',
  `tag_name` varchar(100) NOT NULL COMMENT 'ã‚¿ã‚°å',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'ä½œæˆæ—¥æ™‚',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_tag` (`user_id`,`tag_name`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_tag_name` (`tag_name`),
  CONSTRAINT `user_tags_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user_accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='ãƒ¦ãƒ¼ã‚¶ãƒ¼ã‚¿ã‚°æƒ…å ±ç®¡ç†ãƒ†ãƒ¼ãƒ–ãƒ«';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_tags`
--

LOCK TABLES `user_tags` WRITE;
/*!40000 ALTER TABLE `user_tags` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_tags` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_temp_passwords`
--

DROP TABLE IF EXISTS `user_temp_passwords`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_temp_passwords` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'ä¸€æ™‚ãƒ‘ã‚¹ãƒ¯ãƒ¼ãƒ‰ID',
  `user_id` int NOT NULL COMMENT 'ãƒ¦ãƒ¼ã‚¶ãƒ¼IDï¼ˆuser_accounts.idï¼‰',
  `temp_password` varchar(10) NOT NULL COMMENT 'ä¸€æ™‚ãƒ‘ã‚¹ãƒ¯ãƒ¼ãƒ‰ï¼ˆXXXX-XXXXå½¢å¼ï¼‰',
  `issued_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'ç™ºè¡Œæ—¥æ™‚',
  `expires_at` datetime NOT NULL COMMENT 'æœ‰åŠ¹æœŸé™ï¼ˆæ—¥æœ¬æ™‚é–“23:59ï¼‰',
  `is_used` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'ä½¿ç”¨æ¸ˆã¿ãƒ•ãƒ©ã‚°ï¼ˆ1=ä½¿ç”¨æ¸ˆã¿ã€0=æœªä½¿ç”¨ï¼‰',
  `used_at` datetime DEFAULT NULL COMMENT 'ä½¿ç”¨æ—¥æ™‚',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_expires_at` (`expires_at`),
  KEY `idx_is_used` (`is_used`),
  CONSTRAINT `user_temp_passwords_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user_accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=63 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='åˆ©ç”¨è€…ä¸€æ™‚ãƒ‘ã‚¹ãƒ¯ãƒ¼ãƒ‰ç®¡ç†ãƒ†ãƒ¼ãƒ–ãƒ«ï¼ˆãƒ­ãƒ¼ãƒ«1å°‚ç”¨ï¼‰';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_temp_passwords`
--

LOCK TABLES `user_temp_passwords` WRITE;
/*!40000 ALTER TABLE `user_temp_passwords` DISABLE KEYS */;
INSERT INTO `user_temp_passwords` VALUES (1,98,'EFRS-3PIW','2025-08-28 11:03:32','2025-08-28 23:59:59',1,NULL),(2,98,'J8M8-F0PO','2025-08-29 14:07:48','2025-08-29 23:59:59',1,NULL),(3,98,'X5T3-83BV','2025-09-01 10:20:36','2025-09-01 23:59:59',1,NULL),(4,98,'9XUC-FV6P','2025-09-01 11:34:34','2025-09-01 23:59:59',1,NULL),(5,98,'7AL1-9MDD','2025-09-02 10:22:42','2025-09-02 23:59:59',1,NULL),(6,98,'5XMP-DIN8','2025-09-02 10:38:48','2025-09-02 23:59:59',1,NULL),(7,98,'CFRB-M4KS','2025-09-02 14:14:24','2025-09-02 23:59:59',1,NULL),(8,98,'2JX7-6FVD','2025-09-03 09:54:48','2025-09-03 23:59:59',1,NULL),(9,98,'A3Y8-ROR4','2025-09-04 12:21:21','2025-09-04 23:59:59',1,NULL),(10,98,'VPA2-57JT','2025-09-05 12:53:59','2025-09-05 23:59:59',1,NULL),(11,98,'7UWR-9EXW','2025-09-08 09:44:58','2025-09-08 23:59:59',1,NULL),(12,98,'V2IR-YSGI','2025-09-09 09:39:56','2025-09-09 23:59:59',1,NULL),(13,98,'G0PA-4BHW','2025-09-11 09:54:18','2025-09-11 23:59:59',1,NULL),(14,98,'A0SW-CD4K','2025-09-12 09:53:50','2025-09-12 23:59:59',1,NULL),(15,98,'KKGT-12UN','2025-09-12 14:39:43','2025-09-12 23:59:59',1,NULL),(16,98,'LVV8-7GK2','2025-09-12 15:03:09','2025-09-12 23:59:59',1,NULL),(17,98,'2IKX-Y7MC','2025-09-12 15:03:26','2025-09-12 23:59:59',1,NULL),(18,98,'IN48-KK16','2025-09-12 15:08:44','2025-09-12 23:59:59',1,NULL),(19,98,'NH17-OTDO','2025-09-13 09:53:59','2025-09-13 23:59:59',1,NULL),(20,98,'6X9V-9I6K','2025-09-13 10:31:49','2025-09-13 14:59:59',1,NULL),(27,98,'VRG9-HPA2','2025-09-16 14:56:11','2025-09-16 14:59:59',1,NULL),(28,98,'QEQ3-KRRO','2025-09-16 15:26:39','2025-09-16 14:59:59',1,NULL),(29,98,'4GB9-6VNO','2025-09-16 15:29:46','2025-09-16 14:59:59',1,NULL),(43,98,'GTMT-A5HM','2025-09-20 09:56:01','2025-09-20 14:59:59',1,NULL),(49,98,'JD8R-15GY','2025-11-19 05:47:42','2025-11-19 14:59:59',1,NULL),(51,98,'QT5M-J9EO','2025-12-02 05:42:22','2025-12-02 14:59:59',1,NULL),(54,98,'97Q0-SO9W','2025-12-11 05:15:17','2025-12-11 14:59:59',1,NULL),(56,98,'TD7P-JUJ1','2025-12-12 06:19:47','2025-12-12 14:59:59',1,NULL);
/*!40000 ALTER TABLE `user_temp_passwords` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `weekly_evaluation_records`
--

DROP TABLE IF EXISTS `weekly_evaluation_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `weekly_evaluation_records` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'é€±å ±è¨˜éŒ²ID',
  `user_id` int NOT NULL COMMENT 'åˆ©ç”¨è€…ã®ãƒ¦ãƒ¼ã‚¶ãƒ¼ID',
  `date` date NOT NULL COMMENT 'è©•ä¾¡å®Ÿæ–½æ—¥ï¼ˆè©•ä¾¡è¨˜å…¥æ—¥ï¼‰',
  `prev_eval_date` date DEFAULT NULL COMMENT 'å‰å›žè©•ä¾¡æ—¥ï¼ˆä»»æ„ï¼‰',
  `period_start` date NOT NULL COMMENT 'å¯¾è±¡æœŸé–“ã®é–‹å§‹æ—¥',
  `period_end` date NOT NULL COMMENT 'å¯¾è±¡æœŸé–“ã®çµ‚äº†æ—¥',
  `evaluation_method` enum('通所','訪問','その他') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '通所' COMMENT '評価方法',
  `method_other` varchar(255) DEFAULT NULL COMMENT 'è©•ä¾¡æ–¹æ³•ã®è£œè¶³ï¼ˆãã®ä»–ï¼‰',
  `evaluation_content` text COMMENT 'è©•ä¾¡å†…å®¹ï¼ˆ1é€±é–“åˆ†ã®çŠ¶æ³ã¾ã¨ã‚ï¼‰',
  `recorder_name` varchar(100) DEFAULT NULL COMMENT 'è¨˜éŒ²è€…å',
  `confirm_name` varchar(100) DEFAULT NULL COMMENT 'ç¢ºèªè€…åï¼ˆã‚µãƒ¼ãƒ“ã‚¹ç®¡ç†è²¬ä»»è€…ï¼‰',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `weekly_evaluation_records_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user_accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='é€±å ±ï¼ˆè©•ä¾¡ï¼‰è¨˜éŒ²ãƒ†ãƒ¼ãƒ–ãƒ«';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `weekly_evaluation_records`
--

LOCK TABLES `weekly_evaluation_records` WRITE;
/*!40000 ALTER TABLE `weekly_evaluation_records` DISABLE KEYS */;
INSERT INTO `weekly_evaluation_records` VALUES (1,103,'2025-11-28',NULL,'2025-11-21','2025-11-27','訪問',NULL,'テスト','時安　公代','時安　公代','2025-11-28 02:24:38','2025-11-28 02:24:38'),(2,103,'2025-11-28','2025-11-28','2025-11-21','2025-11-27','通所',NULL,'テスト','時安　公代','時安　公代','2025-11-28 02:33:24','2025-11-28 02:33:24'),(3,103,'2025-11-28','2025-11-28','2025-11-21','2025-11-27','通所',NULL,'テスト','時安　公代','時安　公代','2025-11-28 05:21:58','2025-11-28 05:21:58'),(4,103,'2025-12-01','2025-11-28','2025-11-24','2025-11-30','通所',NULL,'テスト','時安　公代','時安　公代','2025-12-01 02:08:13','2025-12-01 02:08:13'),(5,103,'2025-12-01','2025-12-01','2025-11-24','2025-11-30','通所',NULL,'test','盛内　稔史','盛内　稔史','2025-12-01 02:46:18','2025-12-01 02:46:18'),(6,103,'2025-12-01','2025-12-01','2025-11-24','2025-11-30','通所',NULL,'test','盛内　稔史','盛内　稔史','2025-12-01 02:53:03','2025-12-01 02:53:03');
/*!40000 ALTER TABLE `weekly_evaluation_records` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping events for database 'curriculum-portal'
--
/*!50106 SET @save_time_zone= @@TIME_ZONE */ ;
/*!50106 DROP EVENT IF EXISTS `cleanup_expired_announcements` */;
DELIMITER ;;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;;
/*!50003 SET character_set_client  = utf8mb4 */ ;;
/*!50003 SET character_set_results = utf8mb4 */ ;;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;;
/*!50003 SET sql_mode              = 'IGNORE_SPACE,ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;;
/*!50003 SET @saved_time_zone      = @@time_zone */ ;;
/*!50003 SET time_zone             = '+09:00' */ ;;
/*!50106 CREATE*/ /*!50117 DEFINER=`root`@`%`*/ /*!50106 EVENT `cleanup_expired_announcements` ON SCHEDULE EVERY 1 HOUR STARTS '2025-09-12 11:09:17' ON COMPLETION NOT PRESERVE ENABLE DO DELETE FROM announcements 
        WHERE expires_at <= NOW() */ ;;
/*!50003 SET time_zone             = @saved_time_zone */ ;;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;;
/*!50003 SET character_set_client  = @saved_cs_client */ ;;
/*!50003 SET character_set_results = @saved_cs_results */ ;;
/*!50003 SET collation_connection  = @saved_col_connection */ ;;
/*!50106 DROP EVENT IF EXISTS `cleanup_expired_personal_messages` */;;
DELIMITER ;;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;;
/*!50003 SET character_set_client  = utf8mb4 */ ;;
/*!50003 SET character_set_results = utf8mb4 */ ;;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;;
/*!50003 SET sql_mode              = 'IGNORE_SPACE,ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;;
/*!50003 SET @saved_time_zone      = @@time_zone */ ;;
/*!50003 SET time_zone             = '+09:00' */ ;;
/*!50106 CREATE*/ /*!50117 DEFINER=`root`@`%`*/ /*!50106 EVENT `cleanup_expired_personal_messages` ON SCHEDULE EVERY 1 HOUR STARTS '2025-09-12 11:09:17' ON COMPLETION NOT PRESERVE ENABLE DO DELETE FROM personal_messages 
        WHERE expires_at <= NOW() */ ;;
/*!50003 SET time_zone             = @saved_time_zone */ ;;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;;
/*!50003 SET character_set_client  = @saved_cs_client */ ;;
/*!50003 SET character_set_results = @saved_cs_results */ ;;
/*!50003 SET collation_connection  = @saved_col_connection */ ;;
/*!50106 DROP EVENT IF EXISTS `cleanup_expired_temp_passwords` */;;
DELIMITER ;;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;;
/*!50003 SET character_set_client  = latin1 */ ;;
/*!50003 SET character_set_results = latin1 */ ;;
/*!50003 SET collation_connection  = latin1_swedish_ci */ ;;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;;
/*!50003 SET @saved_time_zone      = @@time_zone */ ;;
/*!50003 SET time_zone             = '+09:00' */ ;;
/*!50106 CREATE*/ /*!50117 DEFINER=`root`@`localhost`*/ /*!50106 EVENT `cleanup_expired_temp_passwords` ON SCHEDULE EVERY 1 DAY STARTS '2025-08-27 14:11:48' ON COMPLETION NOT PRESERVE ENABLE DO DELETE FROM `user_temp_passwords` 
    WHERE `expires_at` < CONVERT_TZ(NOW(), '+00:00', '+09:00') 
    AND `is_used` = 0 */ ;;
/*!50003 SET time_zone             = @saved_time_zone */ ;;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;;
/*!50003 SET character_set_client  = @saved_cs_client */ ;;
/*!50003 SET character_set_results = @saved_cs_results */ ;;
/*!50003 SET collation_connection  = @saved_col_connection */ ;;
DELIMITER ;
/*!50106 SET TIME_ZONE= @save_time_zone */ ;

--
-- Dumping routines for database 'curriculum-portal'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-01-30  5:16:15
