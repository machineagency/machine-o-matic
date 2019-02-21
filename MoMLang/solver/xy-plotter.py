from z3 import *

s = Solver()

# Stepper: 1 step -> step

# Leadscrew: PITCH rev -> 1 mm


# Physical parameters
stage_length_mm = Real('stage_length_mm')
stepper_angle = Real('stepper_angle')
leadscrew_pitch = Real('leadscrew_pitch')

s.add(stepper_angle == 1.8)
s.add(leadscrew_pitch == 6.096)
s.add(stage_length_mm == 609.6)

# Machine Configuration Constraints
# Compiled from these connections:
# SURFACE above -> pen IMPLICIT
# pen -> y.platform 
# y.left -> x1.platform
# y.right -> x2.platform

# For each coordinate, go down the tree writing constraints
# Z3 type declarations <- generate from crawling constraint LHSs
tool_y = Real('tool_y')
tool_x = Real('tool_x')
y_stage_y = Real('y_stage_y')
y_stage_x = Real('y_stage_x')
x1_stage_x = Real('x1_stage_x')
x2_stage_x = Real('x2_stage_x')
y_stage_mm = Real('y_stage_mm')
x1_stage_mm = Real('x1_stage_mm')
x2_stage_mm = Real('x2_stage_mm')
y_stage_steps_to_rev = Real('y_stage_steps_to_rev')
x1_stage_steps_to_rev = Real('x1_stage_steps_to_rev')
x2_stage_steps_to_rev = Real('x2_stage_steps_to_rev')
y_leadscrew_rev_to_mm = Real('y_leadscrew_rev_to_mm')
x1_leadscrew_rev_to_mm = Real('x1_leadscrew_rev_to_mm')
x2_leadscrew_rev_to_mm = Real('x2_leadscrew_rev_to_mm')
y_revolutions = Real('y_revolutions')
x1_revolutions = Real('x1_revolutions')
x2_revolutions = Real('x2_revolutions')
y_motor_steps = Real('y_motor_steps')
x1_motor_steps = Real('x1_motor_steps')
x2_motor_steps = Real('x2_motor_steps')

# Trace tool x, then tool y, down to stage_mm
s.add(tool_y == y_stage_y)
s.add(y_stage_y == y_stage_mm)

s.add(tool_x == y_stage_x)
s.add(y_stage_x == x1_stage_x)
s.add(x1_stage_x == x1_stage_mm)

# Parallel constraint
s.add(x1_stage_x == x2_stage_x)
s.add(x2_stage_x == x2_stage_mm)

# Given config constraints, write constraints for motors to get stage_mm
y_leadscrew_rev_to_mm = (y_stage_mm == leadscrew_pitch * y_revolutions)
x1_leadscrew_rev_to_mm = (x1_stage_mm == leadscrew_pitch * x1_revolutions)
x2_leadscrew_rev_to_mm = (x2_stage_mm == leadscrew_pitch * x2_revolutions)
y_stage_steps_to_rev = (y_revolutions == y_motor_steps * (stepper_angle / 360))
x1_stage_steps_to_rev = (x1_revolutions == x1_motor_steps * (stepper_angle / 360))
x2_stage_steps_to_rev = (x2_revolutions == x2_motor_steps * (stepper_angle / 360))

s.add(And(y_stage_steps_to_rev, y_leadscrew_rev_to_mm))
s.add(And(x1_stage_steps_to_rev, x1_leadscrew_rev_to_mm))
s.add(And(x2_stage_steps_to_rev, x2_leadscrew_rev_to_mm))

# Solve inverse kinematics
goal_x = (tool_x == 50)
goal_y = (tool_y == 20)
s.add(goal_x)
s.add(goal_y)

print s.check()
model = s.model()
print model
print "-----"
print model[y_motor_steps]
print model[x1_motor_steps]
print model[x2_motor_steps]

