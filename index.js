var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var path = require('path');
var config = {};
try {config=require('./config.json')} catch(err){};
var port = process.env.PORT || config.port || 3000;
var Group = require('./group.js');
var db=new Group();
server.listen(port, function () {
  db.load_from_file(config.datafilepath,config.datafile,(group)=>{});
});
module.exports = server;

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/:t/manifest.json/:n?', function (req, res) {
  res.json({
    "short_name": req.params.n||"wissenwerkommt",
    "name": req.params.n||"wissenwerkommt",
    "icons": [
      {
        "src":(req.params.n?"../":"")+"../images/apple-touch-icon-precomposed.png",
        "sizes": "192x192",
        "type": "image/png"
      }
    ],
    "start_url": "/"+req.params.t,
    "background_color": "#fff",
    "theme_color": "#000",
    "display": "standalone"
  });
});
app.use('/api/:r/:t?', function (req, res) {
  switch (req.params.r) {

    // open
    case 'getListOfTeamIDs':
      res.json(db.getListOfTeamIDs());
      break;
    case 'addTeam':
      res.json(db.addTeam(req.body)||{'error':'teamid invalid or existing'});
      break;
    case 'stats':
      res.json(db.getStats(io));
      break;
    case 'getUserLevel':
      res.json(getUserLevel(req));
      break;

    // team members only
    case 'getTeam':
      let userlevel=getUserLevel(req);
      if (userlevel>0) {
        let team=db.getTeam(req.params.t||req.body.teamid);
        let teamCopy=false;
        if (team) {
          teamCopy=JSON.parse(JSON.stringify(team));
          // remove admin token from return-value if userlevel is < 2
          if ((!userlevel)||(userlevel<2)) {teamCopy.admintoken=undefined;}
          // add userlevel-information to result
          teamCopy.userlevel=userlevel;
        }
        res.json(teamCopy);
      } else {res.status(401).json({'error':'not sufficient rights to get team or team does not exist'})}
      break;
    case 'attend':
      if (getUserLevel(req)>0) {
        let aevent=db.findEvent(req.body.teamid,req.body.datetime);
        if (aevent) {res.json(aevent.attend(req.body.name));emitUpdate(req.body.teamid)} else {res.status(403).json({'error':'event not found'})}
      } else {res.status(401).json({'error':'not sufficient rights to attend'})}
      break;
    case 'refuse':
      if (getUserLevel(req)>0) {
        let revent=db.findEvent(req.body.teamid,req.body.datetime);
        if (revent) {res.json(revent.refuse(req.body.name));emitUpdate(req.body.teamid)} else {res.status(403).json({'error':'event not found'})}
      } else {res.status(401).json({'error':'not sufficient rights to refuse'})}
      break;
    case 'undecided':
      if (getUserLevel(req)>0) {
        let uevent=db.findEvent(req.body.teamid,req.body.datetime);
        if (uevent) {res.json(uevent.undecided(req.body.name));emitUpdate(req.body.teamid)} else {res.status(403).json({'error':'event not found'})}
      } else {res.status(401).json({'error':'not sufficient rights to undecide'})}
      break;
    case 'commentEvent':
      if (getUserLevel(req)>0) {
        let cevent=db.findEvent(req.body.teamid,req.body.datetime);
        if (cevent) {res.json(cevent.commentEvent(req.body.comment));emitUpdate(req.body.teamid)} else {res.status(403).json({'error':'event not found'})}
      } else {res.status(401).json({'error':'not sufficient rights to comment event'})}
      break;

    // team admins only
    case 'editTeam':
      if (getUserLevel(req)>1) {
        res.json(db.editTeam(req.body));
        emitUpdate(req.body.teamid);
      } else {res.status(401).json({'error':'not sufficient rights to edit team'})}
      break;
    case 'deleteTeam':
      if (getUserLevel(req)>1) {
        res.json(db.deleteTeam(req.body));
        emitUpdate(req.body.teamid);
      } else {res.status(401).json({'error':'not sufficient rights to delete team'})}
      break;
    case 'addEvent':
      if (getUserLevel(req)>1) {
        let ateam=db.findTeam(req.body.teamid);
        if (ateam) {res.json(ateam.addEvent({"datetime":req.body.datetime,"comment":req.body.comment}));emitUpdate(req.body.teamid)} else {res.json(false)}
      } else {res.status(401).json({'error':'not sufficient rights to add event'})}
      break;
    case 'cancelEvent':
      if (getUserLevel(req)>1) {
        let devent=db.findEvent(req.body.teamid,req.body.datetime);
        if (devent) {res.json(devent.cancelEvent());emitUpdate(req.body.teamid)} else {res.json(false)}
      } else {res.status(401).json({'error':'not sufficient rights to cancel event'})}
      break;
    case 'reviveEvent':
      if (getUserLevel(req)>1) {
        let vevent=db.findEvent(req.body.teamid,req.body.datetime);
        if (vevent) {res.json(vevent.reviveEvent());emitUpdate(req.body.teamid)} else {res.json(false)}
      } else {res.status(401).json({'error':'not sufficient rights to revive event'})}
      break;
    case 'deleteEvent':
      if (getUserLevel(req)>1) {
        let dteam=db.findTeam(req.body.teamid);
        if (dteam) {res.json(dteam.deleteEvent({"datetime":req.body.datetime}));emitUpdate(req.body.teamid)} else {res.json(false)}
      } else {res.status(401).json({'error':'not sufficient rights to delete event'})}
      break;

    // sysops only
    case 'load':
      if (getUserLevel(req)>2) {
        db.load_from_file(config.datafilepath,config.datafile,(db)=>{res.json(db)});
      } else {res.status(401).json({'error':'not sufficient rights to do that (load)'})}
      break;
    case 'save':
      if (getUserLevel(req)>2) {
        db.save_to_file(config.datafilepath,config.datafile,(db)=>{res.json(db)},true);
      } else {res.status(401).json({'error':'not sufficient rights to do that (save)'})}
      break;
    case 'dump':
      if (getUserLevel(req)>2) {
        res.json(db);
      } else {res.status(401).json({'error':'not sufficient rights to do that (dump)'})}
      break;

    default:
      res.status(400).json({'error':'not a valid AJAX-API-call'});

  }

});
app.use(function(req, res, next){res.sendFile('index.html',{root:path.join(__dirname,'public')})});

io.on('connection', function (socket) {
  // socket.emit = reply only to the client who asked
  // socket.broadcast.emit = reply to all clients except the one who asked
  // io.sockets.emit = reply to all clients (including the one who asked)
  //socket.emit('data',{welcomemessage: 'Welcome!'});
  socket.on('getTeam', function (req) {
    //console.log('io:'+JSON.stringify(req));
    let userlevel=getUserLevel(req);
    if (userlevel>0) {
      let team=db.getTeam(req.teamid);
      let teamCopy=false;
      if (team) {
        teamCopy=JSON.parse(JSON.stringify(team));
        // remove admin token from return-value if userlevel is < 2
        if ((!userlevel)||(userlevel<2)) {teamCopy.admintoken=undefined;}
        // add userlevel-information to result
        teamCopy.userlevel=userlevel;
      }
      socket.emit('team', JSON.stringify(teamCopy));
    } else {
      socket.emit('team', JSON.stringify({'error':'not sufficient rights to get team or team does not exist'}));
    }
  });
});

function emitUpdate(teamid) {
  io.sockets.emit('update',{teamid:teamid});
}

function getUserLevel(req) {
  if ((typeof req=='object')&&(req.body)&&(req.params)) {
    let teamid=req.params.t||req.body.teamid;
    let token=req.body.token;
    if ((token==config.sysoptoken) && (token!==undefined)) {return 3}
    return db.getUserLevel(teamid,token);
  }
  else {
    let teamid=req.teamid;
    let token=req.token;
    if ((token==config.sysoptoken) && (token!==undefined)) {return 3}
    return db.getUserLevel(teamid,token);
  }
}

process.on('SIGINT', function(){ if (config.SIGINT==undefined) {config.SIGINT=true; console.log('SIGINT'); db.save_to_file(config.datafilepath,config.datafile,()=>{process.exit(0)},true)} });
process.on('SIGTERM', function(){ if (config.SIGTERM==undefined) {config.SIGTERM=true; console.log('SIGTERM'); db.save_to_file(config.datafilepath,config.datafile,()=>{process.exit(0)},true)} });
