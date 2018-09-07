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
      if (db.findTeam('99')) {res.json(db.findTeam('99'))} else {res.json({})};
      break;
    case 'addEvent':
      if (db.findTeam('99')) {res.json(db.findTeam('99').addEvent({"datetime":"201810011000"}))} else {res.json({})}
      break;
    case 'attend':
      if (db.findEvent('99','201810011000')) {res.json(db.findEvent('99','201810011000').attend('sven'))} else {res.json({})}
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

function Team(group,json) {
  if ((group.hasOwnProperty('teams'))&&(group.teams instanceof Array)&&(json.hasOwnProperty('id'))) {
    //todo: check if id is unique/valid
    this.id=json.id;
    this.name=json.hasOwnProperty('name')?json.name:'';
    this.weekdays=json.hasOwnProperty('weekdays')?json.weekdays:[];
    this.time=json.hasOwnProperty('time')?json.time:'';
    this.admintoken=json.hasOwnProperty('admintoken')?json.admintoken:'';
    this.teamtoken=json.hasOwnProperty('teamtoken')?json.teamtoken:'';
    this.events=[];
    group.teams.push(this);
  }
}

function Event(team,json) {
  if ((team.hasOwnProperty('events'))&&(team.events instanceof Array)&&(json.hasOwnProperty('datetime'))) {
    this.datetime=json.datetime;
    this.attendees=json.hasOwnProperty('attendees')?json.attendees:[];
    this.refusals=json.hasOwnProperty('refusals')?json.refusals:[];
    this.cancelled=json.hasOwnProperty('cancelled')?json.cancelled:false;
    this.cmt=json.hasOwnProperty('comment')?json.comment:'';
    team.events.push(this);
  }
}

Group.prototype.load_from_file = function(filename,callback) {
  this.teams=[];
  fs.readFile(filename, 'utf8', (err, data)=>{
    if (err){console.log('No data-file.')} else {
      try {newdb = JSON.parse(data)} catch (err) {newdb={}};
      if (newdb.hasOwnProperty('teams')) {
        newdb.teams.forEach((t)=>{
          let newteam=new Team(this,t);
          if (t.hasOwnProperty('events')) {
            t.events.forEach((e)=>{new Event(newteam,e)});
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

Group.prototype.addTeam = function(json) {
  return new Team(this,json);
}

Group.prototype.findTeam = function(id) {
  return this.teams.filter(t => t.id==id)[0]||false;
}

Group.prototype.findEvent = function(id,datetime) {
  let team=this.findTeam(id);
  if (team) {
    return team.events.filter(e => e.datetime==datetime)[0]||false;
  } else {return false}
}

Team.prototype.addEvent = function(json) {
  return new Event(this,json);
}

Event.prototype.attend = function(name) {
  this.attendees.push(name);
  return this;
}

/*

io.on('connection', function (socket) {
  // socket.emit = reply only to the client who asked
  // socket.broadcast.emit = reply to all clients except the one who asked
  // io.sockets.emit = reply to all clients (including the one who asked)
  //socket.emit('data',{welcomemessage: 'Welcome!'});


  socket.on('get', function () {
    socket.emit('data', JSON.stringify(teamlist));
  });
  socket.on('write', function (json) {
    console.log(json);
    data = JSON.parse(json.data);
    // find teamlist-Item
    var i=0; while (i<teamlist.length && teamlist[i].ID!=data.ID) {i++}
    if (i<teamlist.length && auth(json.code,teamlist[i].Code)) {
      // update in object
      teamlist[i]=new Team(data.ID,data.Name,data.Chef,data.R1,data.R2,data.R3,data.R4,data.R5,data.Standby,crypt(json.code));
      io.sockets.emit('data', JSON.stringify(teamlist));
      io.sockets.emit('info', {ID:data.ID,info:'updated',color:'green'});
    }
    else {
      console.log('Could not find/update ID '+data.ID+'.');
      socket.emit('info', {ID:data.ID,info:'Falscher Code!',color:'red'});
    }
  });
  socket.on('update_all_clients', function () {
    io.sockets.emit('data', JSON.stringify(teamlist));
  });
  socket.on('auth', function (data) {
    var i=0; while (i<teamlist.length && teamlist[i].ID!=data.id) {i++};
    if (i<teamlist.length) {
      socket.emit('authresult', {'id':data.id, 'code':data.code, 'result':auth(data.code,teamlist[i].Code)})
    } else {
      socket.emit('authresult', {'id':data.id, 'code':data.code, 'result':false})
    }
  });

});
*/


const crypto = require('crypto');
function crypt(str) {
  return crypto.createHmac('sha256','dontwanttousesalthere').update(str).digest('base64');
}
function auth(password,hash) {
  //console.log('AUTH '+password+' '+crypt(password)+' '+hash)
  return ( (typeof hash === 'undefined') || (hash === crypt(password)) );
}

process.on('SIGINT', function(){console.log('SIGINT'); process.exit()});
process.on('SIGTERM', function(){console.log('SIGTERM'); process.exit()});
