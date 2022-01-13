var console = {}; console.log = function(){};

/* SUPERTEST HTTP/REST-API TESTS */
const request = require('supertest');
var app = require('../index');
app.close();

// OPEN REST-REQUESTS
describe ('OPEN REST-REQUESTS', function() {

  describe('POST /api/addTeam', function() {
    it('Creates a new team and adds it to the list of teams. (Recurrence weekday 0-6 is sunday to saturday, 7 is every day, 8 is without recurrence.)', function(done) {
      request(app)
        .post('/api/addTeam')
        .send({teamid:'teamG20',name:'Team G20',recurrence:[{weekday:"7",time:"12:15"}],admintoken:'321',teamtoken:'123'})
        .set('Accept', 'application/json')
        .expect(201)
        .end(function(err, res) {
          if (err) throw err;
          console.log(res.text);
          let r=JSON.parse(res.text);
          if ( (r.teamid=='teamg20') && (r.name=='Team G20') && (r.recurrence[0].weekday=='7') && (r.recurrence[0].time=='12:15') && (r.admintoken=='321') && (r.teamtoken=='123') ) {
            done()
          } else {
            done(new Error('property not set as expected'))
          }
        });
    });
  });

  describe('GET /api/getAllIDs', function() {
    it('Returns a list of all team- and group-IDs.', function(done) {
      request(app)
        .get('/api/getAllIDs')
        .send({token:'sysop'})
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200)
    	  .end(function(err, res) {
    	    if (err) throw err;
    	    console.log(res.text);
          if (res.text.includes('teamg20')) {done()} else {done(new Error('list does not contain new team'))};
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
})

// TEAM REST-REQUESTS
describe ('TEAM REST-REQUESTS', function() {

  describe('GET /api/get', function() {
    it('should get /api/get of teamG20', function(done) {
      request(app)
        .get('/api/get')
        .send({teamid:'teamG20',token:'123'})
        .set('Accept', 'application/json')
        .expect(200)
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
        .send({teamid:'teamG20',datetime:getDateString()+'T12:15',name:'SuperSven',token:'123'})
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
        .send({teamid:'teamG20',datetime:getDateString()+'T12:15',comment:'I like this event.',token:'123'})
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
        .send({teamid:'teamG20',datetime:getDateString()+'T12:15',name:'SuperSven',token:'123'})
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
        .send({teamid:'teamG20',datetime:getDateString()+'T12:15',name:'SuperSven',token:'123'})
        .set('Accept', 'application/json')
        .expect(200)
        .end(function(err, res) {
          if (err) throw err;
          console.log(res.text);
          done();
        });
    });
  });
})

// ADMIN REST-REQUESTS
describe ('TEAM-ADMIN REST-REQUESTS', function() {

  describe('POST /api/editTeam', function() {
    it('should edit teamG20', function(done) {
      request(app)
        .post('/api/editTeam')
        .send({teamid:'teamG20',name:'Team G20+',recurrence:[{weekday:"7",time:"12:30"}],admintoken:'4321',teamtoken:'1234',token:'321'})
        .set('Accept', 'application/json')
        .expect(200)
        .end(function(err, res) {
          if (err) throw err;
          console.log(res.text);
          done();
        });
    });
  });

  describe('POST /api/addEvent', function() {
    it('should add event SingleEvent to teamG20', function(done) {
      request(app)
        .post('/api/addEvent')
        .send({teamid:'teamG20',datetime:getDateString()+'T20:00',comment:'lets meet at 8PM',token:'4321'})
        .set('Accept', 'application/json')
        .expect(201)
        .end(function(err, res) {
          if (err) throw err;
          console.log(res.text);
          done();
        });
    });
  });

  describe('PUT /api/cancelEvent', function() {
    it('should cancel an event', function(done) {
      request(app)
        .post('/api/cancelEvent')
        .send({teamid:'teamG20',datetime:getDateString()+'T20:00',token:'4321'})
        .set('Accept', 'application/json')
        .expect(200)
        .end(function(err, res) {
          if (err) throw err;
          console.log(res.text);
          done();
        });
    });
  });

  describe('PUT /api/reviveEvent', function() {
    it('should revive an event', function(done) {
      request(app)
        .post('/api/reviveEvent')
        .send({teamid:'teamG20',datetime:getDateString()+'T20:00',token:'4321'})
        .set('Accept', 'application/json')
        .expect(200)
        .end(function(err, res) {
          if (err) throw err;
          console.log(res.text);
          done();
        });
    });
  });

  describe('DELETE /api/deleteEvent', function() {
    it('should delete an event', function(done) {
      request(app)
        .delete('/api/deleteEvent')
        .send({teamid:'teamG20',datetime:getDateString()+'T20:00',token:'4321'})
        .set('Accept', 'application/json')
        .expect(200)
        .end(function(err, res) {
          if (err) throw err;
          console.log(res.text);
          done();
        });
    });
  });

  describe('POST /api/editTeam (new_teamid)', function() {
    it('should change teamid of teamG20 to teamG20new', function(done) {
      request(app)
        .post('/api/editTeam')
        .send({teamid:'teamG20',new_teamid:'teamG20new',token:'4321'})
        .set('Accept', 'application/json')
        .expect(200)
        .end(function(err, res) {
          if (err) throw err;
          console.log(res.text);
          done();
        });
    });
  });

  describe('DELETE /api/deleteTeam', function() {
    it('should delete teamG20new', function(done) {
      request(app)
        .delete('/api/deleteTeam')
        .send({teamid:'teamG20new',token:'4321'})
        .set('Accept', 'application/json')
        .expect(200)
        .end(function(err, res) {
          if (err) throw err;
          console.log(res.text);
          done();
        });
    });
  });
})

function getDateString(d) {
  if (!d) {d=new Date()};
  var tzoffset = d.getTimezoneOffset() * 60000;
  return (new Date(d-tzoffset)).toISOString().slice(0, -14);
} 

/*
describe('PUT /api/attend a non-existing event', function() {
  it('should deny attending an event with HTTP status code 403', function(done) {
    request(app)
      .put('/api/attend')
      .send({teamid:'teamG20',datetime:'2011-10-06T12:15',name:'SuperSven',token:'1234'})
      .set('Accept', 'application/json')
      .expect(403)
      .end(function(err, res) {
        if (err) throw err;
        console.log(res.text);
        done();
      });
  });
});
*/