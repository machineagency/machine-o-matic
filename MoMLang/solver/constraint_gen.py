from collections import namedtuple

program = """tool Pen:
    accepts (x, y)

stages:
    linear stage y : y
    linear stage x1 : x
    linear stage x2 : x

connections:
    Pen -> y.platform
    y.left -> x1.platform
    y.right -> x2.platform
"""
Node = namedtuple("Node", "name, children")
Tool = namedtuple("Tool", "name, accepts")
Stage = namedtuple("Stage", "name, stage_type, axis")
Connection = namedtuple("Connection", "from_stage, from_place, to_stage, to_place")

def build_coomponent_tree(tool, connections):
    """
    Assumes we have a complete set of connections and stages
    Missing connections will cause problems
    """
    if (not tool or not stages or not connections):
        return Node("EMPTY", frozenset([]))
    surface_connection = \
            filter(lambda connection: connection.from_stage == "SURFACE", \
                             connections)[0]
    connections_without_surface = frozenset( \
            filter(lambda connection: connection.from_stage != "SURFACE", \
                                      connections))
    return Node("SURFACE", \
                frozenset([(build_subtree(surface_connection.to_stage, \
                    connections_without_surface), \
                    surface_connection.from_place)]))

def build_subtree(subtree_root_name, connections):
    """
    Returns the root node of a tree, where the root node represents the stage
    with the name SUBTREE_ROOT_NAME, and where the node has children which is a
    frozen set with tuples (subsubtree: Node, connection_place: String)
    """
    # TODO: base case -- seems to work without an explicit one...?
    node_connections = \
            frozenset(filter(lambda connection: connection.from_stage == subtree_root_name,
                    connections))
    connections_without_node = connections - node_connections
    children = frozenset([(build_subtree(connection.to_stage, connections_without_node), \
                 connection.from_place) for connection in node_connections])
    node = Node(subtree_root_name, children)
    return node

# AST = (tool, stages, connections) 

tool = Tool("Pen", ("COORD_x", "COORD_y"))

stages = [
    Stage("y", "linear", "AXIS_y"),
    Stage("x1", "linear", "AXIS_x"),
    Stage("x2", "linear", "AXIS_x"),
]

connections = [
    Connection("SURFACE", "SURFACE_CONNECT", "Pen", "BELOW"), # implicit
    Connection("Pen", "TOOL_CONNECT", "y", "platform"),
    Connection("y", "left", "x1", "platform"),
    Connection("y", "right", "x2", "platform")
]

# Lower the AST into a component tree
# TODO: handle the case where we have multiple trees among connections
# This would be done by having the envelope as the root
component_tree = build_coomponent_tree(tool, connections)

# Crawl the tree and generate constraints

print component_tree

