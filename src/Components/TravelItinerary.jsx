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
  'Book museum entries for the first afternoon so the first morning stays flexible.',
  'Keep one open block each day for a cafe, viewpoint, or local market you discover on the ground.',
  'Carry a small day bag with water, charger, and cash for transit or street food stops.',
];

const formatDate = (value) => {
  if (!value) return 'TBD';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${value}T12:00:00`));
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
  const third = interests[2] || 'Scenic walks';

  return [
    {
      time: '08:30',
      title: 'Arrive and reset',
      detail: `Check in, unpack, and settle into a neighborhood stroll around ${destination}.`,
    },
    {
      time: '12:00',
      title: `${primary} anchor`,
      detail: `Book one headline ${primary.toLowerCase()} experience early so the trip has a clear signature moment.`,
    },
    {
      time: '15:30',
      title: `${secondary} stop`,
      detail: `Pair a relaxed lunch with a ${secondary.toLowerCase()} stop that keeps the pace balanced.`,
    },
    {
      time: '19:00',
      title: `${third} evening`,
      detail: 'Reserve sunset time for a viewpoint, waterfront walk, or live local performance.',
    },
  ];
};

function TravelItinerary({ tripData, onEditPlan, onLogout, onBackToMenu }) {
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
              A polished trip board for {departureCity} with {tripLength} days of focused, flexible planning.
            </p>
          </div>

          <div className="topbar-actions">
            <button className="ghost-button" type="button" onClick={onBackToMenu}>
              Menu
            </button>
            <button className="ghost-button" type="button" onClick={onEditPlan}>
              Edit plan
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
              great meals, and room to breathe between highlights.
            </p>

            <div className="chip-row">
              <span className="pill">{formatDate(trip.startDate)} - {formatDate(trip.endDate)}</span>
              <span className="pill">From {departureCity}</span>
              <span className="pill">{BUDGET_LABELS[trip.budget] || 'Custom budget'}</span>
            </div>
          </div>

          <div className="hero-aside">
            <div className="metric-card accent-card">
              <span className="metric-label">Length</span>
              <strong>{tripLength} days</strong>
              <p>Enough time for a headline experience and a slow afternoon.</p>
            </div>
            <div className="metric-card">
              <span className="metric-label">Focus</span>
              <strong>{interests[0]}</strong>
              <p>Primary travel theme that shapes the daily rhythm.</p>
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
                <span className="section-badge">Curated by TrippyAI</span>
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
                  <li>Museum or landmark entry for the first full day</li>
                  <li>One dinner reservation with a strong local menu</li>
                  <li>Transit pass or airport transfer before arrival</li>
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
              <p>
                Keep this balance in the itinerary so the trip feels intentional instead of overpacked.
              </p>
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
                <li>Airport transfer and hotel drop-off</li>
                <li>Old town or central district orientation walk</li>
                <li>One sunset viewpoint and one late meal</li>
                <li>Open morning for a cafe or slow start</li>
              </ul>
            </article>
          </aside>
        </section>
      </section>
    </main>
  );
}

export default TravelItinerary;