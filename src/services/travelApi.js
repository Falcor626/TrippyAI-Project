const USER_AGENT = 'TripAI/1.0 (educational project)';
const NOMINATIM_COOLDOWN_MS = 1100;
const SERPAPI_PROXY_URL = process.env.REACT_APP_SERPAPI_PROXY_URL || 'http://localhost:5051/serpapi';
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
    let message = `Request failed with status ${response.status}`;
    try {
      const errorBody = await response.json();
      if (errorBody?.error) message = errorBody.error;
    } catch (error) {
      // Keep the default status message if the body is not JSON.
    }
    throw new Error(message);
  }

  const data = await response.json();
  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
};

const serpApiFetch = async (params) => {
  const searchParams = new URLSearchParams(params);
  const url = `${SERPAPI_PROXY_URL}?${searchParams.toString()}`;

  try {
    return await safeJsonFetch(url);
  } catch (error) {
    if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
      throw new Error('SerpApi proxy is not running. Start it in another terminal with: npm run serpapi-proxy');
    }
    throw error;
  }
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

const COMMON_AIRPORTS = {
  'los angeles': { code: 'LAX', name: 'Los Angeles International Airport' },
  'los angeles ca': { code: 'LAX', name: 'Los Angeles International Airport' },
  'baldwin park': { code: 'LAX', name: 'Los Angeles International Airport' },
  'baldwin park ca': { code: 'LAX', name: 'Los Angeles International Airport' },
  'orange county': { code: 'SNA', name: 'John Wayne Airport' },
  'anaheim': { code: 'SNA', name: 'John Wayne Airport' },
  'san diego': { code: 'SAN', name: 'San Diego International Airport' },
  'san francisco': { code: 'SFO', name: 'San Francisco International Airport' },
  'san jose': { code: 'SJC', name: 'San Jose Mineta International Airport' },
  'las vegas': { code: 'LAS', name: 'Harry Reid International Airport' },
  'new york': { code: 'JFK', name: 'John F. Kennedy International Airport' },
  'new york city': { code: 'JFK', name: 'John F. Kennedy International Airport' },
  'brooklyn': { code: 'JFK', name: 'John F. Kennedy International Airport' },
  'queens': { code: 'JFK', name: 'John F. Kennedy International Airport' },
  'newark': { code: 'EWR', name: 'Newark Liberty International Airport' },
  'chicago': { code: 'ORD', name: "Chicago O'Hare International Airport" },
  'miami': { code: 'MIA', name: 'Miami International Airport' },
  'orlando': { code: 'MCO', name: 'Orlando International Airport' },
  'seattle': { code: 'SEA', name: 'Seattle-Tacoma International Airport' },
  'denver': { code: 'DEN', name: 'Denver International Airport' },
  'dallas': { code: 'DFW', name: 'Dallas Fort Worth International Airport' },
  'austin': { code: 'AUS', name: 'Austin-Bergstrom International Airport' },
  'atlanta': { code: 'ATL', name: 'Hartsfield-Jackson Atlanta International Airport' },
  'boston': { code: 'BOS', name: 'Boston Logan International Airport' },
  'washington dc': { code: 'DCA', name: 'Ronald Reagan Washington National Airport' },
  'honolulu': { code: 'HNL', name: 'Daniel K. Inouye International Airport' },
  'maui': { code: 'OGG', name: 'Kahului Airport' },
  'tokyo': { code: 'HND', name: 'Tokyo Haneda Airport' },
  'paris': { code: 'CDG', name: 'Charles de Gaulle Airport' },
  'london': { code: 'LHR', name: 'Heathrow Airport' },
  'rome': { code: 'FCO', name: 'Leonardo da Vinci-Fiumicino Airport' },
  'barcelona': { code: 'BCN', name: 'Barcelona-El Prat Airport' },
  'madrid': { code: 'MAD', name: 'Adolfo Suarez Madrid-Barajas Airport' },
  'lisbon': { code: 'LIS', name: 'Humberto Delgado Airport' },
  'amsterdam': { code: 'AMS', name: 'Amsterdam Airport Schiphol' },
  'cancun': { code: 'CUN', name: 'Cancun International Airport' },
};

const extractAirportCode = (value = '') => {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const parentheticalMatch = trimmed.match(/\(([A-Za-z]{3})\)/);
  if (parentheticalMatch) {
    return parentheticalMatch[1].toUpperCase();
  }

  if (/^[A-Za-z]{3}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  return '';
};

const normalizeAirportLookupKey = (value = '') =>
  normalizeFreeText(value)
    .replace(/\b(california|ca|united states|usa|us|new york state|ny)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const getCommonAirport = (location = '') => {
  const key = normalizeAirportLookupKey(location);
  if (COMMON_AIRPORTS[key]) return COMMON_AIRPORTS[key];

  return Object.entries(COMMON_AIRPORTS).find(([city]) => key.includes(city) || city.includes(key))?.[1] || null;
};

const AIRPORT_CODE_DENYLIST = new Set([
  'API',
  'ARE',
  'AND',
  'THE',
  'FOR',
  'NOT',
  'COM',
  'USA',
  'USC',
  'USD',
  'GET',
  'JSON',
  'IATA',
  'ICAO',
  'FAA',
  'GPS',
  'PDF',
  'URL',
  'HTTP',
  'WWW',
]);

const scoreAirportCandidate = (code, text) => {
  const upperText = text.toUpperCase();
  let score = 0;

  if (upperText.includes(`(${code})`)) score += 8;
  if (upperText.includes(`${code} AIRPORT`)) score += 5;
  if (upperText.includes(`AIRPORT ${code}`)) score += 5;
  if (upperText.includes('INTERNATIONAL AIRPORT')) score += 4;
  if (upperText.includes('AIRPORT')) score += 2;
  if (upperText.includes('IATA')) score += 2;

  return score;
};

const extractBestAirportFromText = (text = '') => {
  const matches = [...text.toUpperCase().matchAll(/\b[A-Z]{3}\b/g)].map((match) => match[0]);
  const candidates = matches.filter((code) => !AIRPORT_CODE_DENYLIST.has(code));

  if (!candidates.length) return '';

  const scored = candidates
    .map((code) => ({ code, score: scoreAirportCandidate(code, text) }))
    .sort((a, b) => b.score - a.score);

  return scored[0]?.score > 0 ? scored[0].code : '';
};

const getSearchTextChunks = (data) => {
  const chunks = [];

  if (data?.answer_box) {
    chunks.push(data.answer_box.answer, data.answer_box.snippet, data.answer_box.title);
  }

  if (data?.knowledge_graph) {
    chunks.push(data.knowledge_graph.title, data.knowledge_graph.type, data.knowledge_graph.description);
  }

  if (Array.isArray(data?.organic_results)) {
    data.organic_results.slice(0, 5).forEach((result) => {
      chunks.push(result.title, result.snippet, result.displayed_link);
    });
  }

  if (Array.isArray(data?.related_questions)) {
    data.related_questions.slice(0, 3).forEach((result) => {
      chunks.push(result.question, result.snippet, result.title);
    });
  }

  return chunks.filter(Boolean);
};

const resolveAirportForLocation = async (location, role = 'location') => {
  const directCode = extractAirportCode(location);
  if (directCode) {
    return { code: directCode, name: `${directCode} airport`, source: 'user input' };
  }

  const commonAirport = getCommonAirport(location);
  if (commonAirport) {
    return { ...commonAirport, source: 'common airport map' };
  }

  const searchQuery = `nearest major airport to ${location} IATA code`;
  const data = await serpApiFetch({
    engine: 'google',
    q: searchQuery,
    location: 'United States',
    hl: 'en',
    gl: 'us',
    google_domain: 'google.com',
  });

  const textChunks = getSearchTextChunks(data);
  const airportCode = extractBestAirportFromText(textChunks.join('\n'));

  if (!airportCode) {
    throw new Error(`Could not determine the best airport for ${role}: ${location}. Try a more specific city, such as "Los Angeles, CA".`);
  }

  const airportName =
    textChunks.find((chunk) => chunk.toUpperCase().includes(`(${airportCode})`)) ||
    textChunks.find((chunk) => chunk.toUpperCase().includes(airportCode)) ||
    `${airportCode} airport`;

  return {
    code: airportCode,
    name: airportName,
    source: 'Google Search airport lookup',
  };
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

export const getFlightOptions = async ({
  departureCity,
  destination,
  startDate,
  endDate,
  travelerCount = 1,
  travelClass = 1,
  currency = 'USD',
}) => {
  if (!departureCity || !destination || !startDate) {
    throw new Error('Flight search needs a departure location, destination, and departure date.');
  }

  const [departureAirport, arrivalAirport] = await Promise.all([
    resolveAirportForLocation(departureCity, 'departure location'),
    resolveAirportForLocation(destination, 'destination'),
  ]);

  const data = await serpApiFetch({
    engine: 'google_flights',
    hl: 'en',
    gl: 'us',
    currency,
    departure_id: departureAirport.code,
    arrival_id: arrivalAirport.code,
    outbound_date: startDate,
    adults: String(Math.max(1, Number(travelerCount) || 1)),
    travel_class: String(travelClass),
    type: endDate ? '1' : '2',
    ...(endDate ? { return_date: endDate } : {}),
  });

  const bestFlights = Array.isArray(data?.best_flights) ? data.best_flights : [];
  const otherFlights = Array.isArray(data?.other_flights) ? data.other_flights : [];
  const flights = [...bestFlights, ...otherFlights].map(summarizeFlights);

  return {
    searchMetadata: data?.search_metadata || {},
    searchParameters: data?.search_parameters || {},
    priceInsights: data?.price_insights || {},
    airports: data?.airports || [],
    resolvedAirports: {
      departure: departureAirport,
      arrival: arrivalAirport,
    },
    flights,
  };
};

const travelApi = {
  searchLocations,
  validateLocation,
  getWeatherPreview,
  waitForNominatimCooldown,
  getFlightOptions,
};

export default travelApi;
