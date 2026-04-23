import './ViewPlans.css';

const SAMPLE_PLANS = [
  {
    id: 1,
    destination: 'Paris, France',
    departureCity: 'New York, NY',
    startDate: '2026-06-01',
    endDate: '2026-06-07',
    travelers: '2',
    budget: 'comfort',
    interests: ['culture', 'food', 'photography'],
    image: '🗼',
    description: 'Classic Parisian experience with museums, cafes, and iconic landmarks.',
  },
];

function ViewPlans({ onSelectPlan, onBackToMenu }) {
  const handleSelectPlan = (plan) => {
    onSelectPlan({
      destination: plan.destination,
      departureCity: plan.departureCity,
      startDate: plan.startDate,
      endDate: plan.endDate,
      travelers: plan.travelers,
      budget: plan.budget,
      interests: plan.interests,
    });
  };

  return (
    <div className="view-plans-page">
      <div className="view-plans-container">
        <header className="view-plans-header">
          <div>
            <p className="view-plans-eyebrow">Saved Plans</p>
            <h1>Your Saved Itineraries</h1>
            <p className="view-plans-subtitle">
              Choose from your previously created travel plans.
            </p>
          </div>
        </header>

        <div className="plans-grid">
          {SAMPLE_PLANS.map((plan) => (
            <article
              key={plan.id}
              className="plan-card"
              onClick={() => handleSelectPlan(plan)}
              role="button"
              tabIndex="0"
              onKeyPress={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleSelectPlan(plan);
                }
              }}
            >
              <div className="plan-card-emoji">{plan.image}</div>
              <h3>{plan.destination}</h3>
              <p className="plan-card-description">{plan.description}</p>

              <div className="plan-card-meta">
                <span className="plan-meta-item">
                  📅 {new Date(`${plan.startDate}T12:00:00`).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                  {' - '}
                  {new Date(`${plan.endDate}T12:00:00`).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
                <span className="plan-meta-item">📍 From {plan.departureCity}</span>
              </div>

              <div className="plan-card-footer">
                <button className="plan-select-btn" onClick={() => handleSelectPlan(plan)}>
                  View Plan →
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ViewPlans;
