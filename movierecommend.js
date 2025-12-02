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
app.get('/loginpage', function (req, res) {
    res.render('loginpage', { title: '登录', error: null });
});

/**
 * 实现登录验证功能
 */
app.post('/login', function (req, res) {
    var name = req.body.username.trim();
    var pwd = req.body.pwd.trim();
    console.log('username:' + name + ' password:' + pwd);

    // 首先检查用户是否存在
    var checkUserSQL = "SELECT * FROM user WHERE username = ?";

    connection.query(checkUserSQL, [name], function (err, rows) {
        if (err) {
            console.error('数据库查询错误:', err);
            return res.render('loginpage', {
                title: '登录',
                error: '系统错误，请稍后重试'
            });
        }

        // 情况1：用户不存在
        if (rows.length === 0) {
            return res.render('loginpage', {
                title: '登录',
                error: '用户不存在，请先注册',
                showRegisterLink: true  // 可选：用于在前端显示注册链接
            });
        }

        // 用户存在，验证密码
        var user = rows[0];

        // 情况2：密码错误
        if (user.password !== pwd) {
            return res.render('loginpage', {
                title: '登录',
                error: '密码错误，请重新输入',
                username: name  // 保留用户名，方便用户重新输入
            });
        }

        // 情况3：登录成功，获取电影数据
        var selectMovieInfoSQL = "SELECT movieid, moviename, picture FROM movieinfo LIMIT 1000";
        var movieinfolist = [];

        connection.query(selectMovieInfoSQL, function (err, rows, fields) {
            if (err) {
                console.error('获取电影信息错误:', err);
                // 即使获取电影失败也允许登录，只是没有推荐电影
                movieinfolist = [];
            } else {
                movieinfolist = rows;
            }

            function randomFrom(lowerValue, upperValue) {
                return Math.floor(Math.random() * (upperValue - lowerValue + 1) + lowerValue);
            }

            var lowerValue = 0;
            var upperValue = movieinfolist.length - 1;  // 注意：应该是length-1
            var movielist = [];
            var movieNumbers = 10;

            // 安全检查：如果电影列表为空或数量不足，调整数量
            if (movieinfolist.length === 0) {
                movieNumbers = 0;
            } else if (movieinfolist.length < movieNumbers) {
                movieNumbers = movieinfolist.length;
            }

            for (var i = 0; i < movieNumbers; i++) {
                var index = randomFrom(lowerValue, upperValue);
                // 安全检查：确保索引在有效范围内
                if (movieinfolist[index]) {
                    movielist.push({
                        movieid: movieinfolist[index].movieid,
                        moviename: movieinfolist[index].moviename,
                        picture: movieinfolist[index].picture
                    });
                }
            }

            // 登录成功
            res.render('index', {
                title: 'MovieMatrix - 智能电影推荐',
                isLogin: true,
                userid: user.userid,
                username: user.username,
                recommendedMovies: movielist,  // 改为recommendedMovies更合适
                ratedMovies: []
            });
        });
    });
});

/**
 * 跳转到注册页面
 */
app.get('/registerpage', function (req, res) {
    res.render('registerpage', { title: '注册', error: null });
});

/**
 * 实现注册功能
 */
app.post('/register', function (req, res) {
    var name = req.body.username.trim();
    var pwd = req.body.pwd.trim();

    // 检查用户名是否已存在
    var checkUserSQL = "SELECT * FROM user WHERE username = ?";

    connection.query(checkUserSQL, [name], function (err, rows) {
        if (err) {
            console.error('数据库查询错误:', err);
            return res.render('registerpage', {
                title: '注册',
                error: '系统错误，请稍后重试'
            });
        }

        // 用户名已存在
        if (rows.length > 0) {
            return res.render('registerpage', {
                title: '注册',
                error: '用户名已存在，请选择其他用户名',
                username: name  // 保留输入的用户名
            });
        }

        // 用户名可用，进行注册
        var user = { username: name, password: pwd };

        connection.query('INSERT INTO user SET ?', user, function (err, rs) {
            if (err) {
                console.error('注册失败:', err);
                return res.render('registerpage', {
                    title: '注册',
                    error: '注册失败，请稍后重试'
                });
            }

            res.redirect('/loginpage?registered=true&username=' + encodeURIComponent(name));
        });
    });
});
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

/**
 * 跳转到电影库页面（全部电影）
 */
app.get('/movielibrary', function (req, res) {
    // 获取页码参数，默认为第一页
    var page = parseInt(req.query.page) || 1;
    var pageSize = 24; // 每页显示24部电影
    var offset = (page - 1) * pageSize;

    // 获取排序参数
    var sortBy = req.query.sort || 'movieid'; // 默认按ID排序
    var validSortFields = ['movieid', 'averating', 'numrating', 'releasetime'];
    if (!validSortFields.includes(sortBy)) {
        sortBy = 'movieid';
    }

    var orderBy = req.query.order === 'asc' ? 'ASC' : 'DESC';

    // 查询电影总数（用于分页）
    var countSQL = "SELECT COUNT(*) as total FROM movieinfo";

    // 查询电影数据（带分页和排序）
    var moviesSQL = `
        SELECT 
            movieid, 
            moviename, 
            releasetime, 
            director, 
            leadactors, 
            picture, 
            averating, 
            numrating, 
            description, 
            typelist
        FROM movieinfo 
        ORDER BY ${sortBy} ${orderBy}
        LIMIT ? OFFSET ?
    `;

    connection.query(countSQL, function (err, countResult) {
        if (err) {
            console.error('查询电影总数错误:', err);
            return res.render('error', { title: '错误', message: '获取数据失败' });
        }

        var totalMovies = countResult[0].total;
        var totalPages = Math.ceil(totalMovies / pageSize);

        connection.query(moviesSQL, [pageSize, offset], function (err, movies) {
            if (err) {
                console.error('查询电影数据错误:', err);
                return res.render('error', { title: '错误', message: '获取数据失败' });
            }

            // 格式化电影数据
            var formattedMovies = movies.map(function(movie) {
                return {
                    id: movie.movieid,
                    title: movie.moviename,
                    releaseDate: movie.releasetime ?
                        new Date(movie.releasetime).getFullYear() : '未知',
                    director: movie.director,
                    actors: movie.leadactors,
                    poster: movie.picture || 'https://via.placeholder.com/300x450?text=No+Image',
                    rating: movie.averating ? movie.averating.toFixed(1) : '0.0',
                    votes: movie.numrating || 0,
                    description: movie.description,
                    genres: movie.typelist ? movie.typelist.split(',').slice(0, 3) : [],
                    fullGenres: movie.typelist
                };
            });

            res.render('movielibrary', {
                title: '电影库 - MovieMatrix',
                movies: formattedMovies,
                currentPage: page,
                totalPages: totalPages,
                totalMovies: totalMovies,
                sortBy: sortBy,
                order: orderBy,
                nextOrder: orderBy === 'DESC' ? 'asc' : 'desc',
                // 用户登录状态（如果有的话）
                isLogin: req.session ? req.session.isLoggedIn : false,
                username: req.session ? req.session.username : null
            });
        });
    });
});

/**
 * 电影详情页面
 */
app.get('/movie/:id', function (req, res) {
    var movieId = req.params.id;

    var movieSQL = `
        SELECT 
            movieid, 
            moviename, 
            releasetime, 
            director, 
            leadactors, 
            picture, 
            averating, 
            numrating, 
            description, 
            typelist
        FROM movieinfo 
        WHERE movieid = ?
    `;

    connection.query(movieSQL, [movieId], function (err, movies) {
        if (err) {
            console.error('查询电影详情错误:', err);
            return res.render('error', { title: '错误', message: '获取电影详情失败' });
        }

        if (movies.length === 0) {
            return res.render('error', { title: '未找到', message: '电影不存在' });
        }

        var movie = movies[0];
        var formattedMovie = {
            id: movie.movieid,
            title: movie.moviename,
            releaseDate: movie.releasetime,
            releaseYear: movie.releasetime ?
                new Date(movie.releasetime).getFullYear() : '未知',
            director: movie.director,
            actors: movie.leadactors,
            poster: movie.picture || 'https://via.placeholder.com/300x450?text=No+Image',
            rating: movie.averating ? movie.averating.toFixed(1) : '0.0',
            votes: movie.numrating || 0,
            description: movie.description,
            genres: movie.typelist ? movie.typelist.split(',') : []
        };

        res.render('moviedetail', {
            title: formattedMovie.title + ' - MovieMatrix',
            movie: formattedMovie,
            isLogin: req.session ? req.session.isLoggedIn : false,
            username: req.session ? req.session.username : null
        });
    });
});

/**
 * 我的评分页面
 */
app.get('/myratings', function (req, res) {
    // 从查询参数获取用户信息
    var userId = req.query.userid;
    var username = req.query.username;

    // 如果没有用户ID，重定向到登录页面
    if (!userId) {
        return res.redirect('/loginpage');
    }

    // 查询用户的评分记录
    var ratingsSQL = `
        SELECT 
            pr.movieid,
            pr.rating,
            pr.timestamp,
            mi.moviename,
            mi.picture,
            mi.averating as avg_rating,
            mi.numrating as rating_count,
            mi.typelist,
            mi.releasetime,
            mi.director
        FROM personalratings pr
        LEFT JOIN movieinfo mi ON pr.movieid = mi.movieid
        WHERE pr.userid = ?
        ORDER BY pr.timestamp DESC, pr.rating DESC
    `;

    connection.query(ratingsSQL, [userId], function (err, ratings) {
        if (err) {
            console.error('查询评分记录错误:', err);
            return res.render('error', {
                title: '错误',
                message: '获取评分记录失败',
                isLogin: true,
                userid: userId,
                username: username
            });
        }

        // 格式化评分数据
        var formattedRatings = ratings.map(function(item) {
            return {
                movieId: item.movieid,
                movieName: item.moviename || '未知电影',
                poster: item.picture || 'https://via.placeholder.com/300x450?text=No+Image',
                myRating: item.rating,
                averageRating: item.avg_rating ? item.avg_rating.toFixed(1) : '0.0',
                ratingCount: item.rating_count || 0,
                genres: item.typelist ? item.typelist.split(',').slice(0, 3) : [],
                releaseYear: item.releasetime ?
                    new Date(item.releasetime).getFullYear() : '未知',
                director: item.director,
                timestamp: item.timestamp,
                formattedDate: formatDate(item.timestamp)
            };
        });

        // 计算统计数据
        var stats = {
            totalRatings: formattedRatings.length,
            avgMyRating: formattedRatings.length > 0 ?
                (formattedRatings.reduce((sum, item) => sum + item.myRating, 0) / formattedRatings.length).toFixed(1) : '0.0',
            ratingDistribution: getRatingDistribution(formattedRatings)
    };

        res.render('myratings', {
            title: '我的评分 - MovieMatrix',
            username: username,
            ratings: formattedRatings,
            stats: stats,
            isLogin: true,
            userid: userId,
            username: username
        });
    });
});

/**
 * 格式化日期
 */
function formatDate(timestamp) {
    if (!timestamp) return '未知时间';

    // 假设timestamp是YYYY-MM-DD格式或时间戳
    try {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) {
            return timestamp;
        }
        return date.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } catch (e) {
        return timestamp;
    }
}

/**
 * 获取评分分布
 */
function getRatingDistribution(ratings) {
    const distribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0};

    ratings.forEach(item => {
        if (item.myRating >= 1 && item.myRating <= 5) {
        distribution[item.myRating]++;
    }
});

    return distribution;
}

/**
 * 删除评分记录
 */
app.post('/myratings/delete', function (req, res) {
    var userId = req.body.userid;
    var movieId = req.body.movieid;
    var username = req.body.username;

    if (!userId || !movieId) {
        return res.json({success: false, message: '参数不完整'});
    }

    var deleteSQL = "DELETE FROM personalratings WHERE userid = ? AND movieid = ?";

    connection.query(deleteSQL, [userId, movieId], function (err, result) {
        if (err) {
            console.error('删除评分记录错误:', err);
            return res.json({success: false, message: '删除失败'});
        }

        // 重定向回我的评分页面
        res.redirect(`/myratings?userid=${userId}&username=${encodeURIComponent(username)}`);
    });
});

// support local visit
var server = app.listen(3000, '0.0.0.0', function () {
    var host = server.address().address;
    var port = server.address().port;
    console.log("movierecommend server start......");
    console.log("本地访问: http://localhost:%s", port);
    console.log("网络访问: http://%s:%s", host === '::' ? '0.0.0.0' : host, port);
});
