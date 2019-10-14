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

const plotCoordinateFile = 'axidraw_interface/coords.txt';

let shell;

// routes ==================================================

app.post('/plot', (req, res) => {
    let coordText = req.body.coordText;
    fs.writeFileSync(plotCoordinateFile, coordText);
    console.log(coordText);
    // shell = new ps.PythonShell('momlang/interpreter.py', {
    //     pythonPath : 'python', // use python 2
    //     pythonOptions: ['-u'], // don't buffer messages sent from interpreter.py
    //     args: [ momProgramFilename ]
    // });

    // shell.on('message', (message) => {
    //     console.log(message);
    // });

    // console.log(`Created an interpreter with program:\n ${momProgram}`);

    res.status(200).send('Wrote program.mom');
});

app.post('/inst', (req, res) => {
    let inst = req.body.inst;
    shell.send(inst);
    res.status(200).send('Sent command.');
});


// start app ===============================================
app.listen(port, () => {
    console.log("Running on port: " + port);
    exports = module.exports = app;
});

