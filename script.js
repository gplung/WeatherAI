const container = document.getElementById('forecastContainer');
const addBtn = document.getElementById('addBtn');
const cityInput = document.getElementById('cityInput');

let cities = JSON.parse(
  localStorage.getItem('weatherCities') ||
  '["Phoenix","Denver","Rapid City"]'
);

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
  localStorage.setItem('weatherCities', JSON.stringify(cities));
}

async function geocode(city) {
  const url =
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`;

  const res = await fetch(url);
  const data = await res.json();

  if (!data.results || !data.results.length) {
    return null;
  }

  return data.results[0];
}

async function searchCities(query) {
  if (query.length < 2) return [];

  const url =
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5`;

  const res = await fetch(url);
  const data = await res.json();

  return data.results || [];
}

async function forecast(lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max&hourly=relative_humidity_2m,temperature_2m,windspeed_10m&temperature_unit=fahrenheit&windspeed_unit=mph&timezone=auto&forecast_days=10`;

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
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short'
  });
}

function shortDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric'
  });
}

function deleteCity(city) {
  cities = cities.filter(c => c !== city);

  saveCities();

  render();
}

async function render() {
  container.innerHTML = "";

  for (const city of cities) {
    try {
      const geo = await geocode(city);

      if (!geo) continue;

      const data = await forecast(geo.latitude, geo.longitude);

      const row = document.createElement('div');
      row.className = 'forecast-row';

      const cityCol = document.createElement('div');
      cityCol.className = 'city-column';

      cityCol.innerHTML = `
        <button class="delete-btn" data-city="${city}">
          ✕
        </button>

        <div class="city-name">
          ${geo.name}
        </div>

        <div class="current-temp">
          ${Math.round(data.daily.temperature_2m_max[0])}°
        </div>
      `;

      const scroll = document.createElement('div');
      scroll.className = 'scroll-area';

      data.daily.time.forEach((day, i) => {
        const extra = getPeakHumidity(i, data.hourly);

        const card = document.createElement('div');
        card.className = 'day-card';

        const code = data.daily.weathercode[i];

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

          <div class="metric">
            💧 ${data.daily.precipitation_probability_max[i]}%
          </div>

          <div class="metric">
            🌬 ${Math.round(extra.wind)} mph
          </div>

          <div class="metric">
            💦 ${Math.round(extra.humidity)}%
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
      deleteCity(btn.dataset.city);
    });
  });

  syncScrolling();
}

function syncScrolling() {
  const scrollers = document.querySelectorAll('.scroll-area');

  let syncing = false;

  scrollers.forEach(scroller => {
    scroller.addEventListener('scroll', () => {
      if (syncing) return;

      syncing = true;

      scrollers.forEach(other => {
        if (other !== scroller) {
          other.scrollLeft = scroller.scrollLeft;
        }
      });

      requestAnimationFrame(() => {
        syncing = false;
      });
    });
  });
}

addBtn.addEventListener('click', async () => {
  const city = cityInput.value.trim();

  if (!city) return;

  if (cities.includes(city)) {
    alert('City already added');
    return;
  }

  if (cities.length >= 5) {
    alert('Maximum of 5 cities');
    return;
  }

  const geo = await geocode(city);

  if (!geo) {
    alert('City not found');
    return;
  }

  cities.push(city);

  saveCities();

  cityInput.value = "";

  render();
});

render();
