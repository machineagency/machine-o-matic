from z3 import *

s = Solver()

# Stepper: 1 step -> step

# Leadscrew: PITCH rev -> 1 mm

steps = Real('steps')
revolutions = Real('revolutions')
move_mm = Real('move_mm')
stage_length_mm = Real('stage_length_mm')
stepper_angle = Real('stepper_angle')
leadscrew_pitch = Real('leadscrew_pitch')
tool_pos_x = Int('tool_pos_x')

# Transforms: steps -> rev -> move_mm
stepper_steps_to_rev = (revolutions ==  steps * (stepper_angle / 360))
leadscrew_rev_to_mm = (move_mm == leadscrew_pitch * revolutions)
s.add(And(stepper_steps_to_rev, leadscrew_rev_to_mm))

# Physical parameters
s.add(stepper_angle == 1.8)
s.add(leadscrew_pitch == 6.096)
s.add(stage_length_mm == 609.6)

# Tool to motor constraints, very basic in this case
# move_mm -> tool_pos_x -> GOAL
x_axis_to_tool_pos_x = (tool_pos_x == move_mm)
s.add(x_axis_to_tool_pos_x)

# Solve inverse kinematics
goal = (tool_pos_x == 50)
s.add(goal)

s.check()
model = s.model()
print model[steps]
exit()

