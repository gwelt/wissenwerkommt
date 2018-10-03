[![Build Status](https://travis-ci.com/gwelt/wissenwerkommt.svg?branch=master)](https://travis-ci.com/gwelt/wissenwerkommt)

# wissenwerkommt

## API

### getListOfTeamIDs
`/api/getListOfTeamIDs`  
returns a list of team-IDs  
  
Example output: `["team1","team2"]`  
  
### getTeam
`/api/getTeam/[teamID]` or  
`/api/getTeam` + `{"teamid":"[teamID]"}`  
returns the team-data or  
returns false, if something went wrong (i.e. team does not exist)  

Example output: `{"id":"fbhh","name":"football","recurrence":[{"weekday":4,"time":"18:30"}],"events":[{"datetime":"2018-09-20T18:30"},{"datetime":"2018-09-27T18:30"},{"datetime":"2018-10-04T18:30"},{"datetime":"2018-10-11T18:30"}]}`  
  
### attend
`/api/attend` + `{"teamid":"[teamID]","datetime":"[datetime]","name":"[name]"}`  
adds `name` to the list of attendants of the event at `datetime` and  
removes `name` from the list of refusals and  
returns the event-data or  
returns false, if something went wrong (i.e. event does not exist)  
  
Example output: `{"datetime":"2018-09-20T18:30","attendees":["John"]}`  

### refuse
`/api/refuse` + `{"teamid":"[teamID]","datetime":"[datetime]","name":"[name]"}`  
adds `name` to the list of refusals of the event at `datetime` and  
removes `name` from the list of attendants and  
returns the event-data or  
returns false, if something went wrong (i.e. event does not exist)  
  
Example output: `{"datetime":"2018-09-20T18:30","refusals":["John"]}`  

### undecided
`/api/undecided` + `{"teamid":"[teamID]","datetime":"[datetime]","name":"[name]"}`  
removes `name` from the list of attendants of the event at `datetime` and  
removes `name` from the list of refusals and  
returns the event-data or  
returns false, if something went wrong (i.e. event does not exist)  
  
Example output: `{"datetime":"2018-09-20T18:30"}`  

### addTeam
`/api/addTeam` + `{"teamid":"[teamID]"}`  
adds a new team with id `[teamID]` to the list of teams  
returns the team-data or  
returns false, if something went wrong (i.e. team already exists)  
  
Example output: `{"id":"abc","name":"Football","recurrence":[{"weekday":4,"time":"18:30"}]}`  
