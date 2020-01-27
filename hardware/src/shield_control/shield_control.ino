#include "AccelStepper.h"
#include "MultiStepper.h"
#include "ArduinoJson.h"
#include <ctype.h>

// Assumes all steppers are configured identically with the following settings:
// 0.9 Degree Steppers
//   8x Microstepping Factor
//   Max travel of +/- 90 degrees
// Total steps count is +/- 800 steps with the above settings.

// Pin Mapping
// #define XSTEP 2
// #define YSTEP 3
// #define ZSTEP 4
// #define XDIR 5
// #define YDIR 6
// #define ZDIR 7
#define MAX_STAGES 5

// Forward Declarations
int string_index_of(String);
AccelStepper& get_phys_motor(String);
void test_motors(void);
void zero_motors(void);
void configure_motors(JsonObject&);
void set_motor_kinematics(int);
void handle_move(JsonObject&);
void handle_multiple_moves(JsonArray&);

/* Cartesian example */
// This section declares the constants for the stepper motors.
int NUM_STAGES = 0;
String stage_names[3]; // array of names of each of the motors
AccelStepper phys_motors[3]; // array of AccelStepper classes for each motor
int stage_to_phys[3] = { 0, 1, 2 }; // array of name to AccelStepper mapping

/* Polar example */
// const int NUM_STAGES = 2;
// String stage_names[2] = { "l", "c"};
// AccelStepper phys_motors[3];// = { &phys_x_motor, &phys_y_motor, &phys_z_motor };
// // TODO: un-hardcode mapping
// // index is stage index, value at index is physical index
// int stage_to_phys[3] = { 0, 1, 2 };

// Constants
int MS_FACTOR = 4;
float SPEED = 200.0;


void setup() {
	Serial.println("Initiating Setup");
	Serial.begin(115200); // set serial com baud rate
	pinMode(8, OUTPUT);   // set pin 8 as output
	digitalWrite(8, LOW); // set pin 8 to low
	
    // test_motors();
	//  if (&phys_motors[0]) Serial.println(&phys_motors[0]);
	
   Serial.println("Hello! I am the motor hub.");
}


void loop() {
	if (Serial.available()) {
		String s = Serial.readString();
		// s = s.substring(4); // there's an error here... 
		Serial.print("Received: ");
		Serial.println(s);

		char *json_str = (char *) malloc((s.length() + 1) * sizeof(char));
		s.toCharArray(json_str, s.length() + 1);

		// Figure out StaticJsonBuffer
		StaticJsonBuffer<1024> jsonBuffer;
		JsonObject& root = jsonBuffer.parseObject(json_str);

		// Test if parsing succeeds.
		if (!root.success()) {
			Serial.println("parseObject() failed");
			free(json_str);
			return;
		}

		const char *instr_type = root["type"];
		Serial.println(instr_type);

		if (strcmp("setup", instr_type) == 0) {
			Serial.println("Configuring motor setups...");
			JsonObject& data = root["data"];
			configure_motors(data);
		} else if (strcmp("move", instr_type) == 0) {
			Serial.println("Moving motors ...");
			JsonObject& data = root["data"]["steps"];
			handle_move(data);
		} else if (strcmp("moves", instr_type) == 0) {
			Serial.println("Moving multiple motors <instr not implemented> ...");
		}

		// const char *inst = root["inst"];
		// Serial.println(inst);
	
		// if (strcmp("move", inst) == 0) {
		// 	Serial.println("moving one stepper...");
		// 	JsonObject& steps = root["steps"];
		// 	handle_move(steps);
		// }

		// if (strcmp("moves", inst) == 0) {
		// 	Serial.println("moving multi steppers...");
		// 	JsonArray& steps_arr = root["steps"];
		// 	handle_multiple_moves(steps_arr);
		// }

		free(json_str);
	}
}


// Rewrite handle_move so that it works
void configure_motors(JsonObject& data) {
	NUM_STAGES = data["stages"];
	// Serial.println(NUM_STAGES); // value correct
	JsonArray& motors = data["motors"].as<JsonArray>();
	int index = 0;

	for (JsonObject& motor : motors) {
		String name = motor["name"];
		int step = atoi(motor["step"]);
		int dir = atoi(motor["dir"]);
		stage_names[index] = name;
		// Serial.println(index); // values correct
		// Serial.println(name + ": " + step + ", " + dir); // values correct
		phys_motors[index] = AccelStepper(AccelStepper::DRIVER, step, dir);
		set_motor_kinematics(index++);
	}

	Serial.println("Configuration Complete!");

	Serial.println("Testing Movement...");
	test_motors();
	// long coords0[3] = { 10 * 328, 10 * 328, 4 * 328 };
	// MultiStepper steppers;
	// for (int i = 0; i < NUM_STAGES; i++) steppers.addStepper(phys_motors[i]);

	// steppers.moveTo(coords0);
	// steppers.runSpeedToPosition();
	// delay(100);

	// for (int i = 0; i < NUM_STAGES; i++) {
	// 	phys_motors[i] = AccelStepper(AccelStepper::DRIVER, motors[i]["step"], motors[i]["dir"]);
	// 	set_motor_kinematics(index++);
	// }
}


void set_motor_kinematics(int index) {
	phys_motors[index].setMaxSpeed(MS_FACTOR * SPEED);
	phys_motors[index].setAcceleration(MS_FACTOR * SPEED / 8.0);
}


// Rewrite handle_move so that it works
void handle_move(JsonObject& steps) {
	MultiStepper steppers;
	long motor_steps[MAX_STAGES]; // not allowed to set variable NUM_STAGES
	int index = 0;

	for (auto motor : steps) {
		Serial.println(motor.key);
		steppers.addStepper(get_phys_motor(motor.key));
		motor_steps[index++] = MS_FACTOR * motor.value.as<long>();
	}

	steppers.moveTo(motor_steps);
	steppers.runSpeedToPosition(); // Blocks until all are in position
	zero_motors();
}


void handle_multiple_moves(JsonArray& steps) {
	// Note that steps is a _list_ of steps, unlike handle_move
	for (JsonObject& step : steps) {
		handle_move(step);
	}
}


AccelStepper& get_phys_motor(String stage_name) {
	int index = string_index_of(stage_name);
	if (index == -1) {
		Serial.println("Error: cannot find stage");
		return phys_motors[0];
	}
	return phys_motors[index];
}


int string_index_of(String name) {
	for (int i = 0; i < NUM_STAGES; i++) {
		if (name == stage_names[i]) return i;
	}
	return -1;
}


void zero_motors(void) {
	for (int i = 0; i < NUM_STAGES; i += 1) {
		phys_motors[i].setCurrentPosition(0);
	}
}


void test_motors(void) {
	long coords0[3] = { 10 * 328, 10 * 328, 4 * 328 };
	long coords1[3] = { 10 * -328, 10 * -328, 4 * -328 };
	MultiStepper steppers;

	for (int i = 0; i < NUM_STAGES; i++) steppers.addStepper(phys_motors[i]);

	steppers.moveTo(coords0);
	steppers.runSpeedToPosition();
	delay(100);
	
	zero_motors();
	delay(100);
	
	steppers.moveTo(coords1);
	steppers.runSpeedToPosition();
	delay(100);
	
	zero_motors();
	delay(100);
}
// { "inst" : "move", "steps" : { "x1" : "50" } }