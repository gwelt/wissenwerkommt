var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var server = require('http').createServer(app);
var fs = require('fs');
var path = require('path');
var config = {};
try {config=require('./config.json')} catch(err){};
var port = process.env.PORT || config.port || 3000;
var db=new Group();
server.listen(port, function () {
  console.log('Server listening at port %d', port);
  db.load_from_file(config.datafilepath+'/'+config.datafile,(group)=>{console.log(JSON.stringify(group))});
});

app.use(express.static(path.join(__dirname, 'public')));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/api/:r/:t?', function (req, res) {
  
  switch (req.params.r) {

    // open
    case 'getListOfTeamIDs':
      res.json(db.getListOfTeamIDs());
      break;
    case 'addTeam':
      res.json(db.addTeam(req.body));
      break;
    case 'stats':
      res.json(db.stats());
      break;

    // team members only
    case 'getTeam':
      if (getUserLevel(req)>-1) {
        res.json(db.getTeam(req.params.t||req.body.teamid));
      } else {res.json({'error':'not sufficient rights to get team'})}
      break;
    case 'attend':
      if (getUserLevel(req)>0) {
        let aevent=db.findEvent(req.body.teamid,req.body.datetime);
        if (aevent) {res.json(aevent.attend(req.body.name))} else {res.json(false)}
      } else {res.json({'error':'not sufficient rights to attend'})}
      break;
    case 'refuse':
      if (getUserLevel(req)>0) {
        let revent=db.findEvent(req.body.teamid,req.body.datetime);
        if (revent) {res.json(revent.refuse(req.body.name))} else {res.json(false)}
      } else {res.json({'error':'not sufficient rights to refuse'})}
      break;
    case 'undecided':
      if (getUserLevel(req)>0) {
        let uevent=db.findEvent(req.body.teamid,req.body.datetime);
        if (uevent) {res.json(uevent.undecided(req.body.name))} else {res.json(false)}
      } else {res.json({'error':'not sufficient rights to undecide'})}
      break;
    case 'commentEvent':
      if (getUserLevel(req)>0) {
        let cevent=db.findEvent(req.body.teamid,req.body.datetime);
        if (cevent) {res.json(cevent.commentEvent(req.body.comment))} else {res.json(false)}
      } else {res.json({'error':'not sufficient rights to comment event'})}
      break;
  
    // team admins only
    case 'editTeam':
        if (getUserLevel(req)>1) {
        res.json(db.editTeam(req.body));
      } else {res.json({'error':'not sufficient rights to edit team'})}
      break;
    case 'deleteTeam':
        if (getUserLevel(req)>1) {
        res.json(db.deleteTeam(req.body));
      } else {res.json({'error':'not sufficient rights to delete team'})}
      break;
    case 'addEvent':
      if (getUserLevel(req)>1) {
        let ateam=db.findTeam(req.body.teamid);
        if (ateam) {res.json(ateam.addEvent({"datetime":req.body.datetime,"comment":req.body.comment}))} else {res.json(false)}
      } else {res.json({'error':'not sufficient rights to add event'})}
      break;
    case 'cancelEvent':
      if (getUserLevel(req)>1) {
        let devent=db.findEvent(req.body.teamid,req.body.datetime);
        if (devent) {res.json(devent.cancelEvent())} else {res.json(false)}
      } else {res.json({'error':'not sufficient rights to cancel event'})}
      break;
    case 'reviveEvent':
      if (getUserLevel(req)>1) {
        let vevent=db.findEvent(req.body.teamid,req.body.datetime);
        if (vevent) {res.json(vevent.reviveEvent())} else {res.json(false)}
      } else {res.json({'error':'not sufficient rights to revive event'})}
      break;
    case 'deleteEvent':
      if (getUserLevel(req)>1) {
        let dteam=db.findTeam(req.body.teamid);
        if (dteam) {res.json(dteam.deleteEvent({"datetime":req.body.datetime}))} else {res.json(false)}
      } else {res.json({'error':'not sufficient rights to delete event'})}
      break;

    // sysops only
    case 'load':
      if (getUserLevel(req)>2) {
        db.load_from_file(config.datafilepath+'/'+config.datafile,(db)=>{res.json(db)});
      } else {res.json({'error':'not sufficient rights to do that (load)'})}
      break;
    case 'save':
      if (getUserLevel(req)>2) {
        db.save_to_file(config.datafilepath+'/'+config.datafile,(db)=>{res.json(db)});
      } else {res.json({'error':'not sufficient rights to do that (save)'})}
      break;
    case 'dump':
      if (getUserLevel(req)>2) {
        res.json(db);
      } else {res.json({'error':'not sufficient rights to do that (dump)'})}
      break;

    default:
      res.json({'error':'not a valid AJAX-API-call'});

  }

})

app.use(function(req, res, next){
  res.sendFile('index.html', { root: path.join(__dirname, 'public')});
});


function Group() {
  this.teams=[];
}

function Team(json) {
  //todo: stealthen
  this.teamid=((json.hasOwnProperty('teamid'))&&(json.teamid.length))?json.teamid:undefined;
  this.admintoken=(json.hasOwnProperty('admintoken')&&(json.admintoken.length))?json.admintoken.trim():undefined;
  this.teamtoken=(json.hasOwnProperty('teamtoken')&&(json.teamtoken.length))?json.teamtoken.trim():undefined;
  this.name=(json.hasOwnProperty('name')&&(json.name.length))?json.name:undefined;
  if (json.recurrence instanceof Array) {
    this.recurrence=[];
    json.recurrence.forEach((rc)=>{
      if ((rc.hasOwnProperty('weekday'))&&(rc.hasOwnProperty('time'))) {this.recurrence.push({"weekday":rc.weekday,"time":rc.time})}
    });
    if (!this.recurrence.length) {this.recurrence=undefined}
  } else {this.recurrence=undefined}
}

function Event(json) {
  //todo: stealthen
  this.datetime=json.hasOwnProperty('datetime')?json.datetime:undefined;
  this.attendees=(json.attendees instanceof Array)?json.attendees:undefined;
  this.refusals=(json.refusals instanceof Array)?json.refusals:undefined;
  this.cancelled=json.hasOwnProperty('cancelled')?json.cancelled:undefined;
  this.comment=(json.hasOwnProperty('comment')&&(json.comment.length))?json.comment:undefined;
}

Group.prototype.getListOfTeamIDs = function() {
  if (this.teams instanceof Array) {
    return this.teams.map(t=>t.teamid);
  } else {return false}
}

Group.prototype.getTeam = function(teamid) {
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
    t.events.sort((a,b)=>{return (a.datetime>b.datetime)?1:-1});
    if (!t.events.length) {t.events=undefined};
  }
  // remove admin token from return-value
  var t_res = JSON.parse(JSON.stringify(t));
  t_res.admintoken=undefined;
  return t_res;
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
  let step=7; // step one week, if event recurs weekly
  // calc the days it takes till the next event takes place (first offset)
  let offset=(weekday%7)-d.getDay();
  if (offset<0) {offset+=step};
  // 7 is set, if the event recurs every day
  if (weekday==7) {offset=0; step=1};
  res=[];
  let i=0;
  // 8 is set, if the event has no recurrence
  if (weekday==8) {i=9999};
  while (++i<=(count||4)) {res.push(getDateString(new Date(d.valueOf()+offset*86400000))); offset+=step;}
  return res;
}

Event.prototype.attend = function(name) {
  //todo: stealthen
  if (issafe(name)) {
    if (!(this.attendees instanceof Array)) {this.attendees=[]};  
    if (!this.attendees.includes(name)) {this.attendees.push(name)};
    if (this.refusals instanceof Array) {this.refusals=this.refusals.filter(r=>r!==name); if (!this.refusals.length) {this.refusals=undefined};};
    return this;
  } else {return false}
}

Event.prototype.refuse = function(name) {
  //todo: stealthen
  if (issafe(name)) {
    if (!(this.refusals instanceof Array)) {this.refusals=[]};
    if (!this.refusals.includes(name)) {this.refusals.push(name)};
    if (this.attendees instanceof Array) {this.attendees=this.attendees.filter(a=>a!==name); if (!this.attendees.length) {this.attendees=undefined};};
    return this;
  } else {return false}
}

Event.prototype.undecided = function(name) {
  //todo: stealthen
  if (issafe(name)) {
    if (this.attendees instanceof Array) {this.attendees=this.attendees.filter(a=>a!==name); if (!this.attendees.length) {this.attendees=undefined};};
    if (this.refusals instanceof Array) {this.refusals=this.refusals.filter(r=>r!==name); if (!this.refusals.length) {this.refusals=undefined};};
    return this;
  } else {return false}
}

Group.prototype.addTeam = function(json) {
  let team=new Team(json);
  if ( (typeof team.teamid !== 'undefined') && (!this.findTeam(team.teamid)) )
  {
    if (!(this.teams instanceof Array)) {this.teams=[]};
    this.teams.push(team);
    return team;
  } else {
    return false;
  }
}

Group.prototype.editTeam = function(json) {
  // create a temporary team-object to make use of data-checks in constructor
  let editTeam=new Team(json);
  let team=this.findTeam(editTeam.teamid);
  if (team) {
    // check for each property, if json-key (!) is not undefined
    // that way, a string with no length ('') can delete/undefine a current string
    // exceptional case: do not delete/undefine admintoken, if it's left blank
    if (json['admintoken']=='') {json['admintoken']=undefined};
    for (let key of Object.keys(editTeam)) {if (json[key]!==undefined) {team[key]=editTeam[key]}};
    return team;
  } else {
    return false;
  }
}

Group.prototype.deleteTeam = function(json) {
  if ( (json.hasOwnProperty('teamid')) && (this.findTeam(json.teamid)) ) {
    this.teams=this.teams.filter(t=>t.teamid!==json.teamid);
    //if (!this.teams.length) {this.teams=undefined; return [];};
    return true;
  } else {return false}
}

Team.prototype.addEvent = function(json) {
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

Event.prototype.commentEvent = function(comment) {
  //todo: stealthen
  if (issafe(comment)) {
    this.comment=comment;
    if ((this.hasOwnProperty('comment'))&&(!this.comment.length)) {this.comment=undefined}
    return this;
  } else {return false}
}

Event.prototype.cancelEvent = function() {
  this.cancelled=true;
  return this;
}

Event.prototype.reviveEvent = function() {
  this.cancelled=undefined;
  return this;
}

Team.prototype.deleteEvent = function(json) {
  if ( (json.hasOwnProperty('datetime')) && (this.findEvent(json.datetime)) ) {
    this.events=this.events.filter(e=>e.datetime!==json.datetime);
    if (!this.events.length) {this.events=undefined; return [];};
    return this.events;
  } else {return false}
}

Group.prototype.stats = function() {
  let teamCount=0;
  let eventCount=0;
  let attendCount=0;
  let refusalCount=0;
  try {teamCount=this.teams.length} catch(e) {};
  eventCount=this.teams.reduce((a,t)=>a+=t.events?t.events.length:0,0);
  attendCount=this.teams.reduce((a,t)=>a+=t.events?t.events.reduce((b,u)=>b+=u.attendees?u.attendees.length:0,0):0,0);
  refusalCount=this.teams.reduce((a,t)=>a+=t.events?t.events.reduce((b,u)=>b+=u.refusals?u.refusals.length:0,0):0,0);
  return {"teams":teamCount,"events":eventCount,"attendees":attendCount,"refusals":refusalCount};
}

Group.prototype.load_from_file = function(filename,callback) {
  this.teams=[];
  fs.readFile(filename, 'utf8', (err, data)=>{
    if (err){console.log('No data-file.')} else {
      try {group = JSON.parse(data)} catch (err) {group={}};
      if (group.hasOwnProperty('teams')) {
        group.teams.forEach((t)=>{
          let team=this.addTeam(t);
          if ((team)&&(t.hasOwnProperty('events'))) {
            t.events.forEach((e)=>{team.addEvent(e)});
          } 
        });
      }
    }
    callback(this);
  });
}

Group.prototype.save_to_file = function(filename,callback) {
  fs.writeFile(filename, JSON.stringify(this), 'utf8', (err)=>{
    console.log('File '+filename+' saved. Errors: '+err);
    callback(this);
  });
}


Group.prototype.findTeam = function(teamid) {
  if (this.teams instanceof Array) {
    return this.teams.find(t => t.teamid==teamid)||false;
  } else {return false}
}

Group.prototype.findEvent = function(teamid,datetime) {
  let team=this.findTeam(teamid);
  if (team) {return team.findEvent(datetime)} else {return false}
}

Team.prototype.findEvent = function(datetime) {
  if (this.events instanceof Array) {
    return this.events.find(e => e.datetime==datetime)||false;
  } else {return false}
}



const crypto = require('crypto');
function crypt(str) {
  return crypto.createHmac('sha256','dontwanttousesalthere').update(str).digest('base64');
}
function auth(str,hash) {
  return ( (typeof hash === 'undefined') || (hash === crypt(str)) );
}

function getUserLevel(req) {
  let team=db.findTeam(req.params.t||req.body.teamid);
  let userLevel=0; // not a member
  if (team) {
    if ((team.admintoken)&&(req.body.token==team.admintoken)) {
      userLevel=2; // admin
    } else {
      if ((!team.teamtoken)||(req.body.token==team.teamtoken)) {
        userLevel=1;  // team member
        if (!team.admintoken) {userLevel=2} // admin
      }
    }
  }
  if ((req.body.token==config.sysoptoken) && (req.body.token!==undefined)) {userLevel=3} // todo: sysop
  //console.log('team:'+req.body.teamid+' teamtoken:'+team.teamtoken+' usertoken:'+req.body.token+' = '+userLevel);
  return userLevel;
};

function safe_text(text) {return unescape(text).replace(/[^\w\s\däüöÄÜÖß\.,'!\@#$^&%*()\+=\-\[\]\/{}\|:\?]/g,'').slice(0,256)}
function issafe(text) {return text==safe_text(text)}

process.on('SIGINT', function(){console.log('SIGINT'); db.save_to_file(config.datafilepath+'/temp_'+getDateString().slice(8,10)+'_'+config.datafile,()=>{process.exit()}); });
process.on('SIGTERM', function(){console.log('SIGTERM'); db.save_to_file(config.datafilepath+'/temp_'+getDateString().slice(8,10)+'_'+config.datafile,()=>{process.exit()}); });
