from z3 import *

s = Solver()

# Stepper: 1 step -> step

# Leadscrew: PITCH rev -> 1 mm

steps = Int('steps')
revolutions = Int('revolutions')
move_mm = Real('move_mm')
stage_length_mm = Real('stage_length_mm')
stepper_angle = Real('stepper_angle')
leadscrew_pitch = Real('leadscrew_pitch')

# Transforms
stepper_steps_to_rev = (revolutions == steps * (stepper_angle / 360))
leadscrew_rev_to_mm = (move_mm == leadscrew_pitch * revolutions)
s.add(stepper_steps_to_rev)
s.add(leadscrew_rev_to_mm)

# Physical parameters
s.add(stepper_angle == 1.8)
s.add(leadscrew_pitch == 6.096)
s.add(stage_length_mm == 609.6)

# Tool to motor constraints


# Solve for position
for c in s.assertions():
    print c
