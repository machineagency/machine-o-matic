import sys, cmd
from xy_plotter import xyPlotterSolver

class Interpreter(cmd.Cmd):
    intro = "Welcome to the interpreter."
    prompt = "machine > "
    file = None
    CURR_COORDS = (0, 0)
    MAX_COORDS = (100, 100)
    NUM_AXES = 2

    @staticmethod
    def parse_move_coords(arg):
        'Convert a series of zero or more numbers to an argument tuple'
        try:
            return tuple(map(int, arg.split()))
        except ValueError:
            print "Warning: can't understand where to move"
            return Interpreter.CURR_COORDS

    def do_move(self, arg):
        self.move(Interpreter.parse_move_coords(arg))

    def coords_in_bounds(self, coords):
        """
        Checks COORDS against my own maximum coordinates.
        Returns TRUE iff coords is valid and bounded, FALSE otherwise.
        """
        for idx, coord in enumerate(coords):
            if coord > Interpreter.MAX_COORDS:
                return False
        return True

    def find_relative_coords(self, goal_coords):
        """
        Given my current position, return the relative coordinate position that
        I should move to.
        E.g. if the current position is (50, 20) and your goal is (30, 30),
        then the relative coordinates are (-20, 10).
        """
        return tuple(goal_coord - curr_coord for goal_coord, curr_coord \
                in zip(goal_coords, Interpreter.CURR_COORDS))

    def move(self, coords):
        """
        Try to move to coords.
        """
        print "Going to move to {}".format(coords)
        if len(coords) != Interpreter.NUM_AXES:
            print "{0} has {1} axes, but I need {2}" \
                    .format(coords, len(coords), Interpreter.NUM_AXES)
        if not self.coords_in_bounds(coords):
            print "{0} is outside my bounds {1}".format(coords, Interpreter.CURR_COORDS)
        relative_coords = self.find_relative_coords(coords)
        steps = xyPlotterSolver.solve_ik(relative_coords[0], relative_coords[1])
        print steps

Interpreter().cmdloop()

