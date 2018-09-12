var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var server = require('http').createServer(app);
//var io = require('socket.io')(server);
var fs = require('fs');
var path = require('path');
var config = {};
try {config=require('./config.json')} catch(err){};
var port = process.env.PORT || config.port || 3000;
var db=new Group();
server.listen(port, function () {
  console.log('Server listening at port %d', port);
  db.load_from_file('data.json',(group)=>{console.log(JSON.stringify(group))});
  db.addTeam({"id":"fbhh","name":"Fußball","recurrence":[{"weekday":4,"time":"18:30"}],"admintoken":"secret"});
});

app.use(express.static(path.join(__dirname, 'public')));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/api/:r/:t?', function (req, res) {
  switch (req.params.r) {
    case 'getTeam':
      res.json(db.getTeam(req.params.t||req.body.teamid));
      break;
    case 'attend':
      let aevent=db.findEvent(req.body.teamid,req.body.datetime);
      if (aevent) {res.json(aevent.attend(req.body.name))} else {res.json(false)}
      break;
    case 'refuse':
      let revent=db.findEvent(req.body.teamid,req.body.datetime);
      if (revent) {res.json(revent.refuse(req.body.name))} else {res.json(false)}
      break;
    case 'undecided':
      let uevent=db.findEvent(req.body.teamid,req.body.datetime);
      if (uevent) {res.json(uevent.undecided(req.body.name))} else {res.json(false)}
      break;
    case 'getListOfTeamIDs':
      res.json(db.getListOfTeamIDs());
      break;
    default:
      res.json({'error':'not a valid AJAX-API-call'});
  }
})

app.use(function(req, res, next){
  res.sendFile('index.html', { root: path.join(__dirname, 'public')});
});

/*
app.use('/testapi/:r', function (req, res, next) {
  res.setHeader('Access-Control-Allow-Origin','*');
  switch (req.params.r) {
    case 'getTeam':
      res.json(db.getTeam('fbhh'));
      break;
    case 'attend':
      let aevent=db.findEvent('fbhh','2018-09-13T18:30');
      if (aevent) {res.json(aevent.attend('sven'))} else {res.json(false)}
      break;
    case 'refuse':
      let revent=db.findEvent('fbhh','2018-09-13T18:30');
      if (revent) {res.json(revent.refuse('sven'))} else {res.json(false)}
      break;
    case 'undecided':
      let uevent=db.findEvent('fbhh','2018-09-13T18:30');
      if (uevent) {res.json(uevent.undecided('sven'))} else {res.json(false)}
      break;

    case 'addTeam':
      res.json(db.addTeam({"id":"fbhh","name":"Testteam","recurrence":[{"weekday":4,"time":"18:30"},{"weekday":3,"time":"20:00"}]}));
      break;
    case 'editTeam':
      res.json(db.editTeam({"id":"fbhh","name":"","recurrence":[]}));
      break;
    case 'deleteTeam':
      res.json(db.deleteTeam({"id":"fbhh"}));
      break;

    case 'addEvent':
      let ateam=db.findTeam('fbhh');
      if (ateam) {res.json(ateam.addEvent({"datetime":"2018-10-13T11:11","comment":"manually added event"}))} else {res.json(false)}
      break;
    case 'cancelEvent':
      let devent=db.findEvent('fbhh','2018-09-13T18:30');
      if (devent) {res.json(devent.cancelEvent())} else {res.json(false)}
      break;
    case 'reviveEvent':
      let vevent=db.findEvent('fbhh','2018-09-13T18:30');
      if (vevent) {res.json(vevent.reviveEvent())} else {res.json(false)}
      break;
    case 'commentEvent':
      let cevent=db.findEvent('fbhh','2018-09-13T18:30');
      if (cevent) {res.json(cevent.commentEvent('Kommentar zum Event.'))} else {res.json(false)}
      break;
    case 'deleteEvent':
      let dteam=db.findTeam('fbhh');
      if (dteam) {res.json(dteam.deleteEvent({"datetime":"2018-10-13T11:11"}))} else {res.json(false)}
      break;

    case 'load':
      db.load_from_file('data.json',(group)=>{res.json(group)});
      break;
    case 'save':
      db.save_to_file('data.json',(group)=>{res.json(group)});
      break;
    case 'stats':
      res.json(db.status());
      break;
    case 'dump':
      res.json(db);
      break;
    case 'findTeam':
      res.json(db.findTeam('99'));
      break;
    case 'findEvent':
      res.json(db.findEvent('99','2018-10-01T10:00'));
      break;
    default:
      res.send('not a valid API-call');
  }
})
*/


function Group() {}

function Team(json) {
  //todo: stealthen
  this.id=json.hasOwnProperty('id')?json.id:undefined;
  this.name=(json.hasOwnProperty('name')&&(json.name.length))?json.name:undefined;
  if (json.recurrence instanceof Array) {
    this.recurrence=[];
    json.recurrence.forEach((rc)=>{
      if ((rc.hasOwnProperty('weekday'))&&(rc.hasOwnProperty('time'))) {this.recurrence.push({"weekday":rc.weekday,"time":rc.time})}
    });
    if (!this.recurrence.length) {this.recurrence=undefined}
  } else {this.recurrence=undefined}
  this.admintoken=(json.hasOwnProperty('admintoken')&&(json.admintoken.length))?json.admintoken:undefined;
  this.teamtoken=(json.hasOwnProperty('teamtoken')&&(json.teamtoken.length))?json.teamtoken:undefined;
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
  //todo: use of sysop-token
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
  //todo: use of sysop-token
  fs.writeFile(filename, JSON.stringify(this), 'utf8', (err)=>{console.log('File saved. Errors: '+err);callback(this)});
}

Group.prototype.getListOfTeamIDs = function() {
  //todo: use of sysop-token (?)
  if (this.teams instanceof Array) {
    return this.teams.map(t=>t.id);
  } else {return false}
}

Group.prototype.findTeam = function(teamid) {
  //todo: use of teamtoken
  if (this.teams instanceof Array) {
    return this.teams.find(t => t.id==teamid)||false;
  } else {return false}
}

Group.prototype.getTeam = function(teamid) {
  //todo: use of teamtoken
  let t=this.findTeam(teamid);
  if (t) {
    if (!(t.events instanceof Array)) {t.events=[]};
    // groom: delete all past events
    let d=getDateString();
    t.events=t.events.filter(e=>e.datetime>d);
    // groom: delete all events that have no data yet (=events that only have one property that has to be 'datetime')
    // this will delete all automatic generated events without changes/edits (manually added events should have at least one other property)
    t.events=t.events.filter(e=>Object.values(e).reduce((a,c)=>(c!==undefined)?a+1:a,0)>1);
    // backfill: generate future events, if any recurrance is specified
    t.generateNextRecurringEvents();
    // order events by date
    t.events.sort((a,b)=>{return a.datetime>b.datetime});
    if (!t.events.length) {t.events=undefined};
  }
  return t;
}

function getDateString(d) {
  if (!d) {d=new Date()};
  var tzoffset = d.getTimezoneOffset() * 60000;
  return (new Date(d-tzoffset)).toISOString().slice(0, -14);
} 

Team.prototype.generateNextRecurringEvents = function(count) {
  if (this.recurrence instanceof Array) {
    this.recurrence.forEach((rc)=>{
      getNextDaysWithWeekday(rc.weekday,count).forEach((d)=>{this.addEvent({"datetime":d+'T'+(rc.time||'00:00')})});
    });
  }
}

function getNextDaysWithWeekday(weekday,count) {
  let d=new Date(getDateString());
  let offset=(weekday%7)-d.getDay();
  if (offset<0) {offset+=7};
  res=[];
  let i=0;
  while (++i<=(count||4)) {res.push(getDateString(new Date(d.valueOf()+offset*86400000))); offset+=7;}
  return res;
}

Group.prototype.addTeam = function(json) {
  let team=new Team(json);
  if ( (typeof team.id !== 'undefined') && (!this.findTeam(team.id)) )
  {
    if (!(this.teams instanceof Array)) {this.teams=[]};
    this.teams.push(team);
    return team;
  } else {
    return false;
  }
}

Group.prototype.editTeam = function(json) {
  //todo: use of admintoken
  // create a temporary team-object to make use of data-checks in constructor
  let editTeam=new Team(json);
  let team=this.findTeam(editTeam.id);
  if (team) {
    // check for each property, if json-key (!) is not undefined
    // editTeam[key] may be undefined because the constructor made it undefined ... that's ok!
    // that way, a string with no length can replace/delete a current string
    for (let key of Object.keys(editTeam)) {if (json[key]!==undefined) {team[key]=editTeam[key]}};
    return team;
  } else {
    return false;
  }
}

Group.prototype.deleteTeam = function(json) {
  //todo: use of admintoken
  if ( (json.hasOwnProperty('id')) && (this.findTeam(json.id)) ) {
    this.teams=this.teams.filter(t=>t.id!==json.id);
    if (!this.teams.length) {this.teams=undefined; return [];};
    return this.teams;
  } else {return false}
}

Group.prototype.stats = function() {
  //todo: use of sysop-token
  let teamCount=0;
  let eventCount=0;
  let attendCount=0;
  let refusalCount=0;
  try {teamCount=this.teams.length} catch(e) {};
  try {eventCount=this.teams.reduce((a,t)=>a+t.events.length,0)} catch(e) {};
  try {attendCount=this.teams.reduce((a,t)=>a+t.events.reduce((b,u)=>b+((u.attendees instanceof Array)?u.attendees.length:0),0),0)} catch(e) {};
  try {refusalCount=this.teams.reduce((a,t)=>a+t.events.reduce((b,u)=>b+((u.refusals instanceof Array)?u.refusals.length:0),0),0)} catch(e) {};
  return {"teams":teamCount,"events":eventCount,"attendees":attendCount,"refusals":refusalCount};
}

Group.prototype.findEvent = function(teamid,datetime) {
  //todo: use of teamtoken
  let team=this.findTeam(teamid);
  if (team) {return team.findEvent(datetime)} else {return false}
}

Team.prototype.findEvent = function(datetime) {
  //todo: use of teamtoken
  if (this.events instanceof Array) {
    return this.events.find(e => e.datetime==datetime)||false;
  } else {return false}
}

Team.prototype.addEvent = function(json) {
  //todo: use of admintoken
  let event=new Event(json);
  if ( (typeof event.datetime !== 'undefined') && (!this.findEvent(event.datetime)) )
  {
    if (!(this.events instanceof Array)) {this.events=[]};
    this.events.push(event);
    return event;
  } else {
    return false;
  }
}

Team.prototype.deleteEvent = function(json) {
  //todo: use of admintoken
  if ( (json.hasOwnProperty('datetime')) && (this.findEvent(json.datetime)) ) {
    this.events=this.events.filter(e=>e.datetime!==json.datetime);
    if (!this.events.length) {this.events=undefined; return [];};
    return this.events;
  } else {return false}
}

Event.prototype.attend = function(name) {
  //todo: use of teamtoken
  //todo: stealthen
  if (issafe(name)) {
    if (!(this.attendees instanceof Array)) {this.attendees=[]};  
    if (!this.attendees.includes(name)) {this.attendees.push(name)};
    if (this.refusals instanceof Array) {this.refusals=this.refusals.filter(r=>r!==name); if (!this.refusals.length) {this.refusals=undefined};};
    return this;
  } else {return false}
}

Event.prototype.refuse = function(name) {
  //todo: use of teamtoken
  //todo: stealthen
  if (issafe(name)) {
    if (!(this.refusals instanceof Array)) {this.refusals=[]};
    if (!this.refusals.includes(name)) {this.refusals.push(name)};
    if (this.attendees instanceof Array) {this.attendees=this.attendees.filter(a=>a!==name); if (!this.attendees.length) {this.attendees=undefined};};
    return this;
  } else {return false}
}

Event.prototype.undecided = function(name) {
  //todo: use of teamtoken
  //todo: stealthen
  if (issafe(name)) {
    if (this.attendees instanceof Array) {this.attendees=this.attendees.filter(a=>a!==name); if (!this.attendees.length) {this.attendees=undefined};};
    if (this.refusals instanceof Array) {this.refusals=this.refusals.filter(r=>r!==name); if (!this.refusals.length) {this.refusals=undefined};};
    return this;
  } else {return false}
}

Event.prototype.commentEvent = function(comment) {
  //todo: use of teamtoken
  //todo: stealthen
  if (issafe(name)) {
    this.comment=comment;
    return this;
  } else {return false}
}

Event.prototype.cancelEvent = function() {
  //todo: use of admintoken
  this.cancelled=true;
  return this;
}

Event.prototype.reviveEvent = function() {
  //todo: use of admintoken
  this.cancelled=undefined;
  return this;
}


const crypto = require('crypto');
function crypt(str) {
  return crypto.createHmac('sha256','dontwanttousesalthere').update(str).digest('base64');
}
function auth(str,hash) {
  return ( (typeof hash === 'undefined') || (hash === crypt(str)) );
}
function safe_text(text) {return unescape(text).replace(/[^\w\s\däüöÄÜÖß\.,'!\@#$^&%*()\+=\-\[\]\/{}\|:\?]/g,'').slice(0,256)}
function issafe(text) {return !!text}

process.on('SIGINT', function(){console.log('SIGINT'); process.exit()});
process.on('SIGTERM', function(){console.log('SIGTERM'); process.exit()});
