package MoMLang

import scala.util.parsing.combinator._

object MoMParser extends JavaTokenParsers {
    def program: Parser[Map[String, Map[String, Any]]] = msection~psection ^^ {
        case msection~psection => Map("msection" -> msection, "psection" -> psection)
    }
    def msection: Parser[Map[String, Any]] = "Machine"~ident~"{"~mbody~"}" ^^ {
        case _~_~_~mbody~_ => mbody
    }
    def psection: Parser[Map[String, Any]] = "Program"~ident~"{"~pbody~"}" ^^ {
        case _ => Map[String, Any]() // TODO: implement
    }
    def mbody: Parser[Map[String, Any]] = tblock~sblock~cblock ^^ {
        case tblock~sblock~cblock => Map("tblock" -> tblock, "sblock" ->sblock, "cblock" -> cblock)
    }
    def tblock: Parser[ToolNode] = "tool"~ident~"{"~tbody~"}" ^^ {
        case _~id~_~tbody~_ => tbody
    }
    def sblock: Parser[List[StageNode]] = "stages"~"{"~rep(sstat)~"}" ^^
                                                { case _~_~sstats~_ => sstats }
    def cblock: Parser[List[ConnectionNode]] = "connections"~"{"~rep(cstat)~"}" ^^
                                                { case _~_~cstats~_ => cstats }
    def tbody: Parser[ToolNode] = staccept~stposition~opt(rep(motordef))~opt(rep(actiondef)) ^^ {
        case staccept~stposition~_~_ => ToolNode(evalStAccept(staccept), evalStPosition(stposition))
    }
    def sstat: Parser[StageNode] = ("linear" | "rotary")~"stage"~ident ^^ {
        case l~s~id => StageNode(name = id, stageType = l)
    }
    def cstat: Parser[ConnectionNode] = connection~"connectsto"~connection ^^ {
        case c0~_~c1 => ConnectionNode(evalConnection(c0), evalConnection(c1))
    }
    def connection: Parser[Any] = (ident~"."~side
                                   | "SURFACE"~directional
                                   | ident)
    def directional: Parser[Any] = ("ABOVE"
                                    | "BELOW"
                                    | "LEFT"
                                    | "RIGHT"
                                    | "FRONT"
                                    | "BACK")
    def side: Parser[Any] = ("leftEdge"
                             | "rightEdge"
                             | "left"
                             | "middle"
                             | "right"
                             | "platform")
    def staccept: Parser[Any] = "accepts ("~opt(rep(char~",")~char)~")"
    def stposition: Parser[Any] = "position"~directional
    def motordef: Parser[Any] = "motor"~ident
    def actiondef: Parser[Any] = "action"~ident~"{"~opt(actiondefbody)~"}"
    def actiondefbody: Parser[Any] = rep(ident~".forward()"
                                      | ident~".reverse()"
                                      | ident~".stop()"
                                      | ident~".start()")
    def pbody: Parser[Any] = pointsdef~opt(rep(actioncall | stdraw))
    // TODO: implement point arrays
    def pointsdef: Parser[Any] = "points"~ident~"source"~stringLiteral
    def actioncall: Parser[Any] = ident~"."~ident~"()"
    def stdraw: Parser[Any] = "draw"~ident
    def char: Parser[Any] = """[a-z]""".r

    // TODO: handle comments

    /**
     * Returns a tuple representing one side of a connection statement, either:
     * (TOOL, *toolName*), (SURFACE, *directional*), or (*stageName*, *place*)
     */
    def evalConnection(subtree: Any): (String, String) = subtree match {
        case stage~"."~place => (stage.toString(), place.toString())
        case "SURFACE"~directional => ("SURFACE", directional.toString())
        case tool => ("TOOL", tool.toString())
    }

    def evalStAccept(subtree: Any): List[String] = subtree match {
        case "accepts ("~coordString~")" => coordString.toString()
                                        .split(",").map(_.trim).toList
        case _ => List[String]()
    }

    def evalStPosition(subtree: Any): String = subtree match {
        case "position"~directional => directional.toString()
        case _ => "UNDEFINED_POSITION"
    }

    def buildCTree(tNode: ToolNode, sNodes: List[StageNode], cNodes: List[ConnectionNode],
                 pNodes: Any): Node = {
        /* Initialize a dummy stage node for the surface. This acts as the root. */
        val surfaceStageNode = StageNode("SURFACE", "__SURFACE");

        /* The tool must be the surface's child. */
        surfaceStageNode.children = Vector[(Node, String)]((tNode, "__TOOL"));

        /* Recurse on the toolNode. */
        buildSubCTree(tNode, cNodes)

        return ToolNode(coords = List("x", "y"), directional = "ABOVE")
    }

    def buildSubCTree(node: Node, cNodes: List[ConnectionNode]): Node = {
        // BC: iff list is empty return NODE
        // Go thru list of parent -> child nodes
        // Find child node corresponding to NODE, which is parent
        // return node + children + subtree
        if (cNodes.length == 0) {
          return 
        }
        return node
    }

}

sealed trait Node {
  var children: Vector[(Node, String)] = Vector[(Node, String)]()
}

case class ToolNode(val coords: List[String], val directional: String,
                    val actions: List[String] = List[String]()) extends Node {

}

case class StageNode(val name: String, val stageType: String) extends Node {

}

case class ConnectionNode(val connection0: (String, String),
                          val connection1: (String, String)) extends Node {
    val parentName = connection0._1 match {
        case "TOOL" => connection0._2
        case "SURFACE" => connection0._2
        case _ => connection0._1
    }
    val parentPlace = connection0._1 match {
        case "TOOL" | "SURFACE" => null
        case _ => connection0._2
    }
    val childName = connection1._1 match {
        case "TOOL" => connection1._2
        case "SURFACE" => connection1._2
        case _ => connection1._1
    }
    val childPlace = connection1._1 match {
        case "TOOL" | "SURFACE" => null
        case _ => connection1._2
    }

    override def toString = {
        s"CNODE(${parentName} @ ${parentPlace} -> ${childName} @ ${childPlace})"
    }
}

