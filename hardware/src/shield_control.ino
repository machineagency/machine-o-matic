#include "AccelStepper.h"
#include "MultiStepper.h"

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

AccelStepper xMotor(AccelStepper::DRIVER, XSTEP, XDIR);
AccelStepper yMotor(AccelStepper::DRIVER, YSTEP, YDIR);

MultiStepper steppers;

char read_c_string[32];

void setup()
{  
    Serial.begin(9600);
    pinMode(8, OUTPUT); // Disable pin.
    digitalWrite(8, LOW);
    
    xMotor.setMaxSpeed(600.0);
    xMotor.setAcceleration(300.0);
    
    yMotor.setMaxSpeed(600.0);
    yMotor.setAcceleration(300.0);

    steppers.addStepper(xMotor);
    steppers.addStepper(yMotor);

//    yMotor.moveTo(1200);
//    yMotor.run();

    long coords[2];

    coords[0] = 0;
    coords[1] = -4800;
    steppers.moveTo(coords);
    steppers.runSpeedToPosition(); // Blocks until all are in position
    delay(1000);
 
}

void loop()
{
//    Serial.println("Hello");
//    delay(1000);
//    while (!Serial.available()) {
//      String read_arduino_string = Serial.readString();
//      read_arduino_string.toCharArray(read_c_string, 32 + 1);
//      Serial.println(read_arduino_string);
//
//      char *token;
//      while ((token = strsep(&read_c_string[0], ",")) != NULL)
//          printf("%s\n", token);
//    }
}
