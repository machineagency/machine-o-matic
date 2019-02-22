import sys, cmd
from xy_plotter import xyPlotterSolver

class Interpreter(cmd.Cmd):
    intro = "Welcome to the interpreter."
    prompt = "machine > "
    CURR_COORDS = (0, 0)

    # Parameter below are generated by machine configuration
    MIN_COORDS = (0, 0)
    MAX_COORDS = (100, 100)
    NUM_AXES = 2

    # COMMAND LINE METHODS #

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

    def do_bye(self, arg):
        print "Bye!"
        return True

    # FUNCTIONAL METHODS #

    def coords_in_bounds(self, coords):
        """
        Checks COORDS against my own maximum coordinates.
        Returns TRUE iff coords is valid and bounded, FALSE otherwise.
        """
        for idx, coord in enumerate(coords):
            if coord > Interpreter.MAX_COORDS[idx] \
                    or coord < Interpreter.MIN_COORDS[idx]:
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
        elif not self.coords_in_bounds(coords):
            print "{0} is outside my bounds: {1} to {2}" \
                    .format(coords, Interpreter.MIN_COORDS, Interpreter.MAX_COORDS)
        else:
            relative_coords = self.find_relative_coords(coords)
            steps = xyPlotterSolver.solve_ik(relative_coords[0], relative_coords[1])
            print steps
            step_succeeded = self.dipatch_steps(steps)
            if step_succeeded:
                print "Moved successfully!"
                Interpreter.CURR_COORDS = coords
            else:
                print "Tried to move, but couldn't."

    def dipatch_steps(self, steps):
        """
        NOT YET IMPLEMENTED.
        Takes in dictionary of motor names -> steps as argument STEPS.
        Dispatches steps to hardware to move motors synchronously.
        Blocks thread until this finishes, and waits for hardware response.
        Returns FALSE if we receive an error response indicating that the stepping
        was not successful.
        Returns TRUE otherwise.
        """
        return True

Interpreter().cmdloop()

