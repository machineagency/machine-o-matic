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
        return Node("EMPTY", frozenset(()))
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

# FIXME: this currently works for STAGE NAMES, not AXIS, because we do not
# yet store AXIS in the tree
def path_for_axis(axis, conn_tree):
    """
    Given a connection tree CONN_TREE with nodes representing stages where
    each stage controls one or more axes, finds *a* node that controls
    AXIS. Then returns a path from the tool to the node as a tuple e.g.
    ("Pen", "y", "x2"). Note that if there are multiple nodes for some axis
    A, we can return any one of the nodes.
    """
    if conn_tree.name == axis:
        return (conn_tree.name,)
    elif not conn_tree.children:
        return ()
    else:
        children_paths = tuple(path_for_axis(axis, child_pair[0]) for \
                child_pair in conn_tree.children)
        viable_paths = filter(lambda path: len(path) > 0, children_paths)
        # Just pick the first viable path - may want to change in the future
        if len(viable_paths) == 0:
            return ()
        return (conn_tree.name,) + viable_paths[0]

def constraint_function_for_path(path):
    """
    Takes a tuple representing a tool -> stage path and returns a unary function
    that takes a z3 solver as an argument and adds constraints to the solver.
    """
    # TODO: how to add constraint in inner fn body based on PATH?
    def constraint_writer(solver):
        pass
    return constraint_writer

def list_multistage_axes_tuples(stages):
    """
    Returns a tuple of tuples, where each inner tuple represent the names of
    all stages which control a particular axis. For example, below, we return
    a tuple of one tuple that contains "x1" and "x2" because those stages
    both determine the position on the x-axis for the tool.
    >>> stages = [
        Stage("y", "linear", "AXIS_y"),
        Stage("x1", "linear", "AXIS_x"),
        Stage("x2", "linear", "AXIS_x"),
    ]
    (("x1", "x2"),)
    """
    pass

def constraint_function_for_multistages(multistage_tuple):
    """
    Given a tuple containing the names of tuples with stages that all
    control a single axis in parallel, returns a unary function that takes
    a z3 solver as an argument and adds these constraints to the solver.

    In the future, we will consider stages with non-parallel relations
    such as a coreXY gantry.
    """
    pass

print path_for_axis("x1", component_tree)

