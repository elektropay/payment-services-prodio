let express = require('express');
let app = express();

let DB_NAME ="ezpaydental";
let PORT ="5959";

app.listen(PORT);

let Agenda = require('agenda');
let Agendash = require('agendash');

let agenda = new Agenda({db: {address: 'mongodb://localhost/'+DB_NAME},useNewUrlParser:true});
// or provide your own mongo client:
// var agenda = new Agenda({mongo: myMongoClient})

app.use('/', Agendash(agenda));