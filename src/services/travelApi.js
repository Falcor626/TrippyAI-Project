const USER_AGENT = 'TripAI/1.0 (educational project)';
const NOMINATIM_COOLDOWN_MS = 1100;
let lastNominatimRequestAt = 0;

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

const normalizeFreeText = (value = '') =>
  value
    .toLowerCase()
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const levenshteinDistance = (a = '', b = '') => {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, () => new Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
};

const similarityScore = (a = '', b = '') => {
  if (!a || !b) return 0;
  const distance = levenshteinDistance(a, b);
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - distance / maxLen;
};

const isStrongLocationMatch = (query, suggestion) => {
  const normalizedQuery = normalizeFreeText(query);
  if (!normalizedQuery || !suggestion) return false;

  const primary = normalizeFreeText(suggestion.primaryLabel || '');
  const display = normalizeFreeText(suggestion.displayName || '');
  const firstSegment = normalizeFreeText((suggestion.displayName || '').split(',')[0] || '');

  if (!primary && !display) return false;

  if (primary === normalizedQuery || firstSegment === normalizedQuery) {
    return true;
  }

  if (
    primary.startsWith(normalizedQuery) ||
    normalizedQuery.startsWith(primary) ||
    display.startsWith(normalizedQuery)
  ) {
    return true;
  }

  return similarityScore(normalizedQuery, primary || firstSegment || display) >= 0.74;
};

const looksCanonicalEnoughToAutofill = (query, suggestion, suggestions = []) => {
  if (!suggestion) return false;
  if (isStrongLocationMatch(query, suggestion)) return true;
  if (suggestions.length === 1) return true;

  const second = suggestions[1];
  if (!second) return false;

  const bestScore = similarityScore(normalizeFreeText(query), normalizeFreeText(suggestion.primaryLabel || suggestion.displayName));
  const secondScore = similarityScore(normalizeFreeText(query), normalizeFreeText(second.primaryLabel || second.displayName));
  return bestScore >= 0.72 && bestScore - secondScore >= 0.12;
};

export const waitForNominatimCooldown = async () => {
  const elapsed = Date.now() - lastNominatimRequestAt;
  if (elapsed < NOMINATIM_COOLDOWN_MS) {
    await new Promise((resolve) => setTimeout(resolve, NOMINATIM_COOLDOWN_MS - elapsed));
  }
};

export const searchLocations = async (query, { limit = 5 } = {}) => {
  const trimmed = query.trim();
  if (!trimmed) return [];

  await waitForNominatimCooldown();
  lastNominatimRequestAt = Date.now();

  const url =
    'https://nominatim.openstreetmap.org/search?' +
    new URLSearchParams({
      q: trimmed,
      format: 'jsonv2',
      addressdetails: '1',
      limit: String(limit),
      dedupe: '1',
      'accept-language': 'en',
    }).toString();

  const data = await safeJsonFetch(url, {
    headers: {
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': USER_AGENT,
    },
  });

  return uniqueSuggestions((data || []).map(normalizeSuggestion));
};

export const validateLocation = async (query, options = {}) => {
  const trimmed = query.trim();
  const { autoSelect = false } = options;

  if (!trimmed) {
    return {
      isValid: false,
      message: 'Enter a city, state, or country.',
      normalizedName: '',
      lat: null,
      lon: null,
      place: null,
      suggestions: [],
      autoSelected: false,
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
        autoSelected: false,
      };
    }

    const bestMatch = suggestions[0];
    const isValid = isStrongLocationMatch(trimmed, bestMatch);
    const autoSelected = autoSelect && looksCanonicalEnoughToAutofill(trimmed, bestMatch, suggestions);

    return {
      isValid: isValid || autoSelected,
      message:
        isValid || autoSelected
          ? `Matched to ${bestMatch.displayName}`
          : 'Choose one of the suggested locations for a clearer match.',
      normalizedName: bestMatch.displayName,
      lat: bestMatch.lat,
      lon: bestMatch.lon,
      place: bestMatch,
      suggestions,
      autoSelected,
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
      autoSelected: false,
    };
  }
};

export const getWeatherPreview = async (location) => {
  let lat = null;
  let lon = null;
  let startDate = null;
  let endDate = null;

  if (typeof location === 'string') {
    const validated = await validateLocation(location, { autoSelect: true });
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
      `&temperature_unit=fahrenheit` +
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

const travelApi = {
  searchLocations,
  validateLocation,
  getWeatherPreview,
  waitForNominatimCooldown,
};

export default travelApi;
