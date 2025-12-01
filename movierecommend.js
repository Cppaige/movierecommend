/**
 * Created by linziyu on 2018/7/3.
 */
/**
 * express接收html传递的参数
 */

var  express=require('express');
var  bodyParser = require('body-parser')
const spawnSync = require('child_process').spawnSync;
var  app=express();
var mysql=require('mysql');
var http = require("http");
app.set('view engine', 'jade');
app.set('views', './views');
app.use(bodyParser.json())
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

/**
 * 配置MySQL
 */
var connection = mysql.createConnection({
    host     : '127.0.0.1',
    user     : 'root',
    password : '202325330111',
    database : 'movierecommend',
    port:'3306'
});
connection.connect();

/**
 * 跳转到网站首页
 */
app.get('/',function (req,res) {
    res.render('index');
})

/**
 * 跳转到登录页面
 */

app.get('/loginpage',function (req,res) {
    res.render('loginpage',{title:'登录'});
})


/**
 * 实现登录验证功能
 */
app.post('/login',function (req,res) {
    var  name=req.body.username.trim();
    var pwd=req.body.pwd.trim();
    console.log('username:'+name+'password:'+pwd);

    var selectMovieInfoSQL="select movieid,moviename,picture from movieinfo limit 1000";
    var movieinfolist=[];
    connection.query(selectMovieInfoSQL,function(err,rows,fields){
        if (err) throw  err;
        movieinfolist=rows;
    });

    var selectSQL = "select * from user where username = '"+name+"' and password = '"+pwd+"'";
    connection.query(selectSQL,function (err,rows,fields) {
        if (err) throw  err;

        function randomFrom(lowerValue,upperValue) {
            return Math.floor(Math.random() * (upperValue - lowerValue + 1) + lowerValue);
        }

        var lowerValue=0;
        var upperValue=movieinfolist.length;
        var movielist=[];
        var movieNumbers=10;
        
        // 安全检查：如果电影列表为空或数量不足，调整数量
        if (movieinfolist.length === 0) {
            movieNumbers = 0;
        } else if (movieinfolist.length < movieNumbers) {
            movieNumbers = movieinfolist.length;
        }
        
        for (var i=0;i<movieNumbers;i++){
            var index=randomFrom(lowerValue,upperValue);
            // 安全检查：确保索引在有效范围内
            if (movieinfolist[index]) {
                movielist.push({
                    movieid:movieinfolist[index].movieid,
                    moviename:movieinfolist[index].moviename,
                    picture:movieinfolist[index].picture
                });
            }
        }

        if (rows && rows.length > 0) {
            // 登录成功
            res.render('index',{
                title:'MovieMatrix - 智能电影推荐',
                isLogin: true,
                userid: rows[0].userid,
                username: rows[0].username,
                ratedMovies: []
            });
        } else {
            // 登录失败
            res.render('login', {
                title: '登录',
                error: '用户名或密码错误'
            });
        }
    });  // 闭合 connection.query 的回调

});  // 关键：添加这一行，闭合整个 app.post('/login', ...) 接口


/**
 * 跳转到注册页面
 */

app.get('/registerpage',function (req,res) {
    res.render('registerpage',{title:'注册'});
})

/**
 * 实现注册功能
 */
app.post('/register',function (req,res) {
    var  name=req.body.username.trim();
    var  pwd=req.body.pwd.trim();
    var  user={username:name,password:pwd};
    connection.query('insert into user set ?',user,function (err,rs) {
        if (err) throw  err;
        console.log('register success');
        res.render('registersuccess',{title:'注册成功',message:name});
    })
})

/**
 * 跳转到电影选择页面
 */
app.get('/select-movies', function (req, res) {
    var userid = req.query.userid;
    var username = req.query.username;

    // 从数据库获取所有电影
    var selectAllMoviesSQL = "select movieid, moviename, picture from movieinfo limit 200"; // 限制数量避免过多

    connection.query(selectAllMoviesSQL, function(err, rows, fields) {
        if (err) throw err;

        // 将电影分成批次，每批10部
        var batchSize = 10;
        var movieBatches = [];
        for (var i = 0; i < rows.length; i += batchSize) {
            movieBatches.push(rows.slice(i, i + batchSize));
        }

        var currentBatchIndex = 0;
        var totalBatches = movieBatches.length;
        var minSelectionRequired = 5; // 至少选择5部电影

        res.render('movie-selection', {
            title: '选择看过的电影',
            username: username,
            userid: userid,
            movieBatches: movieBatches,
            currentBatchIndex: currentBatchIndex,
            totalBatches: totalBatches,
            minSelectionRequired: minSelectionRequired
        });
    });
});

/**
 * 处理选择的电影并跳转到评分页面
 */
app.post('/rate-movies', function (req, res) {
    var userid = req.body.userid;
    var selectedMovieIds = req.body.selectedMovieIds;

    console.log('Selected movie IDs:', selectedMovieIds);

    // 如果selectedMovieIds是空字符串，转换为空数组
    var movieIdArray = selectedMovieIds ? selectedMovieIds.split(',').filter(function(id) {
        return id.trim() !== '';
    }) : [];

    if (movieIdArray.length === 0) {
        // 如果没有选择电影，返回错误
        return res.render('error', {
            title: '错误',
            message: '请至少选择一部电影进行评分'
        });
    }

    // 根据选中的电影ID获取完整的电影信息
    var placeholders = movieIdArray.map(function() { return '?'; }).join(',');
    var selectMoviesSQL = "SELECT movieid, moviename, picture FROM movieinfo WHERE movieid IN (" + placeholders + ")";

    connection.query(selectMoviesSQL, movieIdArray, function(err, rows, fields) {
        if (err) throw err;

        res.render('rating-page', {
            title: '为电影评分',
            username: req.body.username || '用户',
            userid: userid,
            selectedMovies: rows
        });
    });
});

/**
 * 把用户评分写入数据库
 */

app.post('/submituserscore', function (req, res) {
    console.log('=== 收到评分请求 ===');
    console.log('完整请求体:', JSON.stringify(req.body, null, 2));

    // 检查请求体
    if (!req.body) {
        console.error('错误: req.body 为 undefined');
        return res.status(400).json({ error: '请求体为空' });
    }

    var userid = req.body.userid;

    // 检查必要参数
    if (!userid) {
        console.error('错误: userid 缺失');
        return res.status(400).json({ error: 'userid 参数缺失' });
    }

    if (!req.body.moviescore) {
        console.error('错误: moviescore 缺失');
        return res.status(400).json({ error: 'moviescore 参数缺失' });
    }

    // 同时支持 moveid 和 movieid
    var movieidData = req.body.movieid || req.body.moveid;
    if (!movieidData) {
        console.error('错误: movieid/moveid 缺失');
        return res.status(400).json({
            error: 'movieid 参数缺失',
            hint: '请检查前端是否发送了 movieid 或 moveid 字段'
        });
    }

    var moviescores = [];
    var movieids = [];

    // 安全地处理 moviescore
    if (Array.isArray(req.body.moviescore)) {
        req.body.moviescore.forEach(function(score) {
            console.log('处理评分:', score);
            moviescores.push({ moviescore: score });
        });
    } else {
        console.error('错误: moviescore 不是数组');
        return res.status(400).json({ error: 'moviescore 必须是数组' });
    }

    // 安全地处理 movieid (支持 moveid 和 movieid)
    if (Array.isArray(movieidData)) {
        movieidData.forEach(function(id) {
            console.log('处理电影ID:', id);
            movieids.push({ movieid: id });
        });
    } else {
        console.error('错误: movieid/moveid 不是数组');
        return res.status(400).json({ error: 'movieid 必须是数组' });
    }

    // 检查数组长度是否匹配
    if (moviescores.length !== movieids.length) {
        console.error('错误: 数组长度不匹配');
        return res.status(400).json({
            error: 'moviescore 和 movieid 数组长度不匹配',
            moviescoreLength: moviescores.length,
            movieidLength: movieids.length
        });
    }

    console.log('处理完成: userid=', userid, '电影数量=', movieids.length);

    // 删除该用户历史评分数据
    connection.query('DELETE FROM personalratings WHERE userid = ?', [userid], function(err, result) {
        if (err) {
            console.error('删除历史评分失败:', err);
            return res.status(500).json({ error: '数据库操作失败' });
        }
        console.log('用户 ' + userid + ' 的历史评分已删除');

        // 生成评分时间戳
        var mytimestamp = new Date().getTime().toString().slice(1, 10);
        var completedInserts = 0;
        var totalInserts = movieids.length;

        // 如果没有评分数据，直接返回成功
        if (totalInserts === 0) {
            return handleSuccessResponse();
        }

        // 插入新的评分数据
        for (var i = 0; i < movieids.length; i++) {
            var personalratings = {
                userid: userid,
                movieid: movieids[i].movieid,
                rating: moviescores[i].moviescore,
                timestamp: mytimestamp
            };

            connection.query('INSERT INTO personalratings SET ?', personalratings, function (err, rs) {
                if (err) {
                    console.error('插入评分失败:', err);
                } else {
                    console.log('插入评分成功');
                }

                completedInserts++;
                // 当所有插入操作完成时
                if (completedInserts === totalInserts) {
                    handleSuccessResponse();
                }
            });
        }
    });

    function handleSuccessResponse() {
        var selectUserIdNameSQL = 'SELECT userid, username FROM user WHERE userid = ?';
        connection.query(selectUserIdNameSQL, [userid], function(err, rows) {
            if (err) {
                console.error('查询用户信息失败:', err);
                return res.status(500).json({ error: '查询用户信息失败' });
            }

            if (rows.length === 0) {
                return res.status(404).json({ error: '用户不存在' });
            }

            res.render('userscoresuccess', {
                title: 'Personal Rating Success',
                user: rows[0]
            });
        });
    }
});

/**
 * 为用户显示推荐结果（直接从数据库读取）
 */
app.get('/recommendmovieforuser', function (req, res) {
    const userid = req.query.userid;
    const username = req.query.username;

    console.log('为用户 ' + userid + ' 显示推荐结果...');

    // 直接从数据库中读取推荐结果
    var selectRecommendResultSQL = "SELECT recommendresult.userid, recommendresult.movieid, recommendresult.rating, movieinfo.moviename, movieinfo.picture FROM recommendresult INNER JOIN movieinfo ON recommendresult.movieid = movieinfo.movieid WHERE recommendresult.userid = ?";

    var movieinfolist = [];
    connection.query(selectRecommendResultSQL, [userid], function(err, rows, fields) {
        if (err) {
            console.error('读取推荐结果失败:', err);
            return res.status(500).render('error', {
                title: '错误',
                message: '获取推荐结果失败'
            });
        }

        console.log('成功读取 ' + rows.length + ' 条推荐结果');

        for (var i = 0; i < rows.length; i++) {
            movieinfolist.push({
                userid: rows[i].userid,
                movieid: rows[i].movieid,
                rating: rows[i].rating,
                moviename: rows[i].moviename,
                picture: rows[i].picture
            });
        }

        res.render('recommendresult', {
            title: '推荐结果',
            message: '为您推荐的电影',
            username: username,
            movieinfo: movieinfolist,
            userid: userid
        });
    });
});


var server = app.listen(3000, function () {
    console.log("movierecommend server start......");
});