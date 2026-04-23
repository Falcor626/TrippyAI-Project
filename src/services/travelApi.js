const USER_AGENT = 'TripAI/1.0 (educational project)';
const NOMINATIM_COOLDOWN_MS = 1100;
let lastNominatimRequestAt = 0;

const INTEREST_TO_TAGS = {
  adventure: ['theme_park', 'climbing', 'viewpoint'],
  culture: ['museum', 'gallery', 'artwork', 'monument'],
  food: ['marketplace', 'food_court', 'attraction'],
  nature: ['zoo', 'aquarium', 'botanical_garden', 'viewpoint'],
  nightlife: ['attraction'],
  relaxation: ['spa_resort', 'beach_resort', 'viewpoint'],
  shopping: ['mall', 'marketplace'],
  photography: ['viewpoint', 'artwork', 'monument'],
};

const safeJsonFetch = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json();
};

const toRadians = (value) => (Number(value) * Math.PI) / 180;

const getDistanceMeters = (lat1, lon1, lat2, lon2) => {
  const earthRadius = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
};

const extractPrimaryLabel = (item) => {
  const address = item?.address || {};
  return (
    address.city ||
    address.town ||
    address.village ||
    address.county ||
    address.state ||
    item?.name ||
    item?.display_name?.split(',')[0] ||
    ''
  );
};

const normalizeSuggestion = (item) => ({
  id: item.place_id || item.osm_id || `${item.lat}-${item.lon}-${item.display_name}`,
  displayName: item.display_name,
  primaryLabel: extractPrimaryLabel(item),
  lat: item.lat ? Number(item.lat) : null,
  lon: item.lon ? Number(item.lon) : null,
  type: item.type || item.addresstype || 'place',
  importance: item.importance || 0,
  source: 'OpenStreetMap Nominatim',
  raw: item,
});

const uniqueSuggestions = (items) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.displayName}-${item.lat}-${item.lon}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const isStrongLocationMatch = (query, suggestion) => {
  const trimmed = (query || '').trim().toLowerCase();
  if (!trimmed || !suggestion) return false;

  const primary = (suggestion.primaryLabel || '').toLowerCase();
  const display = (suggestion.displayName || '').toLowerCase();
  const normalizedQuery = trimmed.replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();

  if (primary.startsWith(normalizedQuery)) return true;
  if (display.startsWith(normalizedQuery)) return true;
  if (normalizedQuery.length >= 5 && display.includes(normalizedQuery)) return true;

  const tokens = normalizedQuery.split(' ').filter(Boolean);
  return tokens.length > 0 && tokens.every((token) => display.includes(token));
};

export const waitForNominatimCooldown = async () => {
  const now = Date.now();
  const elapsed = now - lastNominatimRequestAt;
  if (elapsed < NOMINATIM_COOLDOWN_MS) {
    await new Promise((resolve) => setTimeout(resolve, NOMINATIM_COOLDOWN_MS - elapsed));
  }
  lastNominatimRequestAt = Date.now();
};

export const searchLocations = async (query, options = {}) => {
  const trimmed = (query || '').trim();
  const limit = options.limit || 5;

  if (!trimmed) {
    return [];
  }

  await waitForNominatimCooldown();
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=${limit}&q=${encodeURIComponent(trimmed)}`;
  const results = await safeJsonFetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!Array.isArray(results)) {
    return [];
  }

  return uniqueSuggestions(results.map(normalizeSuggestion));
};

export const validateLocation = async (query) => {
  const trimmed = (query || '').trim();
  if (!trimmed) {
    return {
      isValid: false,
      message: 'Location is required.',
      normalizedName: '',
      lat: null,
      lon: null,
      place: null,
      suggestions: [],
    };
  }

  try {
    const suggestions = await searchLocations(trimmed, { limit: 5 });

    if (!suggestions.length) {
      return {
        isValid: false,
        message: 'Location not found. Try a city, state, or country.',
        normalizedName: '',
        lat: null,
        lon: null,
        place: null,
        suggestions: [],
      };
    }

    const bestMatch = suggestions[0];
    const isValid = isStrongLocationMatch(trimmed, bestMatch);

    return {
      isValid,
      message: isValid
        ? `Matched to ${bestMatch.displayName}`
        : 'Choose one of the suggested locations for a clearer match.',
      normalizedName: bestMatch.displayName,
      lat: bestMatch.lat,
      lon: bestMatch.lon,
      place: bestMatch,
      suggestions,
    };
  } catch (error) {
    return {
      isValid: false,
      message: 'Location lookup failed. Please try again.',
      normalizedName: trimmed,
      lat: null,
      lon: null,
      place: null,
      suggestions: [],
    };
  }
};

export const getWeatherPreview = async (location) => {
  let lat = null;
  let lon = null;
  let startDate = null;
  let endDate = null;

  if (typeof location === 'string') {
    const validated = await validateLocation(location);
    lat = validated.lat;
    lon = validated.lon;
  } else {
    lat = location?.lat ?? null;
    lon = location?.lon ?? null;
    startDate = location?.startDate ?? null;
    endDate = location?.endDate ?? null;
  }

  if (lat == null || lon == null) {
    return [];
  }

  try {
    const forecastStart = startDate || new Date().toISOString().split('T')[0];
    const forecastEnd = endDate || forecastStart;
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
      `&start_date=${forecastStart}&end_date=${forecastEnd}&timezone=auto`;

    const data = await safeJsonFetch(url);
    const daily = data?.daily;

    if (!daily?.time?.length) {
      return [];
    }

    return daily.time.map((date, index) => ({
      date,
      weatherCode: daily.weather_code?.[index] ?? null,
      tempMax: daily.temperature_2m_max?.[index] ?? null,
      tempMin: daily.temperature_2m_min?.[index] ?? null,
      precipitationProbability: daily.precipitation_probability_max?.[index] ?? 0,
    }));
  } catch (error) {
    return [];
  }
};

export const getAttractionPreview = async (location) => {
  let lat = null;
  let lon = null;
  let interests = [];
  let limit = 5;

  if (typeof location === 'string') {
    const validated = await validateLocation(location);
    lat = validated.lat;
    lon = validated.lon;
  } else {
    lat = location?.lat ?? null;
    lon = location?.lon ?? null;
    interests = location?.interests || [];
    limit = location?.limit || 5;
  }

  if (lat == null || lon == null) {
    return [];
  }

  try {
    const tagPool = interests.flatMap((interest) => INTEREST_TO_TAGS[interest] || []);
    const selectedTags = [...new Set(tagPool)].slice(0, 6);
    const tourismClauses = selectedTags.length
      ? selectedTags
          .map(
            (tag) => `        node["tourism"="${tag}"](around:6500,${lat},${lon});\n        way["tourism"="${tag}"](around:6500,${lat},${lon});\n        relation["tourism"="${tag}"](around:6500,${lat},${lon});`
          )
          .join('\n')
      : `        node["tourism"](around:6500,${lat},${lon});\n        way["tourism"](around:6500,${lat},${lon});\n        relation["tourism"](around:6500,${lat},${lon});`;

    const overpassQuery = `
      [out:json][timeout:25];
      (
${tourismClauses}
      );
      out tags center 25;
    `;

    const data = await safeJsonFetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: overpassQuery,
    });

    const attractions = Array.isArray(data?.elements)
      ? data.elements
          .map((item) => {
            const itemLat = item.lat ?? item.center?.lat ?? null;
            const itemLon = item.lon ?? item.center?.lon ?? null;
            const name = item?.tags?.name;
            if (!name || itemLat == null || itemLon == null) return null;
            return {
              id: `${item.type}-${item.id}`,
              name,
              source: item?.tags?.tourism || item?.tags?.historic || 'point of interest',
              distanceMeters: getDistanceMeters(Number(lat), Number(lon), Number(itemLat), Number(itemLon)),
            };
          })
          .filter(Boolean)
          .sort((a, b) => a.distanceMeters - b.distanceMeters)
          .slice(0, limit)
      : [];

    return attractions;
  } catch (error) {
    return [];
  }
};

const travelApi = {
  searchLocations,
  validateLocation,
  getWeatherPreview,
  waitForNominatimCooldown,
  getAttractionPreview,
};

export default travelApi;
