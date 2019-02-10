var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var path = require('path');
var config = {};
try {config=require('./config.json')} catch(err){};
var port = process.env.PORT || config.port || 3000;
var WissenWerKommt = require('./wissenwerkommt.js');
var db=new WissenWerKommt();
server.listen(port, function () {
  db.load_from_file(config.datafilepath,config.datafile,()=>{});
});
module.exports = server;

/* NGINX-sample config
server {
  listen 80;
  server_name localhost;
  location ~* (^/api/)|(^/socket\.io)|(manifest\.json$) {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    proxy_read_timeout 86400s;
  }
  location ~* /[^\.]*$ {
    rewrite ^(.*)$ / break;
    root   /REPLACE_THIS_PATH/wissenwerkommt/public;
    index  index.html;
  }
  location ~* [^/]*\.[^/]*$ {
    root   /REPLACE_THIS_PATH/wissenwerkommt/public;
    index  index.html;
  }
}
*/

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/:id/manifest.json', function (req, res) {
  let tg=db.getTeamorGroup(req.params.id);
  res.json({
    "short_name": tg.name||"wissenwerkommt",
    "name": tg.name||"wissenwerkommt",
    "icons": [
      {"src":"../images/wissenwerkommt192.png","sizes": "192x192","type": "image/png"},
      {"src": "../images/wissenwerkommt512.png","sizes": "512x512","type": "image/png"},
      {"src": "../images/wissenwerkommt1024.png","sizes": "1024x1024","type": "image/png"}
    ],
    "start_url": "/"+req.params.id,
    "background_color": "#fff",
    "theme_color": "#000",
    "display": "standalone"
  });
});
app.use('/api/:r/:id?', function (req, res) {

  if (['attend','refuse','undecided'].find((a)=>a==req.params.r)) {log.add(req.params,req.body)}

  switch (req.params.r) {

    // open
    case 'addGroup':
      res.json(db.addGroup(req.body)||{'error':'groupid invalid or existing'});
      break;
    case 'addTeam':
      res.json(db.addTeam(req.body)||{'error':'teamid invalid or existing'});
      break;
    case 'stats':
      res.json(db.getStats(io));
      break;
    case 'imprint':
      res.json({'imprint':config.imprint});
      break;

    // team members only
    case 'get':
    //case 'getTeam':
    //case 'getGroup':
    //case 'getTeamOrGroup':
      let userlevel=getUserLevel(req);
      if (userlevel>0) {
        let id=(req.params.id||req.body.id||req.body.teamid||req.body.groupid);
        let tg=db.getTeamOrGroup(id);
        let result=false;
        if (tg) {
          result=JSON.parse(JSON.stringify(tg));
          // remove admin token and member-list (in case of a group it includes token) from return-value if userlevel is < 2
          if ((!userlevel)||(userlevel<2)) {result.admintoken=undefined;result.members=undefined;}
          // add userlevel-information to result
          result.userlevel=userlevel;
        } 
        res.json(result);
      } else {res.status(401).json({'error':'not sufficient rights to get team or group or team or group does not exist'})}
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

    // admins only
    case 'editGroup':
      if (getUserLevel(req)>1) {
        res.json(db.editGroup(req.body));
        emitUpdate(req.body.groupid);
      } else {res.status(401).json({'error':'not sufficient rights to edit group'})}
      break;
    case 'addMember':
      if (getUserLevel(req)>1) {
        let agroup=db.findGroup(req.body.groupid);
        if (agroup) {res.json(agroup.addMember({"id":req.body.memberid,"token":req.body.membertoken}));emitUpdate(req.body.groupid)} else {res.json(false)}
      } else {res.status(401).json({'error':'not sufficient rights to add member'})}
      break;
    case 'removeMember':
      if (getUserLevel(req)>1) {
        let agroup=db.findGroup(req.body.groupid);
        if (agroup) {res.json(agroup.removeMember({"id":req.body.memberid}));emitUpdate(req.body.groupid)} else {res.json(false)}
      } else {res.status(401).json({'error':'not sufficient rights to remove member'})}
      break;
    case 'deleteGroup':
      if (getUserLevel(req)>1) {
        res.json(db.deleteGroup(req.body));
        emitUpdate(req.body.groupid);
      } else {res.status(401).json({'error':'not sufficient rights to delete group'})}
      break;
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
        db.groomTeams(false);
        res.json(db);
        db.groomTeams(true);
      } else {res.status(401).json({'error':'not sufficient rights to do that (dump)'})}
      break;
    case 'getAllIDs':
      if (getUserLevel(req)>2) {
        res.json(db.getAllIDs());
      } else {res.status(401).json({'error':'not sufficient rights to do that (getAllIDs)'})}
      break;
    case 'getLog':
      if (getUserLevel(req)>2) {
        res.send(log.read());
      } else {res.status(400).json({'error':'not a valid API-call'})}
      break;

    default:
      res.status(400).json({'error':'not a valid API-call'});

  }

});
app.use(function(req, res, next){if (req.url.lastIndexOf('/')==0) {res.sendFile('index.html',{root:path.join(__dirname,'public')})} else {res.status(404).send()} });

io.on('connection', function (socket) {
  // socket.emit = reply only to the client who asked
  // socket.broadcast.emit = reply to all clients except the one who asked
  // io.sockets.emit = reply to all clients (including the one who asked)
  //socket.emit('data',{welcomemessage: 'Welcome!'});
  socket.on('get', function (req) {
    let userlevel=getUserLevel(req);
    if (userlevel>0) {
      let tg=db.getTeamOrGroup(req.id);
      let tgCopy=false;
      if (tg) {
        tgCopy=JSON.parse(JSON.stringify(tg));
        // remove admin token from return-value if userlevel is < 2
        if ((!userlevel)||(userlevel<2)) {tgCopy.admintoken=undefined;}
        // add userlevel-information to result
        tgCopy.userlevel=userlevel;
      }
      socket.emit('data', JSON.stringify(tgCopy));
    } else {
      socket.emit('data', JSON.stringify({'error':'not sufficient rights to get team or group or team or group does not exist'}));
    }
  });
});

function emitUpdate(id) {
  io.sockets.emit('update',{id:id});
}

function getUserLevel(req) {
  let id=( (req.params?req.params.id:false) || (req.body?(req.body.id||req.body.teamid||req.body.groupid):false) || (req.id?req.id:false) ); // URL-param|JSON-param|Socket-param
  let token=( (req.body?req.body.token:false) || (req.token?req.token:false) );
  if ((token!==undefined)&&(token==config.sysoptoken)) {return 3}
  return db.getUserLevel(id,token);      
}

var log=new Logger(100);
function Logger(maxlength) {this.maxlength=(maxlength||25); this.list=[];}
Logger.prototype.add = function (a,b) {this.list.push([getDateString()+' '+(b.teamid?b.teamid+' ':'')+(b.datetime?b.datetime+' ':'')+a.r+' '+(b.name?b.name+' ':'')+'\n']); while (this.list.length>this.maxlength) {this.list.splice(0,1)};}
function getDateString() {let d=new Date(); return (new Date(d-d.getTimezoneOffset()*60000)).toISOString().slice(0, -5);}
Logger.prototype.read = function () {
  return this.list.reduce((a,c)=>a+c,'');
}

process.on('SIGINT', function(){ if (config.SIGINT==undefined) {config.SIGINT=true; console.log('SIGINT'); db.save_to_file(config.datafilepath,config.datafile,()=>{process.exit(0)},true)} });
process.on('SIGTERM', function(){ if (config.SIGTERM==undefined) {config.SIGTERM=true; console.log('SIGTERM'); db.save_to_file(config.datafilepath,config.datafile,()=>{process.exit(0)},true)} });
