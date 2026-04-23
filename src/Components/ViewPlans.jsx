import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import './ViewPlans.css';

const BUDGET_LABELS = {
  budget: 'Budget',
  moderate: 'Moderate',
  comfort: 'Comfort',
  luxury: 'Luxury',
};

function formatTripDates(startDate, endDate) {
  if (!startDate || !endDate) {
    return 'Dates pending';
  }

  const format = (value) =>
    new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });

  return `${format(startDate)} - ${format(endDate)}`;
}

function mapTripRow(row) {
  return {
    id: row.id,
    destination: row.destination || 'Untitled trip',
    departureCity: row.departure_city || 'Unknown departure',
    startDate: row.start_date || '',
    endDate: row.end_date || '',
    budget: row.budget_range || '',
    interests: row.interests || [],
    status: row.status || 'pending',
    updatedAt: row.updated_at || row.created_at || null,
  };
}

function ViewPlans({ onSelectPlan, onBackToMenu, onNewTrip }) {
  const [plans, setPlans] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadTrips = async () => {
      setIsLoading(true);
      setError('');

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          throw new Error('Please log in again to view your saved trips.');
        }

        const { data, error: tripsError } = await supabase
          .from('trip_requests')
          .select('id, destination, departure_city, start_date, end_date, budget_range, interests, status, updated_at, created_at')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false });

        if (tripsError) {
          throw tripsError;
        }

        setPlans((data || []).map(mapTripRow));
      } catch (loadError) {
        console.error('Error loading saved trips:', loadError);
        setError(loadError.message || 'Unable to load saved trips right now.');
      } finally {
        setIsLoading(false);
      }
    };

    loadTrips();
  }, []);

  return (
    <div className="view-plans-page">
      <div className="view-plans-container">
        <header className="view-plans-header">
          <div>
            <p className="view-plans-eyebrow">Saved Plans</p>
            <h1>Your Saved Itineraries</h1>
            <p className="view-plans-subtitle">
              Open a previous trip, keep refining it, or start a brand-new request.
            </p>
          </div>

          <div className="button-group">
            <button type="button" className="secondary-button" onClick={onBackToMenu}>
              Back to Menu
            </button>
            <button type="button" onClick={onNewTrip}>
              New Trip
            </button>
          </div>
        </header>

        {isLoading ? (
          <div className="form-container">
            <h2>Loading saved trips...</h2>
          </div>
        ) : error ? (
          <div className="form-container">
            <h2>Saved trips unavailable</h2>
            <p>{error}</p>
          </div>
        ) : plans.length === 0 ? (
          <div className="form-container">
            <h2>No saved trips yet</h2>
            <p>Create your first trip request to generate and store an itinerary.</p>
            <button type="button" onClick={onNewTrip}>
              Start Your First Trip
            </button>
          </div>
        ) : (
          <div className="plans-grid">
            {plans.map((plan) => (
              <article
                key={plan.id}
                className="plan-card"
                onClick={() => onSelectPlan(plan)}
                role="button"
                tabIndex="0"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectPlan(plan);
                  }
                }}
              >
                <div className="plan-card-emoji">✈️</div>
                <h3>{plan.destination}</h3>
                <p className="plan-card-description">
                  From {plan.departureCity} · {BUDGET_LABELS[plan.budget] || 'Custom'} pace
                </p>

                <div className="plan-card-meta">
                  <span className="plan-meta-item">📅 {formatTripDates(plan.startDate, plan.endDate)}</span>
                  <span className="plan-meta-item">🧭 {plan.interests.length || 0} interests saved</span>
                  <span className="plan-meta-item">📝 {plan.status}</span>
                </div>

                <div className="plan-card-footer">
                  <button
                    className="plan-select-btn"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectPlan(plan);
                    }}
                  >
                    Open Itinerary →
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ViewPlans;
