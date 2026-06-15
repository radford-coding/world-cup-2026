const PERSON_TEAMS = {
  Aaron: ['France', 'Japan', 'Scotland'],
  Ashley: ['Morocco', 'South Korea', 'Iraq'],
  Brynja: ['Portugal', 'Switzerland', 'Paraguay'],
  Cristine: ['Senegal', 'Czech Republic', 'DR Congo'],
  Daisy: ['USA', 'Panama', 'Haiti'],
  Dave: ['Netherlands', 'Canada', 'Saudi Arabia'],
  Ingrid: ['Colombia', 'Ecuador', 'Jordan'],
  José: ['Germany', 'Egypt', 'Uzbekistan'],
  Julie: ['Uruguay', 'Turkey', 'Tunisia'],
  Matt: ['Belgium', 'Austria', 'Cape Verde'],
  Miguel: ['Mexico', 'Norway', 'Bosnia and Herzegovina'],
  Nate: ['Argentina', 'Ivory Coast', 'South Africa'],
  Ricardo: ['England', 'Iran', 'Curaçao'],
  Tahnee: ['Spain', 'Sweden', 'Ghana'],
  Tanya: ['Croatia', 'Algeria', 'Qatar'],
  Yvonne: ['Brazil', 'Australia', 'New Zealand'],
};

const ALL_PERSONS = Object.keys(PERSON_TEAMS).sort();

const DISPLAY_TO_API = {
  'USA': 'United States',
  'DR Congo': 'Democratic Republic of the Congo',
};

const API_TO_DISPLAY = {};
for (const [display, api] of Object.entries(DISPLAY_TO_API)) {
  API_TO_DISPLAY[api] = display;
}

function toApiName(name) {
  return DISPLAY_TO_API[name] || name;
}

function toDisplayName(name) {
  return API_TO_DISPLAY[name] || name;
}

const TEAM_PERSON_MAP = {};
const API_TEAM_PERSON_MAP = {};
for (const [person, teams] of Object.entries(PERSON_TEAMS)) {
  for (const team of teams) {
    TEAM_PERSON_MAP[team] = person;
    const apiName = toApiName(team);
    if (apiName !== team) {
      API_TEAM_PERSON_MAP[apiName] = person;
    }
  }
}

function getPersonForTeam(teamName) {
  return TEAM_PERSON_MAP[teamName] || API_TEAM_PERSON_MAP[teamName] || null;
}

function getTeamsForPerson(personName) {
  return PERSON_TEAMS[personName] || [];
}

const STAGE_ORDER = ['group', 'r32', 'r16', 'qf', 'sf', 'third', 'final'];
const STAGE_LABELS = {
  group: 'Group Stage',
  r32: 'Round of 32',
  r16: 'Round of 16',
  qf: 'Quarter-finals',
  sf: 'Semi-finals',
  third: 'Third Place',
  final: 'Final',
};
