package recommend
// 修改
import java.io.File
import org.apache.log4j.{Level, Logger}
import org.apache.spark.ml.recommendation.{ALS, ALSModel}
import org.apache.spark.mllib.recommendation.Rating
import org.apache.spark.rdd.RDD
import org.apache.spark.sql.{DataFrame, Row, SparkSession}
import org.apache.spark.{SparkConf, SparkContext}
import recommend.UpdateProgress


object MovieLensALS {
  case class Rating(user : Int, product : Int, rating : Double)
  val spark=SparkSession.builder().appName("MovieLensALS").master("local[2]").getOrCreate()

  def main(args: Array[String]) {
    // 屏蔽不必要的日志显示在终端上
    Logger.getLogger("org.apache.spark").setLevel(Level.ERROR)
    Logger.getLogger("org.eclipse.jetty.server").setLevel(Level.OFF)
    if (args.length != 2) {
      println("Usage: /usr/local/spark/bin/spark-submit --class recommend.MovieLensALS " +
        "Spark_Recommend_Dataframe.jar movieLensHomeDir userid")
      sys.exit(1)
    }
    // 设置运行环境
    import spark.implicits._

    // 装载参数二,即用户评分,该评分由评分器生成
    val userid=args(1).toInt;
    UpdateProgress.set(userid, 5, "初始化 Spark 引擎")
    //删除该用户之前已经存在的电影推荐结果，为本次写入最新的推荐结果做准备
    DeleteFromMySQL.delete(userid)
    UpdateProgress.set(userid, 10, "清空历史推荐结果")
    //从关系数据库中读取该用户对一些电影的个性化评分数据
    val personalRatingsLines:Array[String]=ReadFromMySQL.read(userid)
    UpdateProgress.set(userid, 20, "加载用户个性评分")
    val myRatings = loadRatings(personalRatingsLines)
    UpdateProgress.set(userid, 30, "评分数据处理完毕")
    val myRatingsRDD = spark.sparkContext.parallelize(myRatings, 1)

    // 样本数据目录
    val movieLensHomeDir = args(0)
    // 装载样本评分数据,其中最后一列 Timestamp 取除 10 的余数作为 key,Rating 为值,即(Int,Rating)
    //ratings.dat 原始数据:用户编号、电影编号、评分、评分时间戳
    val ratings = spark.sparkContext.textFile(s"$movieLensHomeDir/ratings.dat").map { line =>
      val fields = line.split("::")
      (fields(3).toLong % 10, Rating(fields(0).toInt, fields(1).toInt,
        fields(2).toDouble))
    }

    UpdateProgress.set(userid, 40, "加载 MovieLens 大数据集")

    //装载电影目录对照表(电影 ID->电影标题)
    //movies.dat 原始数据:电影编号、电影名称、电影类别
    val movies = spark.sparkContext.textFile(s"$movieLensHomeDir/movies.dat").map { line =>
      val fields = line.split("::")
      (fields(0).toInt, fields(1).toString())
    }.collect().toMap

    val numRatings = ratings.count()
    val numUsers = ratings.map(_._2.user).distinct().count()
    val numMovies = ratings.map(_._2.product).distinct().count()

    println(s"数据集统计: $numRatings 条评分, $numUsers 个用户, $numMovies 部电影")

    // 将样本评分表以 key 值切分成 3 个部分,分别用于训练 (60%,并加入用户评分), 校验 (20%), and 测试 (20%)
    // 该数据在计算过程中要多次应用到,所以 cache 到内存
    val numPartitions = 4
    // training 训练样本数据


    val trainingDF = ratings.filter(x => x._1 < 6) //取评分时间除 10 的余数后值小于 6 的作为训练样本
      .values
      .union(myRatingsRDD) //注意 ratings 是(Int,Rating),取 value 即可
      .toDF()
      .repartition(numPartitions)
      .cache()

    // validation 校验样本数据
    val validationDF = ratings.filter(x => x._1 >= 6 && x._1 < 8) //取评分时间除 10 的余数后值大于等于 6 且小于 8 分的作为校验样本
      .values
      .toDF()
      .repartition(numPartitions)
      .cache()

    // test 测试样本数据

    val testDF = ratings.filter(x => x._1 >= 8).values.toDF().cache() //取评分时间除 10 的余数后值大于等于 8 分的作为测试样本
    val numTraining = trainingDF.count()
    val numValidation = validationDF.count()
    val numTest = testDF.count()

    println(s"数据集划分: 训练集 $numTraining, 验证集 $numValidation, 测试集 $numTest")

    // 检查数据集是否有效
    if (numTraining == 0) {
      println("错误: 训练集为空")
      UpdateProgress.set(userid, -1, "错误: 训练集为空")
      sys.exit(1)
    }
    if (numValidation < 10) {
      println(s"警告: 验证集数据量太少 ($numValidation 条)，建议至少100条")
    }

    // 训练不同参数下的模型,并在校验集中验证,获取最佳参数下的模型
    val ranks = List(8, 12) //模型中隐语义因子的个数
    val lambdas = List(0.1, 10.0) //是 ALS 的正则化参数
    val numIters = List(10, 20) //迭代次数
    var bestModel: Option[ALSModel] = None //最好的模型
    var bestValidationRmse = Double.MaxValue //最好的校验均方根误差
    var bestRank = 0 //最好的隐语义因子的个数
    var bestLambda = 0.0  //最好的ALS正则化参数
    var bestNumIter = 0  //最好的迭代次数

    println("开始训练模型，尝试不同参数组合...")

    for (rank <- ranks; lambda <- lambdas; numIter <- numIters) {
      try {
        UpdateProgress.set(userid, 60, s"训练模型 rank=$rank λ=$lambda iter=$numIter")
        println(s"训练模型: rank=$rank, lambda=$lambda, iter=$numIter")

        val als = new ALS()
          .setMaxIter(numIter)
          .setRank(rank)
          .setRegParam(lambda)
          .setUserCol("user")
          .setItemCol("product")
          .setRatingCol("rating")
        //.setColdStartStrategy("drop") // 处理冷启动问题

        val model = als.fit(trainingDF) // 训练样本、隐语义因子的个数、迭代次数、ALS 的正则化参数

        // 校验模型结果
        val validationRmse = computeRmse(model, validationDF, numValidation)

        println(f"  RMSE = $validationRmse%.4f")

        // 检查 RMSE 是否有效
        if (!validationRmse.isNaN && !validationRmse.isInfinite && validationRmse < bestValidationRmse) {
          bestModel = Some(model)
          bestValidationRmse = validationRmse
          bestRank = rank
          bestLambda = lambda
          bestNumIter = numIter
          println(f"  ★ 找到更好的模型！RMSE = $validationRmse%.4f")
        }
      } catch {
        case e: Exception =>
          println(s"  训练失败: ${e.getMessage}")
          e.printStackTrace()
      }
    }

    // 检查是否找到最佳模型
    if (bestModel.isEmpty) {
      println("错误: 无法找到有效的模型")
      UpdateProgress.set(userid, -1, "错误: 模型训练失败")

      // 尝试使用默认参数训练一个简单模型
      println("尝试使用默认参数训练模型...")
      try {
        val als = new ALS()
          .setMaxIter(10)
          .setRank(10)
          .setRegParam(0.01)
          .setUserCol("user")
          .setItemCol("product")
          .setRatingCol("rating")
        //.setColdStartStrategy("drop")

        bestModel = Some(als.fit(trainingDF))
        println("使用默认参数成功训练模型")
      } catch {
        case e: Exception =>
          println(s"默认参数训练也失败: ${e.getMessage}")
          spark.sparkContext.stop()
          sys.exit(1)
      }
    }

    println(f"\n最佳模型参数: rank=$bestRank, lambda=$bestLambda, iter=$bestNumIter, RMSE=$bestValidationRmse%.4f")
    UpdateProgress.set(userid, 80, "最佳模型已找到，生成推荐中")

    // 用最佳模型预测测试集的评分,并计算和实际评分之间的均方根误差
    val testRmse = computeRmse(bestModel.get, testDF, numTest)
    println(f"测试集 RMSE = $testRmse%.4f")

    //创建一个基准(Naïve Baseline),并把它和最好的模型进行比较
    val meanRating = trainingDF.union(validationDF).select("rating").rdd.map{case Row(v : Double) => v}.mean
    val baselineRmse = math.sqrt(testDF.select("rating").rdd.map{case Row(v : Double) => v}.map(x => (meanRating - x) * (meanRating - x)).mean)
    //改进了基准的最佳模型
    val improvement = (baselineRmse - testRmse) / baselineRmse * 100

    println(f"基准 RMSE = $baselineRmse%.4f, 改进幅度 = $improvement%.2f%%")

    // 推荐前十部最感兴趣的电影,注意要剔除用户已经评分的电影
    val myRatedMovieIds = myRatings.map(_.product).toSet

    val candidates = spark.sparkContext.parallelize(movies.keys.filter(!myRatedMovieIds.contains(_)).toSeq).map(Rating(userid,_,0.0))
      .toDF().select("user","product")
    //上面的Rating(userid,_,0.0)中，0.0是赋予的初始评分值
    val recommendations = bestModel.get
      .transform(candidates).select("user","product","prediction").rdd
      .map(x => Rating(x(0).toString.toInt,x(1).toString.toInt,x(2).toString.toDouble))
      .filter(_.rating > 0) // 只保留正评分
      .sortBy(-_.rating)
      .take(10)

    if (recommendations.isEmpty) {
      println("警告: 无法生成推荐，可能是数据量不足")
      UpdateProgress.set(userid, -1, "错误: 无法生成推荐")
      spark.sparkContext.stop()
      sys.exit(1)
    }

    //把推荐结果写入数据库
    val rddForMySQL=recommendations.map(r=>r.user + "::"+ r.product + "::"+ r.rating+"::" + movies(r.product))
    InsertIntoMySQL.insert(rddForMySQL)
    UpdateProgress.set(userid, 100, "推荐完成")
    var i = 1
    println("Movies recommended for you(用户 ID:推荐电影 ID:推荐分数:推荐电影名称):")
    recommendations.foreach { r =>
      println(r.user + ":" + r.product + ":" + r.rating + ":" + movies(r.product))
      i += 1
    }
    spark.sparkContext.stop()
  }

  /** 校验集预测数据和实际数据之间的均方根误差 **/
  //输入训练模型、校验样本、校验个数
  def computeRmse(model: ALSModel, df: DataFrame, n: Long): Double = {
    import spark.implicits._

    // 修复：使用全部数据而不是只取10条
    val predictions = model.transform(df.select("user","product"))

    // 输出 predictionsAndRatings 预测和评分
    val predictionsAndRatings = predictions.select("user","product","prediction").rdd
      .map(x => ((x(0),x(1)),x(2)))
      .join(df.select("user","product","rating").rdd.map(x => ((x(0),x(1)),x(2))))
      .values
      .collect() // 收集全部数据

    if (predictionsAndRatings.isEmpty) {
      println("警告: 预测结果为空")
      return Double.MaxValue
    }

    // 过滤掉 NaN 和无穷大的预测值
    val validPredictions = predictionsAndRatings.filter { case (pred, actual) =>
      val p = pred.toString.toDouble
      val a = actual.toString.toDouble
      !p.isNaN && !p.isInfinite && !a.isNaN && !a.isInfinite
    }

    if (validPredictions.isEmpty) {
      println("警告: 没有有效的预测值")
      return Double.MaxValue
    }

    val mse = validPredictions.map { case (pred, actual) =>
      val p = pred.toString.toDouble
      val a = actual.toString.toDouble
      val diff = p - a
      diff * diff
    }.sum / validPredictions.length

    math.sqrt(mse)
  }

  /** 装载用户评分文件 **/
  def loadRatings(lines: Array[String]): Seq[Rating] = {
    val ratings = lines.map { line =>
      val fields = line.split("::")
      Rating(fields(0).toInt, fields(1).toInt, fields(2).toDouble)
    }.filter(_.rating > 0.0)
    if (ratings.isEmpty) {
      sys.error("No ratings provided.")
    } else {
      ratings.toSeq
    }
  }

}
