import MoMLang._

object ConfigReasoner {

    val easyProgram: String =
        """
Machine xyPlottter {
    tool pen {
        accepts (x, y)
        position ABOVE
    }

    stages {
        linear stage x1
        linear stage x2
        linear stage y
    }

    connections {
        pen connectsto y.platform
        y.left connectsto x1.platform
        y.right connectsto x2.platform
    }
}

Program DrawSquare {
    points Square source "~/points/square.csv"
    draw Square
}
        """

    // TODO: leadscrew constants

    // TODO: mapping function construction
    // e.g. f: D(3, 3, 4) -> R(20, 40)


    def main(args: Array[String]): Unit = {
        println("This is config reasoner")
        val parse = MoMParser.parse(MoMParser.program, easyProgram)
        val programMap = parse.get
        println(programMap)
        println("Trying to get one part")
        println(programMap("msection")("cblock"))
        println("Done")
    }

    def findParallelInvariants(astRoot: Node): List[List[Node]] = {
      return List[List[Node]]()
    }



    def treeByBfsLayers(astRoot: Node): List[List[Node]] = {
      return List[List[Node]]()
    }
}
