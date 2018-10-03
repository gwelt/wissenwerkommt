/* SUPERTEST HTTP/REST-API TESTS */
const request = require('supertest');
var app = require('../index');
app.close();

// OPEN REST-REQUESTS

describe('POST /api/addTeam', function() {
  it('should add Team G20', function(done) {
    request(app)
      .post('/api/addTeam')
      .send({teamid:'teamG20',name:'Team G20',recurrence:[{weekday:"7",time:"12:15"}]})
      .set('Accept', 'application/json')
      .expect(200)
      .end(function(err, res) {
        if (err) throw err;
        console.log(res.text);
        done();
      });
  });
});

describe('GET /api/getListOfTeamIDs', function() {
  it('should respond with a list of all team-IDs', function(done) {
    request(app)
      .get('/api/getListOfTeamIDs')
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
	  .end(function(err, res) {
	    if (err) throw err;
	    console.log(res.text);
	    done();
	  });
  });
});

describe('GET /api/stats', function() {
  it('respond with json', function(done) {
    request(app)
      .get('/api/stats')
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
	  .end(function(err, res) {
	    if (err) throw err;
	    console.log(res.text);
	    done();
	  });
  });
});

// TEAM REST-REQUESTS

describe('GET /api/getTeam', function() {
  it('should get /api/getTeam of teamG20', function(done) {
    request(app)
      .get('/api/getTeam')
      .send({teamid:'teamG20'})
      .set('Accept', 'application/json')
      .expect(200)
      .end(function(err, res) {
        if (err) throw err;
        console.log(res.text);
        done();
      });
  });
});

function getDateString(d) {
  if (!d) {d=new Date()};
  var tzoffset = d.getTimezoneOffset() * 60000;
  return (new Date(d-tzoffset)).toISOString().slice(0, -14);
} 

describe('PUT /api/attend a non-existing event', function() {
  it('should deny attending an event with HTTP status code 403', function(done) {
    request(app)
      .put('/api/attend')
      .send({teamid:'teamG20',datetime:'2011-10-06T12:15',name:'SuperSven'})
      .set('Accept', 'application/json')
      .expect(403)
      .end(function(err, res) {
        if (err) throw err;
        console.log(res.text);
        done();
      });
  });
});

describe('PUT /api/attend', function() {
  it('should attend an event', function(done) {
    request(app)
      .put('/api/attend')
      .send({teamid:'teamG20',datetime:getDateString()+'T12:15',name:'SuperSven'})
      .set('Accept', 'application/json')
      .expect(200)
      .end(function(err, res) {
        if (err) throw err;
        console.log(res.text);
        done();
      });
  });
});

describe('PUT /api/commentEvent', function() {
  it('should comment an event', function(done) {
    request(app)
      .put('/api/commentEvent')
      .send({teamid:'teamG20',datetime:getDateString()+'T12:15',comment:'I like this event.'})
      .set('Accept', 'application/json')
      .expect(200)
      .end(function(err, res) {
        if (err) throw err;
        console.log(res.text);
        done();
      });
  });
});

describe('GET /api/getTeam', function() {
  it('should get /api/getTeam of teamG20', function(done) {
    request(app)
      .get('/api/getTeam')
      .send({teamid:'teamG20'})
      .set('Accept', 'application/json')
      .expect(200)
      .end(function(err, res) {
        if (err) throw err;
        console.log(res.text);
        done();
      });
  });
});

describe('PUT /api/refuse', function() {
  it('should refuse an event', function(done) {
    request(app)
      .put('/api/refuse')
      .send({teamid:'teamG20',datetime:getDateString()+'T12:15',name:'SuperSven'})
      .set('Accept', 'application/json')
      .expect(200)
      .end(function(err, res) {
        if (err) throw err;
        console.log(res.text);
        done();
      });
  });
});

describe('PUT /api/undecided', function() {
  it('should undecide an event', function(done) {
    request(app)
      .put('/api/undecided')
      .send({teamid:'teamG20',datetime:getDateString()+'T12:15',name:'SuperSven'})
      .set('Accept', 'application/json')
      .expect(200)
      .end(function(err, res) {
        if (err) throw err;
        console.log(res.text);
        done();
      });
  });
});

describe('PUT /api/commentEvent', function() {
  it('should comment an event', function(done) {
    request(app)
      .put('/api/commentEvent')
      .send({teamid:'teamG20',datetime:getDateString()+'T12:15',comment:''})
      .set('Accept', 'application/json')
      .expect(200)
      .end(function(err, res) {
        if (err) throw err;
        console.log(res.text);
        done();
      });
  });
});

describe('GET /api/getTeam', function() {
  it('should get /api/getTeam of teamG20', function(done) {
    request(app)
      .get('/api/getTeam')
      .send({teamid:'teamG20'})
      .set('Accept', 'application/json')
      .expect(200)
      .end(function(err, res) {
        if (err) throw err;
        console.log(res.text);
        done();
      });
  });
});

// TEAM-ADMIN REST-REQUESTS

describe('DELETE /api/deleteTeam', function() {
  it('should delete teamG20', function(done) {
    request(app)
      .delete('/api/deleteTeam')
      .send({teamid:'teamG20'})
      .set('Accept', 'application/json')
      .expect(200)
      .end(function(err, res) {
        if (err) throw err;
        console.log(res.text);
        done();
      });
  });
});

describe('GET /api/getListOfTeamIDs', function() {
  it('should respond with a list of all team-IDs', function(done) {
    request(app)
      .get('/api/getListOfTeamIDs')
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
	  .end(function(err, res) {
	    if (err) throw err;
	    console.log(res.text);
	    done();
	  });
  });
});
