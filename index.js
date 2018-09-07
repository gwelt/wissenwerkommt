var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var path = require('path');
var config = {};
try {config=require('./config.json')} catch(err){console.log(err)};
var port = process.env.PORT || config.port || 3000;
server.listen(port, function () {
  console.log('Server listening at port %d', port);
});


app.use('/api/:r', function (req, res, next) {
  res.setHeader('Access-Control-Allow-Origin','*');
  switch (req.params.r) {
    case 'add':
      db.teams.push(new Team('1','2','3','4','5','6'));
      res.json(get_object_by_id(db.teams,'1'));
      break;
    case 'teams':
      res.json(db);
      break;
    case 'load':
      load_from_file();
      res.send('load');
      break;
    case 'save':
      save_to_file();
      res.send('save');
      break;
    default:
      res.send('Valid API-calls: <a href=/api/teams>/api/teams</a>');
  }
})
app.use(express.static(path.join(__dirname, 'public')));

function Group(id) {
  this.id=id;
  this.teams=[];
  this.events=[];
}
var db=new Group(0);

function Team(id,name,weekdays,time,admintoken,teamtoken) {
  this.id=id;
  this.name=name;
  this.weekdays=weekdays;
  this.time=time;
  this.admintoken=admintoken;
  this.teamtoken=teamtoken;
}

function get_object_by_id (objectlist,id) {
  return objectlist.filter(o => o.id==id)[0];
}

var fs = require('fs');
function load_from_file() {
	fs.readFile('data.json', 'utf8', function readFileCallback(err, data){
	  if (err){console.log('Creating new data-file.'); write_to_file()} else {
	    try {db = JSON.parse(data)} catch (err){console.log(err)};
	    let teams='No'; if (db.hasOwnProperty('teams')) {teams=db.teams.length};
	    console.log(teams+' team-datasets imported from data-file.');
	    let events='No'; if (db.hasOwnProperty('events')) {events=db.events.length};
	    console.log(events+' event-datasets imported from data-file.');
	  }
	});	
}

function save_to_file() {
   fs.writeFile('data.json', JSON.stringify(db), 'utf8', (err)=>{console.log('File saved. Errors: '+err)});    
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
