package MoMLang

import scala.util.parsing.combinator._

// class MoMParser extends JavaTokenParsers {
//     def mblock: Parser[Any] = "Machine"~ident~":\n"~mbody
//     def mbody: Parser[Any] = "pass"
// }

object MoMParser extends JavaTokenParsers {
    def program: Parser[Any] = msection~psection
    def msection: Parser[Any] = "Machine"~ident~"{"~opt(mbody)~"}"
    def psection: Parser[Any] = "Program"~ident~"{"~opt(pbody)~"}"
    // def mbody: Parser[Any] = "tool"~ident~"{"~opt(tbody)~"}"~
    //                          "stages"~"{"~opt(rep(sstat))~"}"~
    //                          "connections"~"{"~opt(rep(cstat))~"}"
    def mbody: Parser[Any] = tblock~sblock~cblock
    def tblock: Parser[Any] = "tool"~ident~"{"~opt(tbody)~"}"
    def sblock: Parser[List[StageNode]] = "stages"~"{"~rep(sstat)~"}" ^^
                                                { case _~_~sstats~_ => sstats }
    def cblock: Parser[List[ConnectionNode]] = "connections"~"{"~rep(cstat)~"}" ^^
                                                { case _~_~cstats~_ => cstats }
    def tbody: Parser[Any] = staccept~stposition~opt(rep(motordef))~opt(rep(actiondef))
    def sstat: Parser[StageNode] = ("linear" | "rotary")~"stage"~ident ^^
                                { case l~s~id => StageNode(name = id, stageType = l) }
    def cstat: Parser[ConnectionNode] = connection~"connectsto"~connection ^^
                                {
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

}

sealed trait Node

case class StageNode(val name: String, val stageType: String) extends Node

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

class ComponentNode(var name: String = null, var parent:ComponentNode = null,
                    var childrenByConnectionPlace:Map[String, ComponentNode] = Map[String, ComponentNode]()) {

}
