import MoMLang._

object App {
    val testProgram: String =
    """
    Machine myMachine:
        pass
    """
    def main(args: Array[String]): Unit = {
        println(s"Input Program: ${testProgram}")
        println(MoMParser.parseAll(MoMParser.mblock, testProgram))
    }
}
