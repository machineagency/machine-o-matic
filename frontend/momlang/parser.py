# NOTE: this is a quick and dirty parser and should probably be replaced

from collections import namedtuple
import re

AST = namedtuple("AST", "tool, stages, connections")
Node = namedtuple("Node", "name, axis, children")
Tool = namedtuple("Tool", "name, accepts")
Stage = namedtuple("Stage", "name, type, axis, transfer")
Connection = namedtuple("Connection", "from_stage, from_place, to_stage, to_place")

tool = None
stages = []
connections = []

def peek_line(f):
    pos = f.tell()
    line = f.readline()
    f.seek(pos)
    return line

def nl(f):
    """
    Next line alias
    """
    return f.readline()

def tokenize(s):
    return s.strip().split(" ")

def first_word(tokens):
    return tokens[0]

def tool_name(tokens):
    return tokens[1].replace(":", "")

def accepts_tuple(tokens):
    lst = tokens[1:]
    lst = map(lambda s: s.replace("(", ""), lst)
    lst = map(lambda s: s.replace(")", ""), lst)
    lst = map(lambda s: s.replace(",", ""), lst)
    return tuple("AXIS_" + letter for letter in lst)

def stage_name_type_axis(tokens):
    name = tokens[1]
    ttype = tokens[0]
    axis = "AXIS_" + re.search("\((.*?)\)", tokens[3]).group(1)
    return (name, ttype, axis)

def connection_tuple_from_string(string):
    both_sides = string.split("->")
    stage_places = map(lambda s: s.strip().split("."), both_sides)
    if len(stage_places[0]) == 1:
        if stage_places[0][0] == "SURFACE":
            stage_places[0].append("SURFACE_CONNECT")
        else:
            stage_places[0].append("TOOL_CONNECT")
    flattened = [item for sublist in stage_places for item in sublist]
    return tuple(flattened)

class MoMParser():

    @staticmethod
    def parse(filename):
        f = open(filename)
        name = tool_name(tokenize(nl(f)))
        accepts = accepts_tuple(tokenize(nl(f)))
        tool = Tool(name, accepts)

        while nl(f) == "\n":
            pass

        while peek_line(f) != "\n":
            nta = stage_name_type_axis(tokenize(nl(f)))
            transfer = nl(f).strip()
            stage = Stage(nta[0], nta[1], nta[2], transfer)
            stages.append(stage)

        while nl(f) == "\n":
            pass

        while peek_line(f) != "\n":
            tp = connection_tuple_from_string(nl(f))
            connection = Connection(tp[0], tp[1], tp[2], tp[3])
            connections.append(connection)

        # FIXME: add implicit surface statement
        surface_cxn = Connection("SURFACE", "SURFACE_CONNECT", tool.name, "BELOW")
        connections.append(surface_cxn)

        ast = AST(tool, stages, connections)
        return ast

