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

AccelStepper phys_x_motor(AccelStepper::DRIVER, XSTEP, XDIR);
AccelStepper phys_y_motor(AccelStepper::DRIVER, YSTEP, YDIR);
AccelStepper phys_z_motor(AccelStepper::DRIVER, ZSTEP, ZDIR);

const int NUM_STAGES = 3;
String stage_names[3] = { "x1", "x2", "y" };
AccelStepper *phys_motors[3] = { &phys_x_motor, &phys_y_motor, &phys_z_motor };
// TODO: un-hardcode mapping
// index is stage index, value at index is physical index
int stage_to_phys[3] = { 0, 1, 2 };

int string_index_of(String, String *, int);
AccelStepper& get_phys_motor(String, String *);

void setup() {
    Serial.begin(9600);
    pinMode(8, OUTPUT); // Disable pin.
    digitalWrite(8, LOW);

    phys_x_motor.setMaxSpeed(400.0);
    phys_x_motor.setAcceleration(200.0);
    phys_y_motor.setMaxSpeed(400.0);
    phys_y_motor.setAcceleration(200.0);
    phys_z_motor.setMaxSpeed(400.0);
    phys_z_motor.setAcceleration(200.0);

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
        Serial.println(inst);

        JsonObject& steps = root["steps"];

        MultiStepper steppers;
        long motor_steps[NUM_STAGES];
        int step_idx = 0;

        for (auto stage_step : steps) {
            Serial.println(stage_step.key);
            Serial.println(stage_step.value.as<char*>());
            steppers.addStepper(get_phys_motor(stage_step.key, stage_names));
            motor_steps[step_idx++] = stage_step.value.as<long>();
        }

        steppers.moveTo(motor_steps);
        steppers.runSpeedToPosition(); // Blocks until all are in position

        free(json_str);

    }
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
    Serial.println(stage_idx);
    if (stage_idx == -1) {
        Serial.println("Error: cannot find stage");
        return *phys_motors[0];
    }
    int phys_motor_idx = stage_to_phys[stage_idx];
    Serial.println(phys_motor_idx);
    Serial.println("---");
    return *phys_motors[phys_motor_idx];
}

