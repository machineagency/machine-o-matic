import MoMLang._

object App {
    val testProgram: String =
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
                x1.platform connectsto y.left
                x2.platform connectsto y.right
                pen connectsto y.platform
            }
        }

        Program DrawSquare {
            points Square source "~/points/square.csv"
            draw Square
        }
    """
    def main(args: Array[String]): Unit = {
        println(s"Input Program...")
        println(s"${testProgram}")
        println("Running parser...")
        println(MoMParser.parseAll(MoMParser.program, testProgram))
    }
}
