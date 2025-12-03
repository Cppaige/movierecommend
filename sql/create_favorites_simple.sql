-- 创建简单版本的收藏夹表（不带分类）
CREATE TABLE IF NOT EXISTS `favorites` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '收藏记录ID',
  `userid` INT NOT NULL COMMENT '用户ID',
  `movieid` INT NOT NULL COMMENT '电影ID',
  `createtime` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '收藏时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_movie` (`userid`, `movieid`),
  KEY `idx_userid` (`userid`),
  KEY `idx_movieid` (`movieid`),
  KEY `idx_createtime` (`createtime`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户收藏表';
