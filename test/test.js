var assert = require('chai').assert;
var Group = require('../group.js');
var db=new Group();

describe('Group functions', function() {
	describe('getListOfTeamIDs', function () {
		it('should return the list of current teams', function () {
			assert.isArray(db.getListOfTeamIDs(),'isArray');
			assert.deepEqual(db.getListOfTeamIDs(),[]);
		});
	});
	describe('addTeam', function () {
		it('should add a team to the list of teams, if the team is not present', function () {
			db.addTeam({"teamid":"team1"});
			db.addTeam({"teamid":"team1"});
			assert.include(db.getListOfTeamIDs(),'team1');
			assert.lengthOf(db.getListOfTeamIDs(),1);
			db.addTeam({"teamid":"team2"});
			assert.include(db.getListOfTeamIDs(),'team2');
			assert.lengthOf(db.getListOfTeamIDs(),2);
		});
	});
});

/*
db.load_from_file('../data/data.json',(d)=>{console.log(d)});
*/