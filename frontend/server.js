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

//Store all JS and CSS in Scripts folder.
// app.use(express.static(__dirname + '/css'));

// routes ==================================================

// Example route
// app.get('/', (req, res) => {
//     res.sendFile(path.join(__dirname + '/client/index.html'));
// });

app.get('/inst/:inst', (req, res) => {
    ps.PythonShell.run('momlang/test.py', { 'pythonPath' : 'python' }, (err, results) => {
        console.log(req.params.inst);
        if (err) {
            console.log(err);
            res.status(400).send(err);
        }
        else {
            console.log(results);
            res.status(200).send(results);
        }
    });
});


// start app ===============================================
app.listen(port, () => {
    console.log("Running on port: " + port);
    exports = module.exports = app;
});

