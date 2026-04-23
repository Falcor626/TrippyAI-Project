const USER_AGENT = 'TripAI/1.0 (educational project)';
const NOMINATIM_COOLDOWN_MS = 1100;
const SERPAPI_BASE_URL = 'https://serpapi.com/search.json';
const SERPAPI_AUTOCOMPLETE_ENGINE = 'google_flights_autocomplete';
const SERPAPI_KEY = process.env.REACT_APP_SERPAPI_KEY;
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

const extractAirportCode = (value = '') => {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const parentheticalMatch = trimmed.match(/\(([A-Za-z]{3})\)/);
  if (parentheticalMatch) {
    return parentheticalMatch[1].toUpperCase();
  }

  const standaloneMatch = trimmed.match(/\b([A-Za-z]{3})\b/);
  if (standaloneMatch && trimmed.length <= 12) {
    return standaloneMatch[1].toUpperCase();
  }

  if (/^[A-Za-z]{3}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  return '';
};


const parseDistanceMiles = (value) => {
  if (typeof value !== 'string') return Number.POSITIVE_INFINITY;
  const match = value.match(/([\d.]+)/);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
};

const scoreAirportCandidate = (airport = {}, locationQuery = '') => {
  const normalizedQuery = normalizeFreeText(locationQuery);
  const airportName = normalizeFreeText(airport.name || '');
  const airportCity = normalizeFreeText(airport.city || '');
  const distance = parseDistanceMiles(airport.distance);

  let score = 0;

  if (airportCity && normalizedQuery) {
    if (airportCity === normalizedQuery) score += 120;
    else if (airportCity.startsWith(normalizedQuery) || normalizedQuery.startsWith(airportCity)) score += 80;
    else score += similarityScore(normalizedQuery, airportCity) * 70;
  }

  if (airportName && normalizedQuery) {
    if (airportName.includes(normalizedQuery) || normalizedQuery.includes(airportName)) score += 35;
    else score += similarityScore(normalizedQuery, airportName) * 25;
  }

  if (Number.isFinite(distance)) {
    score += Math.max(0, 40 - distance);
  }

  return score;
};

const dedupeAirports = (airports = []) => {
  const seen = new Set();
  return airports.filter((airport) => {
    const code = airport?.id || airport?.code;
    if (!code || seen.has(code)) return false;
    seen.add(code);
    return true;
  });
};

const resolveFlightLocation = async (query) => {
  const trimmed = (query || '').trim();
  if (!trimmed) {
    throw new Error('Flight search needs both a departure location and a destination.');
  }

  const directCode = extractAirportCode(trimmed);
  if (directCode) {
    return {
      locationId: directCode,
      matchedName: trimmed,
      airports: [{ id: directCode, name: directCode, city: trimmed, distance: null }],
      selectedAirport: { id: directCode, name: directCode, city: trimmed, distance: null },
      source: 'direct-airport-code',
    };
  }

  const url = `${SERPAPI_BASE_URL}?${new URLSearchParams({
    engine: SERPAPI_AUTOCOMPLETE_ENGINE,
    api_key: SERPAPI_KEY,
    q: trimmed,
    gl: 'us',
    hl: 'en',
    exclude_regions: 'true',
  }).toString()}`;

  const data = await safeJsonFetch(url);
  const suggestions = Array.isArray(data?.suggestions) ? data.suggestions : [];
  const citySuggestions = suggestions.filter((item) => item?.type === 'city' && Array.isArray(item?.airports) && item.airports.length);
  const airportSuggestions = suggestions.filter((item) => item?.type === 'airport' && item?.id);

  if (citySuggestions.length) {
    const bestCity = [...citySuggestions]
      .map((suggestion) => ({
        suggestion,
        score: similarityScore(normalizeFreeText(trimmed), normalizeFreeText(suggestion.name || ''))
      }))
      .sort((a, b) => b.score - a.score)[0]?.suggestion;

    const rankedAirports = dedupeAirports(bestCity?.airports || [])
      .map((airport) => ({ ...airport, _score: scoreAirportCandidate(airport, trimmed) }))
      .sort((a, b) => b._score - a._score);

    const selectedAirport = rankedAirports[0] || null;

    return {
      locationId: bestCity?.id || selectedAirport?.id || '',
      matchedName: bestCity?.name || trimmed,
      airports: rankedAirports.map(({ _score, ...airport }) => airport),
      selectedAirport,
      source: 'autocomplete-city',
    };
  }

  if (airportSuggestions.length) {
    const bestAirport = airportSuggestions[0];
    return {
      locationId: bestAirport.id,
      matchedName: bestAirport.name || trimmed,
      airports: [{ id: bestAirport.id, name: bestAirport.name || bestAirport.id, city: bestAirport.description || trimmed, distance: null }],
      selectedAirport: { id: bestAirport.id, name: bestAirport.name || bestAirport.id, city: bestAirport.description || trimmed, distance: null },
      source: 'autocomplete-airport',
    };
  }

  throw new Error(`Could not match "${trimmed}" to a flight-searchable city or airport.`);
};

const parseNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const numeric = Number(value.replace(/[^\d.-]/g, ''));
  return Number.isFinite(numeric) ? numeric : null;
};

const summarizeFlights = (flightGroup) => {
  const flights = Array.isArray(flightGroup?.flights) ? flightGroup.flights : [];
  const firstFlight = flights[0] || {};
  const lastFlight = flights[flights.length - 1] || firstFlight;
  const airlineNames = [...new Set(flights.map((flight) => flight?.airline).filter(Boolean))];
  const layovers = Array.isArray(flightGroup?.layovers)
    ? flightGroup.layovers.map((layover) => layover?.name || layover?.id).filter(Boolean)
    : [];

  return {
    airline: airlineNames.join(', ') || 'Unknown airline',
    price: flightGroup?.price || flightGroup?.price_raw || null,
    priceRaw: parseNumber(flightGroup?.price || flightGroup?.price_raw),
    totalDuration: flightGroup?.total_duration || null,
    type: flightGroup?.type || '',
    carbonEmissions: flightGroup?.carbon_emissions?.this_flight || null,
    bookingToken: flightGroup?.departure_token || '',
    flights,
    stops: Math.max(0, flights.length - 1),
    layovers,
    departureAirport: firstFlight?.departure_airport?.id || firstFlight?.departure_airport?.name || '',
    departureTime: firstFlight?.departure_airport?.time || '',
    arrivalAirport: lastFlight?.arrival_airport?.id || lastFlight?.arrival_airport?.name || '',
    arrivalTime: lastFlight?.arrival_airport?.time || '',
  };
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

    return (data?.daily?.time || []).map((date, index) => ({
      date,
      weatherCode: data.daily.weather_code?.[index] ?? null,
      maxTemp: data.daily.temperature_2m_max?.[index] ?? null,
      minTemp: data.daily.temperature_2m_min?.[index] ?? null,
      precipitationChance: data.daily.precipitation_probability_max?.[index] ?? null,
    }));
  } catch (error) {
    return [];
  }
};

export const getFlightOptions = async ({
  departureCity,
  destination,
  startDate,
  endDate,
  travelerCount = 1,
  travelClass = 1,
  currency = 'USD',
}) => {
  if (!SERPAPI_KEY) {
    throw new Error('Missing SerpApi key. Set REACT_APP_SERPAPI_KEY in your .env file.');
  }

  const departureLocation = await resolveFlightLocation(departureCity);
  const arrivalLocation = await resolveFlightLocation(destination);
  const departureId = departureLocation.locationId;
  const arrivalId = arrivalLocation.locationId;

  if (!departureId || !arrivalId) {
    throw new Error('Unable to resolve flight airports for the selected trip locations.');
  }

  if (!startDate) {
    throw new Error('Flight search needs a departure date.');
  }

  const searchParams = new URLSearchParams({
    engine: 'google_flights',
    api_key: SERPAPI_KEY,
    hl: 'en',
    gl: 'us',
    currency,
    departure_id: departureId,
    arrival_id: arrivalId,
    outbound_date: startDate,
    adults: String(Math.max(1, Number(travelerCount) || 1)),
    travel_class: String(travelClass),
    type: endDate ? '1' : '2',
  });

  if (endDate) {
    searchParams.set('return_date', endDate);
  }

  const url = `${SERPAPI_BASE_URL}?${searchParams.toString()}`;
  const data = await safeJsonFetch(url);

  const bestFlights = Array.isArray(data?.best_flights) ? data.best_flights : [];
  const otherFlights = Array.isArray(data?.other_flights) ? data.other_flights : [];
  const flights = [...bestFlights, ...otherFlights].map(summarizeFlights);

  return {
    searchMetadata: data?.search_metadata || {},
    searchParameters: data?.search_parameters || {},
    priceInsights: data?.price_insights || {},
    airports: data?.airports || [],
    flights,
    resolvedDeparture: departureLocation,
    resolvedArrival: arrivalLocation,
  };
};

const travelApi = {
  searchLocations,
  validateLocation,
  waitForNominatimCooldown,
  getWeatherPreview,
  getFlightOptions,
};

export default travelApi;