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
app.use('/:teamid?/manifest.json', function (req, res) {
  let teamid=(req.params.teamid)||'';
  let tg=db.getTeam(teamid);
  res.json({
    "short_name": tg.name||"wissenwerkommt",
    "name": tg.name||"wissenwerkommt",
    "icons": [
      {"src": "/images/wissenwerkommt192.png","sizes": "192x192","type": "image/png"},
      {"src": "/images/wissenwerkommt512.png","sizes": "512x512","type": "image/png"},
      {"src": "/images/wissenwerkommt1024.png","sizes": "1024x1024","type": "image/png"}
    ],
    "start_url": "/"+teamid,
    "background_color": "#fff",
    "theme_color": "#000",
    "display": "standalone"
  });
});
app.use('/api/:r/:teamid?', function (req, res) {

  if (['attend','refuse','undecided'].find((a)=>a==req.params.r)) {log.add(req.params,req.body)}

  switch (req.params.r) {

    // open
    case 'addTeam':
      let r=db.addTeam(req.body);
      if (r) {
        res.status(201).json(db.addTeam(req.body));
      } else {
        res.status(409).json({'error':'conflict (409) - teamid invalid or existing'});
      }
      break;
    case 'stats':
      res.status(200).json(db.getStats(io));
      break;
    case 'imprint':
      res.status(200).json({'imprint':config.imprint});
      break;

    // team members only
    case 'get':
      let userlevel=getUserLevel(req);
      if (userlevel>0) {
        let tg=db.getTeam((req.params.teamid||req.body.teamid));
        let result={'error':'team does not exist'};
        if (tg) {
          result=JSON.parse(JSON.stringify(tg));
          // remove admin token and member-list from return-value if userlevel is < 2
          if ((!userlevel)||(userlevel<2)) {result.admintoken=undefined}
          // add userlevel-information to result
          result.userlevel=userlevel;
        } 
        res.status(200).json(result);
      } else {res.status(401).json({'error':'unauthorized (401) - not sufficient rights to get team or team does not exist'})}
      break;
    case 'attend':
      if (getUserLevel(req)>0) {
        let aevent=db.findEvent(req.body.teamid,req.body.datetime);
        if (aevent) {res.status(200).json(aevent.attend(req.body.name));emitUpdate(req.body.teamid)} else {res.status(403).json({'error':'event not found'})}
      } else {res.status(401).json({'error':'not sufficient rights to attend'})}
      break;
    case 'refuse':
      if (getUserLevel(req)>0) {
        let revent=db.findEvent(req.body.teamid,req.body.datetime);
        if (revent) {res.status(200).json(revent.refuse(req.body.name));emitUpdate(req.body.teamid)} else {res.status(403).json({'error':'event not found'})}
      } else {res.status(401).json({'error':'not sufficient rights to refuse'})}
      break;
    case 'undecided':
      if (getUserLevel(req)>0) {
        let uevent=db.findEvent(req.body.teamid,req.body.datetime);
        if (uevent) {res.status(200).json(uevent.undecided(req.body.name));emitUpdate(req.body.teamid)} else {res.status(403).json({'error':'event not found'})}
      } else {res.status(401).json({'error':'not sufficient rights to undecide'})}
      break;
    case 'commentEvent':
      if (getUserLevel(req)>0) {
        let cevent=db.findEvent(req.body.teamid,req.body.datetime);
        if (cevent) {res.status(200).json(cevent.commentEvent(req.body.comment));emitUpdate(req.body.teamid)} else {res.status(403).json({'error':'event not found'})}
      } else {res.status(401).json({'error':'not sufficient rights to comment event'})}
      break;

    // admins only
    case 'editTeam':
      if (getUserLevel(req)>1) {
        res.status(200).json(db.editTeam(req.body));
        emitUpdate(req.body.teamid);
      } else {res.status(401).json({'error':'not sufficient rights to edit team'})}
      break;
    case 'deleteTeam':
      if (getUserLevel(req)>1) {
        res.status(200).json(db.deleteTeam(req.body));
        emitUpdate(req.body.teamid);
      } else {res.status(401).json({'error':'not sufficient rights to delete team'})}
      break;
    case 'addEvent':
      if (getUserLevel(req)>1) {
        let ateam=db.findTeam(req.body.teamid);
        if (ateam) {res.status(201).json(ateam.addEvent({"datetime":req.body.datetime,"comment":req.body.comment}));emitUpdate(req.body.teamid)} else {res.status(200).json(false)}
      } else {res.status(401).json({'error':'not sufficient rights to add event'})}
      break;
    case 'cancelEvent':
      if (getUserLevel(req)>1) {
        let devent=db.findEvent(req.body.teamid,req.body.datetime);
        if (devent) {res.status(200).json(devent.cancelEvent());emitUpdate(req.body.teamid)} else {res.status(200).json(false)}
      } else {res.status(401).json({'error':'not sufficient rights to cancel event'})}
      break;
    case 'reviveEvent':
      if (getUserLevel(req)>1) {
        let vevent=db.findEvent(req.body.teamid,req.body.datetime);
        if (vevent) {res.status(200).json(vevent.reviveEvent());emitUpdate(req.body.teamid)} else {res.status(200).json(false)}
      } else {res.status(401).json({'error':'not sufficient rights to revive event'})}
      break;
    case 'deleteEvent':
      if (getUserLevel(req)>1) {
        let dteam=db.findTeam(req.body.teamid);
        if (dteam) {res.status(200).json(dteam.deleteEvent({"datetime":req.body.datetime}));emitUpdate(req.body.teamid)} else {res.status(200).json(false)}
      } else {res.status(401).json({'error':'not sufficient rights to delete event'})}
      break;

    // sysops only
    case 'load':
      if (getUserLevel(req)>2) {
        db.load_from_file(config.datafilepath,config.datafile,(db)=>{res.status(200).json(db)});
      } else {res.status(401).json({'error':'not sufficient rights to do that (load)'})}
      break;
    case 'save':
      if (getUserLevel(req)>2) {
        db.save_to_file(config.datafilepath,config.datafile,(db)=>{res.status(200).json(db)},true);
      } else {res.status(401).json({'error':'not sufficient rights to do that (save)'})}
      break;
    case 'dump':
      if (getUserLevel(req)>2) {
        db.groomTeams(false);
        res.status(200).json(db);
        db.groomTeams(true);
      } else {res.status(401).json({'error':'not sufficient rights to do that (dump)'})}
      break;
    case 'getLog':
      if (getUserLevel(req)>2) {
        res.status(200).send(log.read());
      } else {res.status(401).json({'error':'not sufficient rights to do that (getLog)'})}
      break;
    case 'getAllIDs':
      if (getUserLevel(req)>2) {
        res.status(200).json(db.getAllIDs());
      //} else {res.status(401).json({'error':'not sufficient rights to do that (getAllIDs)'})}
      } else {res.status(200).json({})}
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
      let tg=db.getTeam(req.teamid);
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
      socket.emit('data', JSON.stringify({'error':'not sufficient rights to get team or team does not exist'}));
    }
  });
});

function emitUpdate(teamid) {
  io.sockets.emit('update', JSON.stringify({teamid:teamid}));
}

function getUserLevel(req) {
  let teamid=( (req.params?req.params.teamid:false) || (req.body?(req.body.teamid):false) || (req.teamid?req.teamid:false) ); // URL-param|JSON-param|Socket-param
  let token=( (req.body?req.body.token:false) || (req.token?req.token:false) );
  if ((token!==undefined)&&(token==config.sysoptoken)) {return 3}
  return db.getUserLevel(teamid,token);      
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
