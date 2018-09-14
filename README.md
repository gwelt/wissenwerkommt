# wissenwerkommt

## API

`/api/getListOfTeamIDs`  
returns a list of team-IDs  
Example: `["team1","team2"]`  
  
`/api/getTeam/[teamID]` or `/api/getTeam`+JSON with `teamid`-property  
returns the teams' JSON-object  
Example: `{"id":"fbhh","name":"Fußball","recurrence":[{"weekday":4,"time":"18:30"}],"admintoken":"secret","teamtoken":"123","events":[{"datetime":"2018-09-20T18:30"},{"datetime":"2018-09-27T18:30"},{"datetime":"2018-10-04T18:30"},{"datetime":"2018-10-11T18:30"}]}`  
  
`/api/attend`+JSON with properties `teamid`, `datetime` and `name` adds `name` to the attendants of the event at `datetime` and  
returns the events' JSON-object  
returns false, if something went wrong (i.e. event does not exist)  
Example: `{"datetime":"2018-09-20T18:30","attendees":["John"]}`  
