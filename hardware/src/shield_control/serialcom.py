import serial, json, sys, re, time
import serial.tools.list_ports

BAUD = 115200

# Main Function -----------------------------------
def main():
	max_size = 4096 
	s_flag = False

	ser = open_port() # initiate serial port connection

	while True:
		# if (ser.inWaiting()):
		data = read_port(ser)
		# print(data)
		status = 4
		if (len(data) > 0 and re.match('^[0-9]*$', data[0])):
			status = int(data[0])
		else:
			status = 4
			
		# print(data) # print incoming data
		if (status == 1): # status = idle
			msg_print(data[2:])
			instr = input("\nInstruction: ")

			if instr[0:2] == "w ":
				send_data(ser, instr[2:] + ".json", max_size)
				if instr[2:] == "setting":
					s_flag = True
					# response = read_port(ser)
					# response = response[2:]
					# while not (re.match('^[0-9]*$', response)):
					# 	response = read_port(ser)
					# 	response = response[2:response.find("}")]
					# print(type(response[ 2 : response.find("}") ]))
					# max_size = int(response[2:])

			elif instr == "c" or instr == "C":
				ser.close() # close serial port
				sys.exit() # exit for loop

			else:
				print("unable to interpret instr") 

		elif (status == 2): # status = busy
			if s_flag == True:
				max_size = int(data[2:])
				s_flag = False
			msg_print(data[2:])

		elif (status == 3): # status = message
			msg_print(data[2:])

		else: # no data / invalid packet
			print(data)

# Function: Open Serial Port -----------------------------------
def open_port():
	# List out all com ports
	ports = serial.tools.list_ports.comports()
	print("Ports available:")
	port = 'none'

	for obj in ports: # Find the right com port
		print(" -> " + obj.device.replace("cu", "tty"))
		# print(obj)
		if ("/dev/cu.usbmodem" in obj.device):
			# port = obj.device.replace("cu", "tty")
			port = obj.device
	print("------------------------------------")
	try: # Initiate serial port
		ser = serial.Serial(port, BAUD)
		print("Opened: " + ser.name)
		print("------------------------------------")
		return ser
	except serial.serialutil.SerialException:
		print("Unable to open port")
		return None
	# port = serial.Serial('/dev/tty.usbmodem142301', 115200) # open serial port
	# print("Opened " + port.name) # check which port was really used


# Function: Read Serial Input ----------------------------------

def read_port(ser):
	data = ""
	
	# if (ser.inWaiting()):	
	temp = ser.readline()

	if temp != 10:
		data = temp.decode('utf-8')
	
	if len(data) != 0 and "{" in data and re.match('^[0-9]*$', data[1]):
		start_i = data.find("{")+1
		end_i = data.find("}")
		if start_i != -1 and end_i != -1:
			data = data[start_i:end_i] # retrieve data from packet
		return data
	else:
		print(data)

	return ""

	

# Parse JSON & Serial Write --------------------------
def send_data(ser, file_name, max_size):
	with open(file_name) as json_file:
		print("------------------------------")
		print("Loading JSON file:")
		data = json.load(json_file)
		# print(json.dumps(data, indent=1))
		data_bytes = bytes(json.dumps(data), "utf-8")
		if len(data_bytes) <= max_size:
			print("------------------------------")
			print("Sending JSON file (" + str(len(data_bytes)) + " bytes)...")
			start = time.time()
			ser.write(data_bytes) # write a string
			diff = time.time() - start
			if diff < 0.000001:
				print("[ Tx Time: " + str(diff) + "]")
			else:
				print('[ Tx Time: %.6f ]' % diff)
			ser.flush()
		else:
			print("JSON file (" + str(len(data_bytes)) + " bytes) too large (max size: " + str(max_size) + ").")
		
def msg_print(msg):
	print("------------------------------")
	print(msg)

if __name__ == "__main__":
	main()

# MOVE  INSTR: ~69 bytes 
# MOVES INSTR: ~75 bytes + ~30-40bytes/instr