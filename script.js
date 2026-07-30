const container =
  document.getElementById('forecastContainer');

const cityInput =
  document.getElementById('cityInput');

const resetBtn =
  document.getElementById('resetBtn');

const locationBtn =
  document.getElementById('locationBtn');

const suggestionBox =
  document.createElement('div');

suggestionBox.className = 'suggestions';

document
  .querySelector('.controls')
  .appendChild(suggestionBox);

const MAX_CITIES = 7;

/*
  Weather provider: Open-Meteo (api.open-meteo.com + geocoding-api.open-meteo.com)
  No API key required, no signup, no embedded-key exposure risk.
  Free tier: 10,000 calls/day, non-commercial use.
*/

let sortableInstance = null;

let cities = JSON.parse(
  localStorage.getItem('weatherCities') || '[]'
);

function saveCities() {
  localStorage.setItem(
    'weatherCities',
    JSON.stringify(cities)
  );
}

/* ============================================================
   Forecast cache
   Avoids re-fetching every city's forecast on every add/delete.
   10 minute TTL balances freshness against speed. Persisted to
   localStorage so page reloads are fast too, not just same-session
   actions.
   ============================================================ */

const FORECAST_CACHE_TTL = 10 * 60 * 1000;

let forecastCache = loadForecastCache();

function loadForecastCache() {
  try {
    return JSON.parse(
      localStorage.getItem('weatherForecastCache') || '{}'
    );
  } catch (err) {
    return {};
  }
}

function saveForecastCache() {
  try {
    localStorage.setItem(
      'weatherForecastCache',
      JSON.stringify(forecastCache)
    );
  } catch (err) {
    // Non-critical: if storage is full, caching is just skipped this time
  }
}

function getCachedForecast(query) {
  const entry = forecastCache[query];

  if (entry && Date.now() - entry.ts < FORECAST_CACHE_TTL) {
    return entry.data;
  }

  return null;
}

function setCachedForecast(query, data) {
  forecastCache[query] = { data, ts: Date.now() };
  saveForecastCache();
}

/* ============================================================
   Weather code -> emoji icon
   Open-Meteo returns a numeric WMO weather code instead of a
   hosted icon image. This maps codes to a representative emoji.
   Reference: https://open-meteo.com/en/docs (WMO Weather codes)
   ============================================================ */

const WEATHER_ICON_MAP = {
  0: '☀️',
  1: '🌤️',
  2: '⛅',
  3: '☁️',
  45: '🌫️',
  48: '🌫️',
  51: '🌦️',
  53: '🌦️',
  55: '🌦️',
  56: '🌧️',
  57: '🌧️',
  61: '🌧️',
  63: '🌧️',
  65: '🌧️',
  66: '🌧️',
  67: '🌧️',
  71: '🌨️',
  73: '🌨️',
  75: '🌨️',
  77: '🌨️',
  80: '🌦️',
  81: '🌦️',
  82: '⛈️',
  85: '🌨️',
  86: '🌨️',
  95: '⛈️',
  96: '⛈️',
  99: '⛈️'
};

function getWeatherIcon(code) {
  return WEATHER_ICON_MAP[code] || '🌡️';
}

/* ============================================================
   API calls
   ============================================================ */

async function searchCities(query) {
  if (query.length < 2) {
    return [];
  }

  const url =
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=8&language=en&format=json`;

  const res = await fetch(url);
  const data = await res.json();

  if (!data.results) {
    return [];
  }

  // Normalize to the shape the rest of the app already expects
  // (name, region, lat, lon) so autocomplete/select code is untouched.
  return data.results.map(r => ({
    name: r.name,
    region: r.admin1 || r.country || '',
    lat: r.latitude,
    lon: r.longitude
  }));
}

async function forecast(query) {
  const [lat, lon] = query.split(',');

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m` +
    `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,relative_humidity_2m_mean` +
    `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=10`;

  const res = await fetch(url);

  return await res.json();
}

/*
  Open-Meteo has no reverse-geocoding endpoint (coords -> city name),
  so Current Location name resolution uses BigDataCloud's free,
  keyless, client-side reverse-geocode API. This is purely cosmetic
  (renames "📍 My Location" to the resolved city) and fails silently
  if unreachable — it never blocks or breaks the forecast itself.
*/

async function resolveCurrentLocationName(city) {

  if (!city.isCurrentLocation || city.name !== '📍 My Location') {
    return;
  }

  try {

    const url =
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${city.lat}&longitude=${city.lon}&localityLanguage=en`;

    const res = await fetch(url);
    const data = await res.json();

    const resolved = data.city || data.locality;

    if (resolved) {
      city.name = `📍 ${resolved}`;
      saveCities();
    }

  } catch (err) {
    console.error('Failed to resolve current location name', err);
    // Non-critical: keep the "📍 My Location" label
  }

}

function deleteCity(id) {
  cities = cities.filter(c => c.id !== id);
  saveCities();
  render();
}

function openRadar(lat, lon) {
  window.open(
    `https://www.windy.com/${lat}/${lon}?radar`,
    '_blank'
  );
}

function addCity(city) {

  if (city.isCurrentLocation) {

    // Current Location is a single updatable slot, not a new
    // pin every time — avoids duplicate "My Location" entries
    // from tiny GPS drift between requests.
    const existingIndex = cities.findIndex(
      c => c.isCurrentLocation
    );

    if (existingIndex !== -1) {

      const existing = cities[existingIndex];

      existing.lat = city.lat;
      existing.lon = city.lon;
      existing.query = city.query;

      cities.splice(existingIndex, 1);
      cities.unshift(existing);

      saveCities();
      render();
      return;

    }

  } else {

    const exists = cities.some(
      c => c.lat === city.lat && c.lon === city.lon
    );

    if (exists) {
      alert('City already added');
      return;
    }

  }

  if (cities.length >= MAX_CITIES) {
    alert(`Maximum of ${MAX_CITIES} cities`);
    return;
  }

  cities.unshift(city);
  saveCities();
  render();
}

/*
  CRITICAL FIX:
  Parse date WITHOUT timezone conversion
*/

function parseLocalDate(dateString) {
  const parts = dateString.split('-');

  return {
    year: Number(parts[0]),
    month: Number(parts[1]),
    day: Number(parts[2])
  };
}

function getDayName(dateString) {
  const p = parseLocalDate(dateString);

  const date = new Date(p.year, p.month - 1, p.day);

  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

function getShortDate(dateString) {
  const p = parseLocalDate(dateString);
  return `${p.month}/${p.day}`;
}

/* ============================================================
   Defensive HTML escaping
   City names come from the API and are inserted via innerHTML for
   layout convenience. This neutralizes any HTML special characters
   before insertion.
   ============================================================ */

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value === null || value === undefined ? '' : String(value);
  return div.innerHTML;
}

/* ============================================================
   Row rendering
   Each city gets one stable DOM row. We fill it in progressively
   as its forecast resolves, instead of rebuilding everything.
   ============================================================ */

function buildCityColInner(city, currentTempF) {
  const tempDisplay =
    currentTempF === null || currentTempF === undefined
      ? '--°'
      : `${Math.round(currentTempF)}°`;

  return `
    <button class="delete-btn" type="button">✕</button>

    <div class="city-name">${escapeHtml(city.name)}</div>

    <div class="current-temp">${tempDisplay}</div>

    <button class="radar-btn" type="button">RADAR</button>
  `;
}

function attachCityColListeners(cityColEl, city) {

  const deleteBtn = cityColEl.querySelector('.delete-btn');

  deleteBtn.addEventListener('pointerdown', event => {
    event.preventDefault();
    event.stopPropagation();
    deleteCity(city.id);
  });

  const radarBtn = cityColEl.querySelector('.radar-btn');

  radarBtn.addEventListener('click', event => {
    event.stopPropagation();
    openRadar(city.lat, city.lon);
  });

}

function buildSkeletonRow(city) {

  const row = document.createElement('div');
  row.className = 'forecast-row';

  const cityCol = document.createElement('div');
  cityCol.className = 'city-column';
  cityCol.innerHTML = buildCityColInner(city, null);

  const daysRow = document.createElement('div');
  daysRow.className = 'days-row';
  daysRow.innerHTML = `<div class="loading-card">Loading…</div>`;

  row.appendChild(cityCol);
  row.appendChild(daysRow);

  attachCityColListeners(cityCol, city);

  return { row, cityCol, daysRow };

}

function fillRow(refs, city, data) {

  refs.cityCol.innerHTML = buildCityColInner(city, data.current.temperature_2m);
  attachCityColListeners(refs.cityCol, city);

  refs.daysRow.innerHTML = '';

  const daily = data.daily;

  daily.time.forEach((date, index) => {

    const card = document.createElement('div');
    card.className = 'day-card';

    if (index === 0) {
      card.classList.add('today-card');
    }

    card.innerHTML = `
      <div class="day-name">
        ${getDayName(date)} ${getShortDate(date)}
      </div>

      <div class="icon">
        ${getWeatherIcon(daily.weathercode[index])}
      </div>

      <div class="temps">
        ${Math.round(daily.temperature_2m_max[index])}° / ${Math.round(daily.temperature_2m_min[index])}°
      </div>

      <div class="metric rain">
        💧 ${Math.round(daily.precipitation_probability_max[index])}%
      </div>

      <div class="metric wind">
        🌬 ${Math.round(daily.wind_speed_10m_max[index])} mph
      </div>

      <div class="metric humidity">
        H ${Math.round(daily.relative_humidity_2m_mean[index])}%
      </div>
    `;

    refs.daysRow.appendChild(card);

  });

}

function showRowError(refs, city, message) {

  refs.cityCol.innerHTML = buildCityColInner(city, null);
  attachCityColListeners(refs.cityCol, city);

  refs.daysRow.innerHTML = `
    <div class="error-card">⚠️ ${escapeHtml(message)}</div>
  `;

}

async function fetchAndFillCity(city, refs) {
  try {

    const forecastPromise = (async () => {

      let data = getCachedForecast(city.query);
      const fromCache = !!data;

      if (!data) {
        data = await forecast(city.query);
      }

      return { data, fromCache };

    })();

    // Resolve the Current Location display name in parallel with the
    // forecast fetch, so both settle before the row is filled in.
    const namePromise = resolveCurrentLocationName(city);

    const [{ data, fromCache }] = await Promise.all([
      forecastPromise,
      namePromise
    ]);

    if (data.error) {
      showRowError(
        refs,
        city,
        data.reason || 'Unable to load forecast for this location'
      );
      return;
    }

    if (!data.daily || !data.current) {
      showRowError(
        refs,
        city,
        'Unable to load forecast for this location'
      );
      return;
    }

    if (!fromCache) {
      setCachedForecast(city.query, data);
    }

    fillRow(refs, city, data);

  } catch (err) {
    console.error('Failed to load forecast for', city.name, err);
    showRowError(refs, city, "Network error — couldn't load forecast");
  }
}

function renderEmptyState() {

  const empty = document.createElement('div');
  empty.className = 'empty-state';

  empty.innerHTML = `
    <div class="empty-state-icon">🌤️</div>
    <div class="empty-state-text">No cities yet</div>
    <div class="empty-state-subtext">
      Add a city above, or tap 📍 to use your current location.
    </div>
  `;

  container.appendChild(empty);

}

async function doRender() {

  if (sortableInstance) {
    sortableInstance.destroy();
    sortableInstance = null;
  }

  container.innerHTML = '';

  if (cities.length === 0) {
    renderEmptyState();
    return;
  }

  const scroll = document.createElement('div');
  scroll.className = 'master-scroll';

  const wrapper = document.createElement('div');
  wrapper.className = 'rows-wrapper';

  const rowRefs = [];

  for (const city of cities) {
    const refs = buildSkeletonRow(city);
    wrapper.appendChild(refs.row);
    rowRefs.push({ city, refs });
  }

  scroll.appendChild(wrapper);
  container.appendChild(scroll);

  sortableInstance = new Sortable(wrapper, {

    animation: 150,
    handle: '.city-column',
    delay: 150,
    delayOnTouchOnly: true,

    onEnd: evt => {
      const moved = cities.splice(evt.oldIndex, 1)[0];
      cities.splice(evt.newIndex, 0, moved);
      saveCities();
    }

  });

  // Fetch every city in parallel instead of one at a time.
  // Each call handles its own errors internally and never rejects,
  // so one bad city can't block the others from loading.
  await Promise.all(
    rowRefs.map(({ city, refs }) => fetchAndFillCity(city, refs))
  );

}

/* ============================================================
   render() is the public entry point. Calls are chained so that
   overlapping calls (e.g. rapid add/delete taps) never run
   concurrently and stomp on each other's DOM updates or Sortable
   instances.
   ============================================================ */

let renderChain = Promise.resolve();

function render() {
  renderChain = renderChain
    .then(() => doRender())
    .catch(err => {
      console.error('Render failed:', err);
    });

  return renderChain;
}

/* ============================================================
   City search / autocomplete
   ============================================================ */

const SEARCH_DEBOUNCE_MS = 300;

let searchSeq = 0;
let searchDebounceTimer = null;
let latestSuggestions = [];

function renderSuggestions(results) {

  suggestionBox.innerHTML = '';
  latestSuggestions = results;

  results.forEach(result => {

    const div = document.createElement('div');
    div.className = 'suggestion-item';
    div.textContent = `${result.name}, ${result.region}`;

    div.addEventListener('click', () => {
      selectSuggestion(result);
    });

    suggestionBox.appendChild(div);

  });

}

function selectSuggestion(result) {

  addCity({
    id: crypto.randomUUID(),
    name: `${result.name}, ${result.region}`,
    query: `${result.lat},${result.lon}`,
    lat: result.lat,
    lon: result.lon
  });

  cityInput.value = '';
  suggestionBox.innerHTML = '';
  latestSuggestions = [];

}

cityInput.addEventListener('input', () => {

  const query = cityInput.value.trim();

  clearTimeout(searchDebounceTimer);

  if (query.length < 2) {
    suggestionBox.innerHTML = '';
    latestSuggestions = [];
    return;
  }

  searchDebounceTimer = setTimeout(async () => {

    const thisSeq = ++searchSeq;
    let results;

    try {
      results = await searchCities(query);
    } catch (err) {
      console.error(err);
      return;
    }

    // A newer keystroke fired another search while this one was
    // in flight — discard this now-stale response.
    if (thisSeq !== searchSeq) {
      return;
    }

    if (!Array.isArray(results)) {
      suggestionBox.innerHTML = '';
      latestSuggestions = [];
      return;
    }

    renderSuggestions(results);

  }, SEARCH_DEBOUNCE_MS);

});

cityInput.addEventListener('keydown', event => {
  if (event.key === 'Enter' && latestSuggestions.length > 0) {
    event.preventDefault();
    selectSuggestion(latestSuggestions[0]);
  }
});

document.addEventListener('click', event => {
  if (!event.target.closest('.controls')) {
    suggestionBox.innerHTML = '';
    latestSuggestions = [];
  }
});

resetBtn.addEventListener('click', () => {

  const confirmed = confirm('Clear all saved cities?');

  if (!confirmed) {
    return;
  }

  localStorage.removeItem('weatherCities');
  cities = [];
  render();

});

locationBtn.addEventListener('click', () => {

  if (!navigator.geolocation) {
    alert('Geolocation not supported');
    return;
  }

  navigator.geolocation.getCurrentPosition(

    position => {

      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      addCity({
        id: crypto.randomUUID(),
        name: '📍 My Location',
        query: `${lat},${lon}`,
        lat: lat,
        lon: lon,
        isCurrentLocation: true
      });

    },

    error => {
      console.error(error);
      alert('Location permission denied');
    },

    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }

  );

});

render();
