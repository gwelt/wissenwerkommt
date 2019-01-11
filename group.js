var fs = require('fs');
module.exports = Group;

function Group() {
  this.teams=[];
}

function Team(json) {
  this.teamid=((json.hasOwnProperty('teamid'))&&(json.teamid.length)&&(isValidTeamID(json.teamid)))?json.teamid.toLowerCase():undefined;
  this.admintoken=(json.hasOwnProperty('admintoken')&&(json.admintoken.trim().length)&&(issafe(json.admintoken.trim(),16)))?json.admintoken.trim():undefined;
  this.teamtoken=(json.hasOwnProperty('teamtoken')&&(json.teamtoken.trim().length)&&(issafe(json.teamtoken.trim(),16)))?json.teamtoken.trim():undefined;
  this.name=(json.hasOwnProperty('name')&&(json.name.trim().length)&&(issafe(json.name.trim(),32)))?json.name.trim():undefined;
  if (json.recurrence instanceof Array) {
    this.recurrence=[];
    json.recurrence.forEach((rc)=>{
      if ((this.recurrence.length<7)&&(rc.hasOwnProperty('weekday'))&&(rc.weekday<=7)&&(/^\d$/i.test(rc.weekday))&&(rc.hasOwnProperty('time'))&&(/^\d{2}:\d{2}$/i.test(rc.time))) {
        this.recurrence.push({"weekday":rc.weekday,"time":rc.time});
      } 
    });
    if (!this.recurrence.length) {this.recurrence=undefined}
  } else {this.recurrence=undefined}
}

function Event(json) {
  this.datetime=(json.hasOwnProperty('datetime')&&(isValidDate(json.datetime)))?json.datetime:undefined;
  this.attendees=json.hasOwnProperty('attendees')?convertToListOfValidNames(json.attendees):undefined;
  this.refusals=json.hasOwnProperty('refusals')?convertToListOfValidNames(json.refusals):undefined;
  this.cancelled=json.hasOwnProperty('cancelled')&&(json.cancelled===true)?json.cancelled:undefined;
  this.comment=(json.hasOwnProperty('comment')&&(json.comment.length)&&(issafe(json.comment,140)))?json.comment:undefined;
}

function convertToListOfValidNames(list) {
  if (list instanceof Array) {
    return list.map(name=>safe_text(name,32));
  } 
  return undefined;
}

Group.prototype.getListOfTeamIDs = function() {
  if (this.teams instanceof Array) {
    return this.teams.map(t=>t.teamid).sort();
  } else {return false}
}

Group.prototype.getTeam = function(teamid,userlevel) {
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
  var t_res = JSON.parse(JSON.stringify(t));
  // add userlevel-information to result
  t_res.userlevel=userlevel;
  // remove admin token from return-value if userlevel is < 2
  if ((!userlevel)||(userlevel<2)) {t_res.admintoken=undefined;}
  return t_res;
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

function getDateString(d) {
  if (!d) {d=new Date()};
  var tzoffset = d.getTimezoneOffset() * 60000;
  return (new Date(d-tzoffset)).toISOString().slice(0, -14);
} 

Team.prototype.generateNextRecurringEvents = function(count) {
  if (this.recurrence instanceof Array) {
    this.recurrence.forEach((rc)=>{
      // reduce amount of backfilled/generated events
      if (!count) {count=Math.ceil(4/this.recurrence.length)}
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
  // if (weekday>7) {i=9999}; // will not occur anymore
  while (++i<=(count||4)) {res.push(getDateString(new Date(d.valueOf()+offset*86400000))); offset+=step;}
  return res;
}

Event.prototype.attend = function(name) {
  if (issafe(name,32)) {
    if (!(this.attendees instanceof Array)) {this.attendees=[]};  
    if (!this.attendees.includes(name)) {this.attendees.push(name)};
    if (this.refusals instanceof Array) {this.refusals=this.refusals.filter(r=>r!==name); if (!this.refusals.length) {this.refusals=undefined};};
    return this;
  } else {return false}
}

Event.prototype.refuse = function(name) {
  if (issafe(name,32)) {
    if (!(this.refusals instanceof Array)) {this.refusals=[]};
    if (!this.refusals.includes(name)) {this.refusals.push(name)};
    if (this.attendees instanceof Array) {this.attendees=this.attendees.filter(a=>a!==name); if (!this.attendees.length) {this.attendees=undefined};};
    return this;
  } else {return false}
}

Event.prototype.undecided = function(name) {
  if (issafe(name,32)) {
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
    if (this.teams.length<250) {this.teams.push(team)} else {return false}
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
    // if (json['admintoken']=='') {json['admintoken']=undefined};

    // exceptional case: new_teamid changes existing teamid (only, if new_teamid does not exist yet)
    if (json['new_teamid']!==undefined) {
      // generate temporary team with new_teamid to check validity and availability of new teamid
      let temp_team=new Team({'teamid':json['new_teamid']});
      if ( (typeof temp_team.teamid !== 'undefined') && (!this.findTeam(temp_team.teamid)) ) {
        editTeam.teamid=temp_team.teamid;
      } else {return false}
      json['new_teamid']=undefined;
    }

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
    if (this.events.length<100) {this.events.push(event)} else {return false}
    return event;
  } else {
    return false;
  }
}

Event.prototype.commentEvent = function(comment) {
  //todo: stealthen
  if (issafe(comment,140)) {
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
  return {"teams":teamCount,"events":eventCount,"attendees":attendCount,"refusals":refusalCount,"memorysize":memorySizeOf(this),"JSONsize":formatByteSize(JSON.stringify(this).length)};
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
  if ((typeof teamid=='string') && this.teams instanceof Array && teamid) {
    return this.teams.find(t => t.teamid==teamid.toLowerCase())||false;
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

function memorySizeOf(obj) {
    var bytes = 0;
    function sizeOf(obj) {
        if(obj !== null && obj !== undefined) {
            switch(typeof obj) {
            case 'number':
                bytes += 8;
                break;
            case 'string':
                bytes += obj.length * 2;
                break;
            case 'boolean':
                bytes += 4;
                break;
            case 'object':
                var objClass = Object.prototype.toString.call(obj).slice(8, -1);
                if(objClass === 'Object' || objClass === 'Array') {
                    for(var key in obj) {
                        if(!obj.hasOwnProperty(key)) continue;
                        sizeOf(obj[key]);
                    }
                } else bytes += obj.toString().length * 2;
                break;
            }
        }
        return bytes;
    };
    return formatByteSize(sizeOf(obj));
};
function formatByteSize(bytes) {
    if(bytes < 1024) return bytes + " bytes";
    else if(bytes < 1048576) return(bytes / 1024).toFixed(3) + " KiB";
    else if(bytes < 1073741824) return(bytes / 1048576).toFixed(3) + " MiB";
    else return(bytes / 1073741824).toFixed(3) + " GiB";
};

const crypto = require('crypto');
function crypt(str) {
  return crypto.createHmac('sha256','dontwanttousesalthere').update(str).digest('base64');
}
function auth(str,hash) {
  return ( (typeof hash === 'undefined') || (hash === crypt(str)) );
}

function safe_text(text,maxlength) {return unescape(text).replace(/[^\w\s\däüöÄÜÖß\.,'!\@#$^&%*()\+=\-\[\]\/{}\|:\?]/g,'').trim().slice(0,maxlength||140)}
function issafe(text,maxlength) {return text==safe_text(text,maxlength)}
function safe_id(id) {return unescape(id).replace(/\W/g,'').slice(0,16)}
function issafe_id(id) {return id==safe_id(id)&&id.length>2}
function isValidTeamID(teamid) {return teamid.trim()==teamid&&issafe_id(teamid)}
function isValidDate(datestring) {var d=new Date(datestring); return d instanceof Date && !isNaN(d.getTime()) && d.getMonth()+1==datestring.substring(5,7);}
