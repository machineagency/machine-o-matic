# Machine-o-Matic Language

Compile with

`sbt compile`

For now, try writing your own program in `App.scala` and parsing it. Run it with

`sbt run`

## Machine-o-Matic Grammar

*program* :: *mblock* *pblock*

*mblock* ::= Machine *identifier* {[*mbody*]}

*pblock* ::= Program *identifier* {[*pbody*]}

*mbody* ::= tool *identifier* {[*tbody*]} stages {[*sbody*]} connections {[*cbody*]}

*tbody* ::= *staccept* *stposition* [(*motordef*)\*] [(*actiondef*)\*]

*sbody* ::= ((linear | rotary) stage *identifier*)\*

*cbody* ::= {*connection* connectsto *connection*}

*connection* ::= *identifier*.*side* | *identifier* | SURFACE *directional*

*directional* ::= ABOVE | BELOW | LEFT | RIGHT | FRONT | BACK

*side* ::= leftEdge | rightEdge | left | middle | right | platform

*staccept* ::= accepts([(*char*,)\* *char*])

*stposition* ::= position *directional*

*motordef* :: motor *identifier*

*actiondef* ::= action *identifier* {[*actiondefbody*]}

*actiondefbody* :: = *identifier*.forward() | *identifier*.reverse() | *identifier*.stop() | *identifier*.start()

*pbody* ::= *pointsdef* [{ *actioncall* | *stdraw* }]

*pointsdef* ::= points *identifier* source *filepath*
                | points *identifier* [ (([(*char*,)\*] *char*))\* ]

*actioncall* ::= *identifier*.*identifier*()

*stdraw* ::= draw *identifier*

*char* ::= {a | ... | b}

*identifier* ::= < Java identifier >

*stringliteral* ::= < Java string literal >
