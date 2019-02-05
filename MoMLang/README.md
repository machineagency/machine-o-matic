# Machine-o-Matic Language

Compile with

`sbt compile`

For now, try writing your own program in `App.scala` and parsing it. Run it with

`sbt run`

## Machine-o-Matic Grammar

TODO: format this better

*program* :: *mblock* [NEWLINE *pblock*]

*mblock* ::= Machine *identifier*: NEWLINE INDENT *mbody* DEDENT

*pblock* ::= Program *identifier*: NEWLINE IDENT *pbody* DEDENT

*mbody* ::= tool *identifier*: NEWLINE INDENT *tbody* NEWLINE stages: NEWLINE *sbody* NEWLINE connections: NEWLINE *cbody* DEDENT

*tbody* ::= *staccept* NEWLINE *stposition* NEWLINE [{ *motordef* }] NEWLINE [{ *actiondef* }]

*sbody* ::= {(linear | rotary) stage *identifier*}

*cbody* ::= {*identifier* connectsto *conection*}

*connection* ::= *identifier*.*side* | SURFACE *directional* | *identifier*

*directional* ::= ABOVE | BELOW | LEFT | RIGHT | FRONT | BACK

*side* ::= leftEdge | rightEdge | left | middle | right | platform

*staccept* ::= accepts([{*char*,} *char*])

*stposition* ::= position *directional*

*motordef* :: motor *identifier*

*actiondef* ::= action *identifier*: NEWLINE INDENT *actiondefbody* DEDENT

*actiondefbody* :: = *identifier*.forward() | *identifier*.reverse() | *identifier*.stop() | *identifier*.start()

*pbody* ::= *pointsdef* [{ *actioncall* | *stdraw* }]

*pointsdef* ::= points *identifier* source *filepath*
                | points *identifier* \[ {([{*char*,}] *char*)} \]

*actioncall* ::= *identifier*.*identifier*()

*stdraw* ::= draw *identifier*

*char* ::= {a | ... | b}

*filepath* ::= / | {/*stringliteral*}

*identifier* ::= < Java identifier >

*stringliteral* ::= < Java string literal >
