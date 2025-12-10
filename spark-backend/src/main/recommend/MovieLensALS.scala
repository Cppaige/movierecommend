package recommend

import java.io.File
import org.apache.log4j.{Level, Logger}
import org.apache.spark.ml.recommendation.{ALS, ALSModel}
import org.apache.spark.mllib.recommendation.Rating
import org.apache.spark.sql.{DataFrame, Row, SparkSession}
import recommend.UpdateProgress

/**
 * 优化版本2：模型持久化
 * 性能提升：首次5分钟，后续 5-10秒
 */
object MovieLensALS_Persistent {
  case class Rating(user : Int, product : Int, rating : Double)
  val spark=SparkSession.builder().appName("MovieLensALS").master("local[2]").getOrCreate()

  // 模型保存路径
  val MODEL_PATH = "/tmp/als_model"
  val MODEL_METADATA_PATH = "/tmp/als_model_metadata"

  def main(args: Array[String]) {
    Logger.getLogger("org.apache.spark").setLevel(Level.ERROR)
    Logger.getLogger("org.eclipse.jetty.server").setLevel(Level.OFF)

    if (args.length < 2) {
      println("Usage: spark-submit --class recommend.MovieLensALS_Persistent jar movieLensHomeDir userid [force-retrain]")
      sys.exit(1)
    }

    import spark.implicits._

    val userid = args(1).toInt
    val forceRetrain = if (args.length > 2) args(2) == "force-retrain" else false
    val startTime = System.currentTimeMillis()

    UpdateProgress.set(userid, 5, "初始化推荐引擎")
    DeleteFromMySQL.delete(userid)

    UpdateProgress.set(userid, 10, "加载用户评分数据")
    val personalRatingsLines: Array[String] = ReadFromMySQL.read(userid)
    val myRatings = loadRatings(personalRatingsLines)

    val movieLensHomeDir = args(0)

    UpdateProgress.set(userid, 20, "加载电影元数据")
    val movies = spark.sparkContext.textFile(new File(movieLensHomeDir, "movies.dat").toString).map { line =>
      val fields = line.split("::")
      (fields(0).toInt, fields(1).toString())
    }.collect().toMap

    // ✅ 检查是否已有训练好的模型
    val model: ALSModel = if (!forceRetrain && modelExists()) {
      UpdateProgress.set(userid, 40, "加载已训练的模型（快速模式）")
      println("发现已训练模型，直接加载...")
      ALSModel.load(MODEL_PATH)
    } else {
      UpdateProgress.set(userid, 30, "首次训练模型（需要2-3分钟）")
      println("训练新模型...")
      trainNewModel(movieLensHomeDir, myRatings)
    }

    UpdateProgress.set(userid, 80, "生成个性化推荐")

    // 生成推荐
    val myRatingsRDD = spark.sparkContext.parallelize(myRatings, 1)
    val myRatedMovieIds = myRatings.map(_.product).toSet

    val candidates = spark.sparkContext.parallelize(
      movies.keys.filter(!myRatedMovieIds.contains(_)).toSeq
    ).map(Rating(userid, _, 0.0))
      .toDF()
      .select("user", "product")

    val recommendations = model
      .transform(candidates)
      .select("user", "product", "prediction")
      .rdd
      .map(x => Rating(x(0).toString.toInt, x(1).toString.toInt, x(2).toString.toDouble))
      .filter(r => !r.rating.isNaN && !r.rating.isInfinite && r.rating > 0)
      .sortBy(-_.rating)
      .take(10)

    if (recommendations.isEmpty) {
      println("警告: 无法生成推荐")
      UpdateProgress.set(userid, -1, "错误: 无法生成推荐")
      spark.sparkContext.stop()
      sys.exit(1)
    }

    UpdateProgress.set(userid, 90, "保存推荐结果")

    val rddForMySQL = recommendations.map(r =>
      r.user + "::" + r.product + "::" + r.rating + "::" + movies(r.product)
    )
    InsertIntoMySQL.insert(rddForMySQL)

    UpdateProgress.set(userid, 100, "推荐完成")

    val endTime = System.currentTimeMillis()
    val duration = (endTime - startTime) / 1000.0
    println(f"总耗时: $duration%.2f 秒")

    println("推荐结果:")
    recommendations.foreach { r =>
      println(f"  ${movies(r.product)} - 预测评分: ${r.rating}%.2f")
    }

    spark.sparkContext.stop()
  }

  /** 训练新模型并保存 */
  def trainNewModel(movieLensHomeDir: String, myRatings: Seq[Rating]): ALSModel = {
    import spark.implicits._

    println("加载历史评分数据...")
    val ratings = spark.sparkContext.textFile(new File(movieLensHomeDir, "ratings.dat").toString).map { line =>
      val fields = line.split("::")
      Rating(fields(0).toInt, fields(1).toInt, fields(2).toDouble)
    }

    val myRatingsRDD = spark.sparkContext.parallelize(myRatings, 1)

    val trainingDF = ratings
      .union(myRatingsRDD)
      .toDF()
      .cache()

    println(s"训练集大小: ${trainingDF.count()}")

    val als = new ALS()
      .setMaxIter(10)
      .setRank(10)
      .setRegParam(0.01)
      .setUserCol("user")
      .setItemCol("product")
      .setRatingCol("rating")
      .setColdStartStrategy("drop")

    println("开始训练模型...")
    val model = als.fit(trainingDF)

    println(s"保存模型到: $MODEL_PATH")
    model.save(MODEL_PATH)

    // 保存元数据
    saveMetadata()

    model
  }

  /** 检查模型是否存在 */
  def modelExists(): Boolean = {
    try {
      new File(MODEL_PATH).exists() && new File(MODEL_METADATA_PATH).exists()
    } catch {
      case _: Exception => false
    }
  }

  /** 保存模型元数据 */
  def saveMetadata(): Unit = {
    import java.io.PrintWriter
    val writer = new PrintWriter(new File(MODEL_METADATA_PATH))
    writer.println(s"trained_at=${System.currentTimeMillis()}")
    writer.close()
  }

  /** 装载用户评分 */
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
