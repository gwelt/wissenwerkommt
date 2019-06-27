[![Build Status](https://travis-ci.org/gwelt/wissenwerkommt.svg?branch=master)](https://travis-ci.org/gwelt/wissenwerkommt)

# wissenwerkommt

## API

### get
`/api/get/[ID]` or  
`/api/get` + `{"id":"[ID]"}`  
returns the team- oder group-data for the corresponding `ID` or  
returns `{"error":"..."}`, if something went wrong (i.e. team does not exist)  

Example output: `{"teamid":"fbhh","name":"football","recurrence":[{"weekday":4,"time":"18:30"}],"events":[{"datetime":"2019-09-20T18:30"},{"datetime":"2019-09-27T18:30"},{"datetime":"2019-10-04T18:30"},{"datetime":"2019-10-11T18:30"}],"userlevel":1}`  
  
### getListOfTeamIDs
`/api/getListOfTeamIDs` + `{"token":"[sysoptoken]"}`  
returns a list of team-IDs (Sysops only. `sysoptoken` is defined in config.json.)  
  
Example output: `["team1","team2"]`  
  
### addTeam
`/api/addTeam` + `{"teamid":"[teamID]"}`  
adds a new team with id `teamID` to the list of teams  
returns the team-data or  
returns false, if something went wrong (i.e. team already exists)  
  
Example output: `{"id":"abc","name":"Football","recurrence":[{"weekday":4,"time":"18:30"}]}`  
  
### addEvent
`/api/addEvent` + `{"teamid":"[teamID]","datetime":"[datetime]","comment":"[comment]"}`  
adds a new event at `datetime` with mandatory comment `comment` to team with id `teamID`  
returns the event-data or  
returns false, if something went wrong (i.e. event already exists)  
  
Example output: `{"datetime":"2019-12-31T23:30","comment":"let's celebrate"}`  
  
### attend
`/api/attend` + `{"teamid":"[teamID]","datetime":"[datetime]","name":"[name]"}`  
adds `name` to the list of attendants of the event at `datetime` and  
removes `name` from the list of refusals and  
returns the event-data or  
returns false, if something went wrong (i.e. event does not exist)  
  
Example output: `{"datetime":"2019-09-20T18:30","attendees":["John"]}`  

### refuse
`/api/refuse` + `{"teamid":"[teamID]","datetime":"[datetime]","name":"[name]"}`  
adds `name` to the list of refusals of the event at `datetime` and  
removes `name` from the list of attendants and  
returns the event-data or  
returns false, if something went wrong (i.e. event does not exist)  
  
Example output: `{"datetime":"2019-09-20T18:30","refusals":["John"]}`  

### undecided
`/api/undecided` + `{"teamid":"[teamID]","datetime":"[datetime]","name":"[name]"}`  
removes `name` from the list of attendants of the event at `datetime` and  
removes `name` from the list of refusals and  
returns the event-data or  
returns false, if something went wrong (i.e. event does not exist)  
  
Example output: `{"datetime":"2019-09-20T18:30"}`  
