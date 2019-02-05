# Machine-o-Matic Language

Compile with

`sbt compile`

## Machine-o-Matic Grammar

TODO: format this better

*mblock* ::= Machine *identifier*: NEWLINE INDENT *mbody* DEDENT

*pblock* ::= Program *identifier*: NEWLINE IDENT *pbody* DEDENT

*mbody* ::= tool *identifier*: NEWLINE INDENT *tbody* stages: NEWLINE *sbody* connections: NEWLINE *cbody* DEDENT

*tbody* ::= *staccept* NEWLINE *stposition* NEWLINE [{ *motordef* }] NEWLINE [{ *actiondef* }]

*sbody* ::= {(linear | rotary) stage *identifier*}

*cbody* ::= {*identifier* connectsto *conection*}

*connection* ::= *identifier*.*side* | SURFACE *directional* | *identifier*

*directional* ::= ABOVE | BELOW | LEFT | RIGHT | FRONT | BACK

*staccept* ::= accepts([{*char*,} *char*])

*stposition* ::= position *directional*

*motordef* :: motor *identifier

*actiondef* ::= action *identifier*: NEWLINE INDENT *actiondefbody* DEDENT

*actiondefbody* :: = *identifier*.forward() | *identifier*.reverse() | *identifier*.stop() | *identifier*.start()

*pbody* ::= *pointsdef* [{ *actioncall* | *stdraw* }]

*actioncall* ::= *identifier*.*identifier*()

*stdraw* ::= draw *identifier*

*identifier* ::= < Java identifier >
