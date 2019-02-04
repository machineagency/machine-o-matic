package MoMLang

import scala.util.parsing.combinator._

class MoMParser extends JavaTokenParsers {
    def mblock: Parser[Any] = "Machine"~ident~":\n"~mbody
    def mbody: Parser[Any] = "pass"
}
