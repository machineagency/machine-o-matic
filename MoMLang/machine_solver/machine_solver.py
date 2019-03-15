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

# NOTE: Below are two programs' ASTs for testing, uncomment as needed
# NOTE: AST = (tool, stages, connections)

# tool = Tool("Pen", ("AXIS_x", "AXIS_y"))
#
# stages = [
#     Stage("y", "linear", "AXIS_y", "step -> 0.03048 mm"),
#     Stage("x1", "linear", "AXIS_x", "step -> 0.03048 mm"),
#     Stage("x2", "linear", "AXIS_x", "step -> 0.03048 mm"),
# ]
#
# connections = [
#     Connection("SURFACE", "SURFACE_CONNECT", "Pen", "BELOW"), # implicit
#     Connection("Pen", "TOOL_CONNECT", "y", "platform"),
#     Connection("y", "left", "x1", "platform"),
#     Connection("y", "right", "x2", "platform")
# ]

tool = Tool("Pen", ("AXIS_x", "AXIS_y"))

stages = [
    Stage("c", "rotary", "AXIS_theta", "step -> 0.03048 mm"),
    Stage("l", "linear", "AXIS_r", "step -> 0.005 deg"),
]

connections = [
    Connection("SURFACE", "SURFACE_CONNECT", "Pen", "BELOW"), # implicit
    Connection("Pen", "TOOL_CONNECT", "l", "platform"),
    Connection("l", "center", "c", "platform"),
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
    if conn_tree.axis == axis:
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

def get_stage_axes_set(stages):
    return frozenset(stage.axis for stage in stages)

def from_cartesian_coord_transform_constraint(stages):
    """
    Return a unary function that takes a solver and adds constraints to map
    the accepts axes to the stage axes. If the accepts axes and stage axes
    match, return a noop constraint. Otherwise, assume that the accepts axes
    are cartesian, and return an appropriate transform (e.g. polar, H-bot).

    Note that we currently don't suppor non-cartesian accepts coordinates
    unless those coordinates match the stage coordinates e.g. accepts polar
    coordinates, stages use polar coordinates.
    """
    t = tool.name
    # Define transform constraint functions
    # FIXME: uses small angle approximations
    def cartestian_to_polar_constraint(solver):
        solver.add(Real(t + "_AXIS_x") == Real(t + "_AXIS_r") \
                * Real(t + "_AXIS_theta"))
        solver.add(Real(t + "_AXIS_y") == Real(t + "_AXIS_r") \
                * (1 - (Real(t + "_AXIS_theta") ** 2) / 2))

    def noop_constraint(solver):
        pass

    stage_axes = get_stage_axes_set(stages)
    accepts_axes = frozenset(tool.accepts)

    if (stage_axes == accepts_axes):
        return noop_constraint

    coord_transforms = {
        frozenset(["AXIS_r", "AXIS_theta"]): cartestian_to_polar_constraint,
        frozenset(["AXIS_x", "AXIS_y"]): noop_constraint
    }

    try:
        return coord_transforms[stage_axes]
    except KeyError:
        print "Error: no coordinate transform available."
        return noop_constraint

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
            if stage_from_node(subtree_node, stages).type == "linear":
                solver.add(Real(subtree_node.name + "_" + subtree_node.axis) \
                                    == Real(subtree_node.name + "_mm"))
            if stage_from_node(subtree_node, stages).type == "rotary":
                solver.add(Real(subtree_node.name + "_" + subtree_node.axis) \
                                    == Real(subtree_node.name + "_deg"))
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
    if stage.type == "rotary":
        re_for_number = "\d+(\.\d+)?|\.\d+"
        deg_coeff = re.search(re_for_number, stage.transfer).group()
        deg_adjusted = float(deg_coeff) % 360
        solver.add(Real(stage.name + "_deg")
                    == deg_adjusted * Real(stage.name + "_steps"))

class MachineSolver():
    """
    This is the actual class that we return to the interpreter.
    """
    @staticmethod
    def solve_ik(*coords):

        # Write constraints based on component tree
        # NOTE: use the stage axes, not the accept axes. Generate a transform
        # Into the accepts axes (possibly cartesian if needed)
        axes = get_stage_axes_set(stages)
        paths = tuple(path_for_axis(axis, component_tree) for axis in axes)
        coord_trans_constraint = from_cartesian_coord_transform_constraint(stages)

        path_constraint_fns = tuple(constraint_function_for_path(path, axis) \
                                for path, axis in zip(paths, axes))
        multistage_tuples = list_multistage_axes_tuples(stages)
        ms_fn = constraint_function_for_multistages(multistage_tuples, stages)
        bases_fn = constraint_function_for_base_stages(component_tree)

        # Instantiate solver and add constraints from above
        s = Solver()
        for fn in path_constraint_fns:
            fn(s)
        ms_fn(s)
        bases_fn(s)
        coord_trans_constraint(s)

        # Add goal tool axis constraints e.g.
        # Pen_AXIS_x = 10
        for idx, coord in enumerate(coords):
            s.add(Real(tool.name + "_" + tool.accepts[idx]) == coord)

        try:
            s.check()
            model = s.model()

            print s
            print s.model()
            stage_steps = tuple(stage.name + "_steps" for stage in stages)
            return {
                stage_step: MachineSolver.__z3_real_to_rounded_int(model[Real(stage_step)]) \
                    for stage_step in stage_steps
            }
        except Exception as e:
            print "Could not solve."
            print e
            return {}

    @staticmethod
    def __z3_real_to_rounded_int(real):
        return int(real.as_decimal(0).split(".")[0])

    # FIXME: need a way of passing config to interpreter without relying
    # on global variables
    @staticmethod
    def get_machine_stage_names():
        return tuple(stage.name for stage in stages)

    @staticmethod
    def get_machine_axes():
        return tool.accepts

