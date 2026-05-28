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

const WEATHER_API_KEY =
  '74b32e01f9b5486eaf413100262805';

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

async function searchCities(query) {

  if (query.length < 2) {

    return [];

  }

  const url =
    `https://api.weatherapi.com/v1/search.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(query)}`;

  const res = await fetch(url);

  return await res.json();

}

async function forecast(query) {

  const url =
    `https://api.weatherapi.com/v1/forecast.json?key=${WEATHER_API_KEY}&q=${query}&days=10&aqi=no&alerts=no`;

  const res = await fetch(url);

  return await res.json();

}

function deleteCity(id) {

  cities = cities.filter(
    c => c.id !== id
  );

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

  const exists = cities.some(
    c =>
      c.lat === city.lat &&
      c.lon === city.lon
  );

  if (exists) {

    alert('City already added');

    return;

  }

  if (cities.length >= MAX_CITIES) {

    alert(
      `Maximum of ${MAX_CITIES} cities`
    );

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

  const parts =
    dateString.split('-');

  return {
    year: Number(parts[0]),
    month: Number(parts[1]),
    day: Number(parts[2])
  };

}

function getDayName(dateString) {

  const p =
    parseLocalDate(dateString);

  const date =
    new Date(
      p.year,
      p.month - 1,
      p.day
    );

  return date.toLocaleDateString(
    'en-US',
    {
      weekday: 'short'
    }
  );

}

function getShortDate(dateString) {

  const p =
    parseLocalDate(dateString);

  return `${p.month}/${p.day}`;

}

async function render() {

  container.innerHTML = '';

  const scroll =
    document.createElement('div');

  scroll.className =
    'master-scroll';

  const wrapper =
    document.createElement('div');

  wrapper.className =
    'rows-wrapper';

  for (const city of cities) {

    try {

      const data =
        await forecast(city.query);

      const row =
        document.createElement('div');

      row.className =
        'forecast-row';

      const cityCol =
        document.createElement('div');

      cityCol.className =
        'city-column';

      cityCol.innerHTML = `
        <button
          class="delete-btn"
          data-id="${city.id}"
          type="button"
        >
          ✕
        </button>

        <div class="city-name">
          ${city.name}
        </div>

        <div class="current-temp">
          ${Math.round(
            data.current.temp_f
          )}°
        </div>

        <button
          class="radar-btn"
          data-lat="${city.lat}"
          data-lon="${city.lon}"
          type="button"
        >
          RADAR
        </button>
      `;

      const daysRow =
        document.createElement('div');

      daysRow.className =
        'days-row';

      data.forecast.forecastday.forEach(
        (day, index) => {

          const card =
            document.createElement('div');

          card.className =
            'day-card';

          if (index === 0) {

            card.classList.add(
              'today-card'
            );

          }

          card.innerHTML = `
            <div class="day-name">
              ${getDayName(day.date)}
              ${getShortDate(day.date)}
            </div>

            <div class="icon">
              <img
                src="https:${day.day.condition.icon}"
                alt=""
              >
            </div>

            <div class="temps">
              ${Math.round(
                day.day.maxtemp_f
              )}°
              /
              ${Math.round(
                day.day.mintemp_f
              )}°
            </div>

            <div class="metric rain">
              💧
              ${day.day.daily_chance_of_rain}%
            </div>

            <div class="metric wind">
              🌬
              ${Math.round(
                day.day.maxwind_mph
              )} mph
            </div>

            <div class="metric humidity">
              H
              ${Math.round(
                day.day.avghumidity
              )}%
            </div>
          `;

          daysRow.appendChild(card);

        }
      );

      row.appendChild(cityCol);

      row.appendChild(daysRow);

      wrapper.appendChild(row);

    } catch (err) {

      console.error(err);

    }

  }

  scroll.appendChild(wrapper);

  container.appendChild(scroll);

  document
    .querySelectorAll('.delete-btn')
    .forEach(btn => {

      btn.addEventListener(
        'pointerdown',
        event => {

          event.preventDefault();

          event.stopPropagation();

          deleteCity(
            btn.dataset.id
          );

        }
      );

    });

  document
    .querySelectorAll('.radar-btn')
    .forEach(btn => {

      btn.addEventListener(
        'click',
        event => {

          event.stopPropagation();

          openRadar(
            btn.dataset.lat,
            btn.dataset.lon
          );

        }
      );

    });

  if (sortableInstance) {

    sortableInstance.destroy();

  }

  sortableInstance =
    new Sortable(wrapper, {

      animation: 150,

      handle: '.city-column',

      delay: 150,

      delayOnTouchOnly: true,

      onEnd: evt => {

        const moved =
          cities.splice(
            evt.oldIndex,
            1
          )[0];

        cities.splice(
          evt.newIndex,
          0,
          moved
        );

        saveCities();

      }

    });

}

cityInput.addEventListener(
  'input',
  async () => {

    const query =
      cityInput.value.trim();

    suggestionBox.innerHTML =
      '';

    if (query.length < 2) {

      return;

    }

    const results =
      await searchCities(query);

    results.forEach(result => {

      const div =
        document.createElement('div');

      div.className =
        'suggestion-item';

      div.textContent =
        `${result.name}, ${result.region}`;

      div.addEventListener(
        'click',
        () => {

          addCity({

            id:
              crypto.randomUUID(),

            name:
              `${result.name}, ${result.region}`,

            query:
              `${result.lat},${result.lon}`,

            lat:
              result.lat,

            lon:
              result.lon

          });

          cityInput.value =
            '';

          suggestionBox.innerHTML =
            '';

        }
      );

      suggestionBox.appendChild(div);

    });

  }
);

resetBtn.addEventListener(
  'click',
  () => {

    const confirmed =
      confirm(
        'Clear all saved cities?'
      );

    if (!confirmed) {

      return;

    }

    localStorage.removeItem(
      'weatherCities'
    );

    cities = [];

    render();

  }
);

locationBtn.addEventListener(
  'click',
  () => {

    if (!navigator.geolocation) {

      alert(
        'Geolocation not supported'
      );

      return;

    }

    navigator.geolocation.getCurrentPosition(

      position => {

        const lat =
          position.coords.latitude;

        const lon =
          position.coords.longitude;

        addCity({

          id:
            crypto.randomUUID(),

          name:
            '📍 My Location',

          query:
            `${lat},${lon}`,

          lat:
            lat,

          lon:
            lon

        });

      },

      error => {

        console.error(error);

        alert(
          'Location permission denied'
        );

      },

      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }

    );

  }
);

render();
