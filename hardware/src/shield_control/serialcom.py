import serial, json

port = serial.Serial('/dev/tty.usbmodem142301', 115200) # open serial port
print("Opened " + port.name) # check which port was really used

file_name = input("Which JSON file would you like to send? ")
file_name += ".json"
with open(file_name) as json_file:
	data = json.load(json_file)
	data_bytes = bytes(json.dumps(data), "utf-8")
	# print(data_bytes)
	port.write(data_bytes) # write a string
	port.flush()

port.close() # close port


