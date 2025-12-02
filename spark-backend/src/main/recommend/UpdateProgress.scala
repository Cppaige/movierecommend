package recommend

import java.sql.{Connection, DriverManager}

object UpdateProgress {
  val url = "jdbc:mysql://localhost:3306/movierecommend"
  val user = "root"
  val password = "202325330111"

  def set(userid: Int, progress: Int, step: String): Unit = {
    Class.forName("com.mysql.jdbc.Driver")
    val conn = DriverManager.getConnection(url, user, password)
    val stmt = conn.prepareStatement("REPLACE INTO recommendprogress(userid, progress, step) VALUES (?, ?, ?)")
    stmt.setInt(1, userid)
    stmt.setInt(2, progress)
    stmt.setString(3, step)
    stmt.executeUpdate()
    stmt.close()
    conn.close()
  }
}