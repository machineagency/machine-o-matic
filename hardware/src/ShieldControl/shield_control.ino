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

        for (auto kv : steps) {
            Serial.println(kv.key);
            Serial.println(kv.value.as<char*>());
        }

        free(json_str);

    }
}
