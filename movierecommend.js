/**
 * Created by linziyu on 2018/7/3.
 */
/**
 * express接收html传递的参数
 */

var  express=require('express');
var  bodyParser = require('body-parser')
const spawnSync = require('child_process').spawnSync;
var session = require('express-session');
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

var MySQLStore = require('express-mysql-session')(session);

var sessionStore = new MySQLStore({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '202325330111',
    database: 'movierecommend'
});

app.use(session({
    secret: 'movie-matrix-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24,
        httpOnly: true,
        sameSite: 'lax'   // 避免跳转跨域后 cookie 不带
    }
}));

// 添加中间件，使 session 数据在所有模板中可用
app.use(function(req, res, next) {
    // 将 session 中的用户信息传递给所有视图
    res.locals.isLogin = req.session.isLoggedIn || false;
    res.locals.userid = req.session.userId || '';
    res.locals.username = req.session.username || '';
    next();
});

// 登录检查中间件
function requireLogin(req, res, next) {
    if (!req.session.isLoggedIn) {
        // 可以重定向到登录页面，或者返回错误
        return res.redirect('/loginpage');
    }
    next();
}

/**
 * 跳转到网站首页
 */
app.get('/', function (req, res) {
    // 如果用户已登录，获取他们的评分记录和推荐电影
    var ratedMovies = [];
    var recommendedMovies = [];

    if (req.session.isLoggedIn) {
        var userId = req.session.userId;

        // 查询用户的评分记录
        var ratingsSQL = "SELECT movieid FROM personalratings WHERE userid = ? LIMIT 10";

        connection.query(ratingsSQL, [userId], function(err, rows) {
            if (err) {
                console.error('查询评分记录错误:', err);
            } else {
                ratedMovies = rows.map(row => row.movieid);
            }

            // 如果用户已评分，获取推荐电影（首页展示前8部）
            if (ratedMovies.length > 0) {
                var recommendSQL = `
                    SELECT m.movieid, m.moviename, m.picture, m.averating, m.typelist
                    FROM recommendmovie r
                    JOIN movie m ON r.recommendmovieid = m.movieid
                    WHERE r.userid = ?
                    ORDER BY r.degree DESC
                    LIMIT 8
                `;

                connection.query(recommendSQL, [userId], function(err, recommendRows) {
                    if (err) {
                        console.error('查询推荐电影错误:', err);
                    } else {
                        recommendedMovies = recommendRows;
                    }

                    // 渲染首页
                    res.render('index-v2', {
                        title: 'MovieMatrix - 智能电影推荐',
                        ratedMovies: ratedMovies,
                        recommendedMovies: recommendedMovies
                        // isLogin, userid, username 已经在 res.locals 中
                    });
                });
            } else {
                // 没有评分记录，直接渲染
                res.render('index-v2', {
                    title: 'MovieMatrix - 智能电影推荐',
                    ratedMovies: ratedMovies,
                    recommendedMovies: []
                });
            }
        });
    } else {
        // 未登录用户
        res.render('index-v2', {
            title: 'MovieMatrix - 智能电影推荐',
            ratedMovies: [],
            recommendedMovies: []
        });
    }
});
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
                showRegisterLink: true
            });
        }

        // 用户存在，验证密码
        var user = rows[0];

        // 情况2：密码错误
        if (user.password !== pwd) {
            return res.render('loginpage', {
                title: '登录',
                error: '密码错误，请重新输入',
                username: name
            });
        }

        // 情况3：登录成功
        req.session.isLoggedIn = true;
        req.session.userId = user.userid;
        req.session.username = user.username;

        console.log('用户登录成功，设置session:', {
            userId: user.userid,
            username: user.username
        });

        // 保存 session
        req.session.save(function(err) {
            if (err) {
                console.error('保存session失败:', err);
                return res.render('loginpage', {
                    title: '登录',
                    error: '登录失败，请重试'
                });
            }

            console.log('session保存成功，重定向到首页');
            // 重定向到首页
            res.redirect('/');
        });
    });
});

/**
 * 退出登录
 */
app.get('/logout', function(req, res) {
    // 销毁 session
    req.session.destroy(function(err) {
        if (err) {
            console.error('退出登录失败:', err);
        }
        // 重定向到首页
        res.redirect('/');
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
    // 重定向到合并页面
    res.redirect('/movie-selection-rating');
});
// 2. 添加新的合并页面路由
app.get('/movie-selection-rating', function(req, res) {
    // 获取用户信息
    var userid = req.session.userId;
    var username = req.session.username;

    // 获取电影数据（分批次显示）
    connection.query(
        "SELECT movieid, moviename, picture, typelist, averating FROM movieinfo ORDER BY RAND() LIMIT 100",
        function(error, results, fields) {
            if (error) {
                console.log("查询电影失败: " + error);
                res.status(500).send("服务器错误");
                return;
            }

            // 将电影分成5批，每批20部
            var batches = [];
            var batchSize = 20;
            for (var i = 0; i < results.length; i += batchSize) {
                batches.push(results.slice(i, i + batchSize));
            }

            res.render('movie-selection-rating', {
                username: username,
                userid: userid,
                minSelectionRequired: 10, // 最少选择10部
                currentBatchIndex: 0,
                totalBatches: batches.length,
                movieBatches: batches
            });
        }
    );
});
// 3. 添加新的提交和推荐路由
app.post('/submit-and-recommend', function(req, res) {
    var userid = req.body.userid;
    var selectedData = req.body.selectedData; // 格式: "movieId:rating,movieId:rating"

    console.log("收到评分数据:", selectedData);

    // 1. 清空该用户的历史评分
    connection.query(
        "DELETE FROM personalratings WHERE userid = ?",
        [userid],
        function(error, results, fields) {
            if (error) {
                console.log("删除历史评分失败: " + error);
                res.status(500).json({error: "删除历史评分失败"});
                return;
            }

            console.log("用户 " + userid + " 的历史评分已删除");

            // 2. 插入新的评分
            var ratings = selectedData.split(',');
            var insertedCount = 0;
            var errors = [];

            ratings.forEach(ratingData => {
                var parts = ratingData.split(':');
                if (parts.length === 2) {
                    var movieid = parseInt(parts[0]);
                    var rating = parseInt(parts[1]);

                    if (movieid && rating >= 1 && rating <= 5) {
                        connection.query(
                            "INSERT INTO personalratings SET ?",
                            {
                                userid: userid,
                                movieid: movieid,
                                rating: rating,
                                timestamp: Math.floor(Date.now() / 1000)
                            },
                            function(error, results, fields) {
                                if (error) {
                                    console.log("插入评分失败: " + error);
                                    errors.push(error);
                                } else {
                                    insertedCount++;
                                    console.log("插入评分成功: movieid=" + movieid + ", rating=" + rating);
                                }
                            }
                        );
                    }
                }
            });

            // 延迟响应，等待数据库操作完成
            setTimeout(() => {
                console.log("成功插入 " + insertedCount + " 条评分记录");

                // 3. 直接跳转到推荐结果页面（会触发Spark任务）
                res.json({
                    redirectUrl: `/recommendmovieforuser?userid=${userid}&username=${req.session.username}`
                });
            }, 1000);
        }
    );
});

/**
 * 处理选择的电影并跳转到评分页面
 */
app.post('/rate-movies', function (req, res) {
    // 检查是否登录
    if (!req.session.isLoggedIn) {
        return res.redirect('/loginpage');
    }

    var userid = req.session.userId;
    var username = req.session.username;

    // 这里获取 selectedMovieIds
    var selectedMovieIds = req.body.selectedMovieIds || '';

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

    // 检查是否登录
    if (!req.session.isLoggedIn) {
        return res.status(401).json({ error: '请先登录' });
    }

    var userid = req.session.userId;  // 从 session 获取

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

            var query = connection.query(
                "INSERT INTO personalratings SET ?",
                {
                    userid: parseInt(userid),
                    movieid: parseInt(movieid), // 确保转换为整数
                    rating: parseInt(rating),
                    timestamp: parseInt(timestamp)
                },
                function(error, results, fields) {
                    if (error) {
                        console.log("插入评分失败: " + error);
                    } else {
                        console.log("评分插入成功");
                    }
                }
            );
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
    if (!req.session.isLoggedIn) {
        return res.redirect('/loginpage');
    }

    const userid = req.session.userId;
    const username = req.session.username;

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
                nextOrder: orderBy === 'DESC' ? 'asc' : 'desc'
                // 不再需要传递 isLogin, username
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
        });
    });
});

/**
 * 我的评分页面 - 修改版
 */
app.get('/myratings', function (req, res) {
    console.log('=== 进入 /myratings 路由 ===');

    // 检查是否登录
    if (!req.session.isLoggedIn) {
        console.log('用户未登录，重定向到登录页面');
        return res.redirect('/loginpage');
    }

    // 从 session 获取用户信息
    var userId = req.session.userId;
    var username = req.session.username;

    console.log('从session获取用户信息 - ID:', userId, '用户名:', username);

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
            // 返回一个简单的错误页面
            return res.render('error', {
                title: '数据库错误',
                message: '获取评分记录失败: ' + err.message,
            });
        }

        console.log('查询到评分记录:', ratings.length, '条');

        // 如果没有任何评分记录
        if (ratings.length === 0) {
            return res.render('myratings', {
                title: '我的评分 - MovieMatrix',
                username: username || '用户',
                ratings: [],
                stats: {
                    totalRatings: 0,
                    avgMyRating: '0.0',
                    ratingDistribution: {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
                },
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
                director: item.director || '未知',
                timestamp: item.timestamp,
                formattedDate: item.timestamp || '未知时间'
            };
        });

        // 计算统计数据
        var stats = {
            totalRatings: formattedRatings.length,
            avgMyRating: formattedRatings.length > 0 ?
                (formattedRatings.reduce((sum, item) => sum + item.myRating, 0) / formattedRatings.length).toFixed(1) : '0.0',
            ratingDistribution: {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    };

        formattedRatings.forEach(item => {
            if (item.myRating >= 1 && item.myRating <= 5) {
            stats.ratingDistribution[item.myRating]++;
        }
    });

        res.render('myratings', {
            title: '我的评分 - MovieMatrix',
            username: username,
            ratings: formattedRatings,
            stats: stats
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


// support local visit
var server = app.listen(3000, '0.0.0.0', function () {
    var host = server.address().address;
    var port = server.address().port;
    console.log("movierecommend server start......");
    console.log("本地访问: http://localhost:%s", port);
    console.log("网络访问: http://%s:%s", host === '::' ? '0.0.0.0' : host, port);
});

app.get('/recommendprogress', (req, res) => {
    const userid = req.query.userid;

    const sql = "SELECT progress, step FROM recommendprogress WHERE userid = ?";

    connection.query(sql, [userid], (err, rows) => {
        if (err || rows.length === 0) {
            return res.json({
                status: "running",
                progress: 0,
                message: "初始化 Spark 推荐引擎..."
            });
        }

        const row = rows[0];
        res.json({
            status: row.progress >= 100 ? "completed" : "running",
            progress: row.progress,
            message: row.step
        });
    });
});

const { spawn } = require("child_process");

app.post('/startrecommend', (req, res) => {
    if (!req.session.isLoggedIn) {
        return res.status(403).json({ error: "请先登录" });
    }

    const userid = req.session.userId;

    // Spark 必须用绝对路径
    const sparkPath = "/usr/local/spark/bin/spark-submit";

    // ALS Jar 路径（绝对路径）
    const jarPath = "/home/hadoop/movierecommendapp/spark-backend/out/artifacts/Film_Recommend_Dataframe_jar/Film_Recommend_Dataframe.jar";

    // HDFS 数据路径（你之前给我的是这个）
    const dataPath = "/input_spark";

    console.log("启动 Spark 推荐任务", userid);

    const spark = spawn(sparkPath, [
        "--class", "recommend.MovieLensALS",
        jarPath,
        dataPath,
        userid
    ]);

    spark.stdout.on("data", d => console.log("Spark:", d.toString()));
    spark.stderr.on("data", d => console.error("Spark ERROR:", d.toString()));

    res.json({ status: "started" });
});

/**
 * 收藏夹相关API
 */

// 添加收藏（支持分类）
app.post('/api/favorites/add', function(req, res) {
    if (!req.session.isLoggedIn) {
        return res.status(401).json({ success: false, message: '请先登录' });
    }

    const userid = req.session.userId;
    const movieid = req.body.movieid;
    const category = req.body.category || 'liked'; // 默认为"喜欢"

    if (!movieid) {
        return res.status(400).json({ success: false, message: '缺少电影ID' });
    }

    // 验证分类
    const validCategories = ['want_watch', 'watched', 'liked'];
    if (!validCategories.includes(category)) {
        return res.status(400).json({ success: false, message: '无效的分类' });
    }

    // 检查是否已在该分类中收藏
    const checkSQL = "SELECT * FROM favorites WHERE userid = ? AND movieid = ? AND category = ?";
    connection.query(checkSQL, [userid, movieid, category], function(err, rows) {
        if (err) {
            console.error('检查收藏失败:', err);
            return res.status(500).json({ success: false, message: '数据库错误' });
        }

        if (rows.length > 0) {
            return res.json({ success: false, message: '已经收藏过了', alreadyExists: true });
        }

        // 添加收藏
        const insertSQL = "INSERT INTO favorites (userid, movieid, category) VALUES (?, ?, ?)";
        connection.query(insertSQL, [userid, movieid, category], function(err, result) {
            if (err) {
                console.error('添加收藏失败:', err);
                return res.status(500).json({ success: false, message: '添加收藏失败' });
            }

            res.json({ success: true, message: '收藏成功', category: category });
        });
    });
});

// 取消收藏
app.post('/api/favorites/remove', function(req, res) {
    if (!req.session.isLoggedIn) {
        return res.status(401).json({ success: false, message: '请先登录' });
    }

    const userid = req.session.userId;
    const movieid = req.body.movieid;

    if (!movieid) {
        return res.status(400).json({ success: false, message: '缺少电影ID' });
    }

    const deleteSQL = "DELETE FROM favorites WHERE userid = ? AND movieid = ?";
    connection.query(deleteSQL, [userid, movieid], function(err, result) {
        if (err) {
            console.error('取消收藏失败:', err);
            return res.status(500).json({ success: false, message: '取消收藏失败' });
        }

        res.json({ success: true, message: '已取消收藏' });
    });
});

// 获取用户的所有收藏（支持分类筛选）
app.get('/api/favorites/list', function(req, res) {
    if (!req.session.isLoggedIn) {
        return res.status(401).json({ success: false, message: '请先登录' });
    }

    const userid = req.session.userId;
    const category = req.query.category; // 可选：按分类筛选

    let selectSQL = `
        SELECT f.id, f.movieid, f.category, f.rating, f.note, f.createtime,
               m.moviename, m.picture, m.averating, m.typelist, m.releasetime, m.director
        FROM favorites f
        LEFT JOIN movieinfo m ON f.movieid = m.movieid
        WHERE f.userid = ?
    `;

    const params = [userid];

    if (category && ['want_watch', 'watched', 'liked'].includes(category)) {
        selectSQL += ' AND f.category = ?';
        params.push(category);
    }

    selectSQL += ' ORDER BY f.createtime DESC';

    connection.query(selectSQL, params, function(err, rows) {
        if (err) {
            console.error('获取收藏列表失败:', err);
            return res.status(500).json({ success: false, message: '获取收藏列表失败' });
        }

        res.json({ success: true, favorites: rows });
    });
});

// 获取收藏数量统计
app.get('/api/favorites/count', function(req, res) {
    if (!req.session.isLoggedIn) {
        return res.json({ success: true, count: 0, byCategory: {} });
    }

    const userid = req.session.userId;

    const countSQL = `
        SELECT
            category,
            COUNT(*) as count
        FROM favorites
        WHERE userid = ?
        GROUP BY category
    `;

    connection.query(countSQL, [userid], function(err, rows) {
        if (err) {
            console.error('获取收藏数量失败:', err);
            return res.status(500).json({ success: false, message: '获取收藏数量失败' });
        }

        const byCategory = {
            want_watch: 0,
            watched: 0,
            liked: 0
        };

        let totalCount = 0;

        rows.forEach(row => {
            byCategory[row.category] = row.count;
            totalCount += row.count;
        });

        res.json({
            success: true,
            count: totalCount,
            byCategory: byCategory
        });
    });
});

// 检查电影是否已收藏
app.get('/api/favorites/check/:movieid', function(req, res) {
    if (!req.session.isLoggedIn) {
        return res.json({ success: true, favorited: false });
    }

    const userid = req.session.userId;
    const movieid = req.params.movieid;

    const checkSQL = "SELECT * FROM favorites WHERE userid = ? AND movieid = ?";
    connection.query(checkSQL, [userid, movieid], function(err, rows) {
        if (err) {
            console.error('检查收藏状态失败:', err);
            return res.status(500).json({ success: false, message: '检查收藏状态失败' });
        }

        res.json({ success: true, favorited: rows.length > 0 });
    });
});

// 收藏夹页面
app.get('/favorites', function(req, res) {
    if (!req.session.isLoggedIn) {
        return res.redirect('/loginpage');
    }

    const userid = req.session.userId;
    const username = req.session.username;

    const selectSQL = `
        SELECT f.movieid, f.createtime, m.moviename, m.picture, m.averating, m.typelist, m.releasetime, m.director
        FROM favorites f
        LEFT JOIN movieinfo m ON f.movieid = m.movieid
        WHERE f.userid = ?
        ORDER BY f.createtime DESC
    `;

    connection.query(selectSQL, [userid], function(err, rows) {
        if (err) {
            console.error('获取收藏列表失败:', err);
            // 如果表不存在，返回空列表
            return res.render('favorites', {
                title: '我的收藏 - MovieMatrix',
                username: username,
                favorites: []
            });
        }

        // 格式化数据
        const favorites = rows.map(function(item) {
            return {
                id: item.movieid,
                title: item.moviename || '未知电影',
                poster: item.picture || 'https://via.placeholder.com/300x450?text=No+Image',
                rating: item.averating ? item.averating.toFixed(1) : '0.0',
                genres: item.typelist ? item.typelist.split(',').slice(0, 3) : [],
                releaseYear: item.releasetime ? new Date(item.releasetime).getFullYear() : '未知',
                director: item.director || '未知',
                addedDate: item.createtime
            };
        });

        res.render('favorites', {
            title: '我的收藏 - MovieMatrix',
            username: username,
            favorites: favorites
        });
    });
});