const MIN_DATE = '2026-06-11';
const MAX_DATE = '2026-07-19';

let appState = {
  view: 'games',
  games: [],
  teams: [],
  groups: [],
  teamsMap: {},
  selectedDate: (() => {
    const today = new Date().toISOString().split('T')[0];
    if (today < MIN_DATE) return MIN_DATE;
    if (today > MAX_DATE) return MAX_DATE;
    return today;
  })(),
  scheduleFilter: { type: 'team', value: 'USA' },
  loading: true,
  error: null,
  cacheAge: null,
};



function init() {
  renderNav();
  loadData();
}

function buildTeamsMap() {
  appState.teamsMap = {};
  for (const t of appState.teams) {
    appState.teamsMap[t.name_en] = t;
    appState.teamsMap[t.name_en.toLowerCase()] = t;
  }
  for (const g of appState.games) {
    if (g.home_team_name_en) {
      const clean = g.home_team_name_en.trim();
      if (!appState.teamsMap[clean]) {
        appState.teamsMap[clean] = { name_en: clean, flag: '' };
      }
    }
    if (g.away_team_name_en) {
      const clean = g.away_team_name_en.trim();
      if (!appState.teamsMap[clean]) {
        appState.teamsMap[clean] = { name_en: clean, flag: '' };
      }
    }
  }
}

async function loadData() {
  appState.error = null;

  const cached = loadPersistentCache();
  if (cached) {
    appState.games = cached.data.games || [];
    appState.teams = cached.data.teams || [];
    appState.groups = cached.data.groups || [];
    appState.loading = false;
    appState.cacheAge = getCacheAgeMinutes(cached.timestamp);
    buildTeamsMap();
    switchView(appState.view);
  } else if (CACHE_GAMES?.games?.length) {
    appState.games = CACHE_GAMES.games;
    appState.teams = CACHE_TEAMS?.teams || [];
    appState.groups = CACHE_GROUPS?.groups || [];
    appState.loading = false;
    appState.cacheAge = getCacheAgeMinutes(CACHE_TIMESTAMP);
    buildTeamsMap();
    switchView(appState.view);
  } else {
    appState.loading = true;
    appState.cacheAge = null;
    showLoading();
  }

  try {
    const data = await fetchAllData();
    appState.games = data.games || [];
    appState.teams = data.teams || [];
    appState.groups = data.groups || [];
    appState.loading = false;
    appState.cacheAge = null;
    savePersistentCache(data);
    buildTeamsMap();
    switchView(appState.view);
  } catch (err) {
    console.warn('API fetch failed:', err.message);
    if (!appState.games.length) {
      appState.loading = false;
      appState.error = err.message;
      showError(err.message);
    }
  }
}

function switchView(view) {
  appState.view = view;
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.view === view);
  });
  const container = document.getElementById('view-container');
  container.innerHTML = '';
  showLoading();
  if (appState.loading) return;
  if (appState.error) { showError(appState.error); return; }

  switch (view) {
    case 'games': renderGames(container); break;
    case 'teams': renderTeams(container); break;
    case 'standings': renderStandings(container); break;
    case 'schedule': renderSchedule(container); break;
  }
  addStaleBanner(container);
}

function addStaleBanner(container) {
  const age = appState.cacheAge;
  if (age === null || age === undefined) return;
  if (container.querySelector('.stale-banner')) return;
  const banner = document.createElement('div');
  banner.className = 'stale-banner';
  banner.textContent = `Showing data from ${age} min ago — Updating...`;
  container.insertBefore(banner, container.firstChild);
}

function showLoading() {
  const container = document.getElementById('view-container');
  if (!appState.loading) return;
  container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading data...</p></div>';
}

function showError(msg) {
  const container = document.getElementById('view-container');
  container.innerHTML = `<div class="error-state"><p>${msg}</p><button class="btn btn-primary" onclick="loadData()">Retry</button></div>`;
}

function renderNav() {
  const nav = document.getElementById('nav-bar');
  const views = ['games', 'teams', 'standings', 'schedule'];
  nav.innerHTML = views.map(v =>
    `<button class="nav-btn ${v === appState.view ? 'active' : ''}" data-view="${v}">${v.toUpperCase()}</button>`
  ).join('');
  nav.addEventListener('click', e => {
    const btn = e.target.closest('.nav-btn');
    if (btn) switchView(btn.dataset.view);
  });
}

function h(text) {
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

function teamFlag(teamName, size = 24) {
  const apiName = toApiName(teamName);
  const t = appState.teamsMap[apiName] || appState.teamsMap[apiName.toLowerCase()];
  if (t && t.flag) {
    return `<img class="flag" src="${h(t.flag)}" alt="${h(teamName)}" width="${size}" height="${size}" loading="lazy">`;
  }
  return '';
}

function teamLabel(teamName, extra = '') {
  const person = getPersonForTeam(teamName);
  const flag = teamFlag(teamName);
  const displayName = toDisplayName(teamName);
  const linkName = toDisplayName(teamName);
  const teamLink = `<a href="#" class="team-link" data-team="${h(linkName)}">${flag}${h(displayName)}${extra}</a>`;
  if (person) {
    const personLink = `<a href="#" class="person-link" data-person="${h(person)}">${h(person)}</a>`;
    return `<span class="team-with-person">${teamLink}<span class="person-tag">${personLink}</span></span>`;
  }
  return teamLink;
}

function personLabel(personName) {
  return `<a href="#" class="person-link" data-person="${h(personName)}">${h(personName)}</a>`;
}

function parseGameDate(localDate) {
  const parts = localDate.split(' ');
  if (parts.length < 2) return null;
  const [m, d, y] = parts[0].split('/');
  if (!m || !d || !y) return null;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function parseGameTime(localDate) {
  const parts = localDate.split(' ');
  return parts[1] || '';
}

function formatGameTime(localDate) {
  const time = parseGameTime(localDate);
  if (!time) return '';
  const [h, m] = time.split(':');
  const hr = parseInt(h, 10);
  const ampm = hr >= 12 ? 'PM' : 'AM';
  const hr12 = hr === 0 ? 12 : hr > 12 ? hr - 12 : hr;
  return `${hr12}:${m} ${ampm}`;
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function matchStatus(game) {
  if (game.time_elapsed === 'finished' || game.finished === 'TRUE') return 'final';
  if (game.time_elapsed === 'live' || game.time_elapsed?.toLowerCase().includes('live')) return 'live';
  return 'upcoming';
}

function renderScorers(game) {
  let html = '';
  try {
    function parseScorers(str) {
      if (!str || str === 'null') return [];
      const cleaned = str.replace(/[{}[\]"\u201C\u201D\u201E\u201F\u2033\u2036]/g, '');
      return cleaned.split(',').map(s => s.trim()).filter(Boolean);
    }
    const home = parseScorers(game.home_scorers);
    const away = parseScorers(game.away_scorers);
    const all = [...home, ...away];
    for (const s of all) html += `<span class="scorer">${h(s)}</span>`;
  } catch (e) {}
  return html;
}

function isKnockoutStage() {
  return appState.games.some(g =>
    (g.type === 'r32' || g.type === 'r16' || g.type === 'qf' || g.type === 'sf' || g.type === 'final') &&
    (g.finished === 'TRUE' || g.time_elapsed === 'finished' || g.time_elapsed === 'live')
  );
}

function isGroupStageOver() {
  const today = new Date();
  const lastGroup = new Date('2026-06-28');
  return today >= lastGroup;
}

function currentStage() {
  if (isGroupStageOver() || isKnockoutStage()) {
    if (appState.games.some(g => g.type === 'r32' && (g.finished === 'TRUE' || g.time_elapsed === 'live'))) return 'r32';
    if (appState.games.some(g => g.type === 'r16' && (g.finished === 'TRUE' || g.time_elapsed === 'live'))) return 'r16';
    if (appState.games.some(g => g.type === 'qf' && (g.finished === 'TRUE' || g.time_elapsed === 'live'))) return 'qf';
    if (appState.games.some(g => g.type === 'sf' && (g.finished === 'TRUE' || g.time_elapsed === 'live'))) return 'sf';
    if (appState.games.some(g => g.type === 'final' && (g.finished === 'TRUE' || g.time_elapsed === 'live'))) return 'final';
    if (appState.games.some(g => g.type === 'third' && (g.finished === 'TRUE' || g.time_elapsed === 'live'))) return 'third';
    if (appState.games.some(g => g.type === 'r32')) return 'r32';
    return 'knockout';
  }
  return 'group';
}

function getTeamStats(teamId) {
  for (const g of appState.groups) {
    for (const t of g.teams) {
      if (String(t.team_id) === String(teamId)) return t;
    }
  }
  return null;
}

function getTeamId(teamName) {
  const apiName = toApiName(teamName);
  const t = appState.teamsMap[apiName] || appState.teamsMap[apiName.toLowerCase()];
  return t ? t.id : null;
}

function getStandingsForGroup(groupName) {
  const group = appState.groups.find(g => g.name === groupName);
  if (!group) return [];
  return group.teams
    .map(t => {
      const teamObj = Object.values(appState.teamsMap).find(v => String(v.id) === String(t.team_id));
      return { ...t, teamName: teamObj ? teamObj.name_en : `Team ${t.team_id}` };
    })
    .sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.gd !== a.gd) return b.gd - a.gd;
      return b.gf - a.gf;
    });
}

function getTeamPoints(teamName) {
  const apiName = toApiName(teamName);
  const teamId = getTeamId(apiName);
  if (!teamId) return 0;
  const stats = getTeamStats(teamId);
  if (stats) return parseInt(stats.pts, 10) || 0;

  let pts = 0;
  const teamGames = appState.games.filter(g =>
    g.finished === 'TRUE' &&
    (g.home_team_name_en === apiName || g.away_team_name_en === apiName) &&
    g.type === 'group'
  );
  for (const g of teamGames) {
    const hScore = parseInt(g.home_score, 10);
    const aScore = parseInt(g.away_score, 10);
    if (g.home_team_name_en === apiName) {
      if (hScore > aScore) pts += 3;
      else if (hScore === aScore) pts += 1;
    } else {
      if (aScore > hScore) pts += 3;
      else if (hScore === aScore) pts += 1;
    }
  }
  return pts;
}

function getTeamKnockoutWins(teamName) {
  const apiName = toApiName(teamName);
  const teamId = getTeamId(apiName);
  if (!teamId) return 0;
  let wins = 0;
  const knockouts = appState.games.filter(g =>
    (g.type === 'r32' || g.type === 'r16' || g.type === 'qf' || g.type === 'sf') &&
    g.finished === 'TRUE' &&
    (String(g.home_team_id) === String(teamId) || String(g.away_team_id) === String(teamId))
  );
  for (const g of knockouts) {
    const hScore = parseInt(g.home_score, 10);
    const aScore = parseInt(g.away_score, 10);
    if (String(g.home_team_id) === String(teamId) && hScore > aScore) wins++;
    else if (String(g.away_team_id) === String(teamId) && aScore > hScore) wins++;
  }
  return wins;
}

function getTeamKnockoutStatus(teamName) {
  const apiName = toApiName(teamName);
  const teamId = getTeamId(apiName);
  if (!teamId) return 'group';
  for (const g of appState.games) {
    if (g.finished === 'TRUE' && (String(g.home_team_id) === String(teamId) || String(g.away_team_id) === String(teamId))) {
      if (g.type === 'final' || g.type === 'third') return 'finished';
    }
    if (g.type !== 'group' && (String(g.home_team_id) === String(teamId) || String(g.away_team_id) === String(teamId))) {
      return g.type;
    }
  }
  return 'group';
}

function renderGames(container) {
  const dateStr = appState.selectedDate || new Date().toISOString().split('T')[0];

  const header = document.createElement('div');
  header.className = 'games-header';
  header.innerHTML = `
    <h2>Matches</h2>
    <div class="date-picker">
      <button class="btn btn-icon" id="prev-date" ${dateStr <= MIN_DATE ? 'disabled' : ''}>&larr;</button>
      <input type="date" id="game-date" value="${dateStr}" min="${MIN_DATE}" max="${MAX_DATE}">
      <button class="btn btn-icon" id="next-date" ${dateStr >= MAX_DATE ? 'disabled' : ''}>&rarr;</button>
    </div>
    <button class="btn btn-secondary" id="today-btn">Today</button>
  `;
  container.appendChild(header);

  const dateDisplay = document.createElement('p');
  dateDisplay.className = 'date-display';
  dateDisplay.textContent = formatDateDisplay(dateStr);
  container.appendChild(dateDisplay);

  const dayGames = appState.games.filter(g => {
    const gDate = parseGameDate(g.local_date);
    return gDate === dateStr;
  }).sort((a, b) => {
    const tA = parseGameTime(a.local_date) || '00:00';
    const tB = parseGameTime(b.local_date) || '00:00';
    return tA.localeCompare(tB);
  });

  if (dayGames.length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.className = 'empty-state';
    emptyMsg.innerHTML = '<p>No matches scheduled for this date.</p>';
    container.appendChild(emptyMsg);
  } else {
    const list = document.createElement('div');
    list.className = 'games-list';
    for (const game of dayGames) {
      const status = matchStatus(game);
      const stageLabel = STAGE_LABELS[game.type] || game.type;
      const groupInfo = game.type === 'group' ? `Group ${game.group}` : stageLabel;
      const card = document.createElement('div');
      card.className = `game-card ${status}`;
      const hasScorers = game.finished === 'TRUE' && game.home_scorers && game.home_scorers !== 'null';
      card.innerHTML = `
        <div class="game-meta">
          <span class="game-group">${h(groupInfo)}</span>
          <span class="game-time">${formatGameTime(game.local_date)}</span>
          <span class="game-status status-${status}">${status === 'final' ? 'Final' : status === 'live' ? 'Live' : 'Upcoming'}</span>
        </div>
        <div class="game-teams">
          <div class="team-row home">
            <div class="team-info">${teamLabel(game.home_team_name_en)}</div>
            <div class="team-score">${game.finished === 'TRUE' || (game.time_elapsed && game.time_elapsed !== 'notstarted') ? h(game.home_score) : '-'}</div>
          </div>
          <div class="team-row away">
            <div class="team-info">${teamLabel(game.away_team_name_en)}</div>
            <div class="team-score">${game.finished === 'TRUE' || (game.time_elapsed && game.time_elapsed !== 'notstarted') ? h(game.away_score) : '-'}</div>
          </div>
        </div>
        ${hasScorers ? `<div class="game-scorers">${renderScorers(game)}</div>` : ''}
      `;
      list.appendChild(card);
    }
    container.appendChild(list);
  }

  const dateInput = document.getElementById('game-date');
  const prevBtn = document.getElementById('prev-date');
  const nextBtn = document.getElementById('next-date');
  const todayBtn = document.getElementById('today-btn');

  if (dateInput) {
    dateInput.addEventListener('change', () => {
      appState.selectedDate = dateInput.value;
      switchView('games');
    });
  }
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      const d = new Date(dateStr + 'T12:00:00');
      d.setDate(d.getDate() - 1);
      const val = d.toISOString().split('T')[0];
      if (val >= MIN_DATE) {
        appState.selectedDate = val;
        switchView('games');
      }
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const d = new Date(dateStr + 'T12:00:00');
      d.setDate(d.getDate() + 1);
      const val = d.toISOString().split('T')[0];
      if (val <= MAX_DATE) {
        appState.selectedDate = val;
        switchView('games');
      }
    });
  }
  if (todayBtn) {
    todayBtn.addEventListener('click', () => {
      const today = new Date().toISOString().split('T')[0];
      if (today >= MIN_DATE && today <= MAX_DATE) {
        appState.selectedDate = today;
      } else if (today < MIN_DATE) {
        appState.selectedDate = MIN_DATE;
      } else {
        appState.selectedDate = MAX_DATE;
      }
      switchView('games');
    });
  }

  attachLinkListeners(container);
}

function renderTeams(container) {
  const stage = currentStage();
  if (stage === 'group') {
    renderGroupStandings(container);
  } else {
    renderKnockoutBracket(container);
  }
}

function renderGroupStandings(container) {
  container.innerHTML = '<h2>Group Standings</h2>';

  const sortedGroups = [...appState.groups].sort((a, b) => a.name.localeCompare(b.name));
  const grid = document.createElement('div');
  grid.className = 'groups-grid';

  for (const group of sortedGroups) {
    const standings = getStandingsForGroup(group.name);
    const section = document.createElement('div');
    section.className = 'group-section';
    section.innerHTML = `<h3 class="group-title">Group ${h(group.name)}</h3>`;

    if (standings.length === 0) {
      section.innerHTML += '<p class="empty-small">No data yet</p>';
    } else {
      const table = document.createElement('table');
      table.className = 'standings-table';
      const headerRow = document.createElement('tr');
      headerRow.innerHTML = '<th></th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th>';
      table.appendChild(headerRow);

      for (let i = 0; i < standings.length; i++) {
        const s = standings[i];
        const tr = document.createElement('tr');
        const teamName = s.teamName;
        const posClass = i < 2 ? 'pos-qualify' : (i === 2 && group.name <= 'H' ? 'pos-possible' : '');
        tr.innerHTML = `
          <td class="pos ${posClass}">${i + 1}</td>
          <td class="team-cell">${teamLabel(teamName)}</td>
          <td>${s.mp}</td>
          <td>${s.w}</td>
          <td>${s.d}</td>
          <td>${s.l}</td>
          <td>${s.gf}</td>
          <td>${s.ga}</td>
          <td>${s.gd > 0 ? '+' : ''}${s.gd}</td>
          <td class="pts-cell">${s.pts}</td>
        `;
        table.appendChild(tr);
      }
      section.appendChild(table);
    }
    grid.appendChild(section);
  }
  container.appendChild(grid);

  const legend = document.createElement('div');
  legend.className = 'legend';
  legend.innerHTML = `
    <span class="legend-item"><span class="dot pos-qualify"></span> Top 2 qualify</span>
    <span class="legend-item"><span class="dot pos-possible"></span> Possible 3rd (Groups A-H)</span>
  `;
  container.appendChild(legend);
  attachLinkListeners(container);
}

function renderKnockoutBracket(container) {
  container.innerHTML = '<h2>Knockout Stage</h2>';

  const stageOrder = ['r32', 'r16', 'qf', 'sf', 'final'];
  const stageNames = { r32: 'Round of 32', r16: 'Round of 16', qf: 'Quarter-finals', sf: 'Semi-finals', final: 'Final' };

  const bracket = document.createElement('div');
  bracket.className = 'knockout-bracket';

  for (const st of stageOrder) {
    const matches = appState.games.filter(g => g.type === st)
      .sort((a, b) => parseGameDate(a.local_date)?.localeCompare(parseGameDate(b.local_date)) || 0);
    if (matches.length === 0) continue;

    const round = document.createElement('div');
    round.className = `bracket-round round-${st}`;
    round.innerHTML = `<h3 class="round-title">${stageNames[st]}</h3>`;

    const matchList = document.createElement('div');
    matchList.className = 'bracket-matches';

    for (const game of matches) {
      const isKnown = game.home_team_name_en && game.home_team_name_en !== '0';
      const status = matchStatus(game);
      const m = document.createElement('div');
      m.className = `bracket-match ${status}`;

      if (isKnown) {
        const hWinner = parseInt(game.home_score, 10) > parseInt(game.away_score, 10);
        const aWinner = parseInt(game.away_score, 10) > parseInt(game.home_score, 10);
        m.innerHTML = `
          <div class="bracket-date">${formatDateDisplay(parseGameDate(game.local_date))} ${formatGameTime(game.local_date)}</div>
          <div class="bracket-team${hWinner ? ' winner' : ''}">
            <span class="team-info">${teamLabel(game.home_team_name_en)}</span>
            <span class="team-score">${game.finished === 'TRUE' ? h(game.home_score) : '-'}</span>
          </div>
          <div class="bracket-team${aWinner ? ' winner' : ''}">
            <span class="team-info">${teamLabel(game.away_team_name_en)}</span>
            <span class="team-score">${game.finished === 'TRUE' ? h(game.away_score) : '-'}</span>
          </div>
          <div class="bracket-status status-${status}">${status === 'final' ? 'FT' : status === 'live' ? 'LIVE' : 'TBD'}</div>
        `;
      } else {
        m.innerHTML = `
          <div class="bracket-date">${formatDateDisplay(parseGameDate(game.local_date))}</div>
          <div class="bracket-team tbd"><span>${h(game.home_team_label || 'TBD')}</span><span>-</span></div>
          <div class="bracket-team tbd"><span>${h(game.away_team_label || 'TBD')}</span><span>-</span></div>
          <div class="bracket-status">Upcoming</div>
        `;
      }
      matchList.appendChild(m);
    }
    round.appendChild(matchList);
    bracket.appendChild(round);
  }

  const thirdPlaces = appState.games.filter(g => g.type === 'third');
  if (thirdPlaces.length > 0) {
    const round = document.createElement('div');
    round.className = 'bracket-round round-third';
    round.innerHTML = '<h3 class="round-title">Third Place</h3>';
    const matchList = document.createElement('div');
    matchList.className = 'bracket-matches';
    for (const game of thirdPlaces) {
      const isKnown = game.home_team_name_en && game.home_team_name_en !== '0';
      const m = document.createElement('div');
      m.className = 'bracket-match';
      if (isKnown) {
        m.innerHTML = `
          <div class="bracket-date">${formatDateDisplay(parseGameDate(game.local_date))}</div>
          <div class="bracket-team"><span class="team-info">${teamLabel(game.home_team_name_en)}</span><span class="team-score">${game.finished === 'TRUE' ? h(game.home_score) : '-'}</span></div>
          <div class="bracket-team"><span class="team-info">${teamLabel(game.away_team_name_en)}</span><span class="team-score">${game.finished === 'TRUE' ? h(game.away_score) : '-'}</span></div>
        `;
      } else {
        m.innerHTML = '<div class="bracket-date">TBD</div><div class="bracket-team tbd"><span>TBD</span><span>-</span></div><div class="bracket-team tbd"><span>TBD</span><span>-</span></div>';
      }
      matchList.appendChild(m);
    }
    round.appendChild(matchList);
    bracket.appendChild(round);
  }

  container.appendChild(bracket);
  attachLinkListeners(container);
}

function renderStandings(container) {
  container.innerHTML = '<h2>Family League Standings</h2>';

  const personScores = ALL_PERSONS.map(person => {
    const teams = getTeamsForPerson(person);
    let totalPts = 0;
    let totalGD = 0;
    let totalGF = 0;
    const teamDetails = [];

    for (const teamName of teams) {
      const teamId = getTeamId(teamName);
      const stats = teamId ? getTeamStats(teamId) : null;
      const pts = stats ? parseInt(stats.pts, 10) : getTeamPoints(teamName);
      const gd = stats ? parseInt(stats.gd, 10) : 0;
      const gf = stats ? parseInt(stats.gf, 10) : 0;
      const knockWins = getTeamKnockoutWins(teamName);
      const knockStatus = getTeamKnockoutStatus(teamName);
      const bonus = knockStatus !== 'group' ? 3 : 0;
      const total = pts + bonus + (knockWins * 2);

      totalPts += total;
      totalGD += gd;
      totalGF += gf;

      teamDetails.push({ teamName, pts, gd, gf, bon: bonus, knockWins, total, knockStatus });
    }

    return { person, totalPts, totalGD, totalGF, teamDetails };
  });

  personScores.sort((a, b) => {
    if (b.totalPts !== a.totalPts) return b.totalPts - a.totalPts;
    if (b.totalGD !== a.totalGD) return b.totalGD - a.totalGD;
    return b.totalGF - a.totalGF;
  });

  const wrapper = document.createElement('div');
  wrapper.className = 'standings-wrapper';
  const table = document.createElement('table');
  table.className = 'standings-table person-standings';
  const hRow = document.createElement('tr');
  hRow.innerHTML = '<th>#</th><th>Person</th><th>Teams</th><th>Pts</th><th>GD</th>';
  table.appendChild(hRow);

  let rank = 0;
  for (let i = 0; i < personScores.length; i++) {
    const ps = personScores[i];
    const tr = document.createElement('tr');
    if (i === 0 || ps.totalPts < personScores[i - 1].totalPts) rank = i + 1;
    if (i < 3) tr.classList.add('top-three');

    let teamsHtml = '';
    for (const td of ps.teamDetails) {
      const flag = teamFlag(td.teamName);
      const displayName = toDisplayName(td.teamName);
      const statusIcon = td.knockStatus !== 'group' ? ' 🔥' : '';
      teamsHtml += `<span class="team-stat">${flag}<a href="#" class="team-link" data-team="${h(td.teamName)}">${h(displayName)}</a>${statusIcon}<span class="stat-detail"> ${td.pts}p${td.bon > 0 ? ' +'+td.bon+'b' : ''}</span></span>`;
    }

    tr.innerHTML = `
      <td class="pos">${rank}</td>
      <td class="person-cell">${personLabel(ps.person)}</td>
      <td class="teams-cell">${teamsHtml}</td>
      <td class="pts-cell highlight">${ps.totalPts}</td>
      <td>${ps.totalGD > 0 ? '+' : ''}${ps.totalGD}</td>
    `;
    table.appendChild(tr);
  }
  wrapper.appendChild(table);

  const legend = document.createElement('div');
  legend.className = 'legend';
  legend.innerHTML = `
    <span class="legend-item">🔥 = in knockout stage</span>
    <span class="legend-item"><span class="stat-detail">p = group pts, b = bonus pts</span></span>
  `;
  wrapper.appendChild(legend);
  container.appendChild(wrapper);
  attachLinkListeners(container);
}

function renderSchedule(container) {
  container.innerHTML = `
    <h2>Schedule</h2>
    <div class="schedule-controls">
      <div class="filter-group">
        <label for="schedule-type">View by:</label>
        <select id="schedule-type">
          <option value="person">Person</option>
          <option value="team">Team</option>
        </select>
      </div>
      <div class="filter-group">
        <label for="schedule-value">Select:</label>
        <select id="schedule-value"></select>
      </div>
    </div>
    <div id="schedule-content"></div>
  `;

  const typeSelect = document.getElementById('schedule-type');
  const valueSelect = document.getElementById('schedule-value');
  const content = document.getElementById('schedule-content');
  typeSelect.value = appState.scheduleFilter.type;

  function populateValues() {
    const type = typeSelect.value;
    valueSelect.innerHTML = '';
    if (type === 'person') {
      for (const p of ALL_PERSONS) {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p;
        if (p === appState.scheduleFilter.value) opt.selected = true;
        valueSelect.appendChild(opt);
      }
    } else {
      const allTeams = Object.keys(TEAM_PERSON_MAP).sort();
      for (const t of allTeams) {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        if (t === appState.scheduleFilter.value) opt.selected = true;
        valueSelect.appendChild(opt);
      }
    }
  }

  function renderScheduleContent() {
    const type = typeSelect.value;
    const value = valueSelect.value;
    appState.scheduleFilter = { type, value };

    let teams = [];
    if (type === 'person') {
      teams = getTeamsForPerson(value);
    } else {
      teams = [value];
    }

    if (teams.length === 0) {
      content.innerHTML = '<div class="empty-state"><p>No teams found.</p></div>';
      return;
    }

    let html = '';
    if (type === 'person') {
      html += `<h3>${personLabel(value)}'s Teams</h3>`;
    }

    for (const teamName of teams) {
      const person = getPersonForTeam(teamName);
      const apiName = toApiName(teamName);
      const games = appState.games.filter(g =>
        g.home_team_name_en === apiName || g.away_team_name_en === apiName
      ).sort((a, b) => {
        const dA = parseGameDate(a.local_date) || '';
        const dB = parseGameDate(b.local_date) || '';
        return dA.localeCompare(dB);
      });

      html += `<div class="team-schedule-section">`;
      html += `<h4 class="schedule-team-header">${teamLabel(teamName)}${person && type === 'team' ? ` <span class="person-tag">${personLabel(person)}</span>` : ''}</h4>`;

      if (games.length === 0) {
        html += '<p class="empty-small">No matches found.</p>';
      } else {
        html += `<div class="schedule-grid">`;
        for (const game of games) {
          const status = matchStatus(game);
          const stageLabel = game.type === 'group' ? `Group ${game.group}` : (STAGE_LABELS[game.type] || game.type);
          const isHome = game.home_team_name_en === apiName;

          html += `
            <div class="schedule-card ${status}">
              <div class="schedule-meta">
                <span class="schedule-stage">${h(stageLabel)}</span>
                <span class="schedule-date">${formatDateDisplay(parseGameDate(game.local_date))} ${formatGameTime(game.local_date)}</span>
                <span class="game-status status-${status}">${status === 'final' ? 'FT' : status === 'live' ? 'LIVE' : ''}</span>
              </div>
              <div class="schedule-matchup">
                <div class="schedule-team ${isHome ? 'highlight-team' : ''}">
                  ${teamLabel(game.home_team_name_en)}
                  <span class="score">${game.finished === 'TRUE' || game.time_elapsed !== 'notstarted' ? h(game.home_score) : '-'}</span>
                </div>
                <div class="schedule-vs">vs</div>
                <div class="schedule-team ${!isHome ? 'highlight-team' : ''}">
                  ${teamLabel(game.away_team_name_en)}
                  <span class="score">${game.finished === 'TRUE' || game.time_elapsed !== 'notstarted' ? h(game.away_score) : '-'}</span>
                </div>
              </div>
            </div>
          `;
        }
        html += `</div>`;
      }
      html += `</div>`;
    }

    content.innerHTML = html;
    attachLinkListeners(content);
  }

  populateValues();
  renderScheduleContent();

  typeSelect.addEventListener('change', () => {
    populateValues();
    renderScheduleContent();
  });
  valueSelect.addEventListener('change', renderScheduleContent);
}

function attachLinkListeners(container) {
  container.querySelectorAll('.team-link').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      const team = el.dataset.team;
      appState.scheduleFilter = { type: 'team', value: team };
      switchView('schedule');
      const typeSelect = document.getElementById('schedule-type');
      const valueSelect = document.getElementById('schedule-value');
      if (typeSelect && valueSelect) {
        typeSelect.value = 'team';
        valueSelect.value = team;
      }
    });
  });
  container.querySelectorAll('.person-link').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      const person = el.dataset.person;
      appState.scheduleFilter = { type: 'person', value: person };
      switchView('schedule');
      const typeSelect = document.getElementById('schedule-type');
      const valueSelect = document.getElementById('schedule-value');
      if (typeSelect && valueSelect) {
        typeSelect.value = 'person';
        valueSelect.value = person;
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', init);
