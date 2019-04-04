#include "AccelStepper.h"
#include "MultiStepper.h"
#include "ArduinoJson.h"
#include <ctype.h>

// Assumes all steppers are configured identically with the following settings:
// 0.9 Degree Steppers
//   8x Microstepping Factor
//   Max travel of +/- 90 degrees
// Total steps count is +/- 800 steps with the above settings.

#define XSTEP 2
#define XDIR 5
#define YSTEP 3
#define YDIR 6
#define ZSTEP 4
#define ZDIR 7


/* Cartesian example */
// const int NUM_STAGES = 3;
// String stage_names[3] = { "x1", "x2", "y" };
// AccelStepper phys_motors[3];// = { &phys_x_motor, &phys_y_motor, &phys_z_motor };
// // TODO: un-hardcode mapping
// // index is stage index, value at index is physical index
// int stage_to_phys[3] = { 0, 1, 2 };

/* Polar example */
const int NUM_STAGES = 2;
String stage_names[2] = { "l", "c"};
AccelStepper phys_motors[3];// = { &phys_x_motor, &phys_y_motor, &phys_z_motor };
// TODO: un-hardcode mapping
// index is stage index, value at index is physical index
int stage_to_phys[3] = { 0, 1, 2 };

int string_index_of(String, String *, int);
AccelStepper& get_phys_motor(String, String *);
void test_motors(void);
void zero_motors(void);
void handle_move(JsonObject&);
void handle_multiple_moves(void);

// TODO: send from interpreter, don't hardcode
int MS_FACTOR = 4;
float SPEED = 200.0;

void setup() {
    Serial.begin(9600);
    pinMode(8, OUTPUT); // Disable pin.
    digitalWrite(8, LOW);

    phys_motors[0] = AccelStepper(AccelStepper::DRIVER, XSTEP, XDIR);
    phys_motors[1] = AccelStepper(AccelStepper::DRIVER, YSTEP, YDIR);
    phys_motors[2] = AccelStepper(AccelStepper::DRIVER, ZSTEP, ZDIR);

    for (int i = 0; i < NUM_STAGES; i++) {
        phys_motors[i].setMaxSpeed(MS_FACTOR * SPEED);
        phys_motors[i].setAcceleration(MS_FACTOR * SPEED / 2.0);
    }

    // Uncomment to test motors
    // test_motors();

    Serial.println("Hello! I am the motor hub.");

}

void loop() {
    if (Serial.available()) {
        String s = Serial.readString();
        Serial.print("Got: ");
        Serial.println(s);

        char *json_str = (char *) malloc((s.length() + 1) * sizeof(char));
        s.toCharArray(json_str, s.length() + 1);

        StaticJsonBuffer<256> jsonBuffer;
        JsonObject& root = jsonBuffer.parseObject(json_str);

        // Test if parsing succeeds.
        if (!root.success()) {
          Serial.println("parseObject() failed");
          free(json_str);
          return;
        }

        const char *inst = root["inst"];

        JsonObject& steps = root["steps"];

        if (strcmp("move", inst) == 0) {
            handle_move(steps);
        }

        if (strcmp("moves", inst) == 0) {
            handle_multiple_moves();
        }

        free(json_str);

    }
}

void handle_move(JsonObject& steps) {
    MultiStepper steppers;
    long motor_steps[NUM_STAGES];
    int step_idx = 0;

    for (auto stage_step : steps) {
        steppers.addStepper(get_phys_motor(stage_step.key, stage_names));
        motor_steps[step_idx++] = MS_FACTOR * stage_step.value.as<long>();
    }

    steppers.moveTo(motor_steps);
    steppers.runSpeedToPosition(); // Blocks until all are in position
    zero_motors();
}

void handle_multiple_moves(void) {

}

int string_index_of(String candidate, String strings[], int num_strings) {
    for (int i = 0; i < num_strings; i += 1) {
        if (!candidate.compareTo(strings[i])) {
            return i;
        }
    }
    return -1;
}

AccelStepper& get_phys_motor(String stage_name, String *stage_names) {
    int stage_idx = string_index_of(stage_name, stage_names, NUM_STAGES);
    if (stage_idx == -1) {
        Serial.println("Error: cannot find stage");
        return phys_motors[0];
    }
    int phys_motor_idx = stage_to_phys[stage_idx];
    return phys_motors[phys_motor_idx];
}

void test_motors(void) {
    long coords0[3] = { 4 * 328, 4 * 328, 0 };
    long coords1[3] = { 4 * -328, 4 * -328, 0 };
    MultiStepper steppers;
    for (int i = 0; i < NUM_STAGES; i += 1) {
        steppers.addStepper(phys_motors[i]);
    }
    steppers.moveTo(coords0);
    steppers.runSpeedToPosition();
    zero_motors();
    steppers.moveTo(coords1);
    steppers.runSpeedToPosition();
    zero_motors();
}

void zero_motors(void) {
    for (int i = 0; i < NUM_STAGES; i += 1) {
        phys_motors[i].setCurrentPosition(0);
    }
}

