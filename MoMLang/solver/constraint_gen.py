from collections import namedtuple
from z3 import *
import re

program = """tool Pen:
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
"""
Node = namedtuple("Node", "name, axis, children")
Tool = namedtuple("Tool", "name, accepts")
Stage = namedtuple("Stage", "name, type, axis, transfer")
Connection = namedtuple("Connection", "from_stage, from_place, to_stage, to_place")

def build_coomponent_tree(tool, connections, stages):
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
    return Node("SURFACE", None, \
                frozenset([(build_subtree(surface_connection.to_stage, \
                    connections_without_surface, stages), \
                    surface_connection.from_place)]))

def build_subtree(subtree_root_name, connections, stages):
    """
    Returns the root node of a tree, where the root node represents the stage
    with the name SUBTREE_ROOT_NAME, and where the node has children which is a
    frozen set with tuples (subsubtree: Node, connection_place: String)
    """
    # Base case: node_connections == [] means no recursive calls in
    # the list comprehension below
    node_connections = frozenset(filter(lambda connection: connection.from_stage \
                        == subtree_root_name, connections))
    connections_without_node = connections - node_connections
    children = frozenset([(build_subtree(connection.to_stage, connections_without_node, \
            stages), connection.from_place) for connection in node_connections])
    stage_axis = axis_from_name(subtree_root_name, stages)
    node = Node(subtree_root_name, stage_axis, children)
    return node

def axis_from_name(name, stages):
    """
    Assuming NAME is a stage in STAGES, return the axis corresponding to
    that stage. If NAME isn't a stage (e.g. a tool name) or isn't in STAGES,
    return None.
    """
    axes_list = filter(lambda stage: stage.name == name, stages)
    if len(axes_list) == 0:
        return None
    return axes_list[0].axis

# AST = (tool, stages, connections)

tool = Tool("Pen", ("COORD_x", "COORD_y"))

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

# Lower the AST into a component tree
# TODO: handle the case where we have multiple trees among connections
# This would be done by having the envelope as the root
component_tree = build_coomponent_tree(tool, connections, stages)

# Crawl the tree and generate constraints

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

def constraint_function_for_path(full_path, axis):
    """
    Takes a tuple representing a tool -> stage path and returns a unary function
    that takes a z3 solver as an argument and adds constraints to the solver.
    Note that the inner function is impure because it would be inefficient to
    return a new solver with every iteration.
    Note that we do not add a constraint relating the last stage in the path
    to the motion of its motor, because that is done elsewhere.
    """
    def constraint_writer(solver):
        pairwise_constraints(full_path, solver)

    def pairwise_constraints(working_path, solver):
        if len(working_path) < 2:
            return
        else:
            solver.add(Real(working_path[0] + "_" + axis) \
                            == Real(working_path[1] + "_" + axis))
            pairwise_constraints(working_path[1:], solver)

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
    axes = set(tuple(stage.axis for stage in stages))
    stages_by_axis = tuple(filter(lambda stage: stage.axis == axis, stages) \
                        for axis in axes)
    multistage_groups = tuple(group for group in stages_by_axis if len(group) > 1)
    return tuple(tuple(map(lambda stage: stage.name, group)) \
                    for group in multistage_groups)

def constraint_function_for_multistages(multistage_tuples, stages):
    """
    Given a tuple containing tuples of the names of tuples with stages that all
    control a single axis in parallel, returns a unary function that takes
    a z3 solver as an argument and adds these constraints to the solver.

    In the future, we will consider stages with non-parallel relations
    such as a coreXY gantry.
    """
    def constraint_writer(solver):
        multistage_constraints(multistage_tuples, solver)

    def multistage_constraints(working_multistage_tuples, solver):
        if len(working_multistage_tuples) == 0:
            return
        stages_tuple = working_multistage_tuples[0]
        axis_name = filter(lambda stage: stage.name == stages_tuple[0], \
                stages)[0].axis
        for i in range(len(stages_tuple) - 1):
            solver.add(Real(stages_tuple[i] + "_" + axis_name) \
                    == Real(stages_tuple[i + 1] + "_" + axis_name))
        multistage_constraints(working_multistage_tuples[1:], solver)

    return constraint_writer

def constraint_function_for_base_stages(component_tree):
    """
    Writes constraints relating the motor position of any stage to the axis
    it controls.
    """
    def constraint_writer(solver):
        base_stage_constraints(component_tree, solver)

    def base_stage_constraints(subtree_node, solver):
        if subtree_node.axis:
            solver.add(Real(subtree_node.name + "_" + subtree_node.axis) \
                                == Real(subtree_node.name + "_mm"))
            write_transfer_constraint(stage_from_node(subtree_node, stages), solver)
        for child_place_pair in subtree_node.children:
            subsubtree = child_place_pair[0]
            base_stage_constraints(subsubtree, solver)

    return constraint_writer

def stage_from_node(node, stages):
    """
    Given NODE, find a stage in STAGES correspnding to the NODE.
    Returns a stage or None if no stages is found.
    """
    return filter(lambda stage: stage.name == node.name, stages)[0]

def write_transfer_constraint(stage, solver):
    """
    Given STAGE with some type, add a constraint to SOLVER for its
    steps -> mm transfer function.
    Note: this function is impure.
    """
    if stage.type == "linear":
        re_for_number = "\d+(\.\d+)?|\.\d+"
        mm_coeff = re.search(re_for_number, stage.transfer).group()
        solver.add(Real(stage.name + "_mm")
                    == mm_coeff * Real(stage.name + "_steps"))

path_x_axis = path_for_axis("x1", component_tree)
path_y_axis = path_for_axis("y", component_tree)
cn_fn_x_axis = constraint_function_for_path(path_x_axis, "AXIS_x")
cn_fn_y_axis = constraint_function_for_path(path_y_axis, "AXIS_y")
multistage_tuples = list_multistage_axes_tuples(stages)
ms_fn = constraint_function_for_multistages(multistage_tuples, stages)
bases_fn = constraint_function_for_base_stages(component_tree)
s = Solver()
cn_fn_x_axis(s)
cn_fn_y_axis(s)
ms_fn(s)
bases_fn(s)

s.add(Real("Pen_AXIS_x") == 50)
s.add(Real("Pen_AXIS_y") == 30)

