'use strict';

// modules =================================================
let express        = require('express');
let app            = express();
let bodyParser     = require('body-parser');
let ps             = require('python-shell');
let path           = require('path');

// configuration ===========================================
let port = process.env.PORT || 3000; // set our port
app.use(bodyParser.json()); // for parsing application/json
app.use(express.static(__dirname + '/client')); // set the static files location /public/img will be /img for users

// open a MoM interpreter ==================================
//
// TODO: move this to an API call when the user compiles, sending the mom program
let shell = new ps.PythonShell('momlang/interpreter.py', {
    pythonPath : 'python', // use python 2
    pythonOptions: ['-u'], // don't buffer messages sent from interpreter.py
    args: [ 'momlang/xy_plotter.mom' ]
});

shell.on('message', (message) => {
    console.log(message);
});

// routes ==================================================

app.post('/inst', (req, res) => {
    let command = req.body.command;
    shell.send(command);
    res.status(200).send('Sent command.');
});


// start app ===============================================
app.listen(port, () => {
    console.log("Running on port: " + port);
    exports = module.exports = app;
});

