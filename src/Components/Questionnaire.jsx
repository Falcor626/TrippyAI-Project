import { useEffect, useState } from 'react';
import './Questionnaire.css';

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

  useEffect(() => {
    setForm({ ...emptyForm, ...initialValues });
  }, [initialValues]);

  const toggleInterest = (id) => {
    setForm((prev) => ({
      ...prev,
      interests: prev.interests.includes(id)
        ? prev.interests.filter((interest) => interest !== id)
        : [...prev.interests, id],
    }));
  };

  const validate = () => {
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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
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
              <input
                className={`q-input ${errors.destination ? 'q-input-error' : ''}`}
                type="text"
                placeholder="e.g. Tokyo, Japan"
                value={form.destination}
                disabled={isSubmitting}
                onChange={(e) => setForm({ ...form, destination: e.target.value })}
              />
              {errors.destination && <span className="q-error">{errors.destination}</span>}
            </div>
            <div className="q-field">
              <label className="q-label">
                <span className="q-label-icon">🛫</span> Departure City
              </label>
              <input
                className={`q-input ${errors.departureCity ? 'q-input-error' : ''}`}
                type="text"
                placeholder="e.g. Los Angeles, CA"
                value={form.departureCity}
                disabled={isSubmitting}
                onChange={(e) => setForm({ ...form, departureCity: e.target.value })}
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
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
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
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
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
                  onClick={() => setForm({ ...form, budget: budgetOption.id })}
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
            {isSubmitting ? 'Saving...' : isOnboarding ? 'Save Preferences & Continue ✨' : 'Save Trip Request ✨'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Questionnaire;
