# 快速修复指南

## 问题总结
1. ✅ 导航栏没有"我的收藏"链接 - 已修复
2. ✅ 收藏夹页面可能因为表不存在而报错 - 已修复
3. ✅ 评分界面改回原来的版本 - 已修复

## 立即执行以下步骤

### 第1步：创建favorites表

打开命令行执行：

```bash
mysql -u root -p202325330111 movierecommend
```

然后执行：

```sql
CREATE TABLE IF NOT EXISTS `favorites` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '收藏记录ID',
  `userid` INT NOT NULL COMMENT '用户ID',
  `movieid` INT NOT NULL COMMENT '电影ID',
  `createtime` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '收藏时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_movie` (`userid`, `movieid`),
  KEY `idx_userid` (`userid`),
  KEY `idx_movieid` (`movieid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

或者用SQL文件：

```bash
mysql -u root -p202325330111 movierecommend < D:\code\Java\movierecommend\sql\create_favorites_simple.sql
```

### 第2步：重启服务器

停止当前服务器（如果在运行），然后重新启动：

```bash
cd D:\code\Java\movierecommend
node movierecommend.js
```

### 第3步：测试

1. 访问 `http://localhost:3000`
2. 登录
3. 查看导航栏是否有"我的收藏"
4. 点击"我的收藏"查看是否正常显示
5. 点击"去评分"测试评分功能

---

## 已修复的问题

### 1. 导航栏添加了"我的收藏"链接
- 位置：登录后在导航栏显示
- 文件：`views/layout.jade:27`

### 2. 收藏夹页面容错处理
- 如果表不存在，显示空列表而不是错误页面
- 文件：`movierecommend.js:1114-1161`

### 3. 评分界面回退到原版本
- 使用原来的 `movie-selection-rating.jade`
- 不再使用v2版本

---

## 如果还有问题

### 检查数据库连接
```bash
mysql -u root -p202325330111 movierecommend -e "SHOW TABLES;"
```

应该看到favorites表。

### 检查服务器日志
启动服务器时查看控制台是否有错误信息。

### 检查端口
确保3000端口没有被占用：
```bash
netstat -ano | findstr :3000
```

---

## 暂时禁用的功能

为了让网站能正常运行，我暂时：
- ❌ 禁用了收藏分类功能（想看、已看、喜欢）
- ❌ 禁用了新版评分界面
- ✅ 保留了基础收藏功能
- ✅ 保留了原评分界面

等这些基础功能稳定后，我们再逐步添加高级功能。

---

## 立即行动清单

- [ ] 执行SQL创建favorites表
- [ ] 重启Node.js服务器
- [ ] 登录并查看导航栏
- [ ] 测试"我的收藏"页面
- [ ] 测试评分功能
- [ ] 告诉我结果

请现在执行这些步骤，然后告诉我是否能正常访问了！
