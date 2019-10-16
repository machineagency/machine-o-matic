'use strict';

// modules =================================================
const express        = require('express');
const app            = express();
const bodyParser     = require('body-parser');
const ps             = require('python-shell');
const path           = require('path');
const fs             = require('fs');

// configuration ===========================================
let port = process.env.PORT || 3000; // set our port
app.use(bodyParser.json()); // for parsing application/json
app.use(express.static(__dirname + '/client')); // set the static files location /public/img will be /img for users

// open a MoM interpreter ==================================

const plotCoordinateFile = 'axidraw_interface/AxiDraw_API_v253r4/coords.txt';

let projectionContour = [[[]]];

let shell;

// routes ==================================================

app.post('/plot', (req, res) => {
    let coordsObj = req.body.coordsObj;
    fs.writeFileSync(plotCoordinateFile, JSON.stringify(coordsObj));
    shell = new ps.PythonShell('axidraw_interface/AxiDraw_API_v253r4/plot_coord_file.py', {
        pythonOptions: ['-u'], // don't buffer messages sent from plot_coord_file.py
    });

    shell.on('message', (message) => {
        console.log(message);
    });

    res.status(200).send(`Plotted ${coordsObj}`);
});

app.post('/projection', (req, res) => {
    let contour = req.body.contour;
    projectionContour = contour;

    res.status(200).send('Received contour.');
});

app.get('/projection', (req, res) => {
    res.status(200).send(projectionContour);
});

// start app ===============================================
app.listen(port, () => {
    console.log("Running on port: " + port);
    exports = module.exports = app;
});

