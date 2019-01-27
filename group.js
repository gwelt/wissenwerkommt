module.exports = Group;
var fs = require('fs');
var crypto = require('crypto');
var config = {};
try {config=require('./config.json')} catch(err){};

function Group() {
  this.teams=[];
}

function Team(json) {
  let res=[];
  this.teamid=validateString('teamid',json.teamid,res);
  this.admintoken=validateString('admintoken',json.admintoken,res);
  this.teamtoken=validateString('teamtoken',json.teamtoken,res);
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

function Event(json) {
  let res=[];
  this.datetime=validateString('datetime',json.datetime);
  this.attendees=convertToListOfValidNames(json.attendees);
  this.refusals=convertToListOfValidNames(json.refusals);
  this.cancelled=json.hasOwnProperty('cancelled')&&(json.cancelled===true)?json.cancelled:undefined;
  this.comment=validateString('comment',json.comment);
  _debug('EVENT '+this.datetime+' >> '+res);
}

Group.prototype.getListOfTeamIDs = function() {
  if (this.teams instanceof Array) {
    return this.teams.map(t=>t.teamid).sort();
  } else {return false}
}

Group.prototype.getTeam = function(teamid,backfill) {
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
  return false;
}

Group.prototype.groomTeams = function(backfill) {
  // delete all backfilled events from model (you may want do this with (backfill=false) some time to save space - or just to groom)
  // events will automatically be backfilled when getTeam is requested
  this.teams.forEach((t)=>{this.getTeam(t.teamid,backfill)});
}

Group.prototype.addTeam = function(json) {
  let team=new Team(json);
  if ( (typeof team.teamid !== 'undefined') && (!this.findTeam(team.teamid)) )
  {
    if (!(this.teams instanceof Array)) {this.teams=[]};
    if (this.teams.length<(config.maxTeams||250)) {this.teams.push(team)} else {return false}
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
    // exceptional case: new_teamid changes existing teamid (only, if new_teamid does not exist yet)
    if (json['new_teamid']!==undefined) {
      // generate temporary team with new_teamid to check validity and availability of new teamid
      let temp_team=new Team({'teamid':json['new_teamid']});
      if ( (typeof temp_team.teamid !== 'undefined') && (!this.findTeam(temp_team.teamid)) ) {
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

Group.prototype.deleteTeam = function(json) {
  if ( (json.hasOwnProperty('teamid')) && (this.findTeam(json.teamid)) ) {
    this.teams=this.teams.filter(t=>t.teamid!==json.teamid);
    //if (!this.teams.length) {this.teams=undefined; return [];};
    return true;
  } else {return false}
}

Group.prototype.getUserLevel = function(teamid,token) {
  let t=this.findTeam(teamid);
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
  }
  return userLevel;
};

Group.prototype.getStats = function(io) {
  let teamCount=0;
  let eventCount=0;
  let attendCount=0;
  let refusalCount=0;
  try {teamCount=this.teams.length} catch(e) {};
  eventCount=this.teams.reduce((a,t)=>a+=t.events?t.events.length:0,0);
  attendCount=this.teams.reduce((a,t)=>a+=t.events?t.events.reduce((b,u)=>b+=u.attendees?u.attendees.length:0,0):0,0);
  refusalCount=this.teams.reduce((a,t)=>a+=t.events?t.events.reduce((b,u)=>b+=u.refusals?u.refusals.length:0,0):0,0);
  return {"teams":teamCount,"events":eventCount,"attendees":attendCount,"refusals":refusalCount,"hash":hash(JSON.stringify(this)),"size":formatByteSize(JSON.stringify(this).length),"users":io.engine.clientsCount+1};
}
function formatByteSize(bytes) {
    if(bytes < 1024) return bytes + " bytes";
    else if(bytes < 1048576) return(bytes / 1024).toFixed(3) + " KiB";
    else if(bytes < 1073741824) return(bytes / 1048576).toFixed(3) + " MiB";
    else return(bytes / 1073741824).toFixed(3) + " GiB";
};

Group.prototype.load_from_file = function(filepath,filename,callback) {
  this.teams=[];
  fs.readFile(filepath+'/'+filename, 'utf8', (err, data)=>{
    if (err){console.log('No data-file.')} else {
      // decrypt
      try {data=decrypt(JSON.parse(data))} catch (err) {console.log('decryption failed',err)}
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

Group.prototype.save_to_file = function(filepath,filename,callback,backup) {
  //if (this.teams.length==0) {callback(this)}
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

Group.prototype.findTeam = function(teamid) {
  if ((typeof teamid=='string') && this.teams instanceof Array && teamid) {
    return this.teams.find(t => t.teamid==teamid.toLowerCase())||false;
  } else {return false}
}

Group.prototype.findEvent = function(teamid,datetime) {
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
    case 'teamid':
      if (/^\w{3,16}$/i.test(s)) {
        return s.toLowerCase();
      } else {
        res.push(propertyname+" has to have no other but 3 to 16 word characters (a-z, A-Z, 0-9, _)");
      }
      break;
    case 'admintoken':
    case 'teamtoken':
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
