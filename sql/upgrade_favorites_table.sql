-- 升级收藏表，添加分类字段
-- 先删除旧表（如果存在）
DROP TABLE IF EXISTS `favorites`;

-- 创建新的收藏表（支持分类）
CREATE TABLE `favorites` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '收藏记录ID',
  `userid` INT NOT NULL COMMENT '用户ID',
  `movieid` INT NOT NULL COMMENT '电影ID',
  `category` ENUM('want_watch', 'watched', 'liked') NOT NULL DEFAULT 'liked' COMMENT '收藏分类：想看、已看、喜欢',
  `rating` INT DEFAULT NULL COMMENT '个人评分（1-5星，可选）',
  `note` TEXT DEFAULT NULL COMMENT '个人笔记',
  `createtime` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '收藏时间',
  `updatetime` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_movie_category` (`userid`, `movieid`, `category`),
  KEY `idx_userid` (`userid`),
  KEY `idx_movieid` (`movieid`),
  KEY `idx_category` (`category`),
  KEY `idx_createtime` (`createtime`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户收藏表（支持分类）';

-- 插入一些测试数据（可选）
-- INSERT INTO favorites (userid, movieid, category) VALUES (1, 1, 'liked');
-- INSERT INTO favorites (userid, movieid, category) VALUES (1, 2, 'want_watch');
-- INSERT INTO favorites (userid, movieid, category) VALUES (1, 3, 'watched');
