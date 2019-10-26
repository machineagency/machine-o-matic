import sys, cmd, os
import serial, json
from pyaxidraw import axidraw   # import module

def path_coords_to_svg(path_coords) -> str:
    # TODO: compute sensible bounding box
    svg = '<svg width="8in" height="8in" xmlns="http://www.w3.org/2000/svg">'
    svg += '<title>my_svg</title>'
    svg += '\n<path d="M{:.5f},{:.5f}'.format(path_coords[0][0], path_coords[0][1])
    for coord in path_coords[1:]:
        svg += 'L{:.5f},{:.5f}'.format(coord[0], coord[1])
    svg += 'Z" '
    svg += 'transform="translate(0 0)" '
    svg += 'style="fill:none; stroke:#231f20;"/>'
    svg += '\n</svg>'
    return svg

def plot_svg_string(svg_string, axidraw) -> str:
    axidraw.plot_setup(svg_string)
    return axidraw.plot_run(True)

def read_coords_from_file(filepath) -> str:
    with open(filepath, 'r+') as file:
        coord_text = file.read();
        coord_dict = json.loads(coord_text);
        coords = coord_dict['coords']
        file.close();
    return coords

def init_axidraw():
    ad = axidraw.AxiDraw()          # Initialize class
    ad.interactive()                # Enter interactive context
    ad.options.units = 1            # Interpret numbers as centimeter values
    return ad

if __name__ == '__main__':
    try:
        coords = read_coords_from_file('axidraw_interface/AxiDraw_API_v253r4/coords.txt')
        new_svg = path_coords_to_svg(coords)
        # print(new_svg)
        ad = init_axidraw()
        plot_svg_string(new_svg, ad)
    except Exception as e:
        print('Ran into exception while trying to plot: {}'.format(e))


