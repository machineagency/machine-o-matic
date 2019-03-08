# MoM Domain Specific Language

This directory contains files 

`_archived`: old Scala implementation of MoM
`solver`: current Python implementation.

## Usage as of 2019_03_08

Go to the `solver/` directory and then open `machine_solver.py` and manually construct the AST e.g. the program:

```
tool Pen:
    accepts (x, y)

stages:
    linear y -> A(y):
        step -> 0.03048 mm
    linear x1 -> A(x):
        step -> 0.03048 mm
    linear x2 -> A(x):
        step -> 0.03048 mm

connections:
    Pen -> y.platform
    y.left -> x1.platform
    y.right -> x2.platform
```

when parsed, corresponds to the AST:

```
# AST = (tool, stages, connections)

tool = Tool("Pen", ("AXIS_x", "AXIS_y"))

stages = [
    Stage("y", "linear", "AXIS_y", "step -> 0.03048 mm"),
    Stage("x1", "linear", "AXIS_x", "step -> 0.03048 mm"),
    Stage("x2", "linear", "AXIS_x", "step -> 0.03048 mm"),
]

connections = [
    Connection("SURFACE", "SURFACE_CONNECT", "Pen", "BELOW"), # implicit
    Connection("Pen", "TOOL_CONNECT", "y", "platform"),
    Connection("y", "left", "x1", "platform"),
    Connection("y", "right", "x2", "platform")
]
```

Because I have not yet implemented an updated parser, you will have to construct the AST yourself for now.

Once you create the AST, run:

`$ python machine_solver.py`

Assuming that goes okay, run:

`$ python interpreter.py`

You should get a prompt where you can type in `move` instructions, e.g.

`machine > move 10 10`

Which moves the tool to $(10, 10)$. The number of arguments that the move instruction takes corresponds to the number of arguments in the `accepts` statement.