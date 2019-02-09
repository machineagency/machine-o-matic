package MoMLang

import scala.util.parsing.combinator._

// class MoMParser extends JavaTokenParsers {
//     def mblock: Parser[Any] = "Machine"~ident~":\n"~mbody
//     def mbody: Parser[Any] = "pass"
// }

object MoMParser extends JavaTokenParsers {
    def program: Parser[Any] = mblock~pblock
    def mblock: Parser[Any] = "Machine"~ident~"{"~opt(mbody)~"}"
    def pblock: Parser[Any] = "Program"~ident~"{"~opt(pbody)~"}"
    def mbody: Parser[Any] = "tool"~ident~"{"~opt(tbody)~"}"~
                             "stages"~"{"~opt(sbody)~"}"~
                             "connections"~"{"~opt(cbody)~"}"
    def tbody: Parser[Any] = staccept~stposition~opt(rep(motordef))~opt(rep(actiondef))
    def sbody: Parser[Any] = rep(("linear" | "rotary")~"stage"~ident)
    def cbody: Parser[Any] = rep(connection~"connectsto"~connection)
    def connection: Parser[Any] = (ident~"."~side
                                   | ident
                                   | "SURFACE"~directional)
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
}
