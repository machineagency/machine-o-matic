package MoMLang

import scala.util.parsing.combinator._

// class MoMParser extends JavaTokenParsers {
//     def mblock: Parser[Any] = "Machine"~ident~":\n"~mbody
//     def mbody: Parser[Any] = "pass"
// }

object MoMParser extends JavaTokenParsers {
    def program: Parser[Any] = mblock~opt(NL~pblock)
    def mblock: Parser[Any] = "Machine"~ident~NL~mbody
    def pblock: Parser[Any] = "Program"~ident~NL~pbody
    def mbody: Parser[Any] = "tool"~ident~NL~tbody~NL~
                             "stages:"~NL~sbody~NL~
                             "connections:"~NL~cbody
    def tbody: Parser[Any] = staccept~NL~stposition~opt(rep(motordef))~NL~opt(rep(actiondef))
    def sbody: Parser[Any] = rep(("linear" | "rotary")~"stage"~ident)
    def cbody: Parser[Any] = rep(ident~"connectsto"~connection)
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
    def actiondef: Parser[Any] = "action"~ident~":"~NL~actiondefbody
    def actiondefbody: Parser[Any] = (ident~".forward()"
                                      | ident~".reverse()"
                                      | ident~".stopt()"
                                      | ident~".start()")
    def pbody: Parser[Any] = pointsdef~opt(rep(actioncall~stdraw))
    // TODO: implement point arrays
    def pointsdef: Parser[Any] = "points"~ident~"source"~filepath
    def actioncall: Parser[Any] = ident~"."~ident~"()"
    def stdraw: Parser[Any] = "draw"~ident
    def char: Parser[Any] = """[a-z]""".r
    def filepath: Parser[Any] = "/" | rep("/"~stringLiteral)

    def NL: String = "\n"
    def INDENT: String = ""
    def DEDENT: String = ""
}
