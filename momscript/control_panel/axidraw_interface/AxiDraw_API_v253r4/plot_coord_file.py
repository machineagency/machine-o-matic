import sys, cmd, os
import serial, json
from pyaxidraw import axidraw   # import module

with open('axidraw_interface/AxiDraw_API_v253r4/coords.txt', 'r+') as file:
    coord_text = file.read();
    coord_dict = json.loads(coord_text);
    coords = coord_dict['coords']
    file.close();

ad = axidraw.AxiDraw()          # Initialize class
ad.interactive()                # Enter interactive context
ad.options.units = 1            # Interpret numbers as centimeter values
ad.connect()                    # Open serial port to AxiDraw

for coord in coords:
    print(coord)
    ad.lineto(coord[0], coord[1])

ad.moveto(0, 0)

ad.disconnect()  

