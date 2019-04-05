#include "AccelStepper.h"
#include "MultiStepper.h"
#include "jsmn.h"
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

char receive_buffer[512];
int receive_buffer_idx = 0;
size_t bytes_to_read = 0;
size_t num_bytes_read = 0;

jsmn_parser parser;
int num_tok = 32;
int num_tok_used = 0;
jsmntok_t tokens[32];

char token_string[32];

char pgm_read_byte = 0;
int num_open_braces = 0;

void test_motors(void);

void handle_move_inst(void);
void handle_map_inst(void);

const int NUM_STAGES = 3;
const char* stage_names[3] = { "x1", "x2", "y" };
AccelStepper *phys_motors[3] = { &phys_x_motor, &phys_y_motor, &phys_z_motor };
// TODO: un-hardcode mapping
// index is stage index, value at index is physical index
int stage_phys_map[3] = { 0, 1, 2 };

int INST_FIELD_IDX = 2;
int STEPS_FIRST_TOK_IDX = 5;

void set_substring(char *, char *, int, int);

void setup()
{
    Serial.begin(9600);
    pinMode(8, OUTPUT); // Disable pin.
    digitalWrite(8, LOW);

    jsmn_init(&parser);

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

void loop()
{
    while (Serial.available()) {
        pgm_read_byte = Serial.read();
        receive_buffer[receive_buffer_idx++] = pgm_read_byte;
        Serial.println(receive_buffer);

        if (pgm_read_byte == '{') {
            num_open_braces += 1;
        }
        if (pgm_read_byte == '}') {
            num_open_braces -= 1;
        }

        if (num_open_braces == 0 && !isspace((int) pgm_read_byte)) {
            num_tok_used = jsmn_parse(&parser, receive_buffer, receive_buffer_idx + 1,
                        tokens, num_tok);
            Serial.print("Parsed # of tokens: ");
            Serial.println(num_tok_used);
            Serial.println(num_tok_used);
            for (int i = 0; i < num_tok_used - 1; i++) {
                jsmntok_t curr_tok = tokens[i];
                // Serial.println(curr_tok.type);
                for (int j = curr_tok.start; j < curr_tok.end; j++) {
                    Serial.print(receive_buffer[j]);
                }
                Serial.println();
            }
            Serial.print("INSTRUCTION: ");
            set_substring(token_string, receive_buffer,
                            tokens[INST_FIELD_IDX].start, tokens[INST_FIELD_IDX].end);
            Serial.println(token_string);

            if(!strcmp(token_string, "move")) {
                handle_move_inst();
            }

            memset(receive_buffer, 0, sizeof receive_buffer);
            receive_buffer_idx = 0;
        }
    }
}

int str_index_of(char *cand_str, char **str_arr, int arr_len) {
    for (int i = 0; i < arr_len; i += 1) {
        if (!strcmp(str_arr[i], cand_str)) {
            return i;
        }
    }
    return -1;
}

void set_substring(char *substr, char *str, int begins, int ends) {
    int sub_idx = 0;
    for (int s_idx = begins; s_idx < ends; s_idx++) {
        substr[sub_idx++] = str[s_idx];
    }
    substr[sub_idx] = '\0';
}

void handle_move_inst(void) {
    Serial.println("Handling move command.");
    MultiStepper steppers;
    long steps_per_motor[NUM_STAGES];
    int spm_idx = 0;

    for (int i = STEPS_FIRST_TOK_IDX; i < num_tok_used - 1; i += 2) {
        set_substring(token_string, receive_buffer,
                        tokens[i].start, tokens[i].end);
        Serial.print(token_string);
        Serial.print("->");

        int stage_idx = str_index_of(token_string, (char **) stage_names, NUM_STAGES);
        if (stage_idx == -1) {
            Serial.println("Error: could not find stage.");
        }
        int phys_motor_idx = stage_phys_map[stage_idx];
        steppers.addStepper(*(phys_motors[phys_motor_idx]));

        set_substring(token_string, receive_buffer,
                        tokens[i + 1].start, tokens[i + 1].end);

        steps_per_motor[spm_idx++] = strtol(token_string, NULL, 0);
        Serial.print(token_string);
        Serial.print(": ");
        Serial.println(phys_motor_idx);
    }

    Serial.println(steps_per_motor[0]);
    Serial.println(steps_per_motor[1]);
    Serial.println(steps_per_motor[2]);

    steppers.moveTo(steps_per_motor);
    steppers.runSpeedToPosition(); // Blocks until all are in position
    Serial.println("Done");
}

void test_motors(void) {
    MultiStepper steppers;
    steppers.addStepper(*(phys_motors[0]));
    steppers.addStepper(*(phys_motors[1]));

    // yMotor.moveTo(1200);
    // yMotor.run();

    long coords[2];

    coords[0] = 400;
    coords[1] = 400;
    steppers.moveTo(coords);
    steppers.runSpeedToPosition(); // Blocks until all are in position
}

