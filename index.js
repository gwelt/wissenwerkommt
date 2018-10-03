var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var server = require('http').createServer(app);
var path = require('path');
var config = {};
try {config=require('./config.json')} catch(err){};
var port = process.env.PORT || config.port || 3000;
var Group = require('./group.js');
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

function getDateString(d) {
  if (!d) {d=new Date()};
  var tzoffset = d.getTimezoneOffset() * 60000;
  return (new Date(d-tzoffset)).toISOString().slice(0, -14);
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

process.on('SIGINT', function(){console.log('SIGINT'); db.save_to_file(config.datafilepath+'/temp_'+getDateString().slice(8,10)+'_'+config.datafile,()=>{process.exit()}); });
process.on('SIGTERM', function(){console.log('SIGTERM'); db.save_to_file(config.datafilepath+'/temp_'+getDateString().slice(8,10)+'_'+config.datafile,()=>{process.exit()}); });
