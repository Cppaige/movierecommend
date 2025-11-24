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
app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())
app.use(express.static('public'));

/**
 * 配置MySQL
 */
var connection = mysql.createConnection({
    host     : '127.0.0.1',
    user     : 'root',
    password : 'xiaojia0806',
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
        for (var i=0;i<movieNumbers;i++){
            var index=randomFrom(lowerValue,upperValue);
            movielist.push({
                movieid:movieinfolist[index].movieid,
                moviename:movieinfolist[index].moviename,
                picture:movieinfolist[index].picture
            });
        }

        res.render('index',{
            title:'MovieMatrix - 智能电影推荐',
            isLogin: true,
            userid: rows[0].userid,
            username: rows[0].username,
            ratedMovies: []
        });
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

app.post('/submituserscore',function (req,res) {
    var  userid=req.body.userid;
    var moviescores=[];
    var movieids=[];
    req.body.moviescore.forEach(function(score){
        //console.log('the score is:'+score);
        moviescores.push({moviescore:score});
    });
    req.body.movieid.forEach(function(id){
        //console.log('the id is:'+id);
        movieids.push({movieid:id});
    });

    //for(var item in movieids){
    //   console.log('item is:'+item);
    //   console.log('movieid is:'+movieids[item].movieid);
    //}
    //for(var item in moviescores){
    //   console.log('item is:'+item);
    //   console.log('moviescore is:'+moviescores[item].moviescore);
    //}
    //删除该用户历史评分数据，为写入本次最新评分数据做准备
    connection.query('delete from  personalratings where userid='+userid, function(err, result) {
        if (err) throw err;
        console.log('deleted');
        //console.log(result);
        //console.log('\n');
    });
    //生成评分时间戳
    var mytimestamp =new Date().getTime().toString().slice(1,10);
    //console.log('mytimestamp2 is:'+mytimestamp);
    for(var item in movieids){
        //把每条评分记录(userid,movieid,rating,timestamp)插入数据库
        var personalratings={userid:userid,movieid:movieids[item].movieid,rating:moviescores[item].moviescore,timestamp:mytimestamp};
        connection.query('insert into personalratings set ?',personalratings,function (err,rs) {
        if (err) throw  err;
        console.log('insert into personalrating success');
        });
    }
    var selectUserIdNameSQL='select userid,username from user where userid='+userid;
    connection.query(selectUserIdNameSQL,function(err,rows,fields){
        if (err) throw  err;
        res.render('userscoresuccess',{title:'Personal Rating Success',user:rows[0]});
    });

});

/**
 * 调用Spark程序为用户推荐电影并把推荐结果写入数据库,把推荐结果显示到网页
 */
app.get('/recommendmovieforuser',function (req,res) {
//console.log('result point 1');
    const userid=req.query.userid;
    const username=req.query.username;
    //console.log('recommendation userid is:'+userid);
    const path = '/input_spark';
    //调用Spark程序为用户推荐电影并把推荐结果写入数据库
    var spark_submit = spawnSync('/usr/local/spark/bin/spark-submit',[
        '--class',
        'recommend.MovieLensALS',
        '~/IdeaProjects/Film_Recommend/out/artifacts/Film_Recommend_jar/Film_Recommend.jar',
        path,
        userid
    ], {
        shell: true,
        encoding: 'utf8'
    });    //console.log('spark running result is:'+spark_submit.stdout);
    //从数据库中读取推荐结果,把推荐结果显示到网页
    var selectRecommendResultSQL="select recommendresult.userid,recommendresult.movieid,recommendresult.rating,recommendresult.moviename,movieinfo.picture from recommendresult inner join movieinfo on recommendresult.movieid=movieinfo.movieid where recommendresult.userid="+userid;
    var movieinfolist=[];
    connection.query(selectRecommendResultSQL,function(err,rows,fields){
        if (err) throw  err;
        //console.log('result point 3');
        //console.log('movieids length is:'+rows.length);
        //console.log('movieid is:'+rows[0].movieid);
        //console.log('moviename is:'+rows[0].moviename);
        console.log('read recommend result from database');

        for (var i=0;i<rows.length;i++){
            console.log('forxunhuan:i='+i);
            movieinfolist.push({userid:rows[i].userid,movieid:rows[i].movieid,rating:rows[i].rating,moviename:rows[i].moviename,picture:rows[i].picture});
        }

        //for(var item in movieinfolist){
        //   console.log('result point 6');
        //   console.log('item is:'+item);
        //   console.log('userid is:'+movieinfolist[item].userid);
        //   console.log('movieid is:'+movieinfolist[item].movieid);
        //   console.log('moviename is:'+movieinfolist[item].moviename);
        //   console.log('rating is:'+movieinfolist[item].rating);
        //   console.log('picture is:'+movieinfolist[item].picture);
        //}

        res.render('recommendresult', {title: 'Recommend Result', message: 'this is recommend for you',username:username,movieinfo:movieinfolist})
        });

});

var server = app.listen(3000, '0.0.0.0', function () {
    var host = server.address().address;
    var port = server.address().port;
    console.log("movierecommend server start......");
    console.log("本地访问: http://localhost:%s", port);
    console.log("网络访问: http://%s:%s", host === '::' ? '0.0.0.0' : host, port);
});