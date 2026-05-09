import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import './ViewPlans.css';

const BUDGET_LABELS = {
  budget: 'Budget',
  moderate: 'Moderate',
  comfort: 'Comfort',
  luxury: 'Luxury',
};

const STATUS_LABELS = {
  draft: 'Draft',
  pending: 'Pending',
  generated: 'Generated',
  regenerated: 'Regenerated',
  refined: 'Refined',
  restored: 'Restored',
  generation_failed: 'Generation failed',
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
    planName: row.plan_name || row.destination || 'Untitled trip',
    travelerCount: row.traveler_count || 1,
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

function ViewPlans({ onSelectPlan, onBackToMenu, onNewTrip, onEditPlan }) {
  const [plans, setPlans] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingPlanId, setDeletingPlanId] = useState(null);

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
          .select('id, plan_name, traveler_count, destination, departure_city, start_date, end_date, budget_range, interests, status, updated_at, created_at')
          .eq('user_id', user.id)
          .neq('status', 'deleted')
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

  const handleDeletePlan = async (plan) => {
    const confirmed = window.confirm(`Delete the ${plan.planName} itinerary? This cannot be undone.`);

    if (!confirmed) {
      return;
    }

    setDeletingPlanId(plan.id);
    setError('');

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('Please log in again before deleting this trip.');
      }

      const { data: deletedRows, error: tripDeleteError } = await supabase
        .from('trip_requests')
        .delete()
        .eq('id', plan.id)
        .eq('user_id', user.id)
        .select('id');

      if (tripDeleteError) {
        throw tripDeleteError;
      }

      if (!deletedRows || deletedRows.length === 0) {
        throw new Error('This trip could not be deleted. Check the delete policy for trip_requests, then try again.');
      }

      setPlans((currentPlans) => currentPlans.filter((savedPlan) => savedPlan.id !== plan.id));
    } catch (deleteError) {
      console.error('Error deleting saved trip:', deleteError);
      setError(deleteError.message || 'Unable to delete this saved trip right now.');
    } finally {
      setDeletingPlanId(null);
    }
  };

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
          <div className="view-plans-state">
            <h2>Loading saved trips...</h2>
          </div>
        ) : error ? (
          <div className="view-plans-state view-plans-state-error">
            <h2>Saved trips unavailable</h2>
            <p>{error}</p>
          </div>
        ) : plans.length === 0 ? (
          <div className="view-plans-state view-plans-empty-state">
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
                <h3>{plan.planName}</h3>
                <p className="plan-card-description">
                  {plan.destination} · From {plan.departureCity} · {BUDGET_LABELS[plan.budget] || 'Custom'} pace
                </p>

                <div className="plan-card-meta">
                  <span className="plan-meta-item">📅 {formatTripDates(plan.startDate, plan.endDate)}</span>
                  <span className="plan-meta-item">🧭 {plan.interests.length || 0} interests saved</span>
                  <span className="plan-meta-item">📝 {STATUS_LABELS[plan.status] || plan.status || 'Saved'}</span>
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
                    Open Trip →
                  </button>
                  <button
                    className="plan-edit-btn"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditPlan(plan);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="plan-delete-btn"
                    type="button"
                    disabled={deletingPlanId === plan.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeletePlan(plan);
                    }}
                  >
                    {deletingPlanId === plan.id ? 'Deleting...' : 'Delete'}
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
