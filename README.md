# Multi-City Weather Dashboard

## Project Overview

A custom weather dashboard designed primarily for:

- iPhone Safari
- iPhone Home Screen Web App
- Desktop browsers
- GitHub Pages hosting

The dashboard displays weather for up to 7 cities simultaneously in a vertically stacked format.

Design goals:

- Quick comparison of multiple cities
- Minimal scrolling
- Large weather overview
- RV / travel friendly
- Mobile-first layout

---

## Current Hosting

Hosted using GitHub Pages.

Repository contains:

```
index.html
style.css
script.js
manifest.json
weather-app-icon.png
```

No server-side code. Pure HTML / CSS / JavaScript.

---

## Weather Provider

Current provider: **Open-Meteo** (switched from WeatherAPI.com — see "Provider History" below)

No API key required. No signup. Nothing to rotate or leak.

Forecast endpoint:

```
https://api.open-meteo.com/v1/forecast
```

Geocoding / city search endpoint:

```
https://geocoding-api.open-meteo.com/v1/search
```

Free tier: 10,000 calls/day, no monthly cap currently enforced. Licensed for non-commercial use under CC BY 4.0 — attribution to Open-Meteo is required if the app is ever made public-facing beyond personal use. No SLA / uptime guarantee, which is an accepted tradeoff for a free personal dashboard.

### Current Location name resolution

Open-Meteo has no reverse-geocoding endpoint (coordinates → city name), so resolving "📍 My Location" to a real city name uses one additional service:

```
https://api.bigdatacloud.net/data/reverse-geocode-client
```

Free, keyless, client-side only. This call is purely cosmetic (renames the label) and fails silently if unreachable — the forecast itself never depends on it, and the row simply keeps showing "📍 My Location" if the name can't be resolved.

### Weather icons

Open-Meteo returns a numeric WMO weather code rather than a hosted icon image. The app maps codes to emoji locally (see `WEATHER_ICON_MAP` in `script.js`) — no image requests needed.

---

## Provider History

**WeatherAPI.com (original provider, replaced)**

The app originally used WeatherAPI.com with an embedded API key in `script.js`. In July 2026, WeatherAPI's free trial ended and the key was auto-downgraded to their permanent Free plan, which caps forecasts at 3 days (down from the 10 days the app was built around) and reduced the call quota from 1M/month to 100K/month. A paid plan supporting a true 10-day forecast started at $25/month (Pro+), which was judged not worth it for a personal dashboard. The app was migrated to Open-Meteo instead, which is free indefinitely, has no key to leak or expire, and natively supports up to 16-day forecasts.

---

## Major Features

### Cities

Maximum cities: 7

- Add city by name (Open-Meteo's geocoding search does not support ZIP/postal code lookup — name search only)
- City autocomplete dropdown with 300ms debounce (prevents excessive API calls while typing)
- Pressing Enter selects the top autocomplete suggestion
- Clicking outside the dropdown closes it
- Stale autocomplete responses discarded (fast typists won't see out-of-order results)
- Duplicate city prevention (matched by latitude/longitude)
- New city added to top of list
- Drag-and-drop city sorting
- Delete city button
- Reset all cities button

Cities saved in localStorage under key: `weatherCities`

---

### Current Location

Button: 📍

Uses: `navigator.geolocation`

- Treated as a single persistent slot — tapping 📍 again updates the existing location rather than adding a duplicate
- After the first fetch, the city name updates from "📍 My Location" to the real resolved city name (e.g. "📍 Sioux Falls") via BigDataCloud's free reverse-geocode API (see Weather Provider section above)
- This prevents duplicate pins from tiny GPS drift between requests

---

### Forecast Layout

One city per row. 10-day forecast columns. Single synchronized horizontal scroll area. Frozen city column remains visible while scrolling.

A frozen day-of-week/date header row sits above all cities so the day and date are shown once instead of repeated in every city's row. It's sticky (pinned just below the app header) and scrolls horizontally in sync with the city rows because it lives inside the same `master-scroll` wrapper — no separate scroll-sync logic needed. The header's vertical pin position is measured from the app header's actual height via `updateStickyOffset()` (re-measured on load and on resize/orientation change), so it stays correctly positioned even if the header's height changes.

Columns alternate with a subtle background shade (`nth-child(even)`) to make it easier to track a given day across multiple city rows at a glance.

The header is populated from whichever city's forecast resolves first (all cities request the same `forecast_days` with `timezone=auto`, so their date sequences line up). If every city fails to load, the header shows a placeholder dash rather than blocking or erroring.

---

### Forecast Data Shown

For each day:

- Day name and date
- Weather icon (emoji, mapped from WMO weather code)
- High / low temperature
- Chance of rain
- Wind speed
- Humidity

---

### Left Frozen Column

Displays:

- City name
- Current temperature (live, not the day's forecast high)
- Radar button
- Delete button

---

### Loading & Error States

Each city row shows a pulsing "Loading…" placeholder while its forecast is being fetched. If a fetch fails (network error, bad query, API error, or a malformed/missing response), the row shows a clear inline error message instead of silently disappearing.

---

### Empty State

When no cities are saved — either after a reset or on first launch — a friendly prompt is shown directing the user to add a city or use current location.

---

### Radar

Button: RADAR

Opens Windy.com radar in a new tab:

```
https://www.windy.com/{lat}/{lon}?radar
```

---

### Icons

Weather icons: emoji, mapped locally from Open-Meteo's WMO weather codes.

Browser favicon: `weather-app-icon.png`

Home screen icon: `weather-app-icon.png` (512×512 custom multi-city weather icon)

---

### Styling

- Dark theme (`#0f172a` background)
- Mobile friendly, large weather cards
- Frozen city column with drop shadow
- Smooth synchronized horizontal scrolling
- Humidity displayed in green text: `H 29%`
- No humidity icon

---

## Performance

### Parallel City Fetching

All cities are fetched simultaneously using `Promise.all` rather than sequentially. With 7 cities this can reduce load time by up to 6×.

### Forecast Cache

Forecast data is cached in localStorage for 10 minutes (key: `weatherForecastCache`). Adding or deleting one city does not re-fetch the other cities. Reloading the page within the cache window is near-instant.

### Progressive Row Fill

Each city row renders immediately as a skeleton/loading state, then fills in independently as its forecast resolves. The page is interactive and scrollable while data is still loading.

### Render Queue

`render()` calls are chained sequentially. Rapid actions (quick add, quick delete) never run overlapping renders concurrently, preventing DOM conflicts and duplicate Sortable instances.

---

## PWA / Home Screen Support

A `manifest.json` file is included for proper Home Screen install behavior:

```json
{
  "name": "Weather Dashboard",
  "short_name": "Weather",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#0f172a",
  "start_url": "./index.html",
  "icons": [{ "src": "weather-app-icon.png", "sizes": "512x512" }]
}
```

This works alongside the existing Apple-specific meta tags in `index.html`. No service worker is used — deliberately excluded to avoid stale data risks.

---

## Repository Structure

```
/
├── index.html
├── style.css
├── script.js
├── manifest.json
├── weather-app-icon.png
└── README-WEATHER-DASHBOARD.md
```

---

## GitHub Deployment

1. Edit file(s)
2. Commit changes
3. Wait for GitHub Pages to deploy
4. Hard refresh browser

Safari aggressively caches JavaScript. If changes do not appear after a hard refresh, rename `script.js` to `script-vXX.js` and update the `<script>` tag in `index.html` to match.

---

## Known Historical Bugs — All Fixed

### Weather starts on yesterday

Cause: JavaScript `new Date(dateString)` applies timezone conversion to date strings.

Fix: Date strings from the API are parsed manually by splitting on `-` and constructing a `new Date(year, month-1, day)` with local components. The `parseLocalDate()` function must never be changed to use `new Date(dateString)` directly.

---

### Delete button requiring multiple presses

Cause: SortableJS drag event conflicting with the click event on the delete button.

Fix: Delete button uses `pointerdown` event (not `click`) with `event.preventDefault()` and `event.stopPropagation()`. Must remain `pointerdown` — changing this back to `click` reintroduces the bug.

---

### Scroll lag

Cause: Each city row had its own independent horizontal scroll container.

Fix: A single shared `master-scroll` wrapper contains all rows. All rows scroll together as one unit.

---

### City count not resetting

Cause: Deleted cities were not removed from the array correctly.

Fix: `cities.filter()` recalculates the array from scratch on each delete.

---

### Invalid city consuming city slot

Cause: City count was incremented before API validation.

Fix: Validation runs before the city is added to the array.

---

### Overlapping renders on rapid user actions

Cause: `render()` is async and was called without awaiting, so two renders could run concurrently and conflict.

Fix: A `renderChain` promise ensures renders execute sequentially regardless of how quickly the user acts.

---

### Silent city disappearance on API error

Cause: API errors were caught and logged but the row was left empty with no user feedback.

Fix: Each row shows an inline error message if its forecast fetch fails, returns an error payload, or returns a malformed/missing response.

---

### Stale autocomplete results appearing out of order

Cause: Rapid typing fired multiple `searchCities()` calls, and slow responses could return after newer ones.

Fix: Debounce (300ms) + sequence counter — responses from superseded searches are discarded.

---

### Current Location creating duplicate pins

Cause: Slight GPS drift between requests produced different lat/lon values, bypassing the exact-match duplicate check.

Fix: `isCurrentLocation` flag ensures only one current-location slot exists. Tapping 📍 again updates the existing slot rather than adding a new one.

---

### WeatherAPI.com trial ended, forecasts silently truncated to 3 days (July 2026)

Cause: WeatherAPI's free trial expired and the key was auto-downgraded to their Free plan, which only returns 3 days of forecast regardless of the `days=10` requested. No error was returned — the API simply returned fewer days.

Fix: Migrated the weather provider from WeatherAPI.com to Open-Meteo, which is free indefinitely with no trial/downgrade risk and natively supports up to 16-day forecasts. City search moved to Open-Meteo's geocoding API, and Current Location name resolution moved to BigDataCloud's free reverse-geocode API (see Weather Provider section above).

---

## Future Enhancements Under Consideration

- Weather alerts
- Air quality
- Sunrise / sunset
- Hourly forecast popup
- Weather maps overlay
- Multi-provider forecast comparison
- Apple Weather integration
- Forecast confidence display
- Favorite city presets
- Export / import city list
- Multiple dashboard pages

---

## Developer Notes

Always provide complete file replacements when making changes — never partial snippets. This reduces copy/paste mistakes during GitHub Pages deployment.

When modifying any file, confirm that all previously working features remain intact before delivering the update.
