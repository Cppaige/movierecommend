# 功能更新说明

## 新增功能

### 1. 首页到推荐结果页面联动

**功能描述：**
- 在首页的"个性化推荐"区域，如果用户已登录并且有评分记录，会显示"查看完整推荐"按钮
- 点击该按钮可以直接跳转到推荐结果页面，查看完整的个性化推荐列表

**实现细节：**
- 修改了 `views/index.jade` 文件，添加了条件显示的"查看完整推荐"按钮
- 添加了对应的CSS样式 `.btn-view-recommend`
- 按钮链接到 `/recommendmovieforuser` 路由

**使用方法：**
1. 用户登录后进入首页
2. 完成电影评分（至少5部）
3. 在首页"个性化推荐"区域点击"查看完整推荐"按钮
4. 跳转到推荐结果页面查看所有推荐电影

---

### 2. 个人收藏夹功能

**功能描述：**
- 用户可以收藏自己喜欢的电影，方便后续查看
- 支持在多个页面（电影库、推荐结果页）添加/取消收藏
- 提供专门的收藏夹页面，展示所有收藏的电影

**数据库设计：**
```sql
CREATE TABLE `favorites` (
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
```

**API接口：**

1. **添加收藏**
   - 路由：`POST /api/favorites/add`
   - 参数：`{ movieid: number }`
   - 返回：`{ success: boolean, message: string }`

2. **取消收藏**
   - 路由：`POST /api/favorites/remove`
   - 参数：`{ movieid: number }`
   - 返回：`{ success: boolean, message: string }`

3. **获取收藏列表**
   - 路由：`GET /api/favorites/list`
   - 返回：`{ success: boolean, favorites: Array }`

4. **检查收藏状态**
   - 路由：`GET /api/favorites/check/:movieid`
   - 返回：`{ success: boolean, favorited: boolean }`

5. **收藏夹页面**
   - 路由：`GET /favorites`
   - 显示用户所有收藏的电影

**前端组件：**
- `public/js/favorites.js` - 收藏功能核心JavaScript模块
- `views/favorites.jade` - 收藏夹页面模板

**使用方法：**

1. **在推荐结果页添加收藏：**
   - 进入推荐结果页面
   - 点击电影卡片右上角的心形按钮
   - 按钮会变红表示收藏成功

2. **查看收藏夹：**
   - 在推荐结果页点击"我的收藏"按钮
   - 或者直接访问 `/favorites` 路由
   - 查看所有收藏的电影

3. **取消收藏：**
   - 在收藏夹页面点击心形按钮取消收藏
   - 电影卡片会淡出消失

---

## 安装步骤

### 1. 创建数据库表

连接到MySQL数据库，执行以下SQL语句：

```bash
mysql -u root -p movierecommend < sql/create_favorites_table.sql
```

或者手动在MySQL客户端执行：

```sql
USE movierecommend;

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
```

### 2. 验证表创建

```sql
SHOW TABLES LIKE 'favorites';
DESC favorites;
```

### 3. 重启服务器

```bash
# 停止当前运行的服务器
# 然后重新启动
node movierecommend.js
```

### 4. 测试功能

1. 登录系统
2. 完成电影评分
3. 进入推荐结果页面
4. 测试收藏功能
5. 访问收藏夹页面

---

## 文件清单

### 新增文件：
- `sql/create_favorites_table.sql` - 数据库表创建脚本
- `public/js/favorites.js` - 收藏功能JavaScript模块
- `views/favorites.jade` - 收藏夹页面模板

### 修改文件：
- `movierecommend.js` - 添加收藏相关API路由
- `views/index.jade` - 添加"查看完整推荐"按钮
- `views/recommendresult.jade` - 添加收藏按钮，优化页面样式
- `public/css/index.css` - 添加按钮样式和收藏按钮样式

---

## 功能特性

### 收藏功能特点：
1. ✅ 实时状态同步 - 收藏状态即时反馈
2. ✅ 防重复收藏 - 数据库唯一索引防止重复
3. ✅ 优雅的动画效果 - 心形按钮动画和提示消息
4. ✅ 用户友好 - 清晰的视觉反馈和操作提示
5. ✅ 性能优化 - 批量检查收藏状态，减少请求次数

### 推荐结果联动特点：
1. ✅ 智能显示 - 只在有推荐结果时显示按钮
2. ✅ 快速访问 - 一键跳转到完整推荐列表
3. ✅ 美观设计 - 符合整体UI风格的按钮设计

---

## 常见问题

### Q1: 数据库表创建失败？
**A:** 检查MySQL连接是否正常，确保有CREATE TABLE权限

### Q2: 收藏按钮点击无反应？
**A:**
1. 检查是否已登录
2. 打开浏览器控制台查看错误信息
3. 确认 `favorites.js` 文件已正确加载

### Q3: 收藏夹页面显示空白？
**A:**
1. 检查数据库表是否创建成功
2. 查看后端日志是否有SQL错误
3. 确认用户已登录

### Q4: "查看完整推荐"按钮不显示？
**A:**
1. 确认用户已登录
2. 确认用户已完成电影评分
3. 检查 `ratedMovies.length` 是否大于0

---

## 扩展建议

### 未来可以添加的功能：
1. 收藏夹分类管理（想看、已看、喜欢等）
2. 收藏夹导出功能
3. 分享收藏夹给其他用户
4. 收藏夹统计（收藏数量、类型分布等）
5. 收藏提醒（新电影上映提醒）

---

## 技术栈

- **后端：** Node.js + Express.js
- **数据库：** MySQL
- **前端：** Jade模板引擎 + Vanilla JavaScript
- **样式：** CSS3 + Font Awesome图标

---

## 联系方式

如有问题或建议，请通过以下方式联系：
- 项目Issues
- 邮件反馈

---

**版本：** v2.0
**更新日期：** 2025-12-02
