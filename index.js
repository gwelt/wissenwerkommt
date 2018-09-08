var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var fs = require('fs');
var path = require('path');
var config = {};
try {config=require('./config.json')} catch(err){};
var port = process.env.PORT || config.port || 3000;
var db=new Group();
server.listen(port, function () {
  console.log('Server listening at port %d', port);
  db.load_from_file('data.json',(group)=>{console.log(JSON.stringify(group))});
});

app.use('/api/:r', function (req, res, next) {
  res.setHeader('Access-Control-Allow-Origin','*');
  switch (req.params.r) {
    case 'addTeam':
      res.json(db.addTeam({"id":"99","name":"Testteam","weekdays":[4]}));
      break;
    case 'findTeam':
      res.json(db.findTeam('99'));
      break;
    case 'addEvent':
      let team=db.findTeam('99');
      if (team) {res.json(team.addEvent({"datetime":"201810011000"}))} else {res.json(false)}
      break;
    case 'attend':
      let event=db.findEvent('99','201810011000');
      if (event) {res.json(event.attend('sven'))} else {res.json(false)}
      break;
    case 'dump':
      res.json(db);
      break;
    case 'load':
      db.load_from_file('data.json',(group)=>{res.json(group)});
      break;
    case 'save':
      db.save_to_file('data.json',(group)=>{res.json(group)});
      break;
    default:
      res.send('Valid API-calls: <a href=/api/dump>/api/dump</a>');
  }
})
app.use(express.static(path.join(__dirname, 'public')));

function Group() {
  this.teams=[];
}

function Team(json) {
  this.id=json.hasOwnProperty('id')?json.id:undefined;
  this.name=json.hasOwnProperty('name')?json.name:undefined;
  this.weekdays=json.hasOwnProperty('weekdays')?json.weekdays:undefined;
  this.time=json.hasOwnProperty('time')?json.time:undefined;
  this.admintoken=json.hasOwnProperty('admintoken')?json.admintoken:undefined;
  this.teamtoken=json.hasOwnProperty('teamtoken')?json.teamtoken:undefined;
  if (typeof this.id !== 'undefined') {this.events=[]};
}

function Event(json) {
  this.datetime=json.hasOwnProperty('datetime')?json.datetime:undefined;
  this.attendees=json.hasOwnProperty('attendees')?json.attendees:undefined;
  this.refusals=json.hasOwnProperty('refusals')?json.refusals:undefined;
  this.cancelled=json.hasOwnProperty('cancelled')?json.cancelled:undefined;
  this.cmt=json.hasOwnProperty('comment')?json.comment:undefined;
}

Group.prototype.load_from_file = function(filename,callback) {
  this.teams=[];
  fs.readFile(filename, 'utf8', (err, data)=>{
    if (err){console.log('No data-file.')} else {
      try {g = JSON.parse(data)} catch (err) {g={}};
      if (g.hasOwnProperty('teams')) {
        g.teams.forEach((t)=>{
          let team=this.addTeam(t);
          t.events.forEach((e)=>{team.addEvent(e)});
        });
      }
    }
    callback(this);
  });
}

Group.prototype.save_to_file = function(filename,callback) {
  fs.writeFile(filename, JSON.stringify(this), 'utf8', (err)=>{console.log('File saved. Errors: '+err);callback(this)});
}

Group.prototype.findTeam = function(teamid) {
  return this.teams.filter(t => t.id==teamid)[0]||false;
}

Group.prototype.addTeam = function(json) {
  let team=new Team(json);
  if ( (this.hasOwnProperty('teams'))
     &&(this.teams instanceof Array)
     &&(typeof team.id !== 'undefined')
     &&(this.findTeam(team.id).id!==team.id)
     )
  {
    this.teams.push(team);
    return team;
  } else {
    return false;//{"error":"team could not be added"};
  }
}

Group.prototype.findEvent = function(teamid,datetime) {
  let team=this.findTeam(teamid);
  if (team) {return team.findEvent(datetime)} else {return false}
}

Team.prototype.findEvent = function(datetime) {
  return this.events.filter(e => e.datetime==datetime)[0]||false;
}

Team.prototype.addEvent = function(json) {
  let event=new Event(json);
  if ( (this.hasOwnProperty('events'))
     &&(this.events instanceof Array)
     &&(typeof this.id !== 'undefined')
     &&(typeof event.datetime !== 'undefined')
     &&(this.findEvent(event.datetime).datetime!==event.datetime)
     )
  {
    this.events.push(event);
    return event;
  } else {
    return false;//{"error":"event could not be added"};
  }
}

Event.prototype.attend = function(name) {
  if ( !(this.hasOwnProperty('attendees')) || !(this.attendees instanceof Array) ) {this.attendees=[]}
  this.attendees.push(name);
  //todo: ensure distinction
  return this;
}


const crypto = require('crypto');
function crypt(str) {
  return crypto.createHmac('sha256','dontwanttousesalthere').update(str).digest('base64');
}
function auth(word,hash) {
  return ( (typeof hash === 'undefined') || (hash === crypt(word)) );
}

process.on('SIGINT', function(){console.log('SIGINT'); process.exit()});
process.on('SIGTERM', function(){console.log('SIGTERM'); process.exit()});
