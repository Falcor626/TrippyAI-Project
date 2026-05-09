import { useEffect, useRef, useState } from 'react';
import './Questionnaire.css';
import { TRIPPY_CHAT_URL } from '../config';
import { validateLocation } from '../services/travelApi';

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
  planName: '',
  travelerCount: 1,
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

const GREETING_MESSAGE = {
  role: 'assistant',
  content:
    "I'm Trippy. Tell me what kind of trip you want, and I'll help shape these answers before you save the plan.",
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

const getInterestLabel = (id) => {
  const interest = INTERESTS.find((item) => item.id === id);
  return interest ? interest.label.replace(/^[^\w]+/, '').trim() : id;
};

const getBudgetLabel = (id) => {
  const budget = BUDGETS.find((item) => item.id === id);
  return budget ? `${budget.label} (${budget.sub})` : id;
};

const getAssistantNextStep = (form) => {
  if (!form.destination.trim()) {
    return 'Start with the destination you want the itinerary built around.';
  }

  if (!form.startDate || !form.endDate) {
    return `Next, add dates so Trippy can shape the pace around ${form.destination}.`;
  }

  if (!form.budget) {
    return 'Choose a budget range so recommendations match the trip style.';
  }

  if (!form.interests.length) {
    return 'Pick at least one interest so Trippy can prioritize the right activities.';
  }

  if (!form.departureCity.trim()) {
    return 'Add a departure city so flights and travel logistics can be considered.';
  }

  return 'Your core trip details are ready. Ask Trippy to plan around this destination before saving.';
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
          <span className="q-autocomplete-main-row">
            <span className="q-autocomplete-primary">{suggestion.primaryLabel || suggestion.displayName}</span>
            {suggestion.typeLabel && <span className="q-autocomplete-type">{suggestion.typeLabel}</span>}
          </span>
          <span className="q-autocomplete-secondary">
            {suggestion.secondaryLabel || suggestion.displayName}
          </span>
        </button>
      ))}
    </div>
  );
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
  initialChatMessages = [],
  isOnboarding = false,
  isSubmitting = false,
  submitError = '',
  onBack,
  onSubmit,
  onPersistChatMessage,
}) {
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [locationStates, setLocationStates] = useState({
    destination: emptyLocationState,
    departureCity: emptyLocationState,
  });
  const [focusedField, setFocusedField] = useState('');
  const [chatMessages, setChatMessages] = useState([GREETING_MESSAGE]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef(null);

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

  useEffect(() => {
    setChatMessages(initialChatMessages.length ? initialChatMessages : [GREETING_MESSAGE]);
  }, [initialChatMessages]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  const isGreetingMessage = (message) =>
    message?.role === GREETING_MESSAGE.role && message?.content === GREETING_MESSAGE.content;

  const persistChatMessage = async (message) => {
    try {
      await onPersistChatMessage?.(message);
    } catch (error) {
      console.warn('Unable to persist questionnaire Trippy chat message:', error.message);
    }
  };

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

  const runLocationValidation = async (field, value, options = {}) => {
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
      const result = await validateLocation(trimmed, { autoSelect: options?.autoSelect ?? false });
      const canonicalValue = result.isValid && result.place ? result.place.displayName : trimmed;
      const nextState = {
        status: result.isValid ? 'valid' : 'invalid',
        message: result.message,
        place: result.place,
        suggestions: result.suggestions || [],
        autoSelected: Boolean(result.autoSelected),
      };

      if (result.isValid && result.place && canonicalValue !== value) {
        setForm((prev) => (prev[field] === value ? { ...prev, [field]: canonicalValue } : prev));
      }

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
      runLocationValidation('destination', form.destination, { autoSelect: false });
    }, 450);

    return () => window.clearTimeout(timeoutId);
  }, [form.destination]);

  useEffect(() => {
    if (!form.departureCity.trim()) return undefined;

    const timeoutId = window.setTimeout(() => {
      runLocationValidation('departureCity', form.departureCity, { autoSelect: false });
    }, 450);

    return () => window.clearTimeout(timeoutId);
  }, [form.departureCity]);

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
        autoSelected: true,
      },
    }));

    setFocusedField('');
  };

  const validate = async () => {
    const newErrors = {};

    if (!form.planName.trim()) newErrors.planName = 'Please name this travel plan.';
    if (!Number.isFinite(Number(form.travelerCount)) || Number(form.travelerCount) < 1) {
      newErrors.travelerCount = 'Traveler count must be at least 1.';
    }
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
      runLocationValidation('destination', form.destination, { autoSelect: true }),
      runLocationValidation('departureCity', form.departureCity, { autoSelect: true }),
    ]);

    if (form.destination.trim() && destinationState.status !== 'valid') {
      newErrors.destination = 'Please choose a valid destination.';
    }

    if (form.departureCity.trim() && departureState.status !== 'valid') {
      newErrors.departureCity = 'Please choose a valid departure city.';
    }

    setErrors(newErrors);
    return {
      isValid: Object.keys(newErrors).length === 0,
      destinationState,
      departureState,
    };
  };

  const handleSubmit = async () => {
    const validation = await validate();
    if (!validation.isValid) {
      return;
    }

    const normalizedForm = {
      ...form,
      destination: validation.destinationState?.place?.displayName || form.destination,
      departureCity: validation.departureState?.place?.displayName || form.departureCity,
    };

    setForm(normalizedForm);

    if (onSubmit) {
      try {
        await onSubmit(
          normalizedForm,
          chatMessages.filter((message) => !isGreetingMessage(message))
        );
      } catch (error) {
        setErrors((prev) => ({
          ...prev,
          submit: error?.message || 'Failed to save your trip request.',
        }));
      }
      return;
    }

    alert(`Form submitted!\n${JSON.stringify(normalizedForm, null, 2)}`);
  };

  const buildQuestionnaireContext = () => ({
    mode: isOnboarding ? 'onboarding' : 'trip_request',
    planName: form.planName || null,
    travelerCount: form.travelerCount || null,
    destination: form.destination || null,
    departureCity: form.departureCity || null,
    startDate: form.startDate || null,
    endDate: form.endDate || null,
    budget: form.budget ? getBudgetLabel(form.budget) : null,
    interests: form.interests.map(getInterestLabel),
    missingFields: Object.entries({
      planName: form.planName,
      destination: form.destination,
      departureCity: form.departureCity,
      startDate: form.startDate,
      endDate: form.endDate,
      budget: form.budget,
      interests: form.interests.length ? 'selected' : '',
    })
      .filter(([, value]) => !value)
      .map(([key]) => key),
  });

  const sendTrippiMessage = async (presetMessage = '') => {
    const trimmed = (presetMessage || chatInput).trim();
    if (!trimmed || chatLoading) return;

    const userMessage = { role: 'user', content: trimmed };
    const updatedMessages = [...chatMessages, userMessage];
    setChatMessages(updatedMessages);
    setChatInput('');
    setChatLoading(true);
    await persistChatMessage(userMessage);

    try {
      const history = updatedMessages
        .slice(0, -1)
        .filter((message) => !isGreetingMessage(message))
        .map((message) => ({ role: message.role, content: message.content }));

      const response = await fetch(TRIPPY_CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history,
          questionnaireContext: buildQuestionnaireContext(),
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Unable to reach Trippy.');
      }

      const assistantMessage = { role: 'assistant', content: data.reply };
      setChatMessages((prev) => [...prev, assistantMessage]);
      await persistChatMessage(assistantMessage);
    } catch (error) {
      console.error('Questionnaire Trippy error:', error);
      const assistantMessage = {
        role: 'assistant',
        content: 'I cannot connect to the Trippy backend right now. Keep filling out the form, then try me again.',
      };
      setChatMessages((prev) => [
        ...prev,
        assistantMessage,
      ]);
      await persistChatMessage(assistantMessage);
    } finally {
      setChatLoading(false);
    }
  };

  const sendRandomPlanMessage = () => {
    const hasDateRange = Boolean(form.startDate && form.endDate);
    const randomPlanPrompt = hasDateRange
      ? 'Generate a random trip plan idea for me using my selected date range. You can choose the destination, but use any budget, departure city, traveler count, and interests I already entered. Keep it practical and explain why the idea fits the number of days.'
      : 'I want a random trip plan, but I have not provided a date range or number of travel days yet. Ask me one focused question for either exact dates or trip length before suggesting the plan.';

    sendTrippiMessage(randomPlanPrompt);
  };

  const handleChatKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendTrippiMessage();
    }
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="q-page">
      <div className="q-layout">
        <div className="q-container">
        <div className="q-header">
          <h2 className="q-title">{isOnboarding ? 'Welcome to TripAI' : 'Plan Your Trip'}</h2>
          <p className="q-subtitle">
            {isOnboarding
              ? 'Answer a few questions so TripAI can save your preferences and create your first trip request.'
              : "Tell us about your trip. TripAI will save the request and generate an itinerary from these details."}
          </p>
        </div>

        {submitError && <div className="q-error-banner">{submitError}</div>}

        <div className="q-body">
          <div className="q-row">
            <div className="q-field">
              <label className="q-label" htmlFor="planName">
                <span className="q-label-icon">📝</span> Travel Plan Name
              </label>
              <input
                id="planName"
                className={`q-input ${errors.planName ? 'q-input-error' : ''}`}
                type="text"
                placeholder="e.g. Summer in Tokyo"
                value={form.planName}
                disabled={isSubmitting}
                onChange={(e) => updateField('planName', e.target.value)}
                maxLength={80}
              />
              {errors.planName && <span className="q-error">{errors.planName}</span>}
            </div>

            <div className="q-field">
              <label className="q-label" htmlFor="travelerCount">
                <span className="q-label-icon">👥</span> Number of Travelers
              </label>
              <input
                id="travelerCount"
                className={`q-input ${errors.travelerCount ? 'q-input-error' : ''}`}
                type="number"
                min="1"
                step="1"
                value={form.travelerCount}
                disabled={isSubmitting}
                onChange={(e) => updateField('travelerCount', Math.max(1, Number(e.target.value) || 1))}
              />
              {errors.travelerCount && <span className="q-error">{errors.travelerCount}</span>}
            </div>
          </div>

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
                    runLocationValidation('destination', form.destination, { autoSelect: true });
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
                    runLocationValidation('departureCity', form.departureCity, { autoSelect: true });
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
        </div>

        <div className="q-footer">
          {!isOnboarding && (
            <button className="q-back-btn" type="button" onClick={onBack} disabled={isSubmitting}>
              ← Back
            </button>
          )}
          <button className="q-submit-btn" type="button" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Generating itinerary...' : isOnboarding ? 'Save Preferences & Continue ✨' : 'Generate Itinerary ✨'}
          </button>
        </div>
        </div>

        <aside className="q-assistant-panel">
          <div className="q-assistant-header">
            <div className="q-assistant-avatar">🌍</div>
            <div>
              <h3>Trippy</h3>
              <p>AI trip planning assistant</p>
            </div>
          </div>

          <div className="q-assistant-context">
            <span>{form.destination || 'Destination open'}</span>
            <span>{form.budget ? getBudgetLabel(form.budget) : 'Budget open'}</span>
            <span>
              {form.interests.length ? `${form.interests.length} interests selected` : 'Interests open'}
            </span>
          </div>

          <div className="q-assistant-next-step">
            <span>Next step</span>
            <p>{getAssistantNextStep(form)}</p>
          </div>

          <div className="q-assistant-prompts">
            <button
              type="button"
              disabled={chatLoading}
              onClick={() =>
                sendTrippiMessage(
                  'Plan around my selected destination using my current questionnaire answers. Do not suggest a different destination unless I ask for alternatives.'
                )
              }
            >
              Plan around destination
            </button>
            <button
              type="button"
              disabled={chatLoading}
              onClick={() =>
                sendTrippiMessage(
                  'Based on my selected destination and current answers, which interests should I choose for this trip?'
                )
              }
            >
              Pick interests
            </button>
            <button
              type="button"
              disabled={chatLoading}
              onClick={() =>
                sendTrippiMessage(
                  'Check whether my selected budget is realistic for this destination, dates, and traveler count.'
                )
              }
            >
              Budget check
            </button>
            <button
              type="button"
              disabled={chatLoading}
              onClick={sendRandomPlanMessage}
            >
              Random plan
            </button>
          </div>

          <div className="q-assistant-messages">
            {chatMessages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`q-assistant-message ${message.role === 'user' ? 'q-assistant-user' : ''}`}
              >
                {renderBasicMarkdown(message.content)}
              </div>
            ))}
            {chatLoading && (
              <div className="q-assistant-message q-assistant-typing">
                <span></span>
                <span></span>
                <span></span>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          <div className="q-assistant-input-row">
            <textarea
              className="q-assistant-input"
              placeholder="Ask Trippy..."
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              onKeyDown={handleChatKeyDown}
              rows={2}
              disabled={chatLoading}
            />
            <button
              className="q-assistant-send"
              type="button"
              onClick={() => sendTrippiMessage()}
              disabled={chatLoading || !chatInput.trim()}
            >
              ➤
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default Questionnaire;
