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
  //db.addTeam({"id":"fbhh","name":"Fußball","recurrence":[{"weekday":4,"time":"18:30"}]});
});

app.use('/api/:r', function (req, res, next) {
  res.setHeader('Access-Control-Allow-Origin','*');
  switch (req.params.r) {
    case 'addTeam':
		  res.json(db.addTeam({"id":"fbhh","name":"Testteam","recurrence":[{"weekday":1,"time":"18:00"},{"weekday":3,"time":"20:00"}]}));
      break;
    case 'getTeam':
      res.json(db.getTeam('fbhh'));
      break;
    case 'addEvent':
      let ateam=db.findTeam('fbhh');
      if (ateam) {res.json(ateam.addEvent({"datetime":"2018-10-13T11:11"}))} else {res.json(false)}
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
    case 'deleteEvent':
      let dteam=db.findTeam('fbhh');
      if (dteam) {res.json(dteam.deleteEvent({"datetime":"2018-10-13T11:11"}))} else {res.json(false)}
      break;
    case 'deleteTeam':
		  res.json(db.deleteTeam({"id":"fbhh"}));
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
      res.send('no a valid API-call');
  }
})
app.use(express.static(path.join(__dirname, 'public')));

function Group() {}

function Team(json) {
  //todo: stealthen
  this.id=json.hasOwnProperty('id')?json.id:undefined;
  this.name=json.hasOwnProperty('name')?json.name:undefined;
  if (json.recurrence instanceof Array) {
  	this.recurrence=[];
  	json.recurrence.forEach((rc)=>{
  		if ((rc.hasOwnProperty('weekday'))&&(rc.hasOwnProperty('time'))) {this.recurrence.push({"weekday":rc.weekday,"time":rc.time})}
  	});
  	if (!this.recurrence.length) {this.recurrence=undefined}
  } else {this.recurrence=undefined}
  this.admintoken=json.hasOwnProperty('admintoken')?json.admintoken:undefined;
  this.teamtoken=json.hasOwnProperty('teamtoken')?json.teamtoken:undefined;
  //todo: use of teamtoken
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
    // groom: delete all past events
    let d=getDateString();
    t.events=t.events.filter(e=>e.datetime>d);
    // groom: delete all events that have no data yet (=events that only have one property that has to be 'datetime')
    // this will delete all automatic generated events without changes/edits (assumption is, that manually added events will have at least one other property)
    t.events=t.events.filter(e=>Object.values(e).reduce((a,c)=>(c!==undefined)?a+1:a,0)>1);
    // backfill: generate future events, if any recurrance is specified
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
  if (this.recurrence instanceof Array) {
    this.recurrence.forEach((rc)=>{
      getNextDaysWithWeekday(rc.weekday,count).forEach((d)=>{this.addEvent({"datetime":d+'T'+(rc.time||'00:00')})});
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
  if (!(this.teams instanceof Array)) {this.teams=[]};
  if ( (typeof team.id !== 'undefined') && (!this.findTeam(team.id)) )
  {
    this.teams.push(team);
    return team;
  } else {
 		if (!this.teams.length) {this.teams=undefined};
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
  if (!(this.events instanceof Array)) {this.events=[]};
  if ( (typeof event.datetime !== 'undefined') && (!this.findEvent(event.datetime)) )
  {
    this.events.push(event);
    return event;
  } else {
 		if (!this.events.length) {this.events=undefined};
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
  if (!(this.attendees instanceof Array)) {this.attendees=[]};
  if (!this.attendees.includes(name)) {this.attendees.push(name)};
  if (this.refusals instanceof Array) {this.refusals=this.refusals.filter(r=>r!==name); if (!this.refusals.length) {this.refusals=undefined};};
  return this;
}

Event.prototype.refuse = function(name) {
  //todo: use of teamtoken
  //todo: stealthen
  if (!(this.refusals instanceof Array)) {this.refusals=[]};
  if (!this.refusals.includes(name)) {this.refusals.push(name)};
  if (this.attendees instanceof Array) {this.attendees=this.attendees.filter(a=>a!==name); if (!this.attendees.length) {this.attendees=undefined};};
  return this;
}

Event.prototype.undecided = function(name) {
  //todo: use of teamtoken
  //todo: stealthen
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
