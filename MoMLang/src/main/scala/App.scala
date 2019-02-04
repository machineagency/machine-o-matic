import MoMLang._

object App {
    def main(args: Array[String]): Unit = {
        println(s"Input: ${args(0)}")
        println(MoMParser.parseAll(MoMParser.mblock, args(0)))
    }
}
