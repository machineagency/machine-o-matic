import MoMLang._

object App {
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

    val mediumProgram: String =
        """
        Machine yPlatformPrinter {
            tool PrintHead {
                accepts (x, y, z)
                position ABOVE
                motor E
                action BeginExtrude {
                    E.forward()
                }
                action BeginRetract {
                    E.reverse()
                }
                action StopExtrudeOrRetract {
                    E.stop()
                }
            }

            stages {
                linear stage z1
                linear stage z2
                linear stage x
                linear stage y
            }

            connections {
                z1 connectsto x.leftEdge
                z2 connectsto x.rightEdge
                PrintHead connectsto x.platform
                y connectsto WORK_SURFACE BELOW
            }
        }

        Program PrintFile {
            points onePart source "~/points/part_sliced.csv"
            PrintHead.BeginExtrude()
            draw onePart
            PrintHead.StopExtrudeOrRetract()
        }
        """

    // def main(args: Array[String]): Unit = {
    //     println(s"Input Program...")
    //     println(s"${mediumProgram}")
    //     println("Running parser...")
    //     println(MoMParser.parseAll(MoMParser.program, mediumProgram))
    // }
}
