const API_BASE = 'https://worldcup26.ir/get';
const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';

const API_MIN_INTERVAL = 60000;
let lastCallTime = 0;
let callQueue = [];
let isCalling = false;

let cache = { games: null, teams: null, groups: null };
let cacheTime = 0;
const CACHE_TTL = 60000;

async function rateLimitedFetch(url, options = {}) {
  const now = Date.now();
  const waitTime = lastCallTime + API_MIN_INTERVAL - now;
  if (waitTime > 0) {
    await new Promise(r => setTimeout(r, waitTime));
  }
  lastCallTime = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

async function fetchWithFallback(primaryUrl, secondaryUrl) {
  try {
    return await rateLimitedFetch(primaryUrl);
  } catch (e) {
    console.warn('Primary API failed, trying ESPN:', e.message);
    try {
      const data = await rateLimitedFetch(secondaryUrl);
      return data;
    } catch (e2) {
      throw new Error('Both APIs failed');
    }
  }
}

async function fetchGames() {
  const data = await fetchWithFallback(
    `${API_BASE}/games`,
    ESPN_BASE
  );
  return data.games || data.events || [];
}

async function fetchTeams() {
  const data = await rateLimitedFetch(`${API_BASE}/teams`);
  return data.teams || [];
}

async function fetchGroups() {
  const data = await rateLimitedFetch(`${API_BASE}/groups`);
  return data.groups || [];
}

async function fetchAllData() {
  const now = Date.now();
  if (cache.games && now - cacheTime < CACHE_TTL) {
    return cache;
  }

  const [games, teams, groups] = await Promise.all([
    fetchGames(),
    fetchTeams(),
    fetchGroups(),
  ]);

  cache = { games, teams, groups };
  cacheTime = Date.now();
  return cache;
}

function clearCache() {
  cache = { games: null, teams: null, groups: null };
  cacheTime = 0;
}

const LS_CACHE_KEY = 'wc26_cache';

function loadPersistentCache() {
  try {
    const raw = localStorage.getItem(LS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.data || !parsed.timestamp) return null;
    return parsed;
  } catch (e) {
    return null;
  }
}

function savePersistentCache(data) {
  try {
    localStorage.setItem(LS_CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      data: { games: data.games || [], teams: data.teams || [], groups: data.groups || [] }
    }));
  } catch (e) {}
}

function getCacheAgeMinutes(timestamp) {
  return Math.floor((Date.now() - timestamp) / 60000);
}

const ESPN_TEAM_MAP = {};

function parseEspnData(espnJson) {
  if (!espnJson || !espnJson.events) return null;
  const games = [];
  const teams = [];
  const groups = [];

  for (const event of espnJson.events) {
    const comp = event.competitions?.[0];
    if (!comp) continue;
    const home = comp.competitors?.[0];
    const away = comp.competitors?.[1];
    if (!home || !away) continue;

    const dateStr = new Date(event.date).toLocaleString('en-US', {
      month: '2-digit', day: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });

    games.push({
      id: event.id,
      home_team_name_en: home.team.displayName,
      away_team_name_en: away.team.displayName,
      home_score: home.score ?? '0',
      away_score: away.score ?? '0',
      local_date: dateStr,
      finished: event.status.type.completed ? 'TRUE' : 'FALSE',
      time_elapsed: event.status.type.description || 'notstarted',
      type: 'group',
    });

    [home, away].forEach(c => {
      const name = c.team.displayName;
      if (!ESPN_TEAM_MAP[name]) {
        ESPN_TEAM_MAP[name] = {
          name_en: name,
          flag: c.team.logo || '',
          id: c.team.abbreviation,
          groups: '',
        };
        teams.push(ESPN_TEAM_MAP[name]);
      }
    });
  }

  return { games, teams, groups };
}
