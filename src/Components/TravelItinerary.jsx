import './TravelItinerary.css';
import TripMap from './TripMap';

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

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${value}T12:00:00`));
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

const getTripLength = (startDate, endDate) => {
  if (!startDate || !endDate) return 4;

  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));

  return Math.max(3, diff + 1);
};

const buildItinerary = (trip) => {
  const destination = trip.destination || 'your destination';
  const interests = trip.interests?.length
    ? trip.interests.map((id) => INTEREST_LABELS[id] || id)
    : ['Culture', 'Food & Drink', 'Nature'];

  const primary = interests[0];
  const secondary = interests[1] || interests[0];
  const tertiary = interests[2] || 'Scenic walks';
  const variantIndex = trip.updatedAt ? new Date(trip.updatedAt).getSeconds() % REGENERATED_VARIANTS.length : 0;

  return TIMELINE_TEMPLATES.map((item, index) => {
    if (index === 1) {
      return {
        ...item,
        title: `${primary} anchor`,
        detail: `Center this block around one strong ${primary.toLowerCase()} experience in ${destination} so the itinerary has a memorable core.`,
      };
    }

    if (index === 2) {
      return {
        ...item,
        title: `${secondary} reset`,
        detail: `Follow the main activity with a lighter ${secondary.toLowerCase()} stop that keeps the trip feeling enjoyable instead of rushed.`,
      };
    }

    if (index === 3) {
      return {
        ...item,
        title: `${tertiary} evening`,
        detail: REGENERATED_VARIANTS[variantIndex],
      };
    }

    return item;
  });
};

function TravelItinerary({ tripData, onEditPlan, onLogout, onBackToPlans, onRegeneratePlan }) {
  const trip = tripData || {};
  const destination = trip.destination || 'Lisbon, Portugal';
  const departureCity = trip.departureCity || 'New York, NY';
  const tripLength = getTripLength(trip.startDate, trip.endDate);
  const itinerary = buildItinerary(trip);
  const interests = trip.interests?.length
    ? trip.interests.map((id) => INTEREST_LABELS[id] || id)
    : ['Culture', 'Food & Drink', 'Nature'];

  return (
    <main className="itinerary-page">
      <section className="itinerary-shell">
        <header className="itinerary-topbar">
          <div>
            <p className="eyebrow">Travel itinerary</p>
            <h1>{destination}</h1>
            <p className="itinerary-subtitle">
              A structured trip board for {departureCity} with {tripLength} days of focused, flexible planning.
            </p>
          </div>

          <div className="topbar-actions">
            <button className="ghost-button" type="button" onClick={onBackToPlans}>
              Saved Trips
            </button>
            <button className="ghost-button" type="button" onClick={onEditPlan}>
              Edit plan
            </button>
            <button className="ghost-button" type="button" onClick={onRegeneratePlan}>
              Regenerate
            </button>
            <button className="ghost-button ghost-button-secondary" type="button" onClick={onLogout}>
              Logout
            </button>
          </div>
        </header>

        <section className="hero-card">
          <div className="hero-copy">
            <p className="hero-kicker">Trip snapshot</p>
            <h2>{destination} in motion</h2>
            <p>
              Built around a {BUDGET_LABELS[trip.budget] || 'custom'} pace, this itinerary balances landmarks,
              meals, and breathing room between highlights.
            </p>

            <div className="chip-row">
              <span className="pill">
                {formatDate(trip.startDate)} - {formatDate(trip.endDate)}
              </span>
              <span className="pill">From {departureCity}</span>
              <span className="pill">{BUDGET_LABELS[trip.budget] || 'Custom budget'}</span>
              <span className="pill">Status: {trip.status || 'generated'}</span>
            </div>
          </div>

          <div className="hero-aside">
            <div className="metric-card accent-card">
              <span className="metric-label">Length</span>
              <strong>{tripLength} days</strong>
              <p>Enough room for one major anchor and a slower supporting rhythm.</p>
            </div>
            <div className="metric-card">
              <span className="metric-label">Last updated</span>
              <strong>{formatDateTime(trip.updatedAt)}</strong>
              <p>Regenerating updates the itinerary emphasis and preserves the trip request.</p>
            </div>
          </div>
        </section>

        <TripMap destination={destination} departureCity={departureCity} />

        <section className="content-grid">
          <div className="main-column">
            <div className="panel section-panel">
              <div className="section-heading">
                <div>
                  <p className="section-label">Daily plan</p>
                  <h3>Suggested rhythm</h3>
                </div>
                <span className="section-badge">Generated by TripAI</span>
              </div>

              <div className="timeline">
                {itinerary.map((item) => (
                  <article className="timeline-item" key={`${item.time}-${item.title}`}>
                    <div className="timeline-time">{item.time}</div>
                    <div className="timeline-body">
                      <h4>{item.title}</h4>
                      <p>{item.detail}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="split-grid">
              <article className="panel mini-panel">
                <p className="section-label">Need-to-book</p>
                <h3>Priority reservations</h3>
                <ul className="checklist">
                  <li>One entry-based attraction for the first full day</li>
                  <li>A dinner reservation or headline meal slot</li>
                  <li>Airport transfer, transit pass, or arrival logistics</li>
                </ul>
              </article>

              <article className="panel mini-panel">
                <p className="section-label">Packing list</p>
                <h3>Smart carry items</h3>
                <ul className="checklist">
                  {DEFAULT_PACKING.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            </div>
          </div>

          <aside className="side-column">
            <article className="panel side-card">
              <p className="section-label">Local notes</p>
              <h3>Trip tips</h3>
              <div className="note-list">
                {DEFAULT_TIPS.map((tip) => (
                  <p key={tip}>{tip}</p>
                ))}
              </div>
            </article>

            <article className="panel side-card highlight-card">
              <p className="section-label">Interest mix</p>
              <h3>{interests.join(' + ')}</h3>
              <p>These saved preferences shape the overall pacing and the types of stops TripAI emphasizes.</p>
              <div className="interest-tags">
                {interests.map((interest) => (
                  <span key={interest} className="interest-tag">
                    {interest}
                  </span>
                ))}
              </div>
            </article>

            <article className="panel side-card">
              <p className="section-label">Travel flow</p>
              <h3>Suggested anchors</h3>
              <ul className="route-list">
                <li>Arrival reset and neighborhood orientation walk</li>
                <li>One midday attraction that defines the day</li>
                <li>One flexible recovery block before evening plans</li>
                <li>One strong closing moment each night</li>
              </ul>
            </article>
          </aside>
        </section>
      </section>
    </main>
  );
}

export default TravelItinerary;
