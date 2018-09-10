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
  db.addTeam({"id":"99","name":"Testteam","weekdays":[4,1],"time":"18:00"});
});

app.use('/api/:r', function (req, res, next) {
  res.setHeader('Access-Control-Allow-Origin','*');
  switch (req.params.r) {
    case 'getTeam':
      res.json(db.getTeam('99'));
      break;
    case 'attend':
      let aevent=db.findEvent('99','2018-10-01T18:00');
      if (aevent) {res.json(aevent.attend('sven'))} else {res.json(false)}
      break;
    case 'refuse':
      let revent=db.findEvent('99','2018-10-01T18:00');
      if (revent) {res.json(revent.refuse('sven'))} else {res.json(false)}
      break;
    case 'undecided':
      let uevent=db.findEvent('99','2018-10-01T18:00');
      if (uevent) {res.json(uevent.undecided('sven'))} else {res.json(false)}
      break;
    case 'addEvent':
      let team=db.findTeam('99');
      if (team) {res.json(team.addEvent({"datetime":"2018-10-01T18:00"}))} else {res.json(false)}
      break;
    case 'addTeam':
      res.json(db.addTeam({"id":"99","name":"Testteam","weekdays":[4],"time":"18:00"}));
      break;
    /*
    case 'load':
      db.load_from_file('data.json',(group)=>{res.json(group)});
      break;
    */
    case 'save':
      db.save_to_file('data.json',(group)=>{res.json(group)});
      break;
    case 'findTeam':
      res.json(db.findTeam('99'));
      break;
    case 'findEvent':
      res.json(db.findEvent('99','2018-10-01T10:00'));
      break;
    case 'dump':
      res.json(db);
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
  //todo: stealthen
  this.id=json.hasOwnProperty('id')?json.id:undefined;
  this.name=json.hasOwnProperty('name')?json.name:undefined;
  this.weekdays=(json.weekdays instanceof Array)?json.weekdays:undefined;
  this.time=json.hasOwnProperty('time')?json.time:undefined;
  this.admintoken=json.hasOwnProperty('admintoken')?json.admintoken:undefined;
  this.teamtoken=json.hasOwnProperty('teamtoken')?json.teamtoken:undefined;
  if (typeof this.id !== 'undefined') {this.events=[]};
}

function Event(json) {
  //todo: stealthen
  this.datetime=json.hasOwnProperty('datetime')?json.datetime:undefined;
  this.attendees=(json.attendees instanceof Array)?json.attendees:undefined;
  this.refusals=(json.refusals instanceof Array)?json.refusals:undefined;
  this.cancelled=json.hasOwnProperty('cancelled')?json.cancelled:undefined;
  this.comment=json.hasOwnProperty('comment')?json.comment:undefined;
}

Group.prototype.load_from_file = function(filename,callback) {
  this.teams=[];
  fs.readFile(filename, 'utf8', (err, data)=>{
    if (err){console.log('No data-file.')} else {
      try {group = JSON.parse(data)} catch (err) {group={}};
      if (group.hasOwnProperty('teams')) {
        group.teams.forEach((t)=>{
          let team=this.addTeam(t);
          if (t.hasOwnProperty('events')) {
            t.events.forEach((e)=>{team.addEvent(e)});
          } 
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
  return this.teams.find(t => t.id==teamid)||false;
}

Group.prototype.getTeam = function(teamid) {
  let t=this.findTeam(teamid);
  if (t) {
    // groom: delete all past events
    t.events=t.events.filter(e=>e.datetime>(getDateString()));
    // backfill: generate missing future events, if any weekday for recurring events is specified in t.weekdays
    t.generateNextRecurringEvents();
    // order events by date
    t.events.sort((a,b)=>{return a.datetime>b.datetime});
  }
  return t;
}

function getDateString(d) {
  if (!d) {d=new Date()};
  var tzoffset = d.getTimezoneOffset() * 60000;
  return (new Date(d-tzoffset)).toISOString().slice(0, -14);
} 

Team.prototype.generateNextRecurringEvents = function(count) {
  if (this.weekdays instanceof Array) {
    this.weekdays.forEach((wd)=>{
      getNextDaysWithWeekday(wd,count).forEach((d)=>{this.addEvent({"datetime":d+'T'+(this.time||'00:00')})});
    });
  }
}

function getNextDaysWithWeekday(weekday,count) {
  d=new Date(getDateString());
  let offset=(weekday%7)-d.getDay();
  if (offset<0) {offset+=7};
  res=[];
  let i=0;
  while (++i<=(count||4)) {res.push(getDateString(new Date(d.valueOf()+offset*86400000))); offset+=7;}
  return res;
}

Group.prototype.addTeam = function(json) {
  let team=new Team(json);
  if ( (this.hasOwnProperty('teams'))
     &&(this.teams instanceof Array)
     &&(typeof team.id !== 'undefined')
     &&(!this.findTeam(team.id))
     )
  {
    this.teams.push(team);
    return team;
  } else {
    return false;
  }
}

Group.prototype.findEvent = function(teamid,datetime) {
  let team=this.findTeam(teamid);
  if (team) {return team.findEvent(datetime)} else {return false}
}

Team.prototype.findEvent = function(datetime) {
  return this.events.find(e => e.datetime==datetime)||false;
}

Team.prototype.addEvent = function(json) {
  let event=new Event(json);
  if ( (this.hasOwnProperty('events'))
     &&(this.events instanceof Array)
     &&(typeof event.datetime !== 'undefined')
     &&(!this.findEvent(event.datetime))
     )
  {
    this.events.push(event);
    return event;
  } else {
    return false;
  }
}

Event.prototype.attend = function(name) {
  if (!(this.attendees instanceof Array)) {this.attendees=[]};
  if (!this.attendees.includes(name)) {this.attendees.push(name)};
  if (this.refusals instanceof Array) {this.refusals=this.refusals.filter(r=>r!==name); if (!this.refusals.length) {this.refusals=undefined};};
  return this;
}

Event.prototype.refuse = function(name) {
  if (!(this.refusals instanceof Array)) {this.refusals=[]};
  if (!this.refusals.includes(name)) {this.refusals.push(name)};
  if (this.attendees instanceof Array) {this.attendees=this.attendees.filter(a=>a!==name); if (!this.attendees.length) {this.attendees=undefined};};
  return this;
}

Event.prototype.undecided = function(name) {
  if (this.attendees instanceof Array) {this.attendees=this.attendees.filter(a=>a!==name); if (!this.attendees.length) {this.attendees=undefined};};
  if (this.refusals instanceof Array) {this.refusals=this.refusals.filter(r=>r!==name); if (!this.refusals.length) {this.refusals=undefined};};
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
