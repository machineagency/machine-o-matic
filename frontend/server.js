'use strict';

// modules =================================================
let express        = require('express');
let app            = express();
let bodyParser     = require('body-parser');
let pythonShell    = require('python-shell');
let path           = require('path');

// configuration ===========================================
let port = process.env.PORT || 3000; // set our port
app.use(bodyParser.json()); // for parsing application/json
app.use(express.static(__dirname + '/client')); // set the static files location /public/img will be /img for users

//Store all JS and CSS in Scripts folder.
app.use(express.static(__dirname + '/css'));

// routes ==================================================
// require('./routes.js')(app, runningInCloud); // pass our application into our routes

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname + '/client/index.html'));
});


// start app ===============================================
app.listen(port, () => {
    console.log("Running on port: " + port);
    exports = module.exports = app;
});

