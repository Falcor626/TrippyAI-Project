import { useEffect, useMemo, useRef, useState } from 'react';
import './TravelItinerary.css';
import TripMap from './TripMap';
import {
  getAttractionOptions,
  getFlightOptions,
  getHotelOptions,
  getWeatherPreview,
} from '../services/travelApi';
import { sendTrippyChatMessage } from '../services/itineraryService';

const INTEREST_LABELS = {
  adventure: 'Adventure',
  culture: 'Culture',
  food: 'Food & Drink',
  nature: 'Nature',
  nightlife: 'Nightlife',
  relaxation: 'Relaxation',
  shopping: 'Shopping',
  photography: 'Photography',
};

const BUDGET_LABELS = {
  budget: 'Budget-friendly',
  moderate: 'Balanced',
  comfort: 'Comfort-first',
  luxury: 'Luxury',
};

const DEFAULT_PACKING = ['Passport', 'Comfortable walking shoes', 'Portable charger', 'Transit card', 'Light layer'];

const DEFAULT_TIPS = [
  'Book one headline activity early so the rest of the day stays flexible.',
  'Leave one open block each day for a cafe, viewpoint, or spontaneous stop.',
  'Keep transit, weather, and meal timing light on arrival day so the pace stays realistic.',
];

const DEFAULT_TRAVEL_CHECKLIST = {
  documents: ['Passport or government ID', 'Booking confirmations', 'Travel insurance details'],
  packing: DEFAULT_PACKING,
  weatherPrep: ['Check the forecast 48 hours before departure', 'Pack one flexible outer layer'],
  reservations: ['Confirm lodging check-in details', 'Book one priority activity early'],
  localLogistics: ['Save offline maps', 'Review airport transfer options', 'Check local transit payment methods'],
};

const CHECKLIST_LABELS = {
  documents: 'Documents',
  packing: 'Packing',
  weatherPrep: 'Weather prep',
  reservations: 'Reservations',
  localLogistics: 'Local logistics',
};

const mergeTravelChecklist = (aiChecklist = {}) =>
  Object.entries(DEFAULT_TRAVEL_CHECKLIST).reduce((checklist, [key, fallbackItems]) => {
    const aiItems = Array.isArray(aiChecklist[key]) ? aiChecklist[key].filter(Boolean) : [];
    return {
      ...checklist,
      [key]: aiItems.length ? aiItems : fallbackItems,
    };
  }, {});

const DEFAULT_REFINEMENT_MESSAGE = {
  role: 'assistant',
  content:
    'Tell Trippy how to adjust this itinerary. I can make it cheaper, calmer, more food-focused, or better for a specific group.',
};

const CONFIRM_PLAN_UPDATE_PATTERN = /\b(yes|yep|yeah|sure|ok|okay|confirm|continue|proceed|regenerate it|update it|do it|apply|go ahead|please update|please regenerate)\b/i;
const DECLINE_PLAN_UPDATE_PATTERN = /\b(no|nope|cancel|don't|do not|never mind|nevermind|leave it|keep it)\b/i;
const PLAN_UPDATE_ACTION_PATTERN = /\b(make|turn|add|include|change|update|revise|adjust|modify|replace|swap|remove|regenerate)\b/i;
const PLAN_UPDATE_THEME_PATTERN =
  /\b(romantic|romance|anime|anime-filled|theme|themed|cheaper|budget|affordable|relaxed|relaxing|slower|food|restaurant|family|kid|adventure|day\s*\d+|flights?|hotels?|stays?|activities?|itinerary|plan|trip)\b/i;
const EXPLICIT_REGENERATE_PATTERN = /\b(regenerate|regen|rebuild|recreate)\b/i;

const shouldConfirmPlanUpdate = (message = '') => {
  const normalized = message.trim().toLowerCase();

  const directUpdateRequest = [
    /\bregenerate\b/,
    /\b(change|update|revise|adjust|modify)\s+(the\s+)?(itinerary|plan|trip)\b/,
    /\b(make|turn)\s+(this|it|the\s+plan|the\s+itinerary|the\s+trip)?\s*(a\s+)?(romantic|anime-filled|anime|cheaper|more relaxed|less busy|slower|food-focused|family-friendly)\b/,
    /\b(add|include)\s+(more\s+)?(anime|romantic|food|restaurants|activities|free time|relaxation)\b/,
    /\b(change|update|replace|swap|remove)\s+(day\s*\d+|flights?|hotels?|stays?|activities?)\b/,
    /\b(replace|swap|remove)\s+.+\s+(from|in)\s+(the\s+)?(itinerary|plan|trip)\b/,
  ].some((pattern) => pattern.test(normalized));

  return directUpdateRequest || (PLAN_UPDATE_ACTION_PATTERN.test(normalized) && PLAN_UPDATE_THEME_PATTERN.test(normalized));
};
const confirmsPlanUpdate = (message = '') => CONFIRM_PLAN_UPDATE_PATTERN.test(message.trim());
const declinesPlanUpdate = (message = '') => DECLINE_PLAN_UPDATE_PATTERN.test(message.trim());
const normalizeForIntent = (value = '') =>
  value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const getNumberFromText = (value = '') => {
  const normalized = value.toLowerCase();
  const digitMatch = normalized.match(/\b(\d+)\b/);
  if (digitMatch) return Number(digitMatch[1]);

  const words = {
    a: 1,
    an: 1,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  };
  const word = Object.keys(words).find((key) => new RegExp(`\\b${key}\\b`).test(normalized));
  return word ? words[word] : null;
};
const addDaysToDate = (dateValue, dayDelta) => {
  if (!dateValue || !Number.isFinite(dayDelta)) return dateValue;
  const date = new Date(`${dateValue}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateValue;
  date.setDate(date.getDate() + dayDelta);
  return date.toISOString().split('T')[0];
};
const MONTHS = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};
const formatIsoDateShort = (value = '') => {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
};
const normalizeYear = (yearValue) => {
  if (!yearValue) return null;
  const year = Number(yearValue);
  return year < 100 ? 2000 + year : year;
};
const dateToIso = (year, monthIndex, day) => {
  const date = new Date(year, monthIndex, day, 12);
  if (date.getFullYear() !== year || date.getMonth() !== monthIndex || date.getDate() !== day) {
    return null;
  }
  return date.toISOString().split('T')[0];
};
const getFallbackDateYear = (trip = {}) => {
  const tripYear = Number(trip.startDate?.slice(0, 4));
  return Number.isFinite(tripYear) && tripYear > 1900 ? tripYear : new Date().getFullYear();
};
const resolveDateYear = (startIso, endIso, explicitYear, trip = {}) => {
  if (explicitYear) return { startDate: startIso, endDate: endIso };
  if (!startIso || !endIso) return { startDate: startIso, endDate: endIso };

  const tripYear = Number(trip.startDate?.slice(0, 4));
  const hasTripYear = Number.isFinite(tripYear) && tripYear > 1900;
  const todayIso = new Date().toISOString().split('T')[0];
  if (endIso >= startIso && (hasTripYear || endIso >= todayIso)) {
    return { startDate: startIso, endDate: endIso };
  }

  const shiftOneYear = (iso) => dateToIso(
    Number(iso.slice(0, 4)) + 1,
    Number(iso.slice(5, 7)) - 1,
    Number(iso.slice(8, 10))
  );

  if (endIso >= startIso) {
    const nextYearStart = shiftOneYear(startIso);
    const nextYearEnd = shiftOneYear(endIso);
    if (nextYearStart && nextYearEnd && nextYearEnd >= nextYearStart) {
      return { startDate: nextYearStart, endDate: nextYearEnd };
    }
  }

  const nextYearEndOnly = dateToIso(
    Number(endIso.slice(0, 4)) + 1,
    Number(endIso.slice(5, 7)) - 1,
    Number(endIso.slice(8, 10))
  );
  if (nextYearEndOnly && nextYearEndOnly >= startIso && (hasTripYear || nextYearEndOnly >= todayIso)) {
    return { startDate: startIso, endDate: nextYearEndOnly };
  }

  const nextYearStart = shiftOneYear(startIso);
  const nextYearEnd = nextYearEndOnly ? shiftOneYear(nextYearEndOnly) : shiftOneYear(endIso);

  if (nextYearStart && nextYearEnd && nextYearEnd >= nextYearStart) {
    return { startDate: nextYearStart, endDate: nextYearEnd };
  }

  return { startDate: startIso, endDate: endIso };
};
const parseDateToken = (token = '', fallbackYear, fallbackMonth = null) => {
  const cleaned = token
    .toLowerCase()
    .replace(/,/g, ' ')
    .replace(/\b(\d{1,2})(st|nd|rd|th)\b/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  const numericMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (numericMatch) {
    const year = normalizeYear(numericMatch[3]) || fallbackYear;
    return {
      iso: dateToIso(year, Number(numericMatch[1]) - 1, Number(numericMatch[2])),
      monthIndex: Number(numericMatch[1]) - 1,
      explicitYear: Boolean(numericMatch[3]),
    };
  }

  const monthMatch = cleaned.match(/^([a-z]+)\s+(\d{1,2})(?:\s+(\d{2,4}))?$/);
  if (monthMatch && MONTHS[monthMatch[1]] != null) {
    const monthIndex = MONTHS[monthMatch[1]];
    const year = normalizeYear(monthMatch[3]) || fallbackYear;
    return {
      iso: dateToIso(year, monthIndex, Number(monthMatch[2])),
      monthIndex,
      explicitYear: Boolean(monthMatch[3]),
    };
  }

  const dayOnlyMatch = cleaned.match(/^(\d{1,2})(?:\s+(\d{2,4}))?$/);
  if (dayOnlyMatch && fallbackMonth != null) {
    const year = normalizeYear(dayOnlyMatch[2]) || fallbackYear;
    return {
      iso: dateToIso(year, fallbackMonth, Number(dayOnlyMatch[1])),
      monthIndex: fallbackMonth,
      explicitYear: Boolean(dayOnlyMatch[2]),
    };
  }

  return null;
};
const extractExplicitDateRange = (message = '', trip = {}) => {
  const normalized = message
    .toLowerCase()
    .replace(/\b(\d{1,2})(st|nd|rd|th)\b/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  const fallbackYear = getFallbackDateYear(trip);
  const connector = String.raw`(?:\s+(?:to|through|thru|until)\s+|\s*[-–]\s*)`;
  const monthDate = String.raw`(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:,?\s+\d{2,4})?`;
  const numericDate = String.raw`\d{1,2}\/\d{1,2}(?:\/\d{2,4})?`;
  const dayOnly = String.raw`\d{1,2}(?:,?\s+\d{2,4})?`;

  const patterns = [
    new RegExp(`(?:from\\s+|dates?\\s+(?:to|for)\\s+|date\\s+range\\s+to\\s+|set\\s+the\\s+trip\\s+for\\s+|change\\s+dates?\\s+to\\s+)?(${monthDate})${connector}(${monthDate}|${dayOnly})`, 'i'),
    new RegExp(`(?:from\\s+|dates?\\s+(?:to|for)\\s+|date\\s+range\\s+to\\s+|set\\s+the\\s+trip\\s+for\\s+|change\\s+dates?\\s+to\\s+)?(${numericDate})${connector}(${numericDate})`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) continue;

    const start = parseDateToken(match[1], fallbackYear);
    const end = parseDateToken(match[2], fallbackYear, start?.monthIndex);
    if (!start?.iso || !end?.iso) continue;

    return resolveDateYear(start.iso, end.iso, start.explicitYear || end.explicitYear, trip);
  }

  return null;
};
const hasDateUpdateIntent = (message = '') =>
  (
    /\b(date|dates|date range|from|through|thru|until|set the trip for|change dates?)\b/i.test(message) &&
    /(\d{1,2}\/\d{1,2}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(message)
  ) ||
  /\b(extend|shorten|reduce|start|go|leave|depart).{0,40}\b(day|days|earlier|sooner|later)\b/i.test(message);
const buildDateClarification = (trip = {}) => {
  const year = getFallbackDateYear(trip);
  return `I can update the trip dates, but I need the year. Did you mean those dates in ${year}?`;
};
const formatDateRangeShort = (startDate, endDate) =>
  `${formatIsoDateShort(startDate)}-${formatIsoDateShort(endDate)}`;
const getRelativeStartDateChange = (message = '', trip = {}) => {
  const normalized = normalizeForIntent(message);
  const amountPattern = String.raw`(\d+|one|two|three|four|five|six|seven|eight|nine|ten|a|an)?\s*days?`;
  const earlierPattern = new RegExp(`\\b(?:can\\s+)?(?:actually\\s+)?(?:go|leave|depart|start).{0,28}?${amountPattern}\\s+(?:earlier|sooner)\\b`);
  const laterPattern = new RegExp(`\\b(?:can\\s+)?(?:actually\\s+)?(?:go|leave|depart|start).{0,28}?${amountPattern}\\s+later\\b`);
  const earlierMatch = normalized.match(earlierPattern);
  const laterMatch = normalized.match(laterPattern);

  if (!earlierMatch && !laterMatch) return null;

  const amount = getNumberFromText((earlierMatch || laterMatch)[1] || 'one') || 1;
  const direction = earlierMatch ? -1 : 1;
  const startDate = addDaysToDate(trip.startDate, amount * direction);

  if (!startDate || startDate === trip.startDate) return null;

  return {
    startDate,
    endDate: trip.endDate,
  };
};
const getBudgetChange = (message = '', currentBudget = '') => {
  const normalized = normalizeForIntent(message);
  const budgetAliases = [
    { id: 'budget', patterns: [/\bbudget(?: friendly)?\b/, /\bcheap(?:er)?\b/, /\baffordable\b/, /\blow cost\b/] },
    { id: 'moderate', patterns: [/\bmoderate\b/, /\bbalanced\b/, /\bmid range\b/] },
    { id: 'comfort', patterns: [/\bcomfort(?: first)?\b/, /\bcomfortable\b/, /\bpremium\b/] },
    { id: 'luxury', patterns: [/\bluxury\b/, /\bluxurious\b/, /\bhigh end\b/] },
  ];

  const hasBudgetIntent = /\b(budget|cheap|affordable|cost|luxury|luxurious|comfort|premium|moderate|balanced)\b/.test(normalized);
  if (!hasBudgetIntent) return null;

  const match = budgetAliases.find((option) => option.patterns.some((pattern) => pattern.test(normalized)));
  if (!match || match.id === currentBudget) return null;

  return match.id;
};
const getInterestChanges = (message = '', currentInterests = []) => {
  const normalized = normalizeForIntent(message);
  const nextInterests = new Set(Array.isArray(currentInterests) ? currentInterests : []);
  const added = [];
  const removed = [];

  Object.keys(INTEREST_LABELS).forEach((interestId) => {
    const label = normalizeForIntent(INTEREST_LABELS[interestId]);
    const aliases = [interestId, label];
    if (interestId === 'food') aliases.push('restaurants', 'dining', 'meals', 'food and drink');
    if (interestId === 'relaxation') aliases.push('relaxing', 'relaxed', 'slow pace', 'spa');
    if (interestId === 'nightlife') aliases.push('night life', 'bars', 'clubs');
    if (interestId === 'nature') aliases.push('outdoors', 'outdoor', 'outdoorsy');

    const aliasPattern = aliases
      .map((alias) => alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, String.raw`\s+`))
      .join('|');
    const mentionsInterest = new RegExp(`\\b(?:${aliasPattern})\\b`).test(normalized);
    if (!mentionsInterest) return;

    const removePattern = new RegExp(`\\b(?:remove|skip|drop|exclude|less)\\b.{0,36}\\b(?:${aliasPattern})\\b|\\b(?:${aliasPattern})\\b.{0,36}\\b(?:remove|skip|drop|exclude|less)\\b`);
    const isRemoval = removePattern.test(normalized);

    if (isRemoval && nextInterests.has(interestId)) {
      nextInterests.delete(interestId);
      removed.push(interestId);
      return;
    }

    const addPattern = new RegExp(`\\b(?:add|include|more|with|focus on|interested in|want)\\b.{0,40}\\b(?:${aliasPattern})\\b|\\b(?:${aliasPattern})\\b.{0,24}\\b(?:activities|places|options)?\\b`);
    if (!isRemoval && addPattern.test(normalized) && !nextInterests.has(interestId)) {
      nextInterests.add(interestId);
      added.push(interestId);
    }
  });

  if (!added.length && !removed.length) return null;

  return {
    interests: [...nextInterests],
    added,
    removed,
  };
};
const getStyleChanges = (message = '') => {
  const normalized = normalizeForIntent(message);
  const added = [];
  const removed = [];
  const styleOptions = [
    { label: 'Anime-inspired', patterns: [/\banime(?: inspired| themed| filled)?\b/, /\banime\s+theme\b/] },
    { label: 'Outdoorsy / Nature', patterns: [/\boutdoorsy\b/, /\boutdoor(?:s)?(?: focused| inspired| vacation)?\b/, /\bnature(?: focused| inspired)?\b/] },
    { label: 'Food-focused', patterns: [/\bfood(?: focused| inspired)?\b/, /\brestaurant(?: focused)?\b/, /\bdining(?: focused)?\b/] },
    { label: 'Nightlife-focused', patterns: [/\bnightlife(?: focused| inspired)?\b/, /\bnight life(?: focused)?\b/] },
    { label: 'Relaxing', patterns: [/\brelaxing\b/, /\brelaxed\b/, /\bmore relaxed\b/, /\bslower\b/, /\bcalmer\b/] },
    { label: 'Family-friendly', patterns: [/\bfamily(?: friendly)?\b/, /\bkid(?: friendly)?\b/, /\bchildren\b/] },
    { label: 'Romantic', patterns: [/\bromantic\b/, /\bromance\b/] },
    { label: 'Adventure-focused', patterns: [/\badventure(?: focused)?\b/, /\bhiking?\b/, /\boutdoor(?: focused)?\b/] },
  ];

  styleOptions.forEach((style) => {
    const hasStyle = style.patterns.some((pattern) => pattern.test(normalized));
    if (!hasStyle) return;

    const styleAlternation = style.patterns
      .map((pattern) => pattern.source)
      .join('|');
    const removePattern = new RegExp(
      `\\b(?:no\\s+more|remove|drop|exclude|skip|get\\s+rid\\s+of|do\\s+not|don't|dont|not)\\b.{0,44}(?:${styleAlternation})|(?:${styleAlternation}).{0,44}\\b(?:anymore|no\\s+more|remove|drop|exclude|skip|get\\s+rid\\s+of)\\b`
    );

    if (removePattern.test(normalized)) {
      removed.push(style.label);
      return;
    }

    added.push(style.label);
  });

  return {
    added: [...new Set(added)],
    removed: [...new Set(removed)],
  };
};
const cleanLocationChangeValue = (value = '') =>
  value
    .replace(/\s+\b(?:and|also)\b.*$/i, '')
    .replace(/\s+\b(?:from|between|on)\b\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{1,2}\/\d{1,2}).*$/i, '')
    .replace(/\s+\b(?:with|for)\b\s+\d+\s+(?:travelers?|people|persons?).*$/i, '')
    .replace(/\s+\b(?:with|for|to)\b\s+(?:budget|luxury|moderate|comfort|cheap|affordable).*$/i, '')
    .trim()
    .replace(/[.;:]$/, '')
    .trim();
const getLocationMetadataChanges = (message = '', trip = {}) => {
  const changes = {};
  const details = {};
  const destinationMatch = message.match(/\b(?:change|update|set|make)\s+(?:the\s+)?destination\s+(?:to|as)\s+(.+?)(?=$|\s+\b(?:and|also|from|between|with|for)\b)/i);
  const departureMatch =
    message.match(/\b(?:change|update|set)\s+(?:the\s+)?(?:departure city|departure|origin|leaving from)\s+(?:to|as)\s+(.+?)(?=$|\s+\b(?:and|also|with|for)\b)/i) ||
    message.match(/\b(?:leave|leaving|depart|departing)\s+from\s+(.+?)(?=$|\s+\b(?:and|also|with|for)\b)/i);

  if (destinationMatch?.[1]) {
    const destination = cleanLocationChangeValue(destinationMatch[1]);
    if (destination && destination !== trip.destination) {
      changes.destination = destination;
      details.destination = {
        current: trip.destination || 'Not set',
        next: destination,
      };
    }
  }

  if (departureMatch?.[1]) {
    const departureCity = cleanLocationChangeValue(departureMatch[1]);
    if (departureCity && departureCity !== trip.departureCity) {
      changes.departureCity = departureCity;
      details.departureCity = {
        current: trip.departureCity || 'Not set',
        next: departureCity,
      };
    }
  }

  return Object.keys(changes).length ? { changes, details } : null;
};
const buildTripMetadataChange = (message = '', trip = {}) => {
  const normalized = message.trim().toLowerCase();
  const changes = {};
  const details = {};
  const currentTravelerCount = Math.max(1, Number(trip.travelerCount) || 1);
  const currentTripLength = getTripLength(trip.startDate, trip.endDate);
  const explicitDateRange = extractExplicitDateRange(message, trip);
  const relativeStartDateChange = getRelativeStartDateChange(message, trip);
  const locationChanges = getLocationMetadataChanges(message, trip);

  if (locationChanges) {
    Object.assign(changes, locationChanges.changes);
    details.location = locationChanges.details;
  }

  if (explicitDateRange?.startDate && explicitDateRange?.endDate) {
    changes.startDate = explicitDateRange.startDate;
    changes.endDate = explicitDateRange.endDate;
    details.dates = {
      current: formatDateRangeShort(trip.startDate, trip.endDate),
      next: formatDateRangeShort(explicitDateRange.startDate, explicitDateRange.endDate),
    };
  } else if (relativeStartDateChange?.startDate) {
    changes.startDate = relativeStartDateChange.startDate;
    changes.endDate = relativeStartDateChange.endDate;
    details.dates = {
      current: formatDateRangeShort(trip.startDate, trip.endDate),
      next: formatDateRangeShort(relativeStartDateChange.startDate, relativeStartDateChange.endDate),
    };
  }

  const travelerCountValue = String.raw`(\d+|one|two|three|four|five|six|seven|eight|nine|ten)`;
  const explicitTravelerMatch = normalized.match(new RegExp(`\\b(?:change|make|set|update).{0,24}?\\b(?:to\\s+)?${travelerCountValue}\\s+(?:travelers?|people|persons?)\\b`));
  const assignedTravelerMatch = normalized.match(new RegExp(`\\b(?:traveler\\s*count|travelers?|people|party\\s*size|group\\s*size)\\s*(?:is|=|to|as|:)?\\s*${travelerCountValue}\\b`));
  const partyTravelerMatch = normalized.match(new RegExp(`\\b(?:party|group)\\s+of\\s+${travelerCountValue}\\b`));
  const thereWillBeTravelerMatch = normalized.match(new RegExp(`\\bthere\\s+(?:will\\s+be|are|is)\\s+${travelerCountValue}\\s+(?:of\\s+us|travelers?|people|persons?)\\b`));
  const directTravelerMatch = normalized.match(new RegExp(`\\b${travelerCountValue}\\s+(?:travelers?|people|persons?)\\b`));
  const addTravelerMatch = normalized.match(/\b(?:add|adding|bringing|bring|include|including|invite|inviting).{0,28}?\b(?:additional|another|extra|more|a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:travelers?|persons?|people|guests?)\b/);
  const oneMoreTravelerMatch = normalized.match(/\b(?:one|1|a|an)\s+more\s+(?:traveler|person|guest)\b/);
  const fewerTravelerMatch = normalized.match(/\b(?:remove|drop|subtract|one fewer|1 fewer|fewer|less).{0,28}?\b(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)?\s*(?:travelers?|persons?|people|guests?)\b/);
  const setTravelerMatch = explicitTravelerMatch || assignedTravelerMatch || partyTravelerMatch || thereWillBeTravelerMatch;

  if (setTravelerMatch || /\b(?:make|change|set|update).{0,24}?\b(?:solo|alone)\b/.test(normalized)) {
    const count = setTravelerMatch ? getNumberFromText(setTravelerMatch[1]) : 1;
    if (count && count !== currentTravelerCount) {
      changes.travelerCount = count;
      details.travelers = { current: currentTravelerCount, next: count };
    }
  } else if (addTravelerMatch || oneMoreTravelerMatch || /\b(?:another|additional|extra|one more)\s+(?:person|traveler|guest)\b/.test(normalized)) {
    const amount = addTravelerMatch ? getNumberFromText(addTravelerMatch[0]) || 1 : 1;
    changes.travelerCount = currentTravelerCount + amount;
    details.travelers = { current: currentTravelerCount, next: changes.travelerCount };
  } else if (fewerTravelerMatch) {
    const amount = getNumberFromText(fewerTravelerMatch[0]) || 1;
    changes.travelerCount = Math.max(1, currentTravelerCount - amount);
    if (changes.travelerCount !== currentTravelerCount) {
      details.travelers = { current: currentTravelerCount, next: changes.travelerCount };
    } else {
      delete changes.travelerCount;
    }
  } else if (directTravelerMatch && /\btravelers?|people|persons?\b/.test(normalized)) {
    const count = getNumberFromText(directTravelerMatch[1]);
    if (count && count !== currentTravelerCount) {
      changes.travelerCount = count;
      details.travelers = { current: currentTravelerCount, next: count };
    }
  }

  const exactLengthMatch = normalized.match(/\b(?:make|change|set|update).{0,24}?\b(?:a\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*day\s+(?:trip|itinerary|plan)\b/);
  const extendMatch = normalized.match(/\b(?:extend|add|longer).{0,24}?\b(?:by\s+)?(?:another\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten|a|an)?\s*days?\b/);
  const longerMatch = normalized.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|a|an)\s*days?\s+longer\b/);
  const shortenMatch = normalized.match(/\b(?:shorten|reduce|cut).{0,24}?\b(?:by\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten|a|an)?\s*days?\b/);

  if (explicitDateRange || relativeStartDateChange) {
    // Explicit date ranges take precedence over relative length wording.
  } else if (exactLengthMatch) {
    const requestedLength = getNumberFromText(exactLengthMatch[1]);
    if (requestedLength && requestedLength !== currentTripLength) {
      changes.endDate = addDaysToDate(trip.startDate, requestedLength - 1);
      details.dates = {
        current: formatDateRangeShort(trip.startDate, trip.endDate),
        next: formatDateRangeShort(trip.startDate, changes.endDate),
      };
    }
  } else if (extendMatch || longerMatch || /\b(?:extend|longer).{0,16}\bday\b/.test(normalized)) {
    const amount = extendMatch
      ? getNumberFromText(extendMatch[1] || 'one') || 1
      : longerMatch
        ? getNumberFromText(longerMatch[1] || 'one') || 1
        : 1;
    changes.endDate = addDaysToDate(trip.endDate, amount);
    details.dates = {
      current: formatDateRangeShort(trip.startDate, trip.endDate),
      next: formatDateRangeShort(trip.startDate, changes.endDate),
    };
  } else if (shortenMatch) {
    const amount = getNumberFromText(shortenMatch[1] || 'one') || 1;
    const nextLength = Math.max(1, currentTripLength - amount);
    changes.endDate = addDaysToDate(trip.startDate, nextLength - 1);
    details.dates = {
      current: formatDateRangeShort(trip.startDate, trip.endDate),
      next: formatDateRangeShort(trip.startDate, changes.endDate),
    };
  }

  const nextBudget = getBudgetChange(message, trip.budget);
  if (nextBudget) {
    changes.budget = nextBudget;
    details.budget = {
      current: BUDGET_LABELS[trip.budget] || 'Custom',
      next: BUDGET_LABELS[nextBudget] || nextBudget,
    };
  }

  const interestChange = getInterestChanges(message, trip.interests || []);
  if (interestChange) {
    changes.interests = interestChange.interests;
    details.interests = {
      added: interestChange.added.map((interestId) => INTEREST_LABELS[interestId] || interestId),
      removed: interestChange.removed.map((interestId) => INTEREST_LABELS[interestId] || interestId),
    };
  }

  const styleChanges = getStyleChanges(message);
  if (styleChanges.added.length || styleChanges.removed.length) {
    details.styles = styleChanges;
    if (styleChanges.added.includes('Outdoorsy / Nature') && details.interests?.added?.includes('Nature')) {
      details.interests.added = details.interests.added.filter((label) => label !== 'Nature');
    }
  }

  if (!Object.keys(changes).length && !styleChanges.added.length && !styleChanges.removed.length) {
    return hasDateUpdateIntent(message)
      ? { needsDateClarification: true, clarification: buildDateClarification(trip) }
      : null;
  }

  return { changes, details, styleChanges };
};
const buildTripUpdateConfirmation = (metadataChange = {}) => {
  const details = metadataChange.details || {};
  const sections = ['This will update your trip details and regenerate the itinerary:'];

  if (details.dates) {
    sections.push(`**Travel dates**\nCurrent: ${details.dates.current}\nNew: ${details.dates.next}`);
  }

  if (details.travelers) {
    sections.push(`**Travelers**\nCurrent: ${details.travelers.current}\nNew: ${details.travelers.next}`);
  }

  if (details.budget) {
    sections.push(`**Budget**\nCurrent: ${details.budget.current}\nNew: ${details.budget.next}`);
  }

  const interestLines = [];
  if (details.interests?.added?.length) {
    interestLines.push(`Added: ${details.interests.added.join(', ')}`);
  }
  if (details.interests?.removed?.length) {
    interestLines.push(`Removed: ${details.interests.removed.join(', ')}`);
  }
  if (details.styles?.added?.length) {
    interestLines.push(`Added: ${details.styles.added.join(', ')}`);
  }
  if (details.styles?.removed?.length) {
    interestLines.push(`Removed: ${details.styles.removed.join(', ')}`);
  }
  if (interestLines.length) {
    sections.push(`**Interests / trip style**\n${interestLines.join('\n')}`);
  }

  if (details.location?.destination) {
    sections.push(`**Destination**\nCurrent: ${details.location.destination.current}\nNew: ${details.location.destination.next}`);
  }

  if (details.location?.departureCity) {
    sections.push(`**Departure city**\nCurrent: ${details.location.departureCity.current}\nNew: ${details.location.departureCity.next}`);
  }

  sections.push('Do you want me to continue?');
  return sections.join('\n\n');
};
const shouldRegenerateImmediately = (message = '') => {
  const normalized = message.trim().toLowerCase();

  return EXPLICIT_REGENERATE_PATTERN.test(normalized) && shouldConfirmPlanUpdate(normalized);
};

const getPlanUpdateFocus = (message = '') => {
  const normalized = message.toLowerCase();
  const focuses = [];

  if (/\bromantic|romance\b/.test(normalized)) focuses.push('romantic');
  if (/\banime|anime-filled\b/.test(normalized)) focuses.push('anime-themed');
  if (/\bcheap|budget|affordable|cost\b/.test(normalized)) focuses.push('cheaper');
  if (/\brelax|relaxed|relaxing|slower|less busy\b/.test(normalized)) focuses.push('more relaxed');
  if (/\bfood|restaurant|dining|meal|drink\b/.test(normalized)) focuses.push('food-focused');
  if (/\bfamily|kid|children\b/.test(normalized)) focuses.push('family-friendly');
  if (/\badventure|hike|outdoor|active\b/.test(normalized)) focuses.push('adventure-focused');

  if (!focuses.length) {
    return 'apply your requested changes';
  }

  if (focuses.length === 1) {
    return `focus more on ${focuses[0]} activities`;
  }

  return `focus more on ${focuses.slice(0, -1).join(', ')} and ${focuses[focuses.length - 1]} activities`;
};

const getPlanUpdateConfirmation = (message = '') =>
  `This would update your itinerary to ${getPlanUpdateFocus(message)}. Do you want me to regenerate the plan?`;

const getPlanUpdateCompleteMessage = (message = '', itinerary = {}) => {
  const summary = itinerary.changeSummary || itinerary.change_summary;

  if (summary) {
    return `Done - I updated your itinerary and saved ${summary} as a new version.`;
  }

  return `Done - I updated your itinerary to ${getPlanUpdateFocus(message)}.`;
};

const TIMELINE_TEMPLATES = [
  {
    time: '08:30',
    title: 'Easy arrival block',
    detail: 'Check in, reset, and take a short orientation walk near your stay before doing anything ambitious.',
  },
  {
    time: '11:30',
    title: 'Signature activity',
    detail: 'Place the most important attraction here so the day has a clear anchor and fewer timing surprises.',
  },
  {
    time: '15:30',
    title: 'Recharge and explore',
    detail: 'Slow the pace with a meal, coffee stop, market visit, or scenic walk before the evening picks up.',
  },
  {
    time: '19:00',
    title: 'Evening highlight',
    detail: 'Use the night for dinner, sunset views, or a local performance depending on the trip mood.',
  },
];

const REGENERATED_VARIANTS = [
  'Move the biggest attraction earlier to reduce stress later in the day.',
  'Swap one dense sightseeing block for a slower neighborhood experience.',
  'Keep the afternoon lighter so the evening can carry the energy of the day.',
  'Use one reservation-heavy block and one open-ended block for better flexibility.',
];

const formatDate = (value) => {
  if (!value) return 'TBD';

  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date);
};

const formatDateTime = (value) => {
  if (!value) return 'Not saved yet';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
};

const getCityLabel = (value = '') => {
  const firstSegment = String(value).split(',')[0]?.trim();
  return firstSegment || 'TBD';
};

const getTripLength = (startDate, endDate) => {
  if (!startDate || !endDate) return 4;

  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));

  return Math.max(3, diff + 1);
};

const buildFallbackDays = (trip) => {
  const destination = trip.destination || 'your destination';
  const interests = trip.interests?.length
    ? trip.interests.map((id) => INTEREST_LABELS[id] || id)
    : ['Culture', 'Food & Drink', 'Nature'];

  const primary = interests[0];
  const secondary = interests[1] || interests[0];
  const tertiary = interests[2] || 'Scenic walks';
  const variantIndex = trip.updatedAt ? new Date(trip.updatedAt).getSeconds() % REGENERATED_VARIANTS.length : 0;

  const activities = TIMELINE_TEMPLATES.map((item, index) => {
    if (index === 1) {
      return {
        time: item.time,
        title: `${primary} anchor`,
        description: `Center this block around one strong ${primary.toLowerCase()} experience in ${destination} so the itinerary has a memorable core.`,
        location: destination,
        estimatedCost: 'Varies',
      };
    }

    if (index === 2) {
      return {
        time: item.time,
        title: `${secondary} reset`,
        description: `Follow the main activity with a lighter ${secondary.toLowerCase()} stop that keeps the trip feeling enjoyable instead of rushed.`,
        location: destination,
        estimatedCost: 'Varies',
      };
    }

    if (index === 3) {
      return {
        time: item.time,
        title: `${tertiary} evening`,
        description: REGENERATED_VARIANTS[variantIndex],
        location: destination,
        estimatedCost: 'Varies',
      };
    }

    return {
      time: item.time,
      title: item.title,
      description: item.detail,
      location: destination,
      estimatedCost: 'Varies',
    };
  });

  return [
    {
      day: 1,
      date: trip.startDate || 'TBD',
      theme: `${destination} arrival rhythm`,
      activities,
      meals: [],
      tips: DEFAULT_TIPS,
    },
  ];
};

const formatMoney = (value) => {
  if (value == null || Number.isNaN(Number(value))) return 'N/A';

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(value));
};

const formatDuration = (minutes) => {
  if (!minutes || Number.isNaN(Number(minutes))) return 'Unavailable';
  const totalMinutes = Number(minutes);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours}h ${mins}m`;
};

const getAirlineInitials = (airline = '') => {
  const words = airline
    .split(/[\s,]+/)
    .map((word) => word.trim())
    .filter(Boolean);

  if (!words.length) return 'FL';
  return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase();
};

const getHeaderStatus = (trip = {}, isRegenerating = false, isRefining = false) => {
  if (isRegenerating || isRefining) {
    return { label: 'Generating...', className: 'status-generating' };
  }

  if (trip.itinerary) {
    return { label: 'Generated', className: 'status-generated' };
  }

  if (trip.itineraryStatus === 'generating') {
    return { label: 'Generating...', className: 'status-generating' };
  }

  if (trip.itineraryStatus === 'failed' || trip.status === 'generation_failed') {
    return { label: 'Failed', className: 'status-failed' };
  }

  return { label: 'Generated', className: 'status-generated' };
};

const getFlightTier = (index) => {
  if (index < 3) return 'Economy';
  if (index < 6) return 'Balanced';
  return 'Premium';
};

const sortFlightsByPrice = (flights = []) =>
  [...flights].sort((a, b) => {
    const aPrice = Number.isFinite(Number(a.priceRaw)) ? Number(a.priceRaw) : Number.MAX_SAFE_INTEGER;
    const bPrice = Number.isFinite(Number(b.priceRaw)) ? Number(b.priceRaw) : Number.MAX_SAFE_INTEGER;
    return aPrice - bPrice;
  });

const applyFlightFilter = (flights = [], filter = 'all') => {
  const withLayovers = (flight) => Number(flight.stops || 0) > 0;
  const withoutLayovers = (flight) => Number(flight.stops || 0) === 0;

  if (filter === 'layovers') return flights.filter(withLayovers);
  if (filter === 'nonstop') return flights.filter(withoutLayovers);
  if (filter === 'cheapest-layovers') return sortFlightsByPrice(flights.filter(withLayovers));
  if (filter === 'cheapest-nonstop') return sortFlightsByPrice(flights.filter(withoutLayovers));
  if (filter === 'cheapest') return sortFlightsByPrice(flights);

  return flights;
};

const renderBasicMarkdown = (text = '') => {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    }

    return <span key={`${part}-${index}`}>{part}</span>;
  });
};

const buildVersionSummaryLabel = (version = {}) => {
  const itinerary = version.itinerary_json || {};
  const changeSummary = itinerary.changeSummary || itinerary.change_summary;

  if (changeSummary) {
    return `Version ${version.version_number} (${changeSummary})`;
  }

  const text = `${itinerary.summary || ''} ${itinerary.title || ''}`.toLowerCase();

  if (text.includes('cheap') || text.includes('budget') || text.includes('economy') || text.includes('cost')) {
    return `Version ${version.version_number} (Cheaper Plan)`;
  }

  if (text.includes('relax') || text.includes('slower') || text.includes('calm')) {
    return `Version ${version.version_number} (More Relaxed Pace)`;
  }

  if (text.includes('food') || text.includes('restaurant') || text.includes('cafe') || text.includes('market')) {
    return `Version ${version.version_number} (Food-Focused)`;
  }

  return `Version ${version.version_number} (Updated Itinerary)`;
};

const WEATHER_LABELS = {
  0: 'Clear',
  1: 'Mostly clear',
  2: 'Partly cloudy',
  3: 'Cloudy',
  45: 'Fog',
  48: 'Fog',
  51: 'Drizzle',
  53: 'Drizzle',
  55: 'Drizzle',
  61: 'Rain',
  63: 'Rain',
  65: 'Heavy rain',
  71: 'Snow',
  73: 'Snow',
  75: 'Heavy snow',
  80: 'Rain showers',
  81: 'Rain showers',
  82: 'Heavy showers',
  95: 'Thunder storms',
};

const getWeatherLabel = (code) => WEATHER_LABELS[code] || 'Forecast';

const getWeatherIcon = (code) => {
  if (code === 0) return '☀️';
  if ([1, 2].includes(code)) return '🌤️';
  if (code === 3) return '☁️';
  if ([45, 48].includes(code)) return '🌫️';
  if ([51, 53, 55].includes(code)) return '🌦️';
  if ([61, 63, 65, 80, 81, 82].includes(code)) return '🌧️';
  if ([71, 73, 75].includes(code)) return '❄️';
  if (code === 95) return '⛈️';
  return '🌡️';
};

const formatTemperature = (value) => {
  if (value == null || Number.isNaN(Number(value))) return '--';
  return `${Math.round(Number(value))}°F`;
};

const buildWeatherChecklistItems = (forecast = []) => {
  if (!forecast.length) {
    return [];
  }

  const rainRisk = forecast.some((day) => Number(day.precipitationProbability || 0) >= 40);
  const coldRisk = forecast.some((day) => Number(day.tempMin) <= 45);
  const heatRisk = forecast.some((day) => Number(day.tempMax) >= 85);
  const items = [];

  if (rainRisk) {
    items.push('Pack a compact umbrella or rain shell for likely wet weather');
  }

  if (coldRisk) {
    items.push('Bring a warm layer for cooler mornings or evenings');
  }

  if (heatRisk) {
    items.push('Plan sun protection and refillable water for hotter parts of the day');
  }

  if (!items.length) {
    items.push('Review the daily forecast before locking outdoor activities');
  }

  return items;
};

function TravelItinerary({
  tripData,
  isRegenerating = false,
  isRefining = false,
  isLoadingVersions = false,
  isRestoringVersion = false,
  isRenamingTrip = false,
  versionHistory = [],
  activeVersionId = '',
  versionHistoryError = '',
  trippyMessages = [],
  isLoadingTripChat = false,
  tripChatError = '',
  onRefinePlan,
  onUpdateTripMetadataAndRegenerate,
  onRenameTrip,
  onRestoreVersion,
  onAppendTripChatMessage,
}) {
  const trip = tripData || {};
  const aiItinerary = trip.itinerary || null;
  const planName = trip.planName?.trim() || trip.destination || 'Travel Plan';
  const travelerCount = Math.max(1, Number(trip.travelerCount) || 1);
  const destination = trip.destination || 'Lisbon, Portugal';
  const departureCity = trip.departureCity || 'New York, NY';
  const routePillLabel = `${getCityLabel(departureCity)} \u2192 ${getCityLabel(destination)}`;
  const tripLength = getTripLength(trip.startDate, trip.endDate);
  const itineraryDays = aiItinerary?.days?.length ? aiItinerary.days : buildFallbackDays(trip);
  const generalTips = aiItinerary?.generalTips?.length ? aiItinerary.generalTips : DEFAULT_TIPS;
  const headerStatus = getHeaderStatus(trip, isRegenerating, isRefining);
  const baseTravelChecklist = useMemo(
    () => mergeTravelChecklist(aiItinerary?.travelChecklist || {}),
    [aiItinerary?.travelChecklist]
  );
  const interests = trip.interests?.length
    ? trip.interests.map((id) => INTEREST_LABELS[id] || id)
    : ['Culture', 'Food & Drink', 'Nature'];
  const latestVersionNumber = versionHistory[0]?.version_number || null;

  const [flightState, setFlightState] = useState({
    loading: false,
    error: '',
    flights: [],
    priceInsights: null,
    resolvedAirports: null,
  });
  const [weatherState, setWeatherState] = useState({
    loading: false,
    error: '',
    forecast: [],
  });
  const [hotelState, setHotelState] = useState({
    loading: false,
    error: '',
    hotels: [],
  });
  const [attractionState, setAttractionState] = useState({
    loading: false,
    error: '',
    attractions: [],
  });
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [flightFilter, setFlightFilter] = useState('all');
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [isEditingPlanName, setIsEditingPlanName] = useState(false);
  const [draftPlanName, setDraftPlanName] = useState(planName);
  const [renameError, setRenameError] = useState('');
  const [refinementInput, setRefinementInput] = useState('');
  const [refinementMessages, setRefinementMessages] = useState([DEFAULT_REFINEMENT_MESSAGE]);
  const [pendingPlanUpdate, setPendingPlanUpdate] = useState('');
  const [pendingMetadataUpdate, setPendingMetadataUpdate] = useState(null);
  const [isSendingTrippyMessage, setIsSendingTrippyMessage] = useState(false);
  const [showDailyPlanUpdated, setShowDailyPlanUpdated] = useState(false);
  const refineMessagesRef = useRef(null);
  const dailyPlanWasUpdatingRef = useRef(false);
  const dailyPlanUpdatedTimeoutRef = useRef(null);

  const flightSearchReady = useMemo(
    () => Boolean(trip.departureCity && trip.destination && trip.startDate),
    [trip.departureCity, trip.destination, trip.startDate]
  );
  const weatherSearchReady = useMemo(
    () => Boolean(trip.destination && trip.startDate && trip.endDate),
    [trip.destination, trip.startDate, trip.endDate]
  );
  const hotelSearchReady = useMemo(
    () => Boolean(trip.destination && trip.startDate && trip.endDate),
    [trip.destination, trip.startDate, trip.endDate]
  );
  const attractionSearchReady = useMemo(
    () => Boolean(trip.destination),
    [trip.destination]
  );
  const weatherChecklistItems = useMemo(
    () => buildWeatherChecklistItems(weatherState.forecast),
    [weatherState.forecast]
  );
  const travelChecklist = useMemo(
    () => ({
      ...baseTravelChecklist,
      weatherPrep: [
        ...(Array.isArray(baseTravelChecklist.weatherPrep) ? baseTravelChecklist.weatherPrep : []),
        ...weatherChecklistItems,
      ],
    }),
    [baseTravelChecklist, weatherChecklistItems]
  );
  const selectedItineraryDay = itineraryDays[selectedDayIndex] || itineraryDays[0] || null;
  const visibleItineraryDay = selectedItineraryDay;
  const hotelRecommendationSlots = Array.from({ length: 5 }, (_, index) => hotelState.hotels[index] || null);
  const visibleAttractions = attractionState.attractions;
  const visibleWeatherForecast = weatherState.forecast.slice(0, 4);
  const visibleTips = generalTips.slice(0, 4);
  const latestVersion = versionHistory[0] || null;
  const activeVersion =
    versionHistory.find((version) => version.id === activeVersionId) ||
    latestVersion ||
    null;
  const selectedVersion =
    versionHistory.find((version) => version.id === selectedVersionId) ||
    activeVersion ||
    null;
  const filteredFlights = applyFlightFilter(flightState.flights, flightFilter);
  const visibleFlights = filteredFlights.slice(0, 9);
  const isTrippyBusy = isRefining || isSendingTrippyMessage;
  const isDailyPlanUpdating = isRegenerating || isRefining || isRestoringVersion;
  const dailyPlanStatusText = isRestoringVersion
    ? 'Restoring version...'
    : isDailyPlanUpdating
      ? 'Updating with Trippy...'
      : 'Updated by Trippy';
  const weatherErrorMessage =
    typeof weatherState.error === 'string' && weatherState.error && weatherState.error !== 'true'
      ? weatherState.error
      : 'Weather forecasts are only available up to 16 days ahead. Try dates closer to your trip.';

  useEffect(() => {
    setRefinementMessages(trippyMessages.length ? trippyMessages : [DEFAULT_REFINEMENT_MESSAGE]);
  }, [trip.id, trippyMessages]);

  useEffect(() => {
    setDraftPlanName(planName);
    setRenameError('');
    setIsEditingPlanName(false);
  }, [planName, trip.id]);

  useEffect(() => {
    const messageArea = refineMessagesRef.current;

    if (messageArea) {
      messageArea.scrollTop = messageArea.scrollHeight;
    }
  }, [refinementMessages, isRefining, isSendingTrippyMessage]);

  useEffect(() => {
    setShowDailyPlanUpdated(false);
    dailyPlanWasUpdatingRef.current = false;
    if (dailyPlanUpdatedTimeoutRef.current) {
      clearTimeout(dailyPlanUpdatedTimeoutRef.current);
    }
  }, [trip.id]);

  useEffect(() => {
    if (isDailyPlanUpdating) {
      dailyPlanWasUpdatingRef.current = true;
      setShowDailyPlanUpdated(false);
      if (dailyPlanUpdatedTimeoutRef.current) {
        clearTimeout(dailyPlanUpdatedTimeoutRef.current);
      }
      return;
    }

    if (dailyPlanWasUpdatingRef.current && trip.itineraryStatus !== 'failed') {
      dailyPlanWasUpdatingRef.current = false;
      setShowDailyPlanUpdated(true);
      dailyPlanUpdatedTimeoutRef.current = setTimeout(() => {
        setShowDailyPlanUpdated(false);
      }, 5000);
    }
  }, [isDailyPlanUpdating, trip.itineraryStatus]);

  useEffect(() => () => {
    if (dailyPlanUpdatedTimeoutRef.current) {
      clearTimeout(dailyPlanUpdatedTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    if (activeVersionId && versionHistory.some((version) => version.id === activeVersionId)) {
      setSelectedVersionId(activeVersionId);
      return;
    }

    setSelectedVersionId((currentId) => (
      currentId && versionHistory.some((version) => version.id === currentId)
        ? currentId
        : versionHistory[0]?.id || ''
    ));
  }, [activeVersionId, trip.id, versionHistory]);

  useEffect(() => {
    setSelectedDayIndex(0);
  }, [trip.id]);

  useEffect(() => {
    if (selectedDayIndex > Math.max(0, itineraryDays.length - 1)) {
      setSelectedDayIndex(0);
    }
  }, [itineraryDays.length, selectedDayIndex]);

  const selectDailyPlanDay = (event) => {
    setSelectedDayIndex(Number(event.target.value));
  };

  const updateFlightFilter = (event) => {
    setFlightFilter(event.target.value);
  };

  const openPlanNameEditor = () => {
    setDraftPlanName(planName);
    setRenameError('');
    setIsEditingPlanName(true);
  };

  const cancelPlanNameEdit = () => {
    setDraftPlanName(planName);
    setRenameError('');
    setIsEditingPlanName(false);
  };

  const submitPlanNameEdit = async (event) => {
    event.preventDefault();

    const trimmedPlanName = draftPlanName.trim();

    if (!trimmedPlanName) {
      setRenameError('Trip name cannot be blank.');
      return;
    }

    if (trimmedPlanName === planName) {
      setIsEditingPlanName(false);
      setRenameError('');
      return;
    }

    try {
      await onRenameTrip?.(trimmedPlanName);
      setRenameError('');
      setIsEditingPlanName(false);
    } catch (error) {
      setRenameError(error?.message || 'Unable to rename this trip right now.');
    }
  };

  const persistRefinementMessage = async (message) => {
    try {
      await onAppendTripChatMessage?.(message);
    } catch (error) {
      console.warn('Unable to persist Trippy trip chat message:', error.message);
    }
  };


  useEffect(() => {
    let cancelled = false;

    if (!flightSearchReady) {
      setFlightState({
        loading: false,
        error: '',
        flights: [],
        priceInsights: null,
        resolvedAirports: null,
      });
      return undefined;
    }

    const loadFlights = async () => {
      setFlightState({
        loading: true,
        error: '',
        flights: [],
        priceInsights: null,
        resolvedAirports: null,
      });

      try {
        const result = await getFlightOptions({
          departureCity: trip.departureCity,
          destination: trip.destination,
          startDate: trip.startDate,
          endDate: trip.endDate,
          travelerCount: trip.travelerCount,
        });

        if (cancelled) return;

        setFlightState({
          loading: false,
          error: result.flights.length ? '' : 'No flights were returned for this route and date.',
          flights: result.flights.slice(0, 9),
          priceInsights: result.priceInsights || null,
          resolvedAirports: result.resolvedAirports || null,
        });
      } catch (error) {
        if (cancelled) return;

        setFlightState({
          loading: false,
          error: error.message || 'Unable to load live flights right now.',
          flights: [],
          priceInsights: null,
          resolvedAirports: null,
        });
      }
    };

    loadFlights();

    return () => {
      cancelled = true;
    };
  }, [flightSearchReady, trip.departureCity, trip.destination, trip.startDate, trip.endDate, trip.travelerCount]);

  useEffect(() => {
    let cancelled = false;

    if (!weatherSearchReady) {
      setWeatherState({
        loading: false,
        error: '',
        forecast: [],
      });
      return undefined;
    }

    const loadWeather = async () => {
      setWeatherState({
        loading: true,
        error: '',
        forecast: [],
      });

      try {
        const forecast = await getWeatherPreview({
          destination: trip.destination,
          startDate: trip.startDate,
          endDate: trip.endDate,
        });

        if (cancelled) return;

        setWeatherState({
          loading: false,
          error: forecast.length
            ? ''
            : 'Weather forecasts are only available up to 16 days ahead. Try dates closer to your trip.',
          forecast: forecast.slice(0, 7),
        });
      } catch (error) {
        if (cancelled) return;

        setWeatherState({
          loading: false,
          error:
            typeof error?.message === 'string' && error.message !== 'true'
              ? error.message
              : 'Weather forecasts are only available up to 16 days ahead. Try dates closer to your trip.',
          forecast: [],
        });
      }
    };

    loadWeather();

    return () => {
      cancelled = true;
    };
  }, [weatherSearchReady, trip.destination, trip.startDate, trip.endDate]);

  useEffect(() => {
    let cancelled = false;

    if (!hotelSearchReady) {
      setHotelState({
        loading: false,
        error: '',
        hotels: [],
      });
      return undefined;
    }

    const loadHotels = async () => {
      setHotelState({
        loading: true,
        error: '',
        hotels: [],
      });

      try {
        const result = await getHotelOptions({
          destination: trip.destination,
          startDate: trip.startDate,
          endDate: trip.endDate,
          travelerCount: trip.travelerCount,
        });

        if (cancelled) return;

        setHotelState({
          loading: false,
          error: result.hotels.length ? '' : 'No hotel options were returned for this destination and date range.',
          hotels: result.hotels.slice(0, 5),
        });
      } catch (error) {
        if (cancelled) return;

        setHotelState({
          loading: false,
          error: error.message || 'Unable to load hotel options right now.',
          hotels: [],
        });
      }
    };

    loadHotels();

    return () => {
      cancelled = true;
    };
  }, [hotelSearchReady, trip.destination, trip.startDate, trip.endDate, trip.travelerCount]);

  useEffect(() => {
    let cancelled = false;

    if (!attractionSearchReady) {
      setAttractionState({
        loading: false,
        error: '',
        attractions: [],
      });
      return undefined;
    }

    const loadAttractions = async () => {
      setAttractionState({
        loading: true,
        error: '',
        attractions: [],
      });

      try {
        const result = await getAttractionOptions({
          destination: trip.destination,
          interests: trip.interests,
        });

        if (cancelled) return;

        setAttractionState({
          loading: false,
          error: result.attractions.length ? '' : 'No nearby attractions were returned for this destination.',
          attractions: result.attractions,
        });
      } catch (error) {
        if (cancelled) return;

        setAttractionState({
          loading: false,
          error: error.message || 'Unable to load attractions right now.',
          attractions: [],
        });
      }
    };

    loadAttractions();

    return () => {
      cancelled = true;
    };
  }, [attractionSearchReady, trip.destination, trip.interests]);

  const submitRefinement = async (instruction = '') => {
    const trimmed = (instruction || refinementInput).trim();

    if (!trimmed || isRefining || isSendingTrippyMessage) {
      return;
    }

    const userMessage = { role: 'user', content: trimmed };
    setRefinementMessages((prev) => [...prev, userMessage]);
    setRefinementInput('');

    try {
      await persistRefinementMessage(userMessage);

      const runItineraryUpdate = async (updateInstruction) => {
        if (!onRefinePlan) {
          throw new Error('Trippy cannot update this itinerary right now.');
        }

        const updatedItinerary = await onRefinePlan(updateInstruction);
        const assistantMessage = {
          role: 'assistant',
          content: getPlanUpdateCompleteMessage(updateInstruction, updatedItinerary),
        };
        setRefinementMessages((prev) => [
          ...prev,
          assistantMessage,
        ]);
        await persistRefinementMessage(assistantMessage);
      };

      if (pendingMetadataUpdate) {
        if (confirmsPlanUpdate(trimmed)) {
          if (!onUpdateTripMetadataAndRegenerate) {
            throw new Error('Trippy cannot update trip details right now.');
          }

          const metadataUpdate = pendingMetadataUpdate;
          setPendingMetadataUpdate(null);
          const progressMessage = {
            role: 'assistant',
            content: 'Updating your trip details and regenerating the itinerary...',
          };
          setRefinementMessages((prev) => [...prev, progressMessage]);
          await persistRefinementMessage(progressMessage);

          const result = Object.keys(metadataUpdate.changes || {}).length
            ? await onUpdateTripMetadataAndRegenerate(
                metadataUpdate.changes,
                `Regenerate the itinerary so it matches this trip metadata change: ${metadataUpdate.originalMessage}`
              )
            : {
                regenerated: Boolean(await onRefinePlan?.(metadataUpdate.originalMessage)),
              };

          const assistantMessage = {
            role: 'assistant',
            content: result?.regenerated
              ? 'Done - I updated your trip details and regenerated the itinerary.'
              : 'Trip details were updated, but itinerary regeneration failed. Your saved trip details changed, but the itinerary was not regenerated.',
          };
          setRefinementMessages((prev) => [...prev, assistantMessage]);
          await persistRefinementMessage(assistantMessage);
          return;
        }

        if (declinesPlanUpdate(trimmed)) {
          setPendingMetadataUpdate(null);
          const assistantMessage = {
            role: 'assistant',
            content: 'No problem. I left the trip details unchanged.',
          };
          setRefinementMessages((prev) => [...prev, assistantMessage]);
          await persistRefinementMessage(assistantMessage);
          return;
        }

        setPendingMetadataUpdate(null);
      }

      if (pendingPlanUpdate) {
        if (confirmsPlanUpdate(trimmed)) {
          const confirmedInstruction = pendingPlanUpdate;
          setPendingPlanUpdate('');
          await runItineraryUpdate(confirmedInstruction);
          return;
        }

        if (declinesPlanUpdate(trimmed)) {
          setPendingPlanUpdate('');
          const assistantMessage = {
            role: 'assistant',
            content: 'No problem. I left the itinerary unchanged.',
          };
          setRefinementMessages((prev) => [
            ...prev,
            assistantMessage,
          ]);
          await persistRefinementMessage(assistantMessage);
          return;
        }

        setPendingPlanUpdate('');
      }

      const metadataChange = buildTripMetadataChange(trimmed, trip);
      if (metadataChange) {
        if (metadataChange.needsDateClarification) {
          const assistantMessage = {
            role: 'assistant',
            content: metadataChange.clarification || 'I can update the trip dates, but I need the year.',
          };
          setRefinementMessages((prev) => [...prev, assistantMessage]);
          await persistRefinementMessage(assistantMessage);
          return;
        }

        setPendingMetadataUpdate({
          ...metadataChange,
          originalMessage: trimmed,
        });
        const assistantMessage = {
          role: 'assistant',
          content: buildTripUpdateConfirmation(metadataChange),
        };
        setRefinementMessages((prev) => [...prev, assistantMessage]);
        await persistRefinementMessage(assistantMessage);
        return;
      }

      if (shouldRegenerateImmediately(trimmed)) {
        setPendingPlanUpdate('');
        await runItineraryUpdate(trimmed);
        return;
      }

      if (shouldConfirmPlanUpdate(trimmed)) {
        setPendingPlanUpdate(trimmed);
        const assistantMessage = {
          role: 'assistant',
          content: getPlanUpdateConfirmation(trimmed),
        };
        setRefinementMessages((prev) => [
          ...prev,
          assistantMessage,
        ]);
        await persistRefinementMessage(assistantMessage);
        return;
      }

      setIsSendingTrippyMessage(true);
      const reply = await sendTrippyChatMessage(
        trimmed,
        refinementMessages.filter((message) => ['user', 'assistant'].includes(message.role)),
        trip
      );
      const assistantMessage = {
        role: 'assistant',
        content: reply,
      };
      setRefinementMessages((prev) => [
        ...prev,
        assistantMessage,
      ]);
      await persistRefinementMessage(assistantMessage);
    } catch (error) {
      const assistantMessage = {
        role: 'assistant',
        content: error?.message || 'I could not respond right now.',
      };
      setRefinementMessages((prev) => [
        ...prev,
        assistantMessage,
      ]);
      await persistRefinementMessage(assistantMessage);
    } finally {
      setIsSendingTrippyMessage(false);
    }
  };

  const handleRefinementKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submitRefinement();
    }
  };

  return (
    <main className="itinerary-page">
      <section className="itinerary-shell">
        <section className="hero-card dashboard-card dashboard-card-snapshot">
          <header className="itinerary-topbar">
            <div>
              <p className="eyebrow">Travel Itinerary</p>
              {isEditingPlanName ? (
                <form className="trip-title-edit-form" onSubmit={submitPlanNameEdit}>
                  <input
                    className="trip-title-input"
                    value={draftPlanName}
                    onChange={(event) => setDraftPlanName(event.target.value)}
                    aria-label="Trip name"
                    disabled={isRenamingTrip}
                    autoFocus
                  />
                  <button type="submit" disabled={isRenamingTrip || !draftPlanName.trim()}>
                    {isRenamingTrip ? 'Saving...' : 'Save'}
                  </button>
                  <button type="button" onClick={cancelPlanNameEdit} disabled={isRenamingTrip}>
                    Cancel
                  </button>
                </form>
              ) : (
                <div className="trip-title-row">
                  <h1>{planName}</h1>
                  <button
                    type="button"
                    className="trip-title-edit-btn"
                    onClick={openPlanNameEditor}
                    disabled={isRenamingTrip || !onRenameTrip}
                    title="Rename trip"
                    aria-label="Rename trip"
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      focusable="false"
                    >
                      <path d="M5 19h14" />
                      <path d="M7 16.5 17.5 6a2.1 2.1 0 0 1 3 3L10 19l-4 .8.8-3.3Z" />
                    </svg>
                  </button>
                </div>
              )}
              {renameError && <p className="trip-title-error">{renameError}</p>}
              <p className="itinerary-subtitle">
                A structured trip board for {departureCity} with {tripLength} days of focused, flexible planning.
              </p>
              <div className="topbar-meta">
                <span>{routePillLabel}</span>
                <span>
                  {formatDate(trip.startDate)} - {formatDate(trip.endDate)}
                </span>
                <span className={`status-pill ${headerStatus.className}`}>{headerStatus.label}</span>
              </div>
            </div>
          </header>

          <article className="trip-snapshot-card">
            <p className="hero-kicker">Trip Snapshot</p>
            <div className="hero-aside">
              <div className="metric-card accent-card">
                <span className="metric-label">Length</span>
                <strong>{tripLength} days</strong>
              </div>
              <div className="metric-card">
                <span className="metric-label">Travelers</span>
                <strong>{travelerCount}</strong>
              </div>
              <div className="metric-card">
                <span className="metric-label">Last Updated</span>
                <strong>{formatDateTime(trip.updatedAt)}</strong>
              </div>
              <div className="metric-card">
                <span className="metric-label">Budget Style</span>
                <strong>{BUDGET_LABELS[trip.budget] || 'Custom'}</strong>
              </div>
            </div>
            {trip.itineraryStatus === 'failed' && (
              <p className="itinerary-warning">
                {trip.itineraryError || 'Trip saved, but AI itinerary generation failed. Showing a fallback plan.'}
              </p>
            )}
          </article>
        </section>

        <TripMap destination={destination} departureCity={departureCity} />

        <section className="content-grid">
          <div className="main-column">
            <div className="panel section-panel daily-plan-panel dashboard-card">
              <div className="section-heading">
                <div className="daily-plan-title-group">
                  <p className="section-label">Daily Plan</p>
                  {itineraryDays.length > 1 && (
                    <label className="daily-plan-day-select">
                      <span>Selected day</span>
                      <select value={selectedDayIndex} onChange={selectDailyPlanDay}>
                        {itineraryDays.map((day, dayIndex) => (
                          <option value={dayIndex} key={`${day.day || dayIndex}-${day.date || day.theme}`}>
                            Day {day.day || dayIndex + 1} - {formatDate(day.date)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
                {(isDailyPlanUpdating || showDailyPlanUpdated) && (
                  <span className={`daily-plan-status-pill ${isDailyPlanUpdating ? 'daily-plan-status-pill-loading' : ''}`}>
                    {dailyPlanStatusText}
                  </span>
                )}
                <span className="section-badge">Generated by TripAI</span>
              </div>

              <div className="itinerary-days">
                {visibleItineraryDay && (
                  <article className="itinerary-day" key={`${visibleItineraryDay.day || selectedDayIndex}-${visibleItineraryDay.date || visibleItineraryDay.theme}`}>
                    <div className="itinerary-day-header">
                      <h4>{visibleItineraryDay.theme || formatDate(visibleItineraryDay.date)}</h4>
                    </div>

                    <div className="timeline">
                      {(visibleItineraryDay.activities || []).map((item, index) => (
                        <div className="timeline-item" key={`${selectedDayIndex}-${item.time}-${item.title}-${index}`}>
                          <div className="timeline-time">{item.time || 'TBD'}</div>
                          <div className="timeline-body">
                            <h4>{item.title}</h4>
                            <p>{item.description || item.detail}</p>
                            <div className="timeline-meta">
                              {item.location && <span>{item.location}</span>}
                              {item.estimatedCost && <span>{item.estimatedCost}</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {visibleItineraryDay.meals?.length > 0 && (
                      <div className="itinerary-subsection">
                        <h5>Meals</h5>
                        <ul className="checklist">
                          {visibleItineraryDay.meals.map((meal, index) => (
                            <li key={`${meal.type}-${index}`}>
                              <strong>{meal.type}:</strong> {meal.recommendation}
                              {meal.estimatedCost ? ` (${meal.estimatedCost})` : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {visibleItineraryDay.tips?.length > 0 && (
                      <div className="itinerary-subsection">
                        <h5>Tips</h5>
                        <ul className="checklist">
                          {visibleItineraryDay.tips.map((tip) => (
                            <li key={tip}>{tip}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </article>
                )}
              </div>

            </div>

            <div className="panel section-panel flight-panel dashboard-card">
              <div className="section-heading">
                <div>
                  <p className="section-label">Flights</p>
                </div>
                <span className="section-badge">SerpApi</span>
              </div>

              {!flightSearchReady && (
                <p className="flight-helper-copy">
                  Add a departure field, destination field, and start date to load live flight options.
                </p>
              )}

              {flightState.loading && <p className="flight-helper-copy">Resolving airports and loading live flights...</p>}

              {!flightState.loading && flightState.error && (
                <div className="flight-fallback-card">
                  <strong>Flight data unavailable</strong>
                  <p>{flightState.error}</p>
                  <p>Live fares cannot be shown right now, but the itinerary remains available.</p>
                </div>
              )}

              {!flightState.loading && !flightState.error && Boolean(flightState.priceInsights) && (
                <div className="flight-insights-row">
                  {flightState.priceInsights?.lowest_price != null && (
                    <div className="metric-card flight-metric-card">
                      <span className="metric-label">Lowest fare</span>
                      <strong>{formatMoney(flightState.priceInsights.lowest_price)}</strong>
                    </div>
                  )}
                  {flightState.priceInsights?.price_level && (
                    <div className="metric-card flight-metric-card">
                      <span className="metric-label">Price level</span>
                      <strong>{flightState.priceInsights.price_level}</strong>
                    </div>
                  )}
                  {flightState.priceInsights?.typical_price_range?.length === 2 && (
                    <div className="metric-card flight-metric-card">
                      <span className="metric-label">Typical range</span>
                      <strong>
                        {formatMoney(flightState.priceInsights.typical_price_range[0])} -{' '}
                        {formatMoney(flightState.priceInsights.typical_price_range[1])}
                      </strong>
                    </div>
                  )}
                </div>
              )}

              {!flightState.loading && !flightState.error && flightState.flights.length > 0 && (
                <div className="flight-action-row">
                  <label className="flight-filter-select">
                    <span>Filter flights</span>
                    <select value={flightFilter} onChange={updateFlightFilter}>
                      <option value="all">Filter flights</option>
                      <option value="cheapest">Cheapest overall</option>
                      <option value="layovers">Show flights with layovers</option>
                      <option value="nonstop">Show flights without layovers</option>
                      <option value="cheapest-layovers">Cheapest flights with layovers</option>
                      <option value="cheapest-nonstop">Cheapest flights without layovers</option>
                    </select>
                  </label>
                </div>
              )}

              {!flightState.loading && !flightState.error && visibleFlights.length > 0 && (
                <div className="flight-cards">
                  {visibleFlights.map((flight, index) => (
                    <article className="flight-card" key={`${flight.airline}-${flight.departureTime}-${index}`}>
                      <div className="flight-card-top">
                        <div className="flight-airline-row">
                          <span className="flight-airline-logo" aria-hidden="true">
                            {flight.airlineLogo ? (
                              <img src={flight.airlineLogo} alt="" />
                            ) : (
                              getAirlineInitials(flight.airline)
                            )}
                          </span>
                          <div>
                            <h4>{flight.airline}</h4>
                          </div>
                        </div>
                        <span className="flight-tier-badge">{getFlightTier(index)}</span>
                        <strong className="flight-price">{formatMoney(flight.priceRaw ?? flight.price)}</strong>
                      </div>

                      <div className="flight-route-grid">
                        <div>
                          <span className="flight-route-label">Depart</span>
                          <p>
                            {flight.departureAirport || 'TBD'}
                            <br />
                            {flight.departureTime || 'Time unavailable'}
                          </p>
                        </div>
                        <div>
                          <span className="flight-route-label">Arrive</span>
                          <p>
                            {flight.arrivalAirport || 'TBD'}
                            <br />
                            {flight.arrivalTime || 'Time unavailable'}
                          </p>
                        </div>
                        <div>
                          <span className="flight-route-label">Duration</span>
                          <p>{formatDuration(flight.totalDuration)}</p>
                        </div>
                        <div>
                          <span className="flight-route-label">Stops</span>
                          <p>{flight.stops}</p>
                        </div>
                      </div>

                      {flight.layovers?.length > 0 && (
                        <p className="flight-layovers">Layovers: {flight.layovers.join(', ')}</p>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </div>

          </div>

          <aside className="side-column">
            <article className="panel side-card trippi-refine-panel dashboard-card">
              <div className="trippy-card-header">
                <p className="section-label">Trippy</p>
                <p className="trippy-card-subheader">Your AI travel assistant</p>
              </div>
              {tripChatError && <p className="version-helper version-helper-error">{tripChatError}</p>}

              <div className="refine-messages" ref={refineMessagesRef}>
                {isLoadingTripChat && <div className="refine-message">Loading saved Trippy chat...</div>}
                {!isLoadingTripChat && refinementMessages.map((message, index) => (
                  <div
                    className={`refine-message ${message.role === 'user' ? 'refine-message-user' : 'refine-message-assistant'}`}
                    key={`${message.role}-${index}-${message.content?.slice(0, 24)}`}
                  >
                    {renderBasicMarkdown(message.content)}
                  </div>
                ))}
                {isRefining && <div className="refine-message">Refining itinerary...</div>}
                {!isRefining && isSendingTrippyMessage && <div className="refine-message">Trippy is typing...</div>}
              </div>

              <div className="refine-input-row">
                <textarea
                  value={refinementInput}
                  onChange={(event) => setRefinementInput(event.target.value)}
                  onKeyDown={handleRefinementKeyDown}
                  placeholder="Ask for a specific change or travel question..."
                  rows={2}
                  disabled={isTrippyBusy}
                />
                <button
                  type="button"
                  onClick={() => submitRefinement()}
                  disabled={isTrippyBusy || !refinementInput.trim()}
                >
                  Send
                </button>
              </div>
            </article>

            <article className="panel side-card hotel-panel dashboard-card">
              <p className="section-label">Places to Stay</p>

              {!hotelSearchReady && (
                <p className="travel-data-helper">Add destination and trip dates to load hotel options.</p>
              )}
              {hotelState.loading && <p className="travel-data-helper">Loading hotel options...</p>}
              {!hotelState.loading && hotelState.error && (
                <p className="travel-data-helper travel-data-helper-error">{hotelState.error}</p>
              )}
              {!hotelState.loading && !hotelState.error && hotelState.hotels.length === 0 && (
                <p className="travel-data-helper">No hotel options returned yet. Try checking again later or refining the destination.</p>
              )}

              {!hotelState.loading && !hotelState.error && hotelState.hotels.length > 0 && (
                <div className="travel-result-list">
                  {hotelRecommendationSlots.map((hotel, index) => (
                    hotel ? (
                      <article className="travel-result-card" key={`${hotel.name}-${index}`}>
                        <div className="travel-result-media">
                          {hotel.thumbnail ? (
                            <img
                              src={hotel.thumbnail}
                              alt=""
                              className="travel-result-thumb"
                              onError={(event) => {
                                event.currentTarget.style.display = 'none';
                                event.currentTarget.parentElement?.classList.add('travel-result-media-empty');
                              }}
                            />
                          ) : (
                            <span>{hotel.name?.slice(0, 1) || 'H'}</span>
                          )}
                        </div>
                        <div className="travel-result-body">
                          <div className="travel-result-topline">
                            <h4>{hotel.name}</h4>
                            {hotel.price && <strong>{hotel.price}</strong>}
                          </div>
                          <p>
                            {hotel.rating ? `${hotel.rating} stars` : 'Hotel option'}
                            {hotel.reviews ? ` · ${hotel.reviews} reviews` : ''}
                          </p>
                          {hotel.description && <p>{hotel.description}</p>}
                          {hotel.amenities.length > 0 && (
                            <div className="travel-result-tags">
                              {hotel.amenities.map((amenity) => (
                                <span key={amenity}>{amenity}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </article>
                    ) : (
                      <article className="travel-result-card travel-result-card-empty" key={`hotel-empty-${index}`}>
                        <div className="travel-result-media travel-result-media-empty">
                          <span>H</span>
                        </div>
                        <div className="travel-result-body">
                          <div className="travel-result-topline">
                            <h4>Recommendation unavailable</h4>
                          </div>
                          <p>No additional hotel recommendation was returned for this trip.</p>
                        </div>
                      </article>
                    )
                  ))}
                </div>
              )}
            </article>

            <article className="panel side-card attraction-panel dashboard-card">
              <p className="section-label">Nearby Attractions</p>

              {!attractionSearchReady && (
                <p className="travel-data-helper">Add a destination to load attractions.</p>
              )}
              {attractionState.loading && <p className="travel-data-helper">Loading nearby attractions...</p>}
              {!attractionState.loading && attractionState.error && (
                <p className="travel-data-helper travel-data-helper-error">{attractionState.error}</p>
              )}
              {!attractionState.loading && !attractionState.error && attractionSearchReady && attractionState.attractions.length === 0 && (
                <p className="travel-data-helper">No nearby attractions returned yet. The itinerary activities above are still available.</p>
              )}

              {!attractionState.loading && !attractionState.error && attractionState.attractions.length > 0 && (
                <div className="travel-result-list">
                  {visibleAttractions.map((attraction, index) => (
                    <article className="travel-result-card" key={`${attraction.title}-${index}`}>
                      <div className="travel-result-media">
                        {attraction.thumbnail ? (
                          <img
                            src={attraction.thumbnail}
                            alt=""
                            className="travel-result-thumb"
                            onError={(event) => {
                              event.currentTarget.style.display = 'none';
                              event.currentTarget.parentElement?.classList.add('travel-result-media-empty');
                            }}
                          />
                        ) : (
                          <span>{attraction.title?.slice(0, 1) || 'A'}</span>
                        )}
                      </div>
                      <div className="travel-result-body">
                        <div className="travel-result-topline">
                          <h4>{attraction.title}</h4>
                          {attraction.price && <strong>{attraction.price}</strong>}
                        </div>
                        <p>
                          {attraction.type}
                          {attraction.rating ? ` · ${attraction.rating} stars` : ''}
                          {attraction.reviews ? ` · ${attraction.reviews} reviews` : ''}
                        </p>
                        {attraction.address && <p>{attraction.address}</p>}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </article>

            <article className="panel side-card weather-panel dashboard-card">
              <p className="section-label">Weather</p>

              {!weatherSearchReady && (
                <p className="weather-helper">Add destination and trip dates to load a weather preview.</p>
              )}
              {weatherState.loading && <p className="weather-helper">Loading destination forecast...</p>}
              {!weatherState.loading && weatherState.error && (
                <p className="weather-helper weather-helper-error">{weatherErrorMessage}</p>
              )}
              {!weatherState.loading && !weatherState.error && weatherSearchReady && weatherState.forecast.length === 0 && (
                <p className="weather-helper weather-helper-error">
                  Weather forecasts are only available up to 16 days ahead. Try dates closer to your trip.
                </p>
              )}

              {!weatherState.loading && !weatherState.error && weatherState.forecast.length > 0 && (
                <div className="weather-grid">
                  {visibleWeatherForecast.map((day) => (
                    <div className="weather-card" key={day.date}>
                      <span className="weather-date">{formatDate(day.date)}</span>
                      <div className="weather-icon" aria-hidden="true">
                        {getWeatherIcon(day.weatherCode)}
                      </div>
                      <div className="weather-temps">
                        <span className="weather-high">{formatTemperature(day.tempMax)}</span>
                        <span className="weather-low">{formatTemperature(day.tempMin)}</span>
                      </div>
                      <strong>{getWeatherLabel(day.weatherCode)}</strong>
                      <span className="weather-rain">
                        Rain {Math.round(Number(day.precipitationProbability || 0))}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </article>

            <article className="panel side-card checklist-panel dashboard-card">
              <p className="section-label">AI Checklist</p>
              <div className="checklist-sections">
                {Object.entries(CHECKLIST_LABELS).map(([key, label]) => {
                  const items = Array.isArray(travelChecklist[key]) ? travelChecklist[key] : [];

                  if (!items.length) {
                    return null;
                  }

                  return (
                    <section className="checklist-section" key={key}>
                      <h4>{label}</h4>
                      <ul className="checklist">
                        {items.slice(0, 2).map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </section>
                  );
                })}
              </div>
            </article>

            <article className="panel side-card version-history-panel dashboard-card">
              <p className="section-label">Version History</p>
              <div className="version-history-heading">
                {!isLoadingVersions && !versionHistoryError && selectedVersion && (
                  <label className="version-select-chip">
                    <span>Selected version</span>
                    <select
                      value={selectedVersion?.id || ''}
                      onChange={(event) => {
                        const nextVersionId = event.target.value;
                        if (versionHistory.some((version) => version.id === nextVersionId)) {
                          setSelectedVersionId(nextVersionId);
                        }
                      }}
                      disabled={versionHistory.length <= 1}
                    >
                      {versionHistory.map((version) => (
                        <option value={version.id} key={version.id}>
                          {buildVersionSummaryLabel(version)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              {isLoadingVersions && <p className="version-helper">Loading versions...</p>}
              {!isLoadingVersions && versionHistoryError && (
                <p className="version-helper version-helper-error">{versionHistoryError}</p>
              )}
              {!isLoadingVersions && !versionHistoryError && versionHistory.length === 0 && (
                <p className="version-helper">No saved versions yet.</p>
              )}

              {!isLoadingVersions && !versionHistoryError && selectedVersion && (
                <div className="version-list version-list-compact">
                  {[selectedVersion].map((version) => {
                    const isCurrentVersion = activeVersion
                      ? version.id === activeVersion.id
                      : version.version_number === latestVersionNumber;

                    return (
                      <div className={`version-item ${isCurrentVersion ? 'version-item-current' : ''}`} key={version.id}>
                        <div>
                          <div className="version-item-heading">
                            <strong>{buildVersionSummaryLabel(version)}</strong>
                            {isCurrentVersion && <span className="version-current-badge">Current</span>}
                          </div>
                          <p className="version-meta">
                            {formatDateTime(version.created_at)}
                          </p>
                        </div>

                        <button
                          type="button"
                          className="version-restore-btn"
                          onClick={() => {
                            const versionToRestore = versionHistory.find((item) => item.id === selectedVersionId);
                            onRestoreVersion?.(versionToRestore || version);
                          }}
                          disabled={isCurrentVersion || isRestoringVersion || !onRestoreVersion}
                        >
                          {isCurrentVersion ? 'Active' : isRestoringVersion ? 'Restoring...' : 'Restore'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              {!isLoadingVersions && !versionHistoryError && versionHistory.length > 1 && (
                <p className="version-helper">
                  Choose an older version above, then restore it if you want to make it the active itinerary.
                </p>
              )}
            </article>

            <article className="panel side-card local-notes-panel dashboard-card">
              <p className="section-label">Trip Tips</p>
              <div className="note-list">
                {visibleTips.map((tip) => (
                  <p key={tip}>{tip}</p>
                ))}
              </div>
            </article>

            <article className="panel side-card highlight-card interest-mix-panel dashboard-card">
              <p className="section-label">Interest Mix</p>
              <p>These saved preferences shape the overall pacing and the types of stops TripAI emphasizes.</p>
              <div className="interest-tags">
                {interests.map((interest) => (
                  <span key={interest} className="interest-tag">
                    {interest}
                  </span>
                ))}
              </div>
            </article>

          </aside>
        </section>
      </section>
    </main>
  );
}

export default TravelItinerary;
