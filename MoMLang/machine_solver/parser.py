# NOTE: this is a quick and dirty parser and should probably be replaced

from collections import namedtuple
import re

f = open('test.mom')

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

def tokenize_line(fd):
    return fd.peek_line().split(" ")

def first_word(tokens):
    return tokens[0]

def tool_name(tokens):
    return tokens[0]

def accepts_tuple(tokens):
    lst = tokens[1:]
    lst = map(lambda s: s.replace("(", ""), broken_tuple)
    lst = map(lambda s: s.replace(")", ""), broken_tuple)
    lst = map(lambda s: s.replace(",", ""), broken_tuple)
    return tuple(lst)

def stage_name_type_axis(tokens):
    name = tokens[1]
    ttype = tokens[0]
    axis = re.search("[a-z]", tokens[3]).group()
    return (name, ttype, axis)

line = f.readline()

