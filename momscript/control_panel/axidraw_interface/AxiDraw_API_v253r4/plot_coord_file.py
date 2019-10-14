import sys, cmd, os
import serial, json
from pyaxidraw import axidraw   # import module

def path_coords_to_svg(path_coords) -> str:
    svg = '<svg width=“500” height=“500" xmlns=“http://www.w3.org/2000/svg“>'
    # NOTE: this is an SVG with only one path, if you need more than
    # one path, use another outer loop and update accordingly
    svg += '\n<polygon points='
    for coord in path_coords:
        svg += '{:.5f},{:.5f} '.format(coord[0], coord[1])
    svg += ' style="fill=none; stroke:black; stroke-width:1;"/>'
    svg += '\n</svg>'
    return svg


with open('axidraw_interface/AxiDraw_API_v253r4/coords.txt', 'r+') as file:
    coord_text = file.read();
    coord_dict = json.loads(coord_text);
    coords = coord_dict['coords']
    file.close();

print(path_coords_to_svg(coords))
exit()

ad = axidraw.AxiDraw()          # Initialize class
ad.interactive()                # Enter interactive context
ad.options.units = 1            # Interpret numbers as centimeter values
ad.connect()                    # Open serial port to AxiDraw

for coord in coords:
    print(coord)
    ad.lineto(coord[0], coord[1])

ad.moveto(0, 0)

ad.disconnect()

