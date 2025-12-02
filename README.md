# movierecommend
*已经解决的问题可以标注某某人已解决*

## 问题 & 解决
1. 数据库显示中文问题
   > show create table movieinfo;
   > 
   检查 CHARSET=utf8mb4,如果不是,执行:
   > 
   > ALTER TABLE movieinfo CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   >
   personalratings同理.


### TO DO LIST 必须解决
1. **修改数据库**（可以直接改电影库，换一个数据集，或者修复图片问题，图片是一个外链，外链的网站打不开）== *重要！！* 辣椒油已解决
2. 主页个性化推荐无法跳转到推荐界面，推荐界面也没办法回到主页。
3. 推荐很慢，看看能不能优化算法，加速推荐。spark后台是可以看推荐的进度的，我们可以弄一个生成推荐的进度表，这样跳转后就不会直接进入一个空白的界面。
4. 每一个很丑的界面。可以删可以改。*辣椒油已改：movie-selection、rating-page、userscoresuccess界面

### 可以添加的功能
1. 电影库，可以在电影库里看我们有哪些电影，也可以用户手动添加电影进去（要不要审核员审核？）在电影库和推荐界面都可以加一个收藏夹，这样用户想看的电影可以放到收藏夹里去。
2. 数据库，电影的数据库如果能有
3. 评论区，用户可以自由讨论的社区，如果更高级一点就是可以发帖子，像豆瓣那样。

### 12.2
**TO DO**
1. 重新爬数据库
mysql> describe movieinfo;
+-------------+---------------+------+-----+---------+-------+
| Field       | Type          | Null | Key | Default | Extra |
+-------------+---------------+------+-----+---------+-------+
| movieid     | int(11)       | NO   | PRI | 0       |       |
| tmdbId      | int(11)       | YES  |     | NULL    |       |
| moviename   | varchar(1000) | YES  |     | NULL    |       |
| releasetime | date          | YES  |     | NULL    |       |
| director    | varchar(1000) | YES  |     | NULL    |       |
| leadactors  | varchar(1000) | YES  |     | NULL    |       |
| picture     | varchar(1000) | YES  |     | NULL    |       |
| averating   | double(11,1)  | YES  |     | NULL    |       |
| numrating   | int(11)       | YES  |     | NULL    |       |
| description | varchar(1000) | YES  |     | NULL    |       |
| typelist    | varchar(255)  | YES  |     | NULL    |       |
+-------------+---------------+------+-----+---------+-------+
   数据库字符格式，如果可以是中文就很好，不行的话就算了;
   movieid如果可以按顺序来就好了;
   信息最好不要有缺失;
   电影类型能正常显示就好了;
   
3. 根据数据库的movieinfo导出movies.dat，根据新的movies.dat模拟生成ratings.dat（训练数据），替换hdfs中的这两个dat。 *脚本C++已经准备好，只要第一步有了这两个就能弄出来了。
