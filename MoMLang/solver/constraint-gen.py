from collections import namedtuple

program = """tool Pen:
    accepts (x, y)

stages:
    linear stage y
    linear stage x1
    linear stage x2

connections:
    Pen -> y.platform
    y.left -> x1.platform
    y.right -> x2.platform
"""

Tool = namedtuple("Tool", "name, accepts")
Stage = namedtuple("Stage", "name, stage_type")
Connection = namedtuple("Connection", "from_stage, from_place, to_stage, to_place")

def buildComponentTree(tool, stages, connections):
    pass

tool = Tool("Pen", ("COORD_x", "COORD_y"))

stages = [
    Stage("y", "linear"),
    Stage("x1", "linear"),
    Stage("x2", "linear")
]

connections = [
    Connection("pen", None, "y", "platform"),
    Connection("y", "left", "x1", "platform"),
    Connection("y", "right", "x2", "platform")
]

print connections

