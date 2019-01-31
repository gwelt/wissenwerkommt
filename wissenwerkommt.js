module.exports = WissenWerKommt;
var fs = require('fs');
var crypto = require('crypto');
var config = {};
try {config=require('./config.json')} catch(err){};

function WissenWerKommt() {
  this.groups=[];
  this.teams=[];
}

// Group <n:n> Team <1:n> Event

// Group (Sparte)
function Group(json) {
  let res=[];
  this.groupid=validateString('id',json.groupid,res);
  this.admintoken=validateString('token',json.admintoken,res);
  this.teamtoken=validateString('token',json.teamtoken,res);
  this.name=validateString('name',json.name,res);
  // TODO: listOfTeamIDsAndTeamToken (members)
  this.members=json.members;
  _debug('GROUP '+this.groupid+' >> '+res);
}

WissenWerKommt.prototype.addGroup = function(json) {
  let group=new Group(json);
  if ( (typeof group.groupid !== 'undefined') && (!this.findTeam(group.groupid)) && (!this.findGroup(group.groupid)) )
  {
    if (!(this.groups instanceof Array)) {this.groups=[]};
    if (this.groups.length<(config.maxGroups||100)) {this.groups.push(group)} else {return false}
    return group;
  } else {
    return false;
  }
}

WissenWerKommt.prototype.editGroup = function(json) {
  // create a temporary group-object to make use of data-checks in constructor
  let editGroup=new Group(json);
  let group=this.findTeam(editGroup.groupid);
  if (group) {
    // exceptional case: new_groupid changes existing groupid (only, if new_groupid does not exist yet)
    if (json['new_groupid']!==undefined) {
      // generate temporary group with new_groupid to check validity and availability of new groupid
      let temp_group=new Group({'groupid':json['new_groupid']});
      if ( (typeof temp_group.groupid !== 'undefined') && (!this.findTeam(temp_group.groupid)) && (!this.findGroup(temp_group.groupid)) ) {
        editGroup.groupid=temp_group.groupid;
      } else {return false}
      json['new_groupid']=undefined;
    }
    // check for each property, if json-key (!) is not undefined
    // that way, a string with no length ('') can delete/undefine a current string
    for (let key of Object.keys(editGroup)) {if (json[key]!==undefined) {group[key]=editGroup[key]}};
    return group;
  } else {
    return false;
  }
}

WissenWerKommt.prototype.deleteGroup = function(json) {
  if ( (json.hasOwnProperty('groupid')) && (this.findGroup(json.groupid)) ) {
    this.groups=this.groups.filter(g=>g.groupid!==json.groupid);
    return true;
  } else {return false}
}


// Team (Mannschaft)
function Team(json) {
  let res=[];
  this.teamid=validateString('id',json.teamid,res);
  this.admintoken=validateString('token',json.admintoken,res);
  this.teamtoken=validateString('token',json.teamtoken,res);
  this.name=validateString('name',json.name,res);
  if (json.recurrence instanceof Array) {
    this.recurrence=[];
    json.recurrence.forEach((rc)=>{
      rc.weekday=validateString('weekday',rc.weekday,res);
      rc.time=validateString('time',rc.time,res);
      if ((this.recurrence.length<7)&&(rc.weekday)&&(rc.time)) {
        this.recurrence.push({"weekday":rc.weekday,"time":rc.time});
      }
    });
    if (!this.recurrence.length) {this.recurrence=undefined}
  } else {this.recurrence=undefined}
  _debug('TEAM '+this.teamid+' >> '+res);
}

// Event (Termin)
function Event(json) {
  let res=[];
  this.datetime=validateString('datetime',json.datetime);
  this.attendees=convertToListOfValidNames(json.attendees);
  this.refusals=convertToListOfValidNames(json.refusals);
  this.cancelled=json.hasOwnProperty('cancelled')&&(json.cancelled===true)?json.cancelled:undefined;
  this.comment=validateString('comment',json.comment);
  _debug('EVENT '+this.datetime+' >> '+res);
}

WissenWerKommt.prototype.getAllIDs = function() {
  var groups=[];
  if (this.groups instanceof Array) {
    groups=this.groups.map(g=>g.groupid).sort();
  }
  var teams=[];
  if (this.teams instanceof Array) {
    teams=this.teams.map(t=>t.teamid).sort();
  }
  return {"groups":groups,"teams":teams};
}

WissenWerKommt.prototype.getTeam = function(teamid,backfill) {
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
    if ((backfill==undefined)||(backfill==true)) {t.generateNextRecurringEvents();}
    // order events by date
    t.events.sort((a,b)=>{return (a.datetime>b.datetime)?1:-1});
    if (!t.events.length) {t.events=undefined};
    return t;
  }
  // if id is not a teamid - it maybe is a groupid ... try it
  return this.getGroup(teamid);
}

WissenWerKommt.prototype.getGroup = function(groupid) {
  let g=this.findGroup(groupid);
  if (g) {
    if (g.members) {
      // filter members with same id as groupid to prevent infinite loop (should only occur when data is manipulated)
      g.members=g.members.filter(m=>m.teamid!=groupid);
      g.members.sort((a,b)=>{return (a.teamid>b.teamid)?1:-1});
      if (!g.members.length) {g.members=undefined};
    }
    return g;
  }
  return false;
}

WissenWerKommt.prototype.groomTeams = function(backfill) {
  // delete all backfilled events from model (you may want do this with (backfill=false) some time to save space - or just to groom)
  // events will automatically be backfilled when getTeam is requested
  this.teams.forEach((t)=>{this.getTeam(t.teamid,backfill)});
}

WissenWerKommt.prototype.addTeam = function(json) {
  let team=new Team(json);
  if ( (typeof team.teamid !== 'undefined') && (!this.findTeam(team.teamid)) && (!this.findGroup(team.teamid)) )
  {
    if (!(this.teams instanceof Array)) {this.teams=[]};
    if (this.teams.length<(config.maxTeams||250)) {this.teams.push(team)} else {return false}
    return team;
  } else {
    return false;
  }
}

WissenWerKommt.prototype.editTeam = function(json) {
  // create a temporary team-object to make use of data-checks in constructor
  let editTeam=new Team(json);
  let team=this.findTeam(editTeam.teamid);
  if (team) {
    // exceptional case: new_teamid changes existing teamid (only, if new_teamid does not exist yet)
    if (json['new_teamid']!==undefined) {
      // generate temporary team with new_teamid to check validity and availability of new teamid
      let temp_team=new Team({'teamid':json['new_teamid']});
      if ( (typeof temp_team.teamid !== 'undefined') && (!this.findTeam(temp_team.teamid)) && (!this.findGroup(temp_team.teamid)) ) {
        editTeam.teamid=temp_team.teamid;
      } else {return false}
      json['new_teamid']=undefined;
    }
    // check for each property, if json-key (!) is not undefined
    // that way, a string with no length ('') can delete/undefine a current string
    for (let key of Object.keys(editTeam)) {if (json[key]!==undefined) {team[key]=editTeam[key]}};
    return team;
  } else {
    return false;
  }
}

WissenWerKommt.prototype.deleteTeam = function(json) {
  if ( (json.hasOwnProperty('teamid')) && (this.findTeam(json.teamid)) ) {
    this.teams=this.teams.filter(t=>t.teamid!==json.teamid);
    //if (!this.teams.length) {this.teams=undefined; return [];};
    return true;
  } else {return false}
}

WissenWerKommt.prototype.getUserLevel = function(id,token) {
  let t=this.findTeam(id);
  let userLevel=0; // not a member
  if (t) {
    if ((t.admintoken)&&(token==t.admintoken)) {
      userLevel=2; // team-admin
    } else {
      if ((!t.teamtoken)||(token==t.teamtoken)) {
        userLevel=1;  // team-member
        if (!t.admintoken) {userLevel=2} // team-admin
      }
    }
  } else {
    let g=this.findGroup(id);
    if (g) {
      if ((g.admintoken)&&(token==g.admintoken)) {
        userLevel=2; // group-admin
      } else {
        if ((!g.teamtoken)||(token==g.teamtoken)) {
          userLevel=1;  // group-member
          if (!g.admintoken) {userLevel=2} // group-admin
        }
      }
    }
  }
  return userLevel;
};

WissenWerKommt.prototype.getStats = function(io) {
  let groupCount=0;
  let teamCount=0;
  let eventCount=0;
  let attendCount=0;
  let refusalCount=0;
  try {groupCount=this.groups.length} catch(e) {};
  try {teamCount=this.teams.length} catch(e) {};
  eventCount=this.teams.reduce((a,t)=>a+=t.events?t.events.length:0,0);
  attendCount=this.teams.reduce((a,t)=>a+=t.events?t.events.reduce((b,u)=>b+=u.attendees?u.attendees.length:0,0):0,0);
  refusalCount=this.teams.reduce((a,t)=>a+=t.events?t.events.reduce((b,u)=>b+=u.refusals?u.refusals.length:0,0):0,0);
  return {"groups":groupCount,"teams":teamCount,"events":eventCount,"attendees":attendCount,"refusals":refusalCount,"md5":hash(JSON.stringify(this)),"kb":Math.round(JSON.stringify(this).length/1024),"users":io.engine.clientsCount+1};
}

WissenWerKommt.prototype.load_from_file = function(filepath,filename,callback) {
  this.teams=[];
  fs.readFile(filepath+'/'+filename, 'utf8', (err, data_encrypted)=>{
    if (err){console.log('No data-file.')} else {
      // decrypt
      try {data_encrypted=decrypt(JSON.parse(data_encrypted))} catch (err) {console.log('decryption failed',err)}
      try {data = JSON.parse(data_encrypted)} catch (err) {data={}};
      if (data.hasOwnProperty('groups')) {
        data.groups.forEach((g)=>{
          let group=this.addGroup(g);
        });
      }
      if (data.hasOwnProperty('teams')) {
        data.teams.forEach((t)=>{
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

WissenWerKommt.prototype.save_to_file = function(filepath,filename,callback,backup) {
  // encrypt
  let data=encrypt(JSON.stringify(this));
  fs.writeFile(filepath+'/'+filename, data, 'utf8', (err)=>{
    console.log('File '+filepath+'/'+filename+' saved.'+(err?' !!! '+err:''));
    // save backup
    if (backup) {
      filepath+='/backup';
      filename=hash(JSON.stringify(this));
      fs.writeFile(filepath+'/'+filename, data, 'utf8', (err)=>{
        console.log('File '+filepath+'/'+filename+' saved.'+(err?' !!! '+err:''));
        callback(this);
      });
    } else {
      callback(this);
    }
  });
}

function encrypt(text) {
 let iv=crypto.randomBytes(16);
 let cipher = crypto.createCipheriv('aes-256-cbc', getCipherKey(process.env.SECRET||config.cryptosecret), iv);
 let encrypted = cipher.update(text);
 encrypted = Buffer.concat([encrypted, cipher.final()]);
 return JSON.stringify({ iv: iv.toString('hex'), encryptedData: encrypted.toString('hex') });
}
function decrypt(text) {
 let iv = Buffer.from(text.iv, 'hex');
 let encryptedText = Buffer.from(text.encryptedData, 'hex');
 let decipher = crypto.createDecipheriv('aes-256-cbc', getCipherKey(process.env.SECRET||config.cryptosecret), iv);
 let decrypted = decipher.update(encryptedText);
 decrypted = Buffer.concat([decrypted, decipher.final()]);
 return decrypted.toString();
}
function getCipherKey(key) {if ((typeof key!= 'string')||(key.length<1)) {key="nosecret"}; while (key.length<32) {key+=key}; while (key.length>32) {key=key.slice(0,-1)}; return key;}

WissenWerKommt.prototype.findGroup = function(groupid) {
  if ((typeof groupid=='string') && this.groups instanceof Array && groupid) {
    return this.groups.find(g => g.groupid==groupid.toLowerCase())||false;
  } else {return false}
}

WissenWerKommt.prototype.findTeam = function(teamid) {
  if ((typeof teamid=='string') && this.teams instanceof Array && teamid) {
    return this.teams.find(t => t.teamid==teamid.toLowerCase())||false;
  } else {return false}
}

WissenWerKommt.prototype.findEvent = function(teamid,datetime) {
  let team=this.findTeam(teamid);
  if (team) {return team.findEvent(datetime)} else {return false}
}

Team.prototype.generateNextRecurringEvents = function(count) {
  if (this.recurrence instanceof Array) {
    this.recurrence.forEach((rc)=>{
      // reduce amount of backfilled/generated events
      if (!count) {count=Math.ceil(4/this.recurrence.length)}
      getNextDaysWithWeekday(rc.weekday,count).forEach((d)=>{this.addEvent({"datetime":d+'T'+(rc.time||'00:00')})});
    });
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
    while (++i<=(count||4)) {res.push(getDateString(new Date(d.valueOf()+offset*86400000))); offset+=step;}
    return res;
  }
}

Team.prototype.addEvent = function(json) {
  let event=new Event(json);
  if ( (typeof event.datetime !== 'undefined') && (!this.findEvent(event.datetime)) )
  {
    // reject events with start-date more than 12 months ahead // 360*86400000
    if ((new Date(event.datetime)-new Date()) > 31104000000) {return false}
    if (!(this.events instanceof Array)) {this.events=[]};
    if (this.events.length<(config.maxEvents||100)) {this.events.push(event)} else {return false}
    return event;
  } else {
    return false;
  }
}

Team.prototype.deleteEvent = function(json) {
  if ( (json.hasOwnProperty('datetime')) && (this.findEvent(json.datetime)) ) {
    this.events=this.events.filter(e=>e.datetime!==json.datetime);
    if (!this.events.length) {this.events=undefined; return [];};
    return this.events;
  } else {return false}
}

Team.prototype.findEvent = function(datetime) {
  if (this.events instanceof Array) {
    return this.events.find(e => e.datetime==datetime)||false;
  } else {return false}
}

Event.prototype.attend = function(name) {
  name=validateString('name',name);
  if (typeof name=='string') {
    if (!(this.attendees instanceof Array)) {this.attendees=[]};
    if ((!this.attendees.includes(name))&&(this.attendees.length<(config.maxIndications||250))) {this.attendees.push(name)};
    if (this.refusals instanceof Array) {this.refusals=this.refusals.filter(r=>r!==name); if (!this.refusals.length) {this.refusals=undefined};};
    return this;
  } else {return false}
}

Event.prototype.refuse = function(name) {
  name=validateString('name',name);
  if (typeof name=='string') {
    if (!(this.refusals instanceof Array)) {this.refusals=[]};
    if ((!this.refusals.includes(name))&&(this.refusals.length<(config.maxIndications||250))) {this.refusals.push(name)};
    if (this.attendees instanceof Array) {this.attendees=this.attendees.filter(a=>a!==name); if (!this.attendees.length) {this.attendees=undefined};};
    return this;
  } else {return false}
}

Event.prototype.undecided = function(name) {
  name=validateString('name',name);
  if (typeof name=='string') {
    if (this.attendees instanceof Array) {this.attendees=this.attendees.filter(a=>a!==name); if (!this.attendees.length) {this.attendees=undefined};};
    if (this.refusals instanceof Array) {this.refusals=this.refusals.filter(r=>r!==name); if (!this.refusals.length) {this.refusals=undefined};};
    return this;
  } else {return false}
}

Event.prototype.commentEvent = function(comment) {
  this.comment=validateString('comment',comment);
  return this;
}

Event.prototype.cancelEvent = function() {
  this.cancelled=true;
  return this;
}

Event.prototype.reviveEvent = function() {
  this.cancelled=undefined;
  return this;
}

function validateString(propertyname,string,res) {
  if (typeof res!='object') {res=[]}
  if (typeof string!='string') {return undefined}
  _debug('VALIDATE >> propertyname='+propertyname+' string='+string+' ('+(typeof string)+')');
  s=string.replace(/[^\w\s\däüöÄÜÖß\.,!\@#$^&*()\+=\-\[\]\/{}\|:\?']/g,'').trim().slice(0,140); // not allowed %; //  unescape(string) // [^\\p{L}\\p{Z}]
  if (s!==string) {res.push(propertyname+": invalid characters removed")};

  switch (propertyname) {
    case 'id':
      if (/^\w{3,16}$/i.test(s)) {
        return s.toLowerCase();
      } else {
        res.push(propertyname+" has to have no other but 3 to 16 word characters (a-z, A-Z, 0-9, _)");
      }
      break;
    case 'token':
      if (/^.{1,16}$/i.test(s)) {
        return s;
      } else {
        res.push(propertyname+" has to have 1 to 16 characters");
      }
      break;
    case 'name':
      if (/^.{1,24}$/i.test(s)) {
        return s;
      } else {
        res.push(propertyname+" has to have 1 to 24 characters");
      }
      break;
    case 'weekday':
      if ((/^\d$/i.test(s))&&(s<=7)) {
        return s;
      } else {
        res.push(propertyname+" has to have value 1 to 7");
      }
      break;
    case 'time':
      if (/^\d{2}:\d{2}$/i.test(s)) {
        return s;
      } else {
        res.push(propertyname+" has to have format \d{2}:\d{2}");
      }
      break;
    case 'datetime':
      var d=new Date(s);
      if (d instanceof Date && !isNaN(d.getTime()) && d.getMonth()+1==s.substring(5,7)) {
        return s;
      } else {
        res.push(propertyname+" has to have format YYYY-MM-DDTHH:MM");
      }
      break;
    case 'comment':
      if (/^.{1,140}$/i.test(s)) {
        return s;
      } else {
        res.push(propertyname+" has to have 1 to 140 characters");
      }
      break;

    default:
      return undefined;
  }

  return undefined;
}

function convertToListOfValidNames(list) {
  let res=[];
  if (list instanceof Array) {
    let names=list.map(name=>validateString('name',name,res)).filter(name=>typeof name=='string');
    _debug('LIST OF NAMES >> '+res);
    if (names.length) {return names}
  }
  return undefined;
}

function getDateString(d) {
  if (!d) {d=new Date()};
  var tzoffset = d.getTimezoneOffset() * 60000;
  return (new Date(d-tzoffset)).toISOString().slice(0, -14);
}

function hash(data) {
  return require('crypto').createHash('md5').update(data).digest("hex");
}

function _debug(m) {0?console.log(m):1};
