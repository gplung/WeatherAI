const container = document.getElementById('forecastContainer');
const addBtn = document.getElementById('addBtn');
const cityInput = document.getElementById('cityInput');

const suggestionBox = document.createElement('div');
suggestionBox.className = 'suggestions';

document.querySelector('.controls').appendChild(suggestionBox);

const stateMap = {
  Alabama: "AL",
  Alaska: "AK",
  Arizona: "AZ",
  Arkansas: "AR",
  California: "CA",
  Colorado: "CO",
  Connecticut: "CT",
  Delaware: "DE",
  Florida: "FL",
  Georgia: "GA",
  Hawaii: "HI",
  Idaho: "ID",
  Illinois: "IL",
  Indiana: "IN",
  Iowa: "IA",
  Kansas: "KS",
  Kentucky: "KY",
  Louisiana: "LA",
  Maine: "ME",
  Maryland: "MD",
  Massachusetts: "MA",
  Michigan: "MI",
  Minnesota: "MN",
  Mississippi: "MS",
  Missouri: "MO",
  Montana: "MT",
  Nebraska: "NE",
  Nevada: "NV",
  "New Hampshire": "NH",
  "New Jersey": "NJ",
  "New Mexico": "NM",
  "New York": "NY",
  "North Carolina": "NC",
  "North Dakota": "ND",
  Ohio: "OH",
  Oklahoma: "OK",
  Oregon: "OR",
  Pennsylvania: "PA",
  "Rhode Island": "RI",
  "South Carolina": "SC",
  "South Dakota": "SD",
  Tennessee: "TN",
  Texas: "TX",
  Utah: "UT",
  Vermont: "VT",
  Virginia: "VA",
  Washington: "WA",
  "West Virginia": "WV",
  Wisconsin: "WI",
  Wyoming: "WY"
};

let cities = JSON.parse(
  localStorage.getItem('weatherCities') || '[]'
);

let selectedCity = null;

const weatherIcons = {
  0: "☀️",
  1: "🌤️",
  2: "⛅",
  3: "☁️",
  45: "🌫️",
  48: "🌫️",
  51: "🌦️",
  61: "🌧️",
  63: "🌧️",
  65: "🌧️",
  71: "❄️",
  80: "🌦️",
  95: "⛈️"
};

function saveCities() {
  localStorage.setItem(
    'weatherCities',
    JSON.stringify(cities)
  );
}

function getStateAbbr(state) {
  return stateMap[state] || state || '';
}

async function searchCities(query) {

  if (query.length < 2) return [];

  const url =
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=8`;

  const res = await fetch(url);

  const data = await res.json();

  return data.results || [];
}

async function forecast(lat, lon, timezone) {

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max&hourly=relative_humidity_2m,temperature_2m,windspeed_10m&temperature_unit=fahrenheit&windspeed_unit=mph&timezone=${timezone}&forecast_days=10`;

  const res = await fetch(url);

  return await res.json();
}

function getPeakHumidity(dayIndex, hourly) {

  const start = dayIndex * 24;
  const end = start + 24;

  let maxTemp = -999;
  let humidity = 0;
  let wind = 0;

  for (let i = start; i < end; i++) {

    const temp = hourly.temperature_2m[i];

    if (temp > maxTemp) {

      maxTemp = temp;
      humidity = hourly.relative_humidity_2m[i];
      wind = hourly.windspeed_10m[i];

    }
  }

  return { humidity, wind };
}

function shortDay(dateStr) {

  return new Date(dateStr).toLocaleDateString(
    'en-US',
    { weekday: 'short' }
  );

}

function shortDate(dateStr) {

  return new Date(dateStr).toLocaleDateString(
    'en-US',
    {
      month: 'numeric',
      day: 'numeric'
    }
  );

}

function deleteCity(lat, lon) {

  cities = cities.filter(
    c => !(c.lat === lat && c.lon === lon)
  );

  saveCities();

  render();
}

async function render() {

  container.innerHTML = "";

  for (const city of cities) {

    try {

      const data = await forecast(
        city.lat,
        city.lon,
        city.timezone
      );

      const row =
        document.createElement('div');

      row.className = 'forecast-row';

      const cityCol =
        document.createElement('div');

      cityCol.className = 'city-column';

      cityCol.innerHTML = `
        <button
          class="delete-btn"
          data-lat="${city.lat}"
          data-lon="${city.lon}"
        >
          ✕
        </button>

        <div class="city-name">
          ${city.name}, ${city.state}
        </div>

        <div class="current-temp">
          ${Math.round(data.daily.temperature_2m_max[0])}°
        </div>
      `;

      const scroll =
        document.createElement('div');

      scroll.className = 'scroll-area';

      data.daily.time.forEach((day, i) => {

        const extra =
          getPeakHumidity(i, data.hourly);

        const card =
          document.createElement('div');

        card.className = 'day-card';

        if (i === 0) {
          card.classList.add('today-card');
        }

        const code =
          data.daily.weathercode[i];

        card.innerHTML = `
          <div class="day-name">
            ${shortDay(day)} ${shortDate(day)}
          </div>

          <div class="icon">
            ${weatherIcons[code] || "🌤️"}
          </div>

          <div class="temps">
            ${Math.round(data.daily.temperature_2m_max[i])}°
            /
            ${Math.round(data.daily.temperature_2m_min[i])}°
          </div>

          <div class="metric rain">
            💧 ${data.daily.precipitation_probability_max[i]}%
          </div>

          <div class="metric wind">
            🌬 ${Math.round(extra.wind)} mph
          </div>

          <div class="metric humidity">
            H ${Math.round(extra.humidity)}%
          </div>
        `;

        scroll.appendChild(card);

      });

      row.appendChild(cityCol);
      row.appendChild(scroll);

      container.appendChild(row);

    } catch (err) {

      console.error(err);

    }
  }

  document.querySelectorAll('.delete-btn').forEach(btn => {

    btn.addEventListener('click', () => {

      deleteCity(
        Number(btn.dataset.lat),
        Number(btn.dataset.lon)
      );

    });

  });

  syncScrolling();
}

function syncScrolling() {

  const scrollers =
    document.querySelectorAll('.scroll-area');

  let syncing = false;

  scrollers.forEach(scroller => {

    scroller.addEventListener('scroll', () => {

      if (syncing) return;

      syncing = true;

      scrollers.forEach(other => {

        if (other !== scroller) {

          other.scrollLeft =
            scroller.scrollLeft;

        }

      });

      requestAnimationFrame(() => {

        syncing = false;

      });

    });

  });

}

cityInput.addEventListener('input', async () => {

  const query =
    cityInput.value.trim();

  selectedCity = null;

  suggestionBox.innerHTML = '';

  if (query.length < 2) return;

  const results =
    await searchCities(query);

  results.forEach(result => {

    const div =
      document.createElement('div');

    div.className =
      'suggestion-item';

    const state =
      getStateAbbr(result.admin1);

    const label =
      state
        ? `${result.name}, ${state}`
        : result.name;

    div.textContent = label;

    div.addEventListener('click', () => {

      selectedCity = {
        name: result.name,
        state: state,
        lat: result.latitude,
        lon: result.longitude,
        timezone: result.timezone
      };

      cityInput.value = label;

      suggestionBox.innerHTML = '';

    });

    suggestionBox.appendChild(div);

  });

});

addBtn.addEventListener('click', async () => {

  if (!selectedCity) {

    alert('Please select a city from the dropdown');

    return;
  }

  const alreadyExists =
    cities.some(
      c =>
        c.lat === selectedCity.lat &&
        c.lon === selectedCity.lon
    );

  if (alreadyExists) {

    alert('City already added');

    return;
  }

  if (cities.length >= 5) {

    alert('Maximum of 5 cities');

    return;
  }

  cities.unshift(selectedCity);

  saveCities();

  cityInput.value = '';

  suggestionBox.innerHTML = '';

  selectedCity = null;

  render();

});

render();
