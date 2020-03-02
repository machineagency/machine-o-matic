#ifndef SHIELDCONTROL_H
#define SHIELDCONTROL_H

#include "ArduinoJson.h"
#include "AccelStepper.h"
#include "MultiStepper.h"
#include <ctype.h>

// Pin Mapping
#define STEP0 2
#define STEP1 3
#define STEP2 4
#define STEP3 12
#define DIR0  5
#define DIR1  6
#define DIR2  7
#define DIR3  13

// Constants
#define MAX_STAGES 5
#define MS_FACTOR 4
#define SPEED 200.0
#define JSON_SIZE 4096

// Assumes all steppers are configured identically with the following settings:
// 0.9 Degree Steppers
// 8x Microstepping Factor
// Max travel of +/- 90 degrees
// Total steps count is +/- 800 steps with the above settings.

struct StepperPins {
   uint8_t dir;
   uint8_t step;
};

/* Cartesian example */
// This section declares global variables required for the stepper motors.
int NUM_STAGES = 3;
String stage_names[3]; // array of names of each of the motors
AccelStepper phys_motors[3]; // array of AccelStepper classes for each motor
int stage_to_phys[3] = { 0, 1, 2 }; // array of name to AccelStepper mapping
String frame;

/* Polar example */
// const int NUM_STAGES = 2;
// String stage_names[2] = { "l", "c"};
// AccelStepper phys_motors[3];// = { &phys_x_motor, &phys_y_motor, &phys_z_motor };
// // TODO: un-hardcode mapping
// // index is stage index, value at index is physical index
// int stage_to_phys[3] = { 0, 1, 2 };

// Function Declarations
StepperPins pin_map(int);
int string_index_of(String);
int get_motor_index(String);
void test_motors(void);
void zero_motors(void);
void configure_motors(JsonObject&);
void set_motor_kinematics(int);
void handle_move(JsonObject&);
void handle_multiple_moves(JsonArray&);

#endif