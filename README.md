# wissenwerkommt

## API

### getListOfTeamIDs
`/api/getListOfTeamIDs`  
returns a list of team-IDs  
  
Example output: `["team1","team2"]`  
  
### getTeam
`/api/getTeam/[teamID]` or  
`/api/getTeam` + `{"teamid":"[teamID]"}`  
returns the team-data  
  
Example output: `{"id":"fbhh","name":"Fußball","recurrence":[{"weekday":4,"time":"18:30"}],"admintoken":"secret","teamtoken":"123","events":[{"datetime":"2018-09-20T18:30"},{"datetime":"2018-09-27T18:30"},{"datetime":"2018-10-04T18:30"},{"datetime":"2018-10-11T18:30"}]}`  
  
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

