import { useEffect, useMemo, useState } from 'react';
import './Questionnaire.css';
import {
  getAttractionPreview,
  getWeatherPreview,
  validateLocation,
  waitForNominatimCooldown,
} from '../services/travelApi';

const INTERESTS = [
  { id: 'adventure', label: '🧗 Adventure', desc: 'Hiking, climbing, extreme sports' },
  { id: 'culture', label: '🏛️ Culture', desc: 'Museums, history, architecture' },
  { id: 'food', label: '🍜 Food & Drink', desc: 'Local cuisine, restaurants, markets' },
  { id: 'nature', label: '🌿 Nature', desc: 'Parks, wildlife, scenic landscapes' },
  { id: 'nightlife', label: '🎶 Nightlife', desc: 'Bars, clubs, live music' },
  { id: 'relaxation', label: '🏖️ Relaxation', desc: 'Beaches, spas, slow travel' },
  { id: 'shopping', label: '🛍️ Shopping', desc: 'Markets, malls, local boutiques' },
  { id: 'photography', label: '📸 Photography', desc: 'Scenic spots, urban exploration' },
];

const BUDGETS = [
  { id: 'budget', label: 'Budget', sub: 'Under $1,000', icon: '💸' },
  { id: 'moderate', label: 'Moderate', sub: '$1,000 – $3,000', icon: '💳' },
  { id: 'comfort', label: 'Comfort', sub: '$3,000 – $7,000', icon: '✈️' },
  { id: 'luxury', label: 'Luxury', sub: '$7,000+', icon: '💎' },
];

const emptyForm = {
  destination: '',
  departureCity: '',
  startDate: '',
  endDate: '',
  budget: '',
  interests: [],
};

const emptyLocationState = {
  status: 'idle',
  message: '',
  place: null,
  suggestions: [],
};

function LocationSuggestions({ suggestions, fieldKey, visible, onPickSuggestion }) {
  if (!visible || !suggestions?.length) {
    return null;
  }

  return (
    <div className="q-autocomplete-dropdown">
      {suggestions.slice(0, 5).map((suggestion) => (
        <button
          key={`${fieldKey}-${suggestion.id}`}
          type="button"
          className="q-autocomplete-option"
          onMouseDown={(event) => {
            event.preventDefault();
            onPickSuggestion(fieldKey, suggestion);
          }}
        >
          <span className="q-autocomplete-primary">{suggestion.primaryLabel || suggestion.displayName}</span>
          <span className="q-autocomplete-secondary">{suggestion.displayName}</span>
        </button>
      ))}
    </div>
  );
}

function formatPreviewDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function weatherLabelFromCode(code) {
  const labels = {
    0: 'Clear',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Cloudy',
    45: 'Fog',
    48: 'Fog',
    51: 'Light drizzle',
    53: 'Drizzle',
    55: 'Heavy drizzle',
    61: 'Light rain',
    63: 'Rain',
    65: 'Heavy rain',
    71: 'Light snow',
    73: 'Snow',
    75: 'Heavy snow',
    80: 'Rain showers',
    81: 'Rain showers',
    82: 'Heavy showers',
    95: 'Thunderstorm',
  };

  return labels[code] || 'Variable';
}

function LocationStatus({ state, fieldKey, onPickSuggestion }) {
  if (!state.message && state.status !== 'validating') {
    return null;
  }

  return (
    <div className={`q-location-status q-location-status-${state.status}`}>
      <div className="q-location-status-line">
        {state.status === 'validating' ? 'Checking location…' : state.message}
      </div>
      {state.suggestions?.length > 1 && state.status !== 'validating' && (
        <div className="q-location-suggestions">
          <span className="q-location-suggestions-label">Suggestions:</span>
          {state.suggestions.slice(0, 3).map((suggestion) => (
            <button
              key={`${fieldKey}-${suggestion.id}`}
              type="button"
              className="q-suggestion-btn"
              onClick={() => onPickSuggestion(fieldKey, suggestion)}
            >
              {suggestion.displayName}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Questionnaire({
  initialValues = emptyForm,
  isOnboarding = false,
  isSubmitting = false,
  submitError = '',
  onBack,
  onSubmit,
}) {
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [locationStates, setLocationStates] = useState({
    destination: emptyLocationState,
    departureCity: emptyLocationState,
  });
  const [tripPreview, setTripPreview] = useState({
    loading: false,
    error: '',
    weather: [],
    attractions: [],
  });
  const [focusedField, setFocusedField] = useState('');

  useEffect(() => {
    setForm({ ...emptyForm, ...initialValues });
    setLocationStates({
      destination: initialValues.destination
        ? { ...emptyLocationState, status: 'idle', message: 'Re-checking destination…' }
        : emptyLocationState,
      departureCity: initialValues.departureCity
        ? { ...emptyLocationState, status: 'idle', message: 'Re-checking departure city…' }
        : emptyLocationState,
    });
  }, [initialValues]);

  const tripPreviewReady = useMemo(
    () =>
      Boolean(
        locationStates.destination.place &&
          form.startDate &&
          form.endDate &&
          locationStates.destination.status === 'valid'
      ),
    [locationStates.destination.place, locationStates.destination.status, form.startDate, form.endDate]
  );

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));

    if (field === 'destination' || field === 'departureCity') {
      setLocationStates((prev) => ({
        ...prev,
        [field]: {
          ...emptyLocationState,
          status: value.trim() ? 'idle' : 'idle',
          message: value.trim() ? 'Waiting to validate…' : '',
        },
      }));
    }
  };

  const toggleInterest = (id) => {
    setForm((prev) => ({
      ...prev,
      interests: prev.interests.includes(id)
        ? prev.interests.filter((interest) => interest !== id)
        : [...prev.interests, id],
    }));
  };

  const runLocationValidation = async (field, value) => {
    const trimmed = value.trim();

    if (!trimmed) {
      setLocationStates((prev) => ({
        ...prev,
        [field]: emptyLocationState,
      }));
      return emptyLocationState;
    }

    setLocationStates((prev) => ({
      ...prev,
      [field]: {
        ...prev[field],
        status: 'validating',
        message: 'Checking location…',
      },
    }));

    try {
      const result = await validateLocation(trimmed);
      const nextState = {
        status: result.isValid ? 'valid' : 'invalid',
        message: result.message,
        place: result.place,
        suggestions: result.suggestions || [],
      };

      setLocationStates((prev) => ({
        ...prev,
        [field]: nextState,
      }));

      return nextState;
    } catch (error) {
      const nextState = {
        status: 'invalid',
        message: 'Location lookup failed. Please try again.',
        place: null,
        suggestions: [],
      };

      setLocationStates((prev) => ({
        ...prev,
        [field]: nextState,
      }));

      return nextState;
    }
  };

  useEffect(() => {
    if (!form.destination.trim()) return undefined;

    const timeoutId = window.setTimeout(() => {
      runLocationValidation('destination', form.destination);
    }, 450);

    return () => window.clearTimeout(timeoutId);
  }, [form.destination]);

  useEffect(() => {
    if (!form.departureCity.trim()) return undefined;

    const timeoutId = window.setTimeout(() => {
      runLocationValidation('departureCity', form.departureCity);
    }, 450);

    return () => window.clearTimeout(timeoutId);
  }, [form.departureCity]);

  useEffect(() => {
    let isCancelled = false;

    const loadTripPreview = async () => {
      if (!tripPreviewReady) {
        setTripPreview({
          loading: false,
          error: '',
          weather: [],
          attractions: [],
        });
        return;
      }

      setTripPreview((prev) => ({
        ...prev,
        loading: true,
        error: '',
      }));

      try {
        const place = locationStates.destination.place;
        const weather = await getWeatherPreview({
          lat: place.lat,
          lon: place.lon,
          startDate: form.startDate,
          endDate: form.endDate,
        });

        await waitForNominatimCooldown();

        const attractions = await getAttractionPreview({
          lat: place.lat,
          lon: place.lon,
          interests: form.interests,
          limit: 5,
        });

        if (!isCancelled) {
          setTripPreview({
            loading: false,
            error: '',
            weather: weather || [],
            attractions: attractions || [],
          });
        }
      } catch (error) {
        if (!isCancelled) {
          setTripPreview({
            loading: false,
            error: 'Preview data could not be loaded right now, but you can still save the trip.',
            weather: [],
            attractions: [],
          });
        }
      }
    };

    loadTripPreview();

    return () => {
      isCancelled = true;
    };
  }, [tripPreviewReady, locationStates.destination.place, form.startDate, form.endDate, form.interests]);

  const pickSuggestion = (field, suggestion) => {
    setForm((prev) => ({
      ...prev,
      [field]: suggestion.displayName,
    }));

    setLocationStates((prev) => ({
      ...prev,
      [field]: {
        status: 'valid',
        message: `Matched to ${suggestion.displayName}`,
        place: suggestion,
        suggestions: prev[field].suggestions,
      },
    }));

    setFocusedField('');
  };

  const validate = async () => {
    const newErrors = {};

    if (!form.destination.trim()) newErrors.destination = 'Please enter a destination.';
    if (!form.departureCity.trim()) newErrors.departureCity = 'Please enter a departure city.';
    if (!form.startDate) newErrors.startDate = 'Please select a start date.';
    if (!form.endDate) newErrors.endDate = 'Please select an end date.';
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      newErrors.endDate = 'End date must be after start date.';
    }
    if (!form.budget) newErrors.budget = 'Please select a budget range.';
    if (form.interests.length === 0) newErrors.interests = 'Select at least one interest.';

    const [destinationState, departureState] = await Promise.all([
      runLocationValidation('destination', form.destination),
      waitForNominatimCooldown().then(() => runLocationValidation('departureCity', form.departureCity)),
    ]);

    if (form.destination.trim() && destinationState.status !== 'valid') {
      newErrors.destination = 'Please choose a valid destination.';
    }

    if (form.departureCity.trim() && departureState.status !== 'valid') {
      newErrors.departureCity = 'Please choose a valid departure city.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!(await validate())) {
      return;
    }

    if (onSubmit) {
      await onSubmit(form);
      return;
    }

    alert(`Form submitted!\n${JSON.stringify(form, null, 2)}`);
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="q-page">
      <div className="q-container">
        <div className="q-header">
          <h2 className="q-title">{isOnboarding ? 'Welcome to TripAI' : 'Plan Your Trip'}</h2>
          <p className="q-subtitle">
            {isOnboarding
              ? 'Answer a few questions so TripAI can save your preferences and create your first trip request.'
              : "Tell us about your dream adventure and we'll save it as a trip request for itinerary generation."}
          </p>
        </div>

        {submitError && <div className="q-error-banner">{submitError}</div>}

        <div className="q-body">
          <div className="q-row">
            <div className="q-field">
              <label className="q-label">
                <span className="q-label-icon">📍</span> Destination
              </label>
              <div className="q-input-wrap">
                <input
                  className={`q-input ${errors.destination ? 'q-input-error' : ''}`}
                  type="text"
                  placeholder="e.g. Tokyo, Japan"
                  value={form.destination}
                  disabled={isSubmitting}
                  autoComplete="off"
                  onFocus={() => setFocusedField('destination')}
                  onChange={(e) => updateField('destination', e.target.value)}
                  onBlur={() => {
                    window.setTimeout(() => setFocusedField((prev) => (prev === 'destination' ? '' : prev)), 120);
                    runLocationValidation('destination', form.destination);
                  }}
                />
                <LocationSuggestions
                  suggestions={locationStates.destination.suggestions}
                  fieldKey="destination"
                  visible={focusedField === 'destination' && form.destination.trim().length >= 2}
                  onPickSuggestion={pickSuggestion}
                />
              </div>
              <LocationStatus
                state={locationStates.destination}
                fieldKey="destination"
                onPickSuggestion={pickSuggestion}
              />
              {errors.destination && <span className="q-error">{errors.destination}</span>}
            </div>
            <div className="q-field">
              <label className="q-label">
                <span className="q-label-icon">🛫</span> Departure City
              </label>
              <div className="q-input-wrap">
                <input
                  className={`q-input ${errors.departureCity ? 'q-input-error' : ''}`}
                  type="text"
                  placeholder="e.g. Los Angeles, CA"
                  value={form.departureCity}
                  disabled={isSubmitting}
                  autoComplete="off"
                  onFocus={() => setFocusedField('departureCity')}
                  onChange={(e) => updateField('departureCity', e.target.value)}
                  onBlur={() => {
                    window.setTimeout(() => setFocusedField((prev) => (prev === 'departureCity' ? '' : prev)), 120);
                    runLocationValidation('departureCity', form.departureCity);
                  }}
                />
                <LocationSuggestions
                  suggestions={locationStates.departureCity.suggestions}
                  fieldKey="departureCity"
                  visible={focusedField === 'departureCity' && form.departureCity.trim().length >= 2}
                  onPickSuggestion={pickSuggestion}
                />
              </div>
              <LocationStatus
                state={locationStates.departureCity}
                fieldKey="departureCity"
                onPickSuggestion={pickSuggestion}
              />
              {errors.departureCity && <span className="q-error">{errors.departureCity}</span>}
            </div>
          </div>

          <div className="q-row">
            <div className="q-field">
              <label className="q-label">
                <span className="q-label-icon">📅</span> Start Date
              </label>
              <input
                className={`q-input q-date ${errors.startDate ? 'q-input-error' : ''}`}
                type="date"
                min={today}
                value={form.startDate}
                disabled={isSubmitting}
                onChange={(e) => updateField('startDate', e.target.value)}
              />
              {errors.startDate && <span className="q-error">{errors.startDate}</span>}
            </div>
            <div className="q-field">
              <label className="q-label">
                <span className="q-label-icon">📅</span> End Date
              </label>
              <input
                className={`q-input q-date ${errors.endDate ? 'q-input-error' : ''}`}
                type="date"
                min={form.startDate || today}
                value={form.endDate}
                disabled={isSubmitting}
                onChange={(e) => updateField('endDate', e.target.value)}
              />
              {errors.endDate && <span className="q-error">{errors.endDate}</span>}
            </div>
          </div>

          <div className="q-field q-field-full">
            <label className="q-label">
              <span className="q-label-icon">💰</span> Budget Range
            </label>
            <div className="q-budget-grid">
              {BUDGETS.map((budgetOption) => (
                <button
                  key={budgetOption.id}
                  type="button"
                  disabled={isSubmitting}
                  className={`q-budget-card ${form.budget === budgetOption.id ? 'q-budget-selected' : ''}`}
                  onClick={() => updateField('budget', budgetOption.id)}
                >
                  <span className="q-budget-icon">{budgetOption.icon}</span>
                  <span className="q-budget-label">{budgetOption.label}</span>
                  <span className="q-budget-sub">{budgetOption.sub}</span>
                </button>
              ))}
            </div>
            {errors.budget && <span className="q-error">{errors.budget}</span>}
          </div>

          <div className="q-field q-field-full">
            <label className="q-label">
              <span className="q-label-icon">🎯</span> Travel Interests
              <span className="q-label-hint"> — pick all that apply</span>
            </label>
            <div className="q-interests-grid">
              {INTERESTS.map((interest) => (
                <button
                  key={interest.id}
                  type="button"
                  disabled={isSubmitting}
                  className={`q-interest-card ${form.interests.includes(interest.id) ? 'q-interest-selected' : ''}`}
                  onClick={() => toggleInterest(interest.id)}
                >
                  <span className="q-interest-label">{interest.label}</span>
                  <span className="q-interest-desc">{interest.desc}</span>
                </button>
              ))}
            </div>
            {errors.interests && <span className="q-error">{errors.interests}</span>}
          </div>

          {(tripPreview.loading || tripPreview.error || tripPreview.weather.length > 0 || tripPreview.attractions.length > 0) && (
            <div className="q-preview-card">
              <div className="q-preview-header">
                <div>
                  <h3 className="q-preview-title">Live trip preview</h3>
                  <p className="q-preview-subtitle">
                    Preview pulled from free APIs while the questionnaire is being filled out.
                  </p>
                </div>
                {tripPreview.loading && <span className="q-preview-pill">Loading…</span>}
              </div>

              {tripPreview.error && <div className="q-preview-error">{tripPreview.error}</div>}

              {tripPreview.weather.length > 0 && (
                <div className="q-preview-section">
                  <h4 className="q-preview-section-title">Weather outlook</h4>
                  <div className="q-weather-grid">
                    {tripPreview.weather.slice(0, 5).map((day) => (
                      <div key={day.date} className="q-weather-card">
                        <span className="q-weather-date">{formatPreviewDate(day.date)}</span>
                        <span className="q-weather-label">{weatherLabelFromCode(day.weatherCode)}</span>
                        <span className="q-weather-temp">
                          {Math.round(day.tempMax)}° / {Math.round(day.tempMin)}°
                        </span>
                        <span className="q-weather-rain">Rain chance: {day.precipitationProbability ?? 0}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tripPreview.attractions.length > 0 && (
                <div className="q-preview-section">
                  <h4 className="q-preview-section-title">Nearby attractions</h4>
                  <div className="q-attraction-list">
                    {tripPreview.attractions.map((attraction) => (
                      <div key={attraction.id} className="q-attraction-item">
                        <div>
                          <div className="q-attraction-name">{attraction.name}</div>
                          <div className="q-attraction-meta">{attraction.source}</div>
                        </div>
                        <span className="q-attraction-distance">
                          {Math.max(1, Math.round((attraction.distanceMeters || 0) / 1000 * 10) / 10)} km
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="q-footer">
          {!isOnboarding && (
            <button className="q-back-btn" type="button" onClick={onBack} disabled={isSubmitting}>
              ← Back
            </button>
          )}
          <button className="q-submit-btn" type="button" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : isOnboarding ? 'Save Preferences & Continue ✨' : 'Save Trip Request ✨'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Questionnaire;
