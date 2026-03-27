import { useState } from 'react';
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

function Questionnaire({ onBack, onSubmit }) {
    const [form, setForm] = useState({
        destination: '',
        departureCity: '',
        startDate: '',
        endDate: '',
        budget: '',
        interests: [],
    });
    const [errors, setErrors] = useState({});

    const toggleInterest = (id) => {
        setForm(prev => ({
            ...prev,
            interests: prev.interests.includes(id)
                ? prev.interests.filter(i => i !== id)
                : [...prev.interests, id]
        }));
    };

    const validate = () => {
        const newErrors = {};
        if (!form.destination.trim()) newErrors.destination = 'Please enter a destination.';
        if (!form.departureCity.trim()) newErrors.departureCity = 'Please enter a departure city.';
        if (!form.startDate) newErrors.startDate = 'Please select a start date.';
        if (!form.endDate) newErrors.endDate = 'Please select an end date.';
        if (form.startDate && form.endDate && form.endDate < form.startDate)
            newErrors.endDate = 'End date must be after start date.';
        if (!form.budget) newErrors.budget = 'Please select a budget range.';
        if (form.interests.length === 0) newErrors.interests = 'Select at least one interest.';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = () => {
        if (validate()) {
            if (onSubmit) onSubmit(form);
            else alert('Form submitted!\n' + JSON.stringify(form, null, 2));
        }
    };

    const today = new Date().toISOString().split('T')[0];

    return (
        <div className="q-page">
            <div className="q-container">
                <div className="q-header">
                    <h2 className="q-title">Plan Your Trip</h2>
                    <p className="q-subtitle">Tell us about your dream adventure and we'll craft the perfect itinerary.</p>
                </div>

                <div className="q-body">
                    {/* Row: Destination + Departure */}
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
                                onChange={e => setForm({ ...form, destination: e.target.value })}
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
                                onChange={e => setForm({ ...form, departureCity: e.target.value })}
                            />
                            {errors.departureCity && <span className="q-error">{errors.departureCity}</span>}
                        </div>
                    </div>

                    {/* Row: Dates */}
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
                                onChange={e => setForm({ ...form, startDate: e.target.value })}
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
                                onChange={e => setForm({ ...form, endDate: e.target.value })}
                            />
                            {errors.endDate && <span className="q-error">{errors.endDate}</span>}
                        </div>
                    </div>

                    {/* Budget */}
                    <div className="q-field q-field-full">
                        <label className="q-label">
                            <span className="q-label-icon">💰</span> Budget Range
                        </label>
                        <div className="q-budget-grid">
                            {BUDGETS.map(b => (
                                <button
                                    key={b.id}
                                    type="button"
                                    className={`q-budget-card ${form.budget === b.id ? 'q-budget-selected' : ''}`}
                                    onClick={() => setForm({ ...form, budget: b.id })}
                                >
                                    <span className="q-budget-icon">{b.icon}</span>
                                    <span className="q-budget-label">{b.label}</span>
                                    <span className="q-budget-sub">{b.sub}</span>
                                </button>
                            ))}
                        </div>
                        {errors.budget && <span className="q-error">{errors.budget}</span>}
                    </div>

                    {/* Interests */}
                    <div className="q-field q-field-full">
                        <label className="q-label">
                            <span className="q-label-icon">🎯</span> Travel Interests
                            <span className="q-label-hint"> — pick all that apply</span>
                        </label>
                        <div className="q-interests-grid">
                            {INTERESTS.map(interest => (
                                <button
                                    key={interest.id}
                                    type="button"
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

                {/* Footer */}
                <div className="q-footer">
                    <button className="q-back-btn" type="button" onClick={onBack}>
                        ← Back
                    </button>
                    <button className="q-submit-btn" type="button" onClick={handleSubmit}>
                        Generate My Itinerary ✨
                    </button>
                </div>
            </div>
        </div>
    );
}

export default Questionnaire;