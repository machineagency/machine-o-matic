#include "AccelStepper.h"
#include "MultiStepper.h"
#include "ArduinoJson.h"
#include "shield_control.h"
#include <ctype.h>

void setup() {
	Serial.println("{2:Initiating Setup}");
	Serial.begin(115200); // set serial com baud rate
	pinMode(8, OUTPUT);   // set pin 8 as output
	digitalWrite(8, LOW); // set pin 8 to low
   // test_motors();
   Serial.println("{1:Hello! I am the motor hub.}");
}

void loop() {
	if (Serial.available()) {
		String str = Serial.readString();
		while (Serial.available()) {
			str = str + Serial.readString();
		}
		String print_s = *(new String("{2:Received: ")) + str + *(new String("}"));
		Serial.println(print_s);

		char *json_str = (char *) malloc((str.length() + 1) * sizeof(char));
		str.toCharArray(json_str, str.length() + 1);

		// Figure out StaticJsonBuffer
		StaticJsonBuffer<1024> jsonBuffer;
		JsonObject& root = jsonBuffer.parseObject(json_str);

		// Test if parsing succeeds.
		if (!root.success()) {
			Serial.println("{3:parseObject() failed}");
			free(json_str);
			return;
		}

		String instr_type = root["type"];
		Serial.println("{2:"+instr_type+"}");
		
		// if (strcmp("setup", instr_type) == 0) {
		if (instr_type == "setup") {
			Serial.println("{2:Configuring motor setups...}");
			configure_motors(root["data"]);
			Serial.println("{1:Setup complete!}");

		} else if (instr_type == "move") {
			Serial.println("{2:Executing move...}");
			handle_move(root["data"]["steps"]);
			Serial.println("{1:Move complete!}");

		} else if (instr_type == "moves") {
			Serial.println("{2:Executing multi-moves...}");
			handle_multiple_moves(root["data"]["stepsArray"]);
			Serial.println("{1:Multi-moves complete!}");
		}
		free(json_str);
	}
}


// Rewrite handle_move so that it works
void configure_motors(JsonObject& data) {
	NUM_STAGES = atoi(data["stages"]);
	// Serial.println(NUM_STAGES); // value correct
	JsonArray& motors = data["motors"].as<JsonArray>();
	int index = 0;

	for (JsonObject& motor : motors) {
		String name = motor["name"];
		stage_names[index] = name;
		Serial.println(index);
		StepperPins mapping = pin_map(atoi(motor["map"]));
		
		// Serial.println(index); // values correct
		// Serial.println(name + ": " + step + ", " + dir); // values correct
		phys_motors[index] = AccelStepper(AccelStepper::DRIVER, mapping.step, mapping.dir);
		set_motor_kinematics(index++);
	}

	// Serial.println("{2:Testing Movement...}");
	// test_motors();
	// Serial.println("{2:Testing Complete!}");
}


StepperPins pin_map(int num) {
	StepperPins output;
	switch(num) {
		case 0: output.step = STEP0; output.dir = DIR0; Serial.println("{2:Map to Step0 & Dir0 w/ " + String(num)); break;
		case 1: output.step = STEP1; output.dir = DIR1; Serial.println("{2:Map to Step1 & Dir1 w/ " + String(num)); break;
		case 2: output.step = STEP2; output.dir = DIR2; Serial.println("{2:Map to Step2 & Dir2 w/ " + String(num)); break;
		case 3: output.step = STEP3; output.dir = DIR3; Serial.println("{2:Map to Step3 & Dir3 w/ " + String(num)); break;
		default: output.step = STEP0; output.dir = DIR0; Serial.println("{2:Map to Step3 & Dir3 w/ " + String(num));break;
	}
	return output;
}


void set_motor_kinematics(int index) {
	phys_motors[index].setMaxSpeed(MS_FACTOR * SPEED);
	phys_motors[index].setAcceleration(MS_FACTOR * SPEED / 8.0);
}


// Rewrite handle_move so that it works
void handle_move(JsonObject& steps) {
	MultiStepper steppers;
	long motor_steps[MAX_STAGES]; // not allowed to set variable NUM_STAGES
	// int step_i = 0;
	// test_motors();
	for (auto motor : steps) {
		// Serial.println(motor.key);
		int index = get_motor_index(motor.key);
		if (index != -1) {
			// Serial.println("{2:There's a match!}");
			// Serial.println("{2:index: " + String(index) + "}");
			steppers.addStepper(phys_motors[index]);
			motor_steps[index++] = MS_FACTOR * motor.value.as<long>();
			// Serial.println("{2:" + String(motor_steps[index-1]) + "}");
		} else {
			Serial.println("{2:There isn't a match!}");
		}
	}

	steppers.moveTo(motor_steps);
	steppers.runSpeedToPosition(); // Blocks until all are in position
	zero_motors();
}


void handle_multiple_moves(JsonArray& moves) {
	// Note that steps is a _list_ of steps, unlike handle_move
	for (JsonObject& move : moves) {
		handle_move(move);
	}
}


int get_motor_index(String stage_name) {
	int index = string_index_of(stage_name);
	if (index == -1) {
		Serial.println("{3:Error: cannot find stage}");
	}
	return index;
}


int string_index_of(String name) {
	for (uint8_t i = 0; i < NUM_STAGES; i++) {
		if (name == stage_names[i]) return i;
	}
	return -1;
}


void zero_motors(void) {
	for (uint8_t i = 0; i < NUM_STAGES; i++) {
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